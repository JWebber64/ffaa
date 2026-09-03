import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
  NativeDraftAction,
  NativeDraftFormat,
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
  nativeDraftPath,
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

type NativeDraftCommandType =
  | "create_native_draft"
  | "start_native_draft"
  | "apply_native_draft_action"
  | "revert_native_draft_action";

type DraftContext = {
  league: LeagueCommandStoredDocument;
  season: LeagueCommandStoredDocument;
  settings: LeagueSettingsV1;
  settingsVersionId: string;
  revision: number;
  teams: LeagueCommandStoredDocument[];
  isCommissioner: boolean;
  managerFranchiseIds: Set<string>;
};

type DraftSelection = {
  id: string;
  player_id: string;
  franchise_id: string;
  overall_pick: number;
  round: number;
  price: number;
  roster_transaction_id: string;
  selected_at: string;
  source: "pick" | "autopick" | "auction";
};

function roleActive(document: LeagueCommandStoredDocument, processedAt: string) {
  if (text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(processedAt)) return false;
  const expiresAt = Date.parse(text(document.data.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt);
}

async function draftContext(input: {
  command: LeagueCommand<NativeDraftCommandType>;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}) {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) {
    throw new LeagueCommandFailure("invalid_native_context", "Native drafts require a canonical GameHQ league and season.");
  }
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_draft_required", "This league is not using native GameHQ authority.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId || text(league.data.current_season_id) !== command.seasonId) {
    throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before continuing the draft.", 409);
  }
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `The league changed after you opened the draft. The current revision is ${revision}.`, 409, revision);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active GameHQ league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant))
    .filter((grant) => text(grant.data.user_id) === actorUserId && roleActive(grant, processedAt));
  const isCommissioner = grants.some((grant) => ["commissioner", "co_commissioner"].includes(text(grant.data.role)));
  const managerFranchiseIds = new Set(grants
    .filter((grant) => ["team_owner", "co_manager"].includes(text(grant.data.role)))
    .map((grant) => text(grant.data.franchise_id))
    .filter(Boolean));
  const settingsVersionId = text(season.data.settings_version_id);
  const settingsVersion = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null;
  if (!settingsVersion || text(settingsVersion.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Publish league rules before creating a native draft.", 409);
  const parsed = parseLeagueSettings(settingsVersion.data.settings);
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The published rules cannot configure this native draft.", 409);
  return {
    league,
    season,
    settings: parsed.settings,
    settingsVersionId,
    revision,
    teams: teams.filter((team) => text(team.data.status) !== "retired").sort((left, right) => wholeNumber(left.data.draft_position) - wholeNumber(right.data.draft_position)),
    isCommissioner,
    managerFranchiseIds,
  } satisfies DraftContext;
}

function rosterSize(settings: LeagueSettingsV1) {
  return settings.rosterSlots.filter((slot) => slot.slot !== "IR").reduce((sum, slot) => sum + slot.count, 0);
}

function validPlayerId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value);
}

function mapList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function selectionList(value: unknown): DraftSelection[] {
  return mapList(value).map((entry) => ({
    id: text(entry.id),
    player_id: text(entry.player_id),
    franchise_id: text(entry.franchise_id),
    overall_pick: wholeNumber(entry.overall_pick),
    round: wholeNumber(entry.round),
    price: Math.max(0, wholeNumber(entry.price)),
    roster_transaction_id: text(entry.roster_transaction_id),
    selected_at: text(entry.selected_at),
    source: (["pick", "autopick", "auction"].includes(text(entry.source)) ? text(entry.source) : "pick") as DraftSelection["source"],
  }));
}

function currentFranchise(format: NativeDraftFormat, order: string[], overallPick: number) {
  const teamCount = order.length;
  if (!teamCount) return "";
  const round = Math.floor((Math.max(1, overallPick) - 1) / teamCount) + 1;
  const offset = (Math.max(1, overallPick) - 1) % teamCount;
  if (format === "auction" || format === "linear") return order[offset] ?? "";
  const reverse = format === "snake"
    ? round % 2 === 0
    : round === 2 || (round >= 3 && round % 2 === 1);
  return order[reverse ? teamCount - offset - 1 : offset] ?? "";
}

function requireCommissioner(context: DraftContext) {
  if (!context.isCommissioner) throw new LeagueCommandFailure("permission_denied", "A current commissioner or co-commissioner role is required.", 403);
}

function mayActFor(context: DraftContext, franchiseId: string) {
  return context.isCommissioner || context.managerFranchiseIds.has(franchiseId);
}

function draftAudit(input: {
  command: LeagueCommand<NativeDraftCommandType>;
  context: DraftContext;
  actorUserId: string;
  processedAt: string;
  draftId: string;
  action: string;
  auditId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  transactionId?: string;
}) {
  return {
    schema_version: 1,
    id: input.auditId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    actor_user_id: input.actorUserId,
    action: input.action,
    target: { type: "native_draft", id: input.draftId },
    timestamp: input.processedAt,
    previous_revision: input.context.revision,
    resulting_revision: input.context.revision + 1,
    before: input.before,
    after: input.after,
    material_differences: { draft_id: input.draftId, action: input.action },
    reason: input.command.reason,
    settings_version_id: input.context.settingsVersionId,
    command_id: input.command.commandId,
    transaction_id: input.transactionId ?? "",
    public_summary: `Native draft action recorded: ${input.action.replace(/_/gu, " ")}.`,
    private_metadata: {},
    reversal_of_audit_event_id: "",
  };
}

function commandReceipt(input: {
  command: LeagueCommand<NativeDraftCommandType>;
  context: DraftContext;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  auditId: string;
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
    auditEventId: input.auditId,
    serverProcessedAt: input.processedAt,
    requestHash: input.requestHash,
    result: input.result,
    error: null,
  };
}

function seasonWrite(input: { store: LeagueCommandStore; command: LeagueCommand<NativeDraftCommandType>; context: DraftContext; processedAt: string; changes?: Record<string, unknown> }) {
  return replaceWrite(input.store, input.context.season, `leagues/${input.command.leagueId}/seasons/${input.command.seasonId}`, {
    ...input.context.season.data,
    ...input.changes,
    revision: input.context.revision + 1,
    updated_at: input.processedAt,
  });
}

function pipelineWrites(input: { store: LeagueCommandStore; command: LeagueCommand<NativeDraftCommandType>; draftId: string; processedAt: string; transactionId?: string }) {
  return [
    createOnlyWrite(input.store, `leagues/${input.command.leagueId}/notificationOutbox/notify-${input.command.commandId}`, {
      schema_version: 1,
      id: `notify-${input.command.commandId}`,
      league_id: input.command.leagueId,
      season_id: input.command.seasonId,
      command_id: input.command.commandId,
      draft_id: input.draftId,
      transaction_id: input.transactionId ?? "",
      event_type: input.command.commandType,
      audience: ["league_members"],
      status: "pending",
      created_at: input.processedAt,
    }),
    createOnlyWrite(input.store, `leagues/${input.command.leagueId}/readModelInvalidations/invalidate-${input.command.commandId}`, {
      schema_version: 1,
      id: `invalidate-${input.command.commandId}`,
      league_id: input.command.leagueId,
      season_id: input.command.seasonId,
      command_id: input.command.commandId,
      draft_id: input.draftId,
      transaction_id: input.transactionId ?? "",
      targets: ["league_home", "native_draft", "team_roster", "transactions"],
      status: "pending",
      created_at: input.processedAt,
    }),
  ];
}

function spectatorSharePath(code: string) {
  return `nativeDraftShares/${code}`;
}

function spectatorState(draft: Record<string, unknown>) {
  const { queues: _queues, action_log: _actionLog, created_by: _createdBy, ...publicState } = draft;
  return publicState;
}

async function spectatorShareWrite(store: LeagueCommandStore, draft: Record<string, unknown>) {
  if (!draft.spectator_enabled || !text(draft.spectator_code)) return null;
  const path = spectatorSharePath(text(draft.spectator_code));
  const existing = await store.get(path);
  return replaceWrite(store, existing, path, {
    schema_version: 1,
    share_token: text(draft.spectator_code),
    league_id: text(draft.league_id),
    season_id: text(draft.season_id),
    draft_id: text(draft.id),
    state: spectatorState(draft),
    updated_at: text(draft.updated_at),
  });
}

async function commitDraft(input: {
  store: LeagueCommandStore;
  command: LeagueCommand<NativeDraftCommandType>;
  context: DraftContext;
  requestHash: string;
  actorUserId: string;
  writes: FirestoreWrite[];
}) {
  try {
    await input.store.commit(input.writes);
  } catch (error) {
    const winner = normalizeReceipt(await input.store.get(commandPath(input.command.leagueId, input.command.commandId)));
    if (winner?.requestHash === input.requestHash && winner.actorUserId === input.actorUserId) return winner;
    const latest = await input.store.get(`leagues/${input.command.leagueId}/seasons/${input.command.seasonId}`);
    const revision = Math.max(1, wholeNumber(latest?.data.revision, 1));
    if (revision !== input.context.revision) throw new LeagueCommandFailure("stale_revision", `The league changed while this draft action was processing. The current revision is ${revision}.`, 409, revision);
    throw error;
  }
  return null;
}

function finalStatus(draft: Record<string, unknown>, rosterCapacity: number) {
  const teamCount = stringList(draft.order_franchise_ids).length;
  return selectionList(draft.selections).length >= teamCount * rosterCapacity ? "complete" : text(draft.status);
}

function draftActionLog(input: { command: LeagueCommand<NativeDraftCommandType>; actorUserId: string; processedAt: string; action: string; franchiseId?: string; playerId?: string; amount?: number; transactionId?: string }) {
  return {
    id: input.command.commandId,
    action: input.action,
    actor_user_id: input.actorUserId,
    franchise_id: input.franchiseId ?? "",
    player_id: input.playerId ?? "",
    amount: input.amount ?? 0,
    roster_transaction_id: input.transactionId ?? "",
    timestamp: input.processedAt,
    reverted: false,
  };
}

function maxAuctionBid(draft: Record<string, unknown>, franchiseId: string) {
  const team = mapList(draft.team_states).find((row) => text(row.franchise_id) === franchiseId);
  if (!team) return 0;
  const rosterCapacity = Math.max(1, wholeNumber(draft.roster_size, 1));
  const picks = Math.max(0, wholeNumber(team.picks));
  const unfilledAfterWin = Math.max(0, rosterCapacity - picks - 1);
  return Math.max(0, wholeNumber(team.budget) - wholeNumber(team.spent) - unfilledAfterWin * Math.max(1, wholeNumber(draft.minimum_bid, 1)));
}

function rosterTransaction(input: {
  command: LeagueCommand<NativeDraftCommandType>;
  context: DraftContext;
  actorUserId: string;
  processedAt: string;
  transactionId: string;
  auditId: string;
  franchiseId: string;
  playerId: string;
  beforeRosterRevision: number;
  afterRosterRevision: number;
  type: "draft_selection" | "auction_win";
  draftId: string;
  price: number;
}) {
  const asset = { type: "player", id: input.playerId, amount: null, metadata: { draft_id: input.draftId, price: input.price } };
  return {
    schema_version: 1,
    id: input.transactionId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    transaction_type: input.type,
    moves: [{ assetType: "player", assetId: input.playerId, fromFranchiseId: null, toFranchiseId: input.franchiseId }],
    assets_leaving: [],
    assets_entering: [{ franchise_id: input.franchiseId, assets: [asset] }],
    effective_at: input.processedAt,
    source_command_id: input.command.commandId,
    settings_version_id: input.context.settingsVersionId,
    actor_user_id: input.actorUserId,
    approval_state: "accepted",
    review_state: "not_required",
    before_roster_revisions: { [input.franchiseId]: input.beforeRosterRevision },
    after_roster_revisions: { [input.franchiseId]: input.afterRosterRevision },
    audit_event_id: input.auditId,
    reversal_of_transaction_id: "",
    reversed_by_transaction_id: "",
    draft_id: input.draftId,
    draft_price: input.price,
    created_at: input.processedAt,
    updated_at: input.processedAt,
  };
}

async function acquisitionWrites(input: {
  store: LeagueCommandStore;
  command: LeagueCommand<NativeDraftCommandType>;
  context: DraftContext;
  actorUserId: string;
  processedAt: string;
  draftId: string;
  franchiseId: string;
  playerId: string;
  price: number;
  source: DraftSelection["source"];
  overallPick: number;
  auditId: string;
}) {
  const team = input.context.teams.find((candidate) => (text(candidate.data.franchise_id) || text(candidate.data.id)) === input.franchiseId);
  if (!team) throw new LeagueCommandFailure("team_not_found", "The draft team no longer exists.", 404);
  const players = new Set(stringList(team.data.roster_player_ids));
  if (players.has(input.playerId)) throw new LeagueCommandFailure("player_already_rostered", "That player is already on this team.", 409);
  if (players.size >= rosterSize(input.context.settings)) throw new LeagueCommandFailure("roster_full", "That team's draft roster is already full.", 409);
  const lockPath = assetLockPath(input.command.leagueId, input.command.seasonId, "player", input.playerId);
  if (await input.store.get(lockPath)) throw new LeagueCommandFailure("player_unavailable", "That player is already owned in this native season.", 409);
  players.add(input.playerId);
  const beforeRosterRevision = Math.max(1, wholeNumber(team.data.roster_revision, 1));
  const afterRosterRevision = beforeRosterRevision + 1;
  const transactionId = `tx-${input.command.commandId}`;
  const round = Math.floor((input.overallPick - 1) / input.context.teams.length) + 1;
  const selection: DraftSelection = {
    id: input.command.commandId,
    player_id: input.playerId,
    franchise_id: input.franchiseId,
    overall_pick: input.overallPick,
    round,
    price: input.price,
    roster_transaction_id: transactionId,
    selected_at: input.processedAt,
    source: input.source,
  };
  return {
    transactionId,
    selection,
    writes: [
      replaceWrite(input.store, team, team.path, { ...team.data, roster_player_ids: [...players].sort(), roster_revision: afterRosterRevision, updated_at: input.processedAt }),
      createOnlyWrite(input.store, lockPath, {
        schema_version: 1,
        id: `player__${input.playerId}`,
        league_id: input.command.leagueId,
        season_id: input.command.seasonId,
        asset_type: "player",
        asset_id: input.playerId,
        franchise_id: input.franchiseId,
        roster_transaction_id: transactionId,
        roster_revision: afterRosterRevision,
        revision: 1,
        updated_at: input.processedAt,
      }),
      createOnlyWrite(input.store, rosterTransactionPath(input.command.leagueId, input.command.seasonId, transactionId), rosterTransaction({
        ...input,
        transactionId,
        beforeRosterRevision,
        afterRosterRevision,
        type: input.source === "auction" ? "auction_win" : "draft_selection",
      })),
    ] satisfies FirestoreWrite[],
  };
}

function updatedTeamStates(draft: Record<string, unknown>, franchiseId: string, price: number, delta: 1 | -1) {
  return mapList(draft.team_states).map((team) => text(team.franchise_id) === franchiseId ? {
    ...team,
    picks: Math.max(0, wholeNumber(team.picks) + delta),
    spent: Math.max(0, wholeNumber(team.spent) + price * delta),
  } : team);
}

export async function executeCreateNativeDraft(input: {
  command: LeagueCommand<"create_native_draft">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await draftContext({ command, actorUserId, processedAt, store });
  requireCommissioner(context);
  if (context.teams.length !== context.settings.teamCount) throw new LeagueCommandFailure("teams_required", "Provision every team slot before creating the draft.", 409);
  if (context.teams.some((team) => stringList(team.data.roster_player_ids).length)) throw new LeagueCommandFailure("rosters_not_empty", "A new native draft requires empty authoritative rosters.", 409);
  const format = text(command.payload.format) as NativeDraftFormat;
  if (!["auction", "snake", "linear", "third_round_reversal"].includes(format)) throw new LeagueCommandFailure("invalid_draft_format", "Choose a supported native draft format.");
  if ((context.settings.draft.format === "auction") !== (format === "auction")) throw new LeagueCommandFailure("draft_format_mismatch", "The native draft format must match the published rulebook.", 409);
  const mode = text(command.payload.mode);
  if (!["live", "slow"].includes(mode)) throw new LeagueCommandFailure("invalid_draft_mode", "Choose live or slow draft mode.");
  const teamIds = context.teams.map((team) => text(team.data.franchise_id) || text(team.data.id));
  const requestedOrder = stringList(command.payload.draftOrderFranchiseIds);
  const order = requestedOrder.length ? requestedOrder : teamIds;
  if (order.length !== teamIds.length || new Set(order).size !== order.length || order.some((id) => !teamIds.includes(id))) {
    throw new LeagueCommandFailure("invalid_draft_order", "Draft order must contain every active franchise exactly once.");
  }
  const draftId = `draft-${command.commandId}`;
  const draftRevision = 1;
  const auditId = `audit-${command.commandId}`;
  const pickSeconds = mode === "slow" ? Math.max(900, Math.min(604800, wholeNumber(command.payload.pickSeconds, 86400))) : Math.max(15, Math.min(600, wholeNumber(command.payload.pickSeconds, context.settings.draft.pickSeconds)));
  const nominationSeconds = Math.max(10, Math.min(600, wholeNumber(command.payload.nominationSeconds, 30)));
  const bidSeconds = Math.max(5, Math.min(120, wholeNumber(command.payload.bidSeconds, 10)));
  const antiSnipeSeconds = Math.max(0, Math.min(bidSeconds, wholeNumber(command.payload.antiSnipeSeconds, Math.min(10, bidSeconds))));
  const budget = format === "auction" ? context.settings.draft.auctionBudget : 0;
  const draft = {
    schema_version: 1,
    id: draftId,
    league_id: command.leagueId,
    season_id: command.seasonId,
    settings_version_id: context.settingsVersionId,
    format,
    mode,
    status: "lobby",
    revision: draftRevision,
    season_revision: context.revision + 1,
    order_franchise_ids: order,
    roster_size: rosterSize(context.settings),
    pick_seconds: pickSeconds,
    nomination_seconds: nominationSeconds,
    bid_seconds: bidSeconds,
    anti_snipe_seconds: antiSnipeSeconds,
    minimum_bid: context.settings.draft.minimumBid,
    auction_budget: budget,
    spectator_enabled: Boolean(command.payload.spectatorEnabled),
    spectator_code: crypto.randomUUID(),
    team_states: order.map((franchiseId) => ({ franchise_id: franchiseId, budget, spent: 0, picks: 0 })),
    selections: [],
    action_log: [],
    queues: {},
    overall_pick: 1,
    current_franchise_id: order[0] ?? "",
    current_deadline_at: "",
    auction_state: {},
    created_by: actorUserId,
    created_at: processedAt,
    started_at: "",
    completed_at: "",
    updated_at: processedAt,
  };
  const receipt = commandReceipt({ command, context, actorUserId, requestHash, processedAt, auditId, result: { draftId, draftRevision, status: "lobby", spectatorCode: draft.spectator_code } });
  const shareWrite = await spectatorShareWrite(store, draft);
  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, nativeDraftPath(command.leagueId, command.seasonId, draftId), draft),
    ...(shareWrite ? [shareWrite] : []),
    seasonWrite({ store, command, context, processedAt, changes: { draft_id: draftId, phase: "draft" } }),
    createOnlyWrite(store, auditPath(command.leagueId, auditId), draftAudit({ command, context, actorUserId, processedAt, draftId, action: "native_draft_created", auditId, before: {}, after: { format, mode, status: "lobby" } })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditId), { schema_version: 1, id: auditId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, draft_id: draftId, reason: command.reason, source: "native_draft", created_at: processedAt }),
    ...pipelineWrites({ store, command, draftId, processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitDraft({ store, command, context, requestHash, actorUserId, writes });
  return winner ?? receipt;
}

export async function executeStartNativeDraft(input: {
  command: LeagueCommand<"start_native_draft">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await draftContext({ command, actorUserId, processedAt, store });
  requireCommissioner(context);
  const draftId = text(command.payload.draftId);
  const path = nativeDraftPath(command.leagueId, command.seasonId, draftId);
  const draftDocument = await store.get(path);
  if (!draftDocument || text(draftDocument.data.status) !== "lobby") throw new LeagueCommandFailure("draft_not_startable", "This native draft is not in its lobby.", 409);
  if (text(context.season.data.draft_id) !== draftId) throw new LeagueCommandFailure("draft_changed", "The active season points to a different draft.", 409);
  const draft = draftDocument.data;
  const current = currentFranchise(text(draft.format) as NativeDraftFormat, stringList(draft.order_franchise_ids), 1);
  const deadline = new Date(Date.parse(processedAt) + Math.max(1, wholeNumber(draft.pick_seconds, 60)) * 1000).toISOString();
  const next = { ...draft, status: "live", revision: Math.max(1, wholeNumber(draft.revision)) + 1, season_revision: context.revision + 1, current_franchise_id: current, current_deadline_at: deadline, started_at: processedAt, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "start" })] };
  const auditId = `audit-${command.commandId}`;
  const receipt = commandReceipt({ command, context, actorUserId, requestHash, processedAt, auditId, result: { draftId, draftRevision: next.revision, status: "live" } });
  const shareWrite = await spectatorShareWrite(store, next);
  const writes: FirestoreWrite[] = [
    replaceWrite(store, draftDocument, path, next),
    ...(shareWrite ? [shareWrite] : []),
    seasonWrite({ store, command, context, processedAt, changes: { phase: "draft", draft_id: draftId, draft_started_at: processedAt } }),
    createOnlyWrite(store, auditPath(command.leagueId, auditId), draftAudit({ command, context, actorUserId, processedAt, draftId, action: "native_draft_started", auditId, before: { status: "lobby" }, after: { status: "live" } })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditId), { schema_version: 1, id: auditId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, draft_id: draftId, reason: command.reason, source: "native_draft", created_at: processedAt }),
    ...pipelineWrites({ store, command, draftId, processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitDraft({ store, command, context, requestHash, actorUserId, writes });
  return winner ?? receipt;
}

async function applySelection(input: {
  command: LeagueCommand<"apply_native_draft_action">;
  context: DraftContext;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
  draftDocument: LeagueCommandStoredDocument;
  action: NativeDraftAction;
  playerId: string;
  franchiseId: string;
  price: number;
  source: DraftSelection["source"];
}) {
  const { command, context, actorUserId, requestHash, processedAt, store, draftDocument, action, playerId, franchiseId, price, source } = input;
  const draftId = text(draftDocument.data.id);
  const auditId = `audit-${command.commandId}`;
  const overallPick = Math.max(1, wholeNumber(draftDocument.data.overall_pick, 1));
  const acquired = await acquisitionWrites({ store, command, context, actorUserId, processedAt, draftId, franchiseId, playerId, price, source, overallPick, auditId });
  const selections = [...selectionList(draftDocument.data.selections), acquired.selection];
  const baseDraft: Record<string, unknown> = {
    ...draftDocument.data,
    selections,
    team_states: updatedTeamStates(draftDocument.data, franchiseId, price, 1),
    action_log: [...mapList(draftDocument.data.action_log), draftActionLog({ command, actorUserId, processedAt, action: action.type, franchiseId, playerId, amount: price, transactionId: acquired.transactionId })],
    overall_pick: overallPick + 1,
    auction_state: {},
  };
  const completed = finalStatus(baseDraft, rosterSize(context.settings)) === "complete";
  const nextFranchise = completed ? "" : currentFranchise(text(baseDraft.format) as NativeDraftFormat, stringList(baseDraft.order_franchise_ids), overallPick + 1);
  const deadline = completed ? "" : new Date(Date.parse(processedAt) + Math.max(1, wholeNumber(baseDraft.pick_seconds, 60)) * 1000).toISOString();
  const nextDraft = {
    ...baseDraft,
    status: completed ? "complete" : "live",
    revision: Math.max(1, wholeNumber(draftDocument.data.revision)) + 1,
    season_revision: context.revision + 1,
    current_franchise_id: nextFranchise,
    current_deadline_at: deadline,
    completed_at: completed ? processedAt : "",
    updated_at: processedAt,
  };
  const receipt = commandReceipt({ command, context, actorUserId, requestHash, processedAt, auditId, result: { draftId, draftRevision: nextDraft.revision, status: nextDraft.status, franchiseId, playerId, transactionId: acquired.transactionId, overallPick } });
  const shareWrite = await spectatorShareWrite(store, nextDraft);
  const writes: FirestoreWrite[] = [
    ...acquired.writes,
    replaceWrite(store, draftDocument, draftDocument.path, nextDraft),
    ...(shareWrite ? [shareWrite] : []),
    seasonWrite({ store, command, context, processedAt, changes: completed ? { phase: "regular_season", draft_completed_at: processedAt, rosters_published_at: processedAt } : { phase: "draft" } }),
  ];
  if (completed) writes.push(replaceWrite(store, context.league, context.league.path, { ...context.league.data, status: "active", revision: Math.max(1, wholeNumber(context.league.data.revision)) + 1, updated_at: processedAt }));
  writes.push(
    createOnlyWrite(store, auditPath(command.leagueId, auditId), draftAudit({ command, context, actorUserId, processedAt, draftId, action: source === "auction" ? "auction_win" : source === "autopick" ? "draft_autopick" : "draft_selection", auditId, before: { overall_pick: overallPick, current_franchise_id: franchiseId }, after: { overall_pick: overallPick + 1, player_id: playerId, status: nextDraft.status }, transactionId: acquired.transactionId })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditId), { schema_version: 1, id: auditId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, draft_id: draftId, transaction_id: acquired.transactionId, reason: command.reason, source: "native_draft", created_at: processedAt }),
    ...pipelineWrites({ store, command, draftId, processedAt, transactionId: acquired.transactionId }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  );
  const winner = await commitDraft({ store, command, context, requestHash, actorUserId, writes });
  return winner ?? receipt;
}

export async function executeApplyNativeDraftAction(input: {
  command: LeagueCommand<"apply_native_draft_action">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await draftContext({ command, actorUserId, processedAt, store });
  const draftId = text(command.payload.draftId);
  const path = nativeDraftPath(command.leagueId, command.seasonId, draftId);
  const draftDocument = await store.get(path);
  if (!draftDocument || text(draftDocument.data.id) !== draftId) throw new LeagueCommandFailure("draft_not_found", "Native draft not found.", 404);
  const expectedDraftRevision = wholeNumber(command.payload.expectedDraftRevision, -1);
  const draftRevision = Math.max(1, wholeNumber(draftDocument.data.revision, 1));
  if (expectedDraftRevision !== draftRevision) throw new LeagueCommandFailure("stale_draft_revision", `The draft changed after you opened it. Its current revision is ${draftRevision}.`, 409, context.revision);
  const action = record(command.payload.action) as NativeDraftAction;
  const actionType = text(action.type);
  if (!["pick", "autopick", "set_queue", "nominate", "bid", "settle", "pause", "resume", "complete"].includes(actionType)) throw new LeagueCommandFailure("invalid_draft_action", "Choose a supported draft action.");
  const draft = draftDocument.data;
  const status = text(draft.status);
  const format = text(draft.format) as NativeDraftFormat;

  if (actionType === "pick" || actionType === "autopick") {
    if (format === "auction" || status !== "live") throw new LeagueCommandFailure("pick_not_available", "Player picks require a live non-auction draft.", 409);
    const franchiseId = text(draft.current_franchise_id);
    if (actionType === "autopick") requireCommissioner(context);
    else if (!mayActFor(context, franchiseId)) throw new LeagueCommandFailure("permission_denied", "Only this team or a commissioner can make the current pick.", 403);
    const queues = record(draft.queues);
    const queued = stringList(queues[franchiseId]);
    const unavailable = new Set(selectionList(draft.selections).map((selection) => selection.player_id));
    const playerId = text((action as { playerId?: string }).playerId) || queued.find((id) => !unavailable.has(id)) || "";
    if (!validPlayerId(playerId)) throw new LeagueCommandFailure("autopick_queue_empty", "Choose a valid player or add an available player to this team's queue.");
    return applySelection({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, action, playerId, franchiseId, price: 0, source: actionType === "autopick" ? "autopick" : "pick" });
  }

  if (actionType === "nominate") {
    if (format !== "auction" || status !== "live" || Object.keys(record(draft.auction_state)).length) throw new LeagueCommandFailure("nomination_not_available", "Wait for the current auction to finish before nominating.", 409);
    const franchiseId = text(draft.current_franchise_id);
    if (!mayActFor(context, franchiseId)) throw new LeagueCommandFailure("permission_denied", "Only the current nominator or a commissioner can nominate.", 403);
    const playerId = text((action as { playerId?: string }).playerId);
    const openingBid = wholeNumber((action as { openingBid?: number }).openingBid);
    if (!validPlayerId(playerId)) throw new LeagueCommandFailure("invalid_player", "Choose a valid player to nominate.");
    if (openingBid < Math.max(1, wholeNumber(draft.minimum_bid, 1)) || openingBid > maxAuctionBid(draft, franchiseId)) throw new LeagueCommandFailure("invalid_opening_bid", "The opening bid exceeds this team's maximum legal bid.", 409);
    if (await store.get(assetLockPath(command.leagueId, command.seasonId, "player", playerId))) throw new LeagueCommandFailure("player_unavailable", "That player is already owned in this native season.", 409);
    const endsAt = new Date(Date.parse(processedAt) + Math.max(1, wholeNumber(draft.bid_seconds, 10)) * 1000).toISOString();
    const next = { ...draft, revision: draftRevision + 1, auction_state: { player_id: playerId, nominated_by_franchise_id: franchiseId, high_bidder_franchise_id: franchiseId, current_bid: openingBid, started_at: processedAt, ends_at: endsAt }, current_deadline_at: endsAt, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "nominate", franchiseId, playerId, amount: openingBid })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "auction_nomination", before: { current_franchise_id: franchiseId }, after: { player_id: playerId, opening_bid: openingBid, ends_at: endsAt } });
  }

  if (actionType === "bid") {
    if (format !== "auction" || status !== "live") throw new LeagueCommandFailure("bid_not_available", "Bids require a live auction draft.", 409);
    const auction = record(draft.auction_state);
    const playerId = text(auction.player_id);
    const franchiseId = text((action as { franchiseId?: string }).franchiseId);
    const amount = wholeNumber((action as { amount?: number }).amount);
    if (!playerId || Date.parse(text(auction.ends_at)) < Date.parse(processedAt)) throw new LeagueCommandFailure("auction_expired", "The bid window has closed.", 409);
    if (!mayActFor(context, franchiseId)) throw new LeagueCommandFailure("permission_denied", "You cannot bid for that franchise.", 403);
    const minimumNext = wholeNumber(auction.current_bid) + Math.max(1, wholeNumber(draft.minimum_bid, 1));
    if (amount < minimumNext || amount > maxAuctionBid(draft, franchiseId)) throw new LeagueCommandFailure("invalid_bid", "That bid is below the next bid or above the team's maximum legal bid.", 409);
    const currentEndsAt = Date.parse(text(auction.ends_at));
    const remaining = Math.max(0, currentEndsAt - Date.parse(processedAt));
    const extendedEndsAt = remaining <= Math.max(0, wholeNumber(draft.anti_snipe_seconds)) * 1000
      ? new Date(Date.parse(processedAt) + Math.max(1, wholeNumber(draft.bid_seconds, 10)) * 1000).toISOString()
      : text(auction.ends_at);
    const next = { ...draft, revision: draftRevision + 1, auction_state: { ...auction, high_bidder_franchise_id: franchiseId, current_bid: amount, ends_at: extendedEndsAt }, current_deadline_at: extendedEndsAt, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "bid", franchiseId, playerId, amount })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "auction_bid", before: { current_bid: wholeNumber(auction.current_bid), high_bidder_franchise_id: text(auction.high_bidder_franchise_id) }, after: { current_bid: amount, high_bidder_franchise_id: franchiseId, ends_at: extendedEndsAt } });
  }

  if (actionType === "settle") {
    requireCommissioner(context);
    const auction = record(draft.auction_state);
    if (format !== "auction" || status !== "live" || !text(auction.player_id)) throw new LeagueCommandFailure("auction_not_active", "There is no auction to settle.", 409);
    if (Date.parse(text(auction.ends_at)) > Date.parse(processedAt)) throw new LeagueCommandFailure("auction_still_live", "The bid timer has not expired.", 409);
    return applySelection({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, action, playerId: text(auction.player_id), franchiseId: text(auction.high_bidder_franchise_id), price: Math.max(1, wholeNumber(auction.current_bid)), source: "auction" });
  }

  if (actionType === "set_queue") {
    if (status === "complete") throw new LeagueCommandFailure("draft_complete", "Queues cannot change after draft completion.", 409);
    const franchiseId = text((action as { franchiseId?: string }).franchiseId);
    if (!mayActFor(context, franchiseId)) throw new LeagueCommandFailure("permission_denied", "You cannot change that franchise's draft queue.", 403);
    const playerIds = stringList((action as { playerIds?: string[] }).playerIds).filter(validPlayerId).slice(0, 100);
    if (new Set(playerIds).size !== playerIds.length) throw new LeagueCommandFailure("duplicate_queue_player", "A draft queue cannot contain duplicate players.");
    const next = { ...draft, revision: draftRevision + 1, queues: { ...record(draft.queues), [franchiseId]: playerIds }, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "set_queue", franchiseId })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "draft_queue_updated", before: {}, after: { franchise_id: franchiseId, queued_players: playerIds.length } });
  }

  requireCommissioner(context);
  if (actionType === "pause") {
    if (status !== "live") throw new LeagueCommandFailure("draft_not_live", "Only a live draft can be paused.", 409);
    const next = { ...draft, status: "paused", paused_from: "live", revision: draftRevision + 1, current_deadline_at: "", updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "pause" })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "native_draft_paused", before: { status }, after: { status: "paused" } });
  }
  if (actionType === "resume") {
    if (status !== "paused") throw new LeagueCommandFailure("draft_not_paused", "Only a paused draft can be resumed.", 409);
    const deadline = new Date(Date.parse(processedAt) + Math.max(1, wholeNumber(draft.pick_seconds, 60)) * 1000).toISOString();
    const next = { ...draft, status: "live", revision: draftRevision + 1, current_deadline_at: deadline, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "resume" })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "native_draft_resumed", before: { status }, after: { status: "live", deadline } });
  }
  if (actionType === "complete") {
    if (finalStatus(draft, rosterSize(context.settings)) !== "complete") throw new LeagueCommandFailure("draft_incomplete", "Every team roster must be full before the native draft can complete.", 409);
    const next = { ...draft, status: "complete", revision: draftRevision + 1, current_franchise_id: "", current_deadline_at: "", completed_at: processedAt, updated_at: processedAt, action_log: [...mapList(draft.action_log), draftActionLog({ command, actorUserId, processedAt, action: "complete" })] };
    return commitSimpleDraftAction({ command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft: next, actionName: "native_draft_completed", before: { status }, after: { status: "complete" }, seasonChanges: { phase: "regular_season", draft_completed_at: processedAt, rosters_published_at: processedAt }, activateLeague: true });
  }
  throw new LeagueCommandFailure("invalid_draft_action", "Choose a supported draft action.");
}

async function commitSimpleDraftAction(input: {
  command: LeagueCommand<"apply_native_draft_action">;
  context: DraftContext;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
  draftDocument: LeagueCommandStoredDocument;
  nextDraft: Record<string, unknown>;
  actionName: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  seasonChanges?: Record<string, unknown>;
  activateLeague?: boolean;
}) {
  const { command, context, actorUserId, requestHash, processedAt, store, draftDocument, nextDraft, actionName, before, after } = input;
  const draftId = text(draftDocument.data.id);
  const auditId = `audit-${command.commandId}`;
  const receipt = commandReceipt({ command, context, actorUserId, requestHash, processedAt, auditId, result: { draftId, draftRevision: wholeNumber(nextDraft.revision), status: text(nextDraft.status), action: actionName } });
  const persistedDraft = { ...nextDraft, season_revision: context.revision + 1 };
  const shareWrite = await spectatorShareWrite(store, persistedDraft);
  const writes: FirestoreWrite[] = [
    replaceWrite(store, draftDocument, draftDocument.path, persistedDraft),
    ...(shareWrite ? [shareWrite] : []),
    seasonWrite({ store, command, context, processedAt, changes: input.seasonChanges ?? { phase: "draft" } }),
  ];
  if (input.activateLeague) writes.push(replaceWrite(store, context.league, context.league.path, { ...context.league.data, status: "active", revision: Math.max(1, wholeNumber(context.league.data.revision)) + 1, updated_at: processedAt }));
  writes.push(
    createOnlyWrite(store, auditPath(command.leagueId, auditId), draftAudit({ command, context, actorUserId, processedAt, draftId, action: actionName, auditId, before, after })),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditId), { schema_version: 1, id: auditId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, draft_id: draftId, reason: command.reason, source: "native_draft", created_at: processedAt }),
    ...pipelineWrites({ store, command, draftId, processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  );
  const winner = await commitDraft({ store, command, context, requestHash, actorUserId, writes });
  return winner ?? receipt;
}

export async function executeRevertNativeDraftAction(input: {
  command: LeagueCommand<"revert_native_draft_action">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await draftContext({ command, actorUserId, processedAt, store });
  requireCommissioner(context);
  if (command.reason.trim().length < 5) throw new LeagueCommandFailure("reason_required", "Enter a clear audit reason before reverting a draft result.");
  const draftId = text(command.payload.draftId);
  const path = nativeDraftPath(command.leagueId, command.seasonId, draftId);
  const draftDocument = await store.get(path);
  if (!draftDocument) throw new LeagueCommandFailure("draft_not_found", "Native draft not found.", 404);
  const draftRevision = Math.max(1, wholeNumber(draftDocument.data.revision));
  if (wholeNumber(command.payload.expectedDraftRevision, -1) !== draftRevision) throw new LeagueCommandFailure("stale_draft_revision", `The draft changed after you opened it. Its current revision is ${draftRevision}.`, 409, context.revision);
  const selections = selectionList(draftDocument.data.selections);
  const selection = selections.at(-1);
  if (!selection) throw new LeagueCommandFailure("nothing_to_revert", "This draft has no completed selection to revert.", 409);
  const originalTransactionPath = rosterTransactionPath(command.leagueId, command.seasonId, selection.roster_transaction_id);
  const [originalTransaction, lock, team] = await Promise.all([
    store.get(originalTransactionPath),
    store.get(assetLockPath(command.leagueId, command.seasonId, "player", selection.player_id)),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams/${selection.franchise_id}`),
  ]);
  if (!originalTransaction || text(originalTransaction.data.approval_state) !== "accepted" || text(originalTransaction.data.reversed_by_transaction_id)) throw new LeagueCommandFailure("transaction_not_reversible", "The last draft transaction is no longer reversible.", 409);
  if (!lock || text(lock.data.franchise_id) !== selection.franchise_id || !team || !stringList(team.data.roster_player_ids).includes(selection.player_id)) throw new LeagueCommandFailure("asset_ownership_changed", "That player moved after the draft selection. No result was reverted.", 409);
  const auditId = `audit-${command.commandId}`;
  const reversalTransactionId = `tx-${command.commandId}`;
  const beforeRosterRevision = Math.max(1, wholeNumber(team.data.roster_revision));
  const afterRosterRevision = beforeRosterRevision + 1;
  const remainingPlayers = stringList(team.data.roster_player_ids).filter((id) => id !== selection.player_id);
  const nextOverallPick = Math.max(1, selection.overall_pick);
  const nextDraft = {
    ...draftDocument.data,
    status: "paused",
    revision: draftRevision + 1,
    season_revision: context.revision + 1,
    selections: selections.slice(0, -1),
    team_states: updatedTeamStates(draftDocument.data, selection.franchise_id, selection.price, -1),
    overall_pick: nextOverallPick,
    current_franchise_id: selection.franchise_id,
    current_deadline_at: "",
    auction_state: {},
    completed_at: "",
    updated_at: processedAt,
    action_log: [
      ...mapList(draftDocument.data.action_log).map((entry) => text(entry.roster_transaction_id) === selection.roster_transaction_id ? { ...entry, reverted: true, reverted_by_command_id: command.commandId } : entry),
      draftActionLog({ command, actorUserId, processedAt, action: "revert", franchiseId: selection.franchise_id, playerId: selection.player_id, amount: selection.price, transactionId: reversalTransactionId }),
    ],
  };
  const receipt = commandReceipt({ command, context, actorUserId, requestHash, processedAt, auditId, result: { draftId, draftRevision: nextDraft.revision, status: "paused", revertedTransactionId: selection.roster_transaction_id, transactionId: reversalTransactionId, playerId: selection.player_id, franchiseId: selection.franchise_id } });
  const shareWrite = await spectatorShareWrite(store, nextDraft);
  const reversalTransaction = {
    ...originalTransaction.data,
    id: reversalTransactionId,
    transaction_type: "reversal",
    moves: [{ assetType: "player", assetId: selection.player_id, fromFranchiseId: selection.franchise_id, toFranchiseId: null }],
    assets_leaving: [{ franchise_id: selection.franchise_id, assets: [{ type: "player", id: selection.player_id, amount: null, metadata: { draft_id: draftId, price: selection.price } }] }],
    assets_entering: [],
    source_command_id: command.commandId,
    actor_user_id: actorUserId,
    approval_state: "accepted",
    before_roster_revisions: { [selection.franchise_id]: beforeRosterRevision },
    after_roster_revisions: { [selection.franchise_id]: afterRosterRevision },
    audit_event_id: auditId,
    reversal_of_transaction_id: selection.roster_transaction_id,
    reversed_by_transaction_id: "",
    effective_at: processedAt,
    created_at: processedAt,
    updated_at: processedAt,
  };
  const writes: FirestoreWrite[] = [
    replaceWrite(store, team, team.path, { ...team.data, roster_player_ids: remainingPlayers, roster_revision: afterRosterRevision, updated_at: processedAt }),
    deleteWrite(store, lock, lock.path),
    replaceWrite(store, originalTransaction, originalTransactionPath, { ...originalTransaction.data, approval_state: "reversed", reversed_by_transaction_id: reversalTransactionId, updated_at: processedAt }),
    createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, reversalTransactionId), reversalTransaction),
    replaceWrite(store, draftDocument, path, nextDraft),
    ...(shareWrite ? [shareWrite] : []),
    seasonWrite({ store, command, context, processedAt, changes: { phase: "draft", draft_completed_at: "", rosters_published_at: "" } }),
    replaceWrite(store, context.league, context.league.path, { ...context.league.data, status: "draft", revision: Math.max(1, wholeNumber(context.league.data.revision)) + 1, updated_at: processedAt }),
    createOnlyWrite(store, auditPath(command.leagueId, auditId), { ...draftAudit({ command, context, actorUserId, processedAt, draftId, action: "native_draft_result_reverted", auditId, before: { transaction_id: selection.roster_transaction_id, player_id: selection.player_id, franchise_id: selection.franchise_id }, after: { transaction_id: reversalTransactionId, status: "paused" }, transactionId: reversalTransactionId }), reversal_of_audit_event_id: text(originalTransaction.data.audit_event_id) }),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditId), { schema_version: 1, id: auditId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId, command_id: command.commandId, draft_id: draftId, transaction_id: reversalTransactionId, reason: command.reason, source: "native_draft_reversal", created_at: processedAt }),
    ...pipelineWrites({ store, command, draftId, processedAt, transactionId: reversalTransactionId }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitDraft({ store, command, context, requestHash, actorUserId, writes });
  return winner ?? receipt;
}
