import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
  RosterAssetMove,
  RosterTransactionType,
} from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings, type LeagueSettingsV1 } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  assetLockPath,
  auditPath,
  auditPrivatePath,
  commandPath,
  createOnlyWrite,
  deleteWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  normalizeReceipt,
  receiptRecord,
  record,
  replaceWrite,
  rosterTransactionPath,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type RosterCommandType = "apply_roster_transaction" | "reverse_roster_transaction";

type RosterContext = {
  season: LeagueCommandStoredDocument;
  settings: LeagueSettingsV1;
  settingsVersionId: string;
  revision: number;
  teams: LeagueCommandStoredDocument[];
};

const DIRECT_COMMISSIONER_TYPES = new Set<RosterTransactionType>(["commissioner_add_drop", "roster_correction"]);

function roleActive(document: LeagueCommandStoredDocument, processedAt: string) {
  if (text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(processedAt)) return false;
  const expiresAt = Date.parse(text(document.data.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt);
}

async function rosterContext(input: {
  command: LeagueCommand<RosterCommandType>;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<RosterContext> {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) {
    throw new LeagueCommandFailure("invalid_native_context", "Roster transactions require a canonical GameHQ league and season.");
  }
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_roster_required", "This league is not using native GameHQ rosters.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId || text(league.data.current_season_id) !== command.seasonId) {
    throw new LeagueCommandFailure("season_changed", "The active native season changed. Refresh before editing a roster.", 409);
  }
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `The league changed after you opened it. The current revision is ${revision}.`, 409, revision);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active GameHQ league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant))
    .filter((grant) => text(grant.data.user_id) === actorUserId && roleActive(grant, processedAt));
  if (!grants.some((grant) => ["commissioner", "co_commissioner"].includes(text(grant.data.role)))) {
    throw new LeagueCommandFailure("permission_denied", "A current commissioner role is required for direct roster corrections.", 403);
  }
  const settingsVersionId = text(season.data.settings_version_id);
  const settingsVersion = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null;
  if (!settingsVersion || text(settingsVersion.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Publish league rules before changing native rosters.", 409);
  const parsed = parseLeagueSettings(settingsVersion.data.settings);
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The published rules cannot validate this roster transaction.", 409);
  return {
    season,
    settings: parsed.settings,
    settingsVersionId,
    revision,
    teams: teams.filter((team) => text(team.data.status) !== "retired"),
  };
}

function validAssetId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value);
}

function normalizeMoves(value: unknown): RosterAssetMove[] {
  const rows = Array.isArray(value) ? value : [];
  if (!rows.length || rows.length > 64) throw new LeagueCommandFailure("invalid_roster_moves", "Provide between 1 and 64 roster asset moves.");
  const moves = rows.map((rowValue) => {
    const row = record(rowValue);
    const assetType = text(row.assetType);
    const assetId = text(row.assetId);
    const fromFranchiseId = text(row.fromFranchiseId) || null;
    const toFranchiseId = text(row.toFranchiseId) || null;
    if (assetType !== "player" || !validAssetId(assetId)) throw new LeagueCommandFailure("invalid_roster_asset", "This phase accepts valid player assets only.");
    if ((!fromFranchiseId && !toFranchiseId) || fromFranchiseId === toFranchiseId) throw new LeagueCommandFailure("invalid_roster_move", "Each player must move between different ownership states.");
    if ([fromFranchiseId, toFranchiseId].some((id) => id?.includes("/"))) throw new LeagueCommandFailure("invalid_franchise", "A roster move contains an invalid franchise.");
    return { assetType: "player" as const, assetId, fromFranchiseId, toFranchiseId };
  });
  if (new Set(moves.map((move) => `${move.assetType}:${move.assetId}`)).size !== moves.length) {
    throw new LeagueCommandFailure("duplicate_roster_asset", "A player can appear only once in one roster transaction.");
  }
  return moves;
}

function rosterSize(settings: LeagueSettingsV1) {
  return settings.rosterSlots.filter((slot) => slot.slot !== "IR").reduce((sum, slot) => sum + slot.count, 0);
}

function groupAssets(moves: RosterAssetMove[], key: "fromFranchiseId" | "toFranchiseId") {
  const grouped = new Map<string, Array<{ type: "player"; id: string; amount: null; metadata: Record<string, never> }>>();
  for (const move of moves) {
    const franchiseId = move[key];
    if (!franchiseId) continue;
    const assets = grouped.get(franchiseId) ?? [];
    assets.push({ type: "player", id: move.assetId, amount: null, metadata: {} });
    grouped.set(franchiseId, assets);
  }
  return [...grouped.entries()].map(([franchise_id, assets]) => ({ franchise_id, assets }));
}

async function prepareRosterMutation(input: {
  store: LeagueCommandStore;
  command: LeagueCommand<RosterCommandType>;
  context: RosterContext;
  moves: RosterAssetMove[];
  transactionId: string;
  processedAt: string;
}) {
  const { store, command, context, moves, transactionId, processedAt } = input;
  const teamById = new Map(context.teams.map((team) => [text(team.data.franchise_id) || text(team.data.id), team]));
  const involvedIds = new Set(moves.flatMap((move) => [move.fromFranchiseId, move.toFranchiseId]).filter((id): id is string => Boolean(id)));
  for (const franchiseId of involvedIds) {
    if (!teamById.has(franchiseId)) throw new LeagueCommandFailure("team_not_found", "A roster move references an inactive or missing team.", 404);
  }
  const locks = await Promise.all(moves.map((move) => store.get(assetLockPath(command.leagueId, command.seasonId, move.assetType, move.assetId))));
  const rosterSets = new Map([...teamById].map(([id, team]) => [id, new Set(stringList(team.data.roster_player_ids))]));
  const beforeRosterRevisions: Record<string, number> = {};
  const afterRosterRevisions: Record<string, number> = {};

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index]!;
    const lock = locks[index] ?? null;
    const currentOwner = text(lock?.data.franchise_id) || null;
    const rosterOwners = [...rosterSets].filter(([, players]) => players.has(move.assetId)).map(([franchiseId]) => franchiseId);
    if (rosterOwners.length > 1 || (currentOwner && !rosterOwners.includes(currentOwner)) || (!currentOwner && rosterOwners.length)) {
      throw new LeagueCommandFailure("roster_ownership_inconsistent", `Player ${move.assetId} has inconsistent ownership. No roster changed.`, 409);
    }
    if (currentOwner !== move.fromFranchiseId) {
      throw new LeagueCommandFailure("asset_ownership_changed", `Player ${move.assetId} is no longer owned by the expected team.`, 409);
    }
    if (move.fromFranchiseId) rosterSets.get(move.fromFranchiseId)!.delete(move.assetId);
    if (move.toFranchiseId) rosterSets.get(move.toFranchiseId)!.add(move.assetId);
  }

  const capacity = rosterSize(context.settings);
  for (const franchiseId of involvedIds) {
    const team = teamById.get(franchiseId)!;
    const currentRevision = Math.max(1, wholeNumber(team.data.roster_revision, 1));
    if ((rosterSets.get(franchiseId)?.size ?? 0) > capacity) throw new LeagueCommandFailure("roster_full", `${text(team.data.name) || "A team"} would exceed its ${capacity}-player active roster.`, 409);
    beforeRosterRevisions[franchiseId] = currentRevision;
    afterRosterRevisions[franchiseId] = currentRevision + 1;
  }

  const writes: FirestoreWrite[] = [...involvedIds].map((franchiseId) => {
    const team = teamById.get(franchiseId)!;
    return replaceWrite(store, team, `leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams/${franchiseId}`, {
      ...team.data,
      roster_player_ids: [...(rosterSets.get(franchiseId) ?? [])].sort(),
      roster_revision: afterRosterRevisions[franchiseId],
      updated_at: processedAt,
    });
  });

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index]!;
    const lock = locks[index] ?? null;
    const path = assetLockPath(command.leagueId, command.seasonId, move.assetType, move.assetId);
    if (!move.toFranchiseId) {
      if (!lock) throw new LeagueCommandFailure("asset_ownership_changed", `Player ${move.assetId} is already unowned.`, 409);
      writes.push(deleteWrite(store, lock, path));
      continue;
    }
    writes.push(replaceWrite(store, lock, path, {
      schema_version: 1,
      id: `${move.assetType}__${move.assetId}`,
      league_id: command.leagueId,
      season_id: command.seasonId,
      asset_type: move.assetType,
      asset_id: move.assetId,
      franchise_id: move.toFranchiseId,
      roster_transaction_id: transactionId,
      roster_revision: afterRosterRevisions[move.toFranchiseId],
      revision: Math.max(0, wholeNumber(lock?.data.revision)) + 1,
      updated_at: processedAt,
    }));
  }
  return { writes, beforeRosterRevisions, afterRosterRevisions };
}

function transactionRecord(input: {
  command: LeagueCommand<RosterCommandType>;
  transactionId: string;
  transactionType: string;
  moves: RosterAssetMove[];
  actorUserId: string;
  processedAt: string;
  settingsVersionId: string;
  auditEventId: string;
  beforeRosterRevisions: Record<string, number>;
  afterRosterRevisions: Record<string, number>;
  reversalOfTransactionId?: string;
}) {
  return {
    schema_version: 1,
    id: input.transactionId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    transaction_type: input.transactionType,
    moves: input.moves,
    assets_leaving: groupAssets(input.moves, "fromFranchiseId"),
    assets_entering: groupAssets(input.moves, "toFranchiseId"),
    effective_at: input.processedAt,
    source_command_id: input.command.commandId,
    settings_version_id: input.settingsVersionId,
    actor_user_id: input.actorUserId,
    approval_state: "accepted",
    review_state: "not_required",
    before_roster_revisions: input.beforeRosterRevisions,
    after_roster_revisions: input.afterRosterRevisions,
    audit_event_id: input.auditEventId,
    reversal_of_transaction_id: input.reversalOfTransactionId ?? "",
    reversed_by_transaction_id: "",
    created_at: input.processedAt,
    updated_at: input.processedAt,
  };
}

function auditRecord(input: {
  command: LeagueCommand<RosterCommandType>;
  auditEventId: string;
  transactionId: string;
  actorUserId: string;
  processedAt: string;
  context: RosterContext;
  moves: RosterAssetMove[];
  beforeRosterRevisions: Record<string, number>;
  afterRosterRevisions: Record<string, number>;
  summary: string;
  reversalOfAuditEventId?: string;
}) {
  return {
    schema_version: 1,
    id: input.auditEventId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    actor_user_id: input.actorUserId,
    action: input.command.commandType,
    target: { type: "roster_transaction", id: input.transactionId },
    timestamp: input.processedAt,
    previous_revision: input.context.revision,
    resulting_revision: input.context.revision + 1,
    before: { roster_revisions: input.beforeRosterRevisions },
    after: { roster_revisions: input.afterRosterRevisions },
    material_differences: { moves: input.moves },
    reason: input.command.reason,
    settings_version_id: input.context.settingsVersionId,
    command_id: input.command.commandId,
    transaction_id: input.transactionId,
    public_summary: input.summary,
    private_metadata: {},
    reversal_of_audit_event_id: input.reversalOfAuditEventId ?? "",
  };
}

function receipt(input: {
  command: LeagueCommand<RosterCommandType>;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  context: RosterContext;
  transactionId: string;
  auditEventId: string;
  result: Record<string, unknown>;
}): LeagueCommandReceipt {
  return {
    commandId: input.command.commandId,
    commandType: input.command.commandType,
    actorUserId: input.actorUserId,
    leagueId: input.command.leagueId,
    seasonId: input.command.seasonId,
    status: "accepted",
    previousRevision: input.context.revision,
    resultingRevision: input.context.revision + 1,
    auditEventId: input.auditEventId,
    serverProcessedAt: input.processedAt,
    requestHash: input.requestHash,
    result: { transactionId: input.transactionId, ...input.result },
    error: null,
  };
}

function seasonWrite(store: LeagueCommandStore, command: LeagueCommand<RosterCommandType>, context: RosterContext, processedAt: string) {
  return replaceWrite(store, context.season, `leagues/${command.leagueId}/seasons/${command.seasonId}`, {
    ...context.season.data,
    revision: context.revision + 1,
    updated_at: processedAt,
  });
}

function pipelineHookWrites(input: {
  store: LeagueCommandStore;
  command: LeagueCommand<RosterCommandType>;
  transactionId: string;
  processedAt: string;
}) {
  const { store, command, transactionId, processedAt } = input;
  return [
    createOnlyWrite(store, `leagues/${command.leagueId}/notificationOutbox/notify-${command.commandId}`, {
      schema_version: 1,
      id: `notify-${command.commandId}`,
      league_id: command.leagueId,
      season_id: command.seasonId,
      command_id: command.commandId,
      transaction_id: transactionId,
      event_type: command.commandType,
      audience: ["league_members"],
      status: "pending",
      created_at: processedAt,
    }),
    createOnlyWrite(store, `leagues/${command.leagueId}/readModelInvalidations/invalidate-${command.commandId}`, {
      schema_version: 1,
      id: `invalidate-${command.commandId}`,
      league_id: command.leagueId,
      season_id: command.seasonId,
      command_id: command.commandId,
      transaction_id: transactionId,
      targets: ["league_home", "team_roster", "transactions"],
      status: "pending",
      created_at: processedAt,
    }),
  ];
}

async function commitRosterCommand(input: {
  store: LeagueCommandStore;
  command: LeagueCommand<RosterCommandType>;
  context: RosterContext;
  actorUserId: string;
  requestHash: string;
  writes: FirestoreWrite[];
}) {
  try {
    await input.store.commit(input.writes);
  } catch (error) {
    const winner = normalizeReceipt(await input.store.get(commandPath(input.command.leagueId, input.command.commandId)));
    if (winner?.requestHash === input.requestHash && winner.actorUserId === input.actorUserId) return winner;
    const latest = await input.store.get(`leagues/${input.command.leagueId}/seasons/${input.command.seasonId}`);
    const latestRevision = Math.max(1, wholeNumber(latest?.data.revision, 1));
    if (latestRevision !== input.context.revision) throw new LeagueCommandFailure("stale_revision", `The league changed while this roster transaction was processing. The current revision is ${latestRevision}.`, 409, latestRevision);
    throw error;
  }
  return null;
}

export async function executeApplyRosterTransaction(input: {
  command: LeagueCommand<"apply_roster_transaction">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await rosterContext({ command, actorUserId, processedAt, store });
  const transactionType = text(command.payload.transactionType) as RosterTransactionType;
  if (!DIRECT_COMMISSIONER_TYPES.has(transactionType)) throw new LeagueCommandFailure("invalid_direct_transaction_type", "Direct commissioner roster commands must be an add/drop or correction.");
  if (command.reason.trim().length < 5) throw new LeagueCommandFailure("reason_required", "Enter a clear audit reason before changing a roster.");
  const moves = normalizeMoves(command.payload.moves);
  const transactionId = `tx-${command.commandId}`;
  const auditEventId = `audit-${command.commandId}`;
  const mutation = await prepareRosterMutation({ store, command, context, moves, transactionId, processedAt });
  const acceptedReceipt = receipt({ command, actorUserId, requestHash, processedAt, context, transactionId, auditEventId, result: { transactionType, moves } });
  const writes: FirestoreWrite[] = [
    ...mutation.writes,
    seasonWrite(store, command, context, processedAt),
    createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, transactionId), transactionRecord({ command, transactionId, transactionType, moves, actorUserId, processedAt, settingsVersionId: context.settingsVersionId, auditEventId, beforeRosterRevisions: mutation.beforeRosterRevisions, afterRosterRevisions: mutation.afterRosterRevisions })),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({ command, auditEventId, transactionId, actorUserId, processedAt, context, moves, beforeRosterRevisions: mutation.beforeRosterRevisions, afterRosterRevisions: mutation.afterRosterRevisions, summary: `A commissioner applied ${moves.length} audited roster ${moves.length === 1 ? "move" : "moves"}.` })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditEventId), { schema_version: 1, id: auditEventId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, transaction_id: transactionId, reason: command.reason, source: "commissioner_roster_command", created_at: processedAt }),
    ...pipelineHookWrites({ store, command, transactionId, processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(acceptedReceipt)),
  ];
  const winner = await commitRosterCommand({ store, command, context, actorUserId, requestHash, writes });
  return winner ?? acceptedReceipt;
}

export async function executeReverseRosterTransaction(input: {
  command: LeagueCommand<"reverse_roster_transaction">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await rosterContext({ command, actorUserId, processedAt, store });
  if (command.reason.trim().length < 5) throw new LeagueCommandFailure("reason_required", "Enter a clear audit reason before reversing a roster transaction.");
  const originalId = text(command.payload.transactionId);
  if (!originalId.startsWith("tx-") || originalId.includes("/")) throw new LeagueCommandFailure("invalid_transaction", "Choose a valid roster transaction to reverse.");
  const originalPath = rosterTransactionPath(command.leagueId, command.seasonId, originalId);
  const original = await store.get(originalPath);
  if (!original || text(original.data.league_id) !== command.leagueId || text(original.data.season_id) !== command.seasonId) throw new LeagueCommandFailure("transaction_not_found", "That roster transaction is unavailable.", 404);
  if (text(original.data.reversed_by_transaction_id) || text(original.data.approval_state) === "reversed") throw new LeagueCommandFailure("transaction_already_reversed", "That roster transaction has already been reversed.", 409);
  const originalMoves = normalizeMoves(original.data.moves);
  const moves = originalMoves.map((move) => ({ ...move, fromFranchiseId: move.toFranchiseId, toFranchiseId: move.fromFranchiseId }));
  const transactionId = `tx-${command.commandId}`;
  const auditEventId = `audit-${command.commandId}`;
  const mutation = await prepareRosterMutation({ store, command, context, moves, transactionId, processedAt });
  const acceptedReceipt = receipt({ command, actorUserId, requestHash, processedAt, context, transactionId, auditEventId, result: { transactionType: "reversal", reversalOfTransactionId: originalId, moves } });
  const originalAuditEventId = text(original.data.audit_event_id);
  const writes: FirestoreWrite[] = [
    ...mutation.writes,
    seasonWrite(store, command, context, processedAt),
    replaceWrite(store, original, originalPath, { ...original.data, approval_state: "reversed", reversed_by_transaction_id: transactionId, updated_at: processedAt }),
    createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, transactionId), transactionRecord({ command, transactionId, transactionType: "reversal", moves, actorUserId, processedAt, settingsVersionId: context.settingsVersionId, auditEventId, beforeRosterRevisions: mutation.beforeRosterRevisions, afterRosterRevisions: mutation.afterRosterRevisions, reversalOfTransactionId: originalId })),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({ command, auditEventId, transactionId, actorUserId, processedAt, context, moves, beforeRosterRevisions: mutation.beforeRosterRevisions, afterRosterRevisions: mutation.afterRosterRevisions, summary: `Roster transaction ${originalId} was reversed with an audit reason.`, reversalOfAuditEventId: originalAuditEventId })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditEventId), { schema_version: 1, id: auditEventId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, transaction_id: transactionId, reason: command.reason, source: "commissioner_roster_reversal", created_at: processedAt }),
    ...pipelineHookWrites({ store, command, transactionId, processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(acceptedReceipt)),
  ];
  const winner = await commitRosterCommand({ store, command, context, actorUserId, requestHash, writes });
  return winner ?? acceptedReceipt;
}
