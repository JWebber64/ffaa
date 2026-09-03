import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  AcquireFreeAgentPayload,
  LeagueCommand,
  LeagueCommandReceipt,
  ProcessWaiverRunPayload,
  SubmitWaiverClaimGroupPayload,
  WaiverPlayerPosition,
  WaiverPlayerState,
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
  receiptRecord,
  record,
  replaceWrite,
  rosterTransactionPath,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type WaiverCommand = "initialize_waiver_player_pool" | "submit_waiver_claim_group" | "process_waiver_run" | "acquire_free_agent";
type Role = { role: string; franchiseId: string };
type Context = {
  league: LeagueCommandStoredDocument;
  season: LeagueCommandStoredDocument;
  settings: LeagueSettingsV1;
  settingsVersionId: string;
  seasonRevision: number;
  teams: LeagueCommandStoredDocument[];
  roles: Role[];
};

type PlayerState = {
  document: LeagueCommandStoredDocument | null;
  playerId: string;
  position: WaiverPlayerPosition;
  state: WaiverPlayerState;
  ownerFranchiseId: string;
  droppedUntil: string;
  revision: number;
  data: Record<string, unknown>;
};

function waiverStatePath(leagueId: string, seasonId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverState/current`; }
function waiverTeamStatePath(leagueId: string, seasonId: string, franchiseId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/${franchiseId}`; }
function playerStatePath(leagueId: string, seasonId: string, playerId: string) { return `leagues/${leagueId}/seasons/${seasonId}/playerStates/${playerId}`; }
function waiverClaimPath(leagueId: string, seasonId: string, claimId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverClaims/${claimId}`; }
function waiverRunPath(leagueId: string, seasonId: string, runId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverRuns/${runId}`; }
function waiverReceiptPath(leagueId: string, seasonId: string, receiptId: string) { return `leagues/${leagueId}/seasons/${seasonId}/waiverReceipts/${receiptId}`; }

function activeGrant(document: LeagueCommandStoredDocument, at: string) {
  if (text(document.data.revoked_at)) return false;
  const effective = Date.parse(text(document.data.effective_at)); const expires = Date.parse(text(document.data.expires_at)); const now = Date.parse(at);
  return (!Number.isFinite(effective) || effective <= now) && (!Number.isFinite(expires) || expires > now);
}

async function context(command: LeagueCommand<WaiverCommand>, actorUserId: string, processedAt: string, store: LeagueCommandStore): Promise<Context> {
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "Waivers require a canonical GameHQ league and season.");
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`), store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_waivers_required", "This league is not using native GameHQ waivers.", 409);
  if (!season || text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh waivers.", 409);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((entry): entry is LeagueCommandStoredDocument => Boolean(entry))
    .filter((entry) => text(entry.data.user_id) === actorUserId && activeGrant(entry, processedAt));
  const roles = grants.map((entry) => ({ role: text(entry.data.role), franchiseId: text(entry.data.franchise_id) }));
  const settingsVersionId = text(season.data.settings_version_id);
  const version = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null;
  if (!version || text(version.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Publish waiver rules before using player acquisition.", 409);
  const parsed = parseLeagueSettings(version.data.settings, text(league.data.timezone) || "UTC");
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The active waiver rules are invalid.", 409);
  return { league, season, settings: parsed.settings, settingsVersionId, seasonRevision: Math.max(1, wholeNumber(season.data.revision, 1)), teams: teams.filter((team) => text(team.data.status) !== "retired"), roles };
}

function isCommissioner(input: Context) { return input.roles.some(({ role }) => role === "commissioner" || role === "co_commissioner"); }
function controlsTeam(input: Context, franchiseId: string) { return isCommissioner(input) || input.roles.some(({ role, franchiseId: scoped }) => ["team_owner", "co_manager"].includes(role) && scoped === franchiseId); }
function validPlayerId(value: string) { return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value); }

function zonedParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function zonedDateToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shown = zonedParts(new Date(guess), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    guess -= shownAsUtc - Date.UTC(year, month - 1, day, hour, minute);
  }
  return new Date(guess);
}

export function nextWaiverProcessingAt(nowIso: string, settings: LeagueSettingsV1) {
  const now = new Date(nowIso); const local = zonedParts(now, settings.timezone); const [hour, minute] = settings.transactions.processingTime.split(":").map(Number);
  const base = new Date(Date.UTC(local.year, local.month - 1, local.day));
  for (let offset = 0; offset <= 8; offset += 1) {
    const calendar = new Date(base.getTime() + offset * 86400000);
    if (!settings.transactions.processingDays.includes(calendar.getUTCDay())) continue;
    const candidate = zonedDateToUtc(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), hour ?? 0, minute ?? 0, settings.timezone);
    if (candidate.getTime() > now.getTime()) return candidate.toISOString();
  }
  throw new LeagueCommandFailure("waiver_schedule_invalid", "No waiver processing time could be derived from the active settings.");
}

function normalizePlayer(document: LeagueCommandStoredDocument | null, playerId = "", position: WaiverPlayerPosition = "RB"): PlayerState {
  const data = document?.data ?? {};
  const state = text(data.state) as WaiverPlayerState;
  return {
    document, playerId: text(data.player_id) || playerId, position: (text(data.position) || position) as WaiverPlayerPosition,
    state: ["free_agent", "on_waivers", "owned", "locked", "ineligible", "protected", "trade_block"].includes(state) ? state : "free_agent",
    ownerFranchiseId: text(data.owner_franchise_id), droppedUntil: text(data.dropped_until), revision: Math.max(document ? 1 : 0, wholeNumber(data.revision)), data,
  };
}

function playerRecord(input: PlayerState, state: WaiverPlayerState, ownerFranchiseId: string, droppedUntil: string, at: string, reason = "") {
  return { ...input.data, schema_version: 1, player_id: input.playerId, position: input.position, state, owner_franchise_id: ownerFranchiseId, dropped_until: droppedUntil, waiver_eligible_at: droppedUntil, lock_reason: state === "locked" ? reason : "", protected_reason: state === "protected" ? reason : "", trade_block: state === "trade_block", revision: input.revision + 1, created_at: text(input.data.created_at) || at, updated_at: at };
}

function audit(input: { command: LeagueCommand<WaiverCommand>; actorUserId: string; requestHash: string; processedAt: string; previousRevision: number; resultingRevision: number; settingsVersionId: string; action: string; targetId: string; reason: string; summary: string; result: Record<string, unknown>; store: LeagueCommandStore }) {
  const auditEventId = `audit-${input.command.commandId}`;
  const receipt: LeagueCommandReceipt = { commandId: input.command.commandId, commandType: input.command.commandType, actorUserId: input.actorUserId, leagueId: input.command.leagueId, seasonId: input.command.seasonId, status: "accepted", previousRevision: input.previousRevision, resultingRevision: input.resultingRevision, auditEventId, serverProcessedAt: input.processedAt, requestHash: input.requestHash, result: input.result, error: null };
  const common = { schema_version: 1, id: auditEventId, league_id: input.command.leagueId, season_id: input.command.seasonId, actor_user_id: input.actorUserId, action: input.action, target: { type: "waiver", id: input.targetId }, timestamp: input.processedAt, previous_revision: input.previousRevision, resulting_revision: input.resultingRevision, before: { revision: input.previousRevision }, after: { revision: input.resultingRevision }, material_differences: input.result, reason: input.reason, settings_version_id: input.settingsVersionId, command_id: input.command.commandId, transaction_id: "", public_summary: input.summary, private_metadata: {}, reversal_of_audit_event_id: "" };
  return { receipt, auditEventId, writes: [createOnlyWrite(input.store, auditPath(input.command.leagueId, auditEventId), common), createOnlyWrite(input.store, auditPrivatePath(input.command.leagueId, auditEventId), { ...common, private_metadata: { command_payload: input.command.payload } }), createOnlyWrite(input.store, commandPath(input.command.leagueId, input.command.commandId), receiptRecord(receipt))] satisfies FirestoreWrite[] };
}

function rosterLimit(settings: LeagueSettingsV1) { return settings.rosterSlots.filter((row) => row.slot !== "IR").reduce((sum, row) => sum + row.count, 0); }
function rosterLegal(roster: string[], positions: Map<string, WaiverPlayerPosition>, settings: LeagueSettingsV1) {
  if (roster.length > rosterLimit(settings)) return "The resulting roster exceeds its configured size.";
  for (const [position, limit] of Object.entries(settings.transactions.positionLimits)) if (roster.filter((id) => positions.get(id) === position).length > limit) return `The resulting roster exceeds the ${position} position limit of ${limit}.`;
  return "";
}

export async function executeInitializeWaiverPlayerPool(input: { command: LeagueCommand<"initialize_waiver_player_pool">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command as LeagueCommand<WaiverCommand>, actorUserId, processedAt, store);
  if (!isCommissioner(ctx)) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required to initialize the league player pool.", 403);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const current = await store.get(waiverStatePath(command.leagueId, command.seasonId)); const currentRevision = current ? Math.max(1, wholeNumber(current.data.revision, 1)) : 0;
  if (wholeNumber(command.payload.expectedWaiverStateRevision, -1) !== currentRevision) throw new LeagueCommandFailure("stale_waiver_revision", `The waiver state revision is ${currentRevision}.`, 409, currentRevision);
  const players = command.payload.players ?? [];
  if (!players.length || players.length > 400) throw new LeagueCommandFailure("invalid_player_pool", "Initialize between 1 and 400 fantasy players.");
  const unique = new Set<string>();
  for (const player of players) {
    if (!validPlayerId(player.playerId) || !["QB", "RB", "WR", "TE", "K", "DST"].includes(player.position) || unique.has(player.playerId)) throw new LeagueCommandFailure("invalid_player_pool", "Every player needs one unique ID and supported position.");
    unique.add(player.playerId);
  }
  const [existingDocuments, locks, teamStates] = await Promise.all([store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/playerStates`), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/assetLocks`), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/waiverTeamStates`)]);
  const existingById = new Map(existingDocuments.map((document) => [text(document.data.player_id), document])); const lockById = new Map(locks.filter((lock) => text(lock.data.asset_type) === "player" || lock.path.includes("player__")).map((lock) => [text(lock.data.asset_id), text(lock.data.franchise_id)]));
  const writes: FirestoreWrite[] = players.map((player) => {
    const existing = normalizePlayer(existingById.get(player.playerId) ?? null, player.playerId, player.position);
    const owner = lockById.get(player.playerId) ?? existing.ownerFranchiseId;
    const preserved = ["locked", "ineligible", "protected", "trade_block"].includes(existing.state) ? existing.state : owner ? "owned" : "free_agent";
    return replaceWrite(store, existing.document, playerStatePath(command.leagueId, command.seasonId, player.playerId), playerRecord(existing, preserved as WaiverPlayerState, owner, existing.droppedUntil, processedAt));
  });
  const teamStateById = new Map(teamStates.map((document) => [text(document.data.franchise_id), document]));
  for (const team of ctx.teams) {
    const franchiseId = text(team.data.franchise_id) || text(team.data.id); const prior = teamStateById.get(franchiseId) ?? null;
    writes.push(replaceWrite(store, prior, waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId), { ...prior?.data, schema_version: 1, franchise_id: franchiseId, faab_remaining: prior ? wholeNumber(prior.data.faab_remaining, ctx.settings.transactions.faabBudget) : ctx.settings.transactions.faabBudget, priority: prior ? Math.max(1, wholeNumber(prior.data.priority, 1)) : Math.max(1, wholeNumber(team.data.draft_position, ctx.teams.indexOf(team) + 1)), standings_rank: prior ? Math.max(1, wholeNumber(prior.data.standings_rank, 1)) : ctx.teams.indexOf(team) + 1, priority_week: wholeNumber(prior?.data.priority_week), weekly_acquisitions: record(prior?.data.weekly_acquisitions), revision: (prior ? Math.max(1, wholeNumber(prior.data.revision, 1)) : 0) + 1, updated_at: processedAt }));
  }
  const nextRevision = currentRevision + 1; const nextProcessingAt = nextWaiverProcessingAt(processedAt, ctx.settings);
  const auditRecord = audit({ command: command as LeagueCommand<WaiverCommand>, actorUserId, requestHash, processedAt, previousRevision: currentRevision, resultingRevision: nextRevision, settingsVersionId: ctx.settingsVersionId, action: "waiver_player_pool_initialized", targetId: "current", reason: command.reason || "Initialize canonical player acquisition state", summary: `${players.length} fantasy player states were reconciled with canonical roster ownership.`, result: { waiverStateRevision: nextRevision, playerCount: players.length, nextProcessingAt }, store });
  await store.commit([replaceWrite(store, current, waiverStatePath(command.leagueId, command.seasonId), { schema_version: 1, id: "current", league_id: command.leagueId, season_id: command.seasonId, settings_version_id: ctx.settingsVersionId, revision: nextRevision, player_count: players.length, next_processing_at: nextProcessingAt, last_run_id: text(current?.data.last_run_id), updated_at: processedAt }), ...writes, ...auditRecord.writes]);
  return auditRecord.receipt;
}

function normalizeAlternatives(payload: SubmitWaiverClaimGroupPayload, ctx: Context, team: LeagueCommandStoredDocument, playerById: Map<string, PlayerState>, teamState: LeagueCommandStoredDocument) {
  if (!Array.isArray(payload.alternatives) || !payload.alternatives.length || payload.alternatives.length > 12) throw new LeagueCommandFailure("invalid_claim_group", "Submit between 1 and 12 ordered claim alternatives.");
  const roster = stringList(team.data.roster_player_ids); const positions = new Map([...playerById.values()].map((player) => [player.playerId, player.position]));
  return payload.alternatives.map((row, index) => {
    const addPlayerId = text(row.addPlayerId); const dropPlayerId = text(row.dropPlayerId); const bid = wholeNumber(row.bid, -1); const add = playerById.get(addPlayerId);
    if (!validPlayerId(addPlayerId)) throw new LeagueCommandFailure("invalid_claim_group", `Alternative ${index + 1} needs a valid add player ID.`);
    const issues: string[] = [];
    if (!add || !["free_agent", "on_waivers"].includes(add.state)) issues.push(`${addPlayerId} is not currently available`);
    if (dropPlayerId && (!roster.includes(dropPlayerId) || ["locked", "protected"].includes(playerById.get(dropPlayerId)?.state ?? ""))) issues.push("the conditional drop is not eligible");
    if (bid < 0 || bid > wholeNumber(teamState.data.faab_remaining) || (!ctx.settings.transactions.allowZeroDollarBids && bid === 0)) issues.push("the bid is outside the active FAAB rules");
    const nextRoster = [...roster.filter((id) => id !== dropPlayerId), addPlayerId]; const legal = rosterLegal(nextRoster, positions, ctx.settings);
    if (legal) issues.push(legal);
    return { add_player_id: addPlayerId, drop_player_id: dropPlayerId, bid, order: index + 1, submission_issue: issues.join(" ") };
  });
}

export async function executeSubmitWaiverClaimGroup(input: { command: LeagueCommand<"submit_waiver_claim_group">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command as LeagueCommand<WaiverCommand>, actorUserId, processedAt, store);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const payload = command.payload; const franchiseId = text(payload.franchiseId); if (!controlsTeam(ctx, franchiseId)) throw new LeagueCommandFailure("permission_denied", "You do not control this waiver team.", 403);
  if (payload.settingsVersionId !== ctx.settingsVersionId) throw new LeagueCommandFailure("settings_changed", "Waiver rules changed. Refresh the claim builder.", 409);
  if (ctx.settings.transactions.waiverMode === "first_come_first_served") throw new LeagueCommandFailure("free_agent_mode", "This league uses immediate free-agent acquisition instead of claims.", 409);
  const [waiverState, team, teamState, playerDocuments] = await Promise.all([store.get(waiverStatePath(command.leagueId, command.seasonId)), store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams/${franchiseId}`), store.get(waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId)), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/playerStates`)]);
  if (!waiverState || !team || !teamState) throw new LeagueCommandFailure("waiver_state_required", "Initialize the waiver player pool before submitting claims.", 409);
  const rosterRevision = Math.max(1, wholeNumber(team.data.roster_revision, 1)); if (payload.expectedRosterRevision !== rosterRevision) throw new LeagueCommandFailure("stale_roster_revision", `The roster revision is ${rosterRevision}.`, 409, rosterRevision);
  const week = wholeNumber(payload.week); const acquisitions = wholeNumber(record(teamState.data.weekly_acquisitions)[String(week)]);
  if (ctx.settings.transactions.weeklyAcquisitionLimit && acquisitions >= ctx.settings.transactions.weeklyAcquisitionLimit) throw new LeagueCommandFailure("weekly_acquisition_limit", "This team reached its weekly acquisition limit.");
  const playerById = new Map(playerDocuments.map((document) => { const player = normalizePlayer(document); return [player.playerId, player]; }));
  const alternatives = normalizeAlternatives(payload, ctx, team, playerById, teamState); const claimId = `claim-${command.commandId}`; const processAt = nextWaiverProcessingAt(processedAt, ctx.settings); const waiverRevision = Math.max(1, wholeNumber(waiverState.data.revision, 1));
  const auditRecord = audit({ command: command as LeagueCommand<WaiverCommand>, actorUserId, requestHash, processedAt, previousRevision: 0, resultingRevision: 1, settingsVersionId: ctx.settingsVersionId, action: "waiver_claim_group_submitted", targetId: claimId, reason: command.reason || "Submit ordered waiver alternatives", summary: `A ${alternatives.length}-alternative waiver claim group was submitted for processing.`, result: { claimId, processAt, alternativeCount: alternatives.length, waiverStateRevision: waiverRevision }, store });
  await store.commit([createOnlyWrite(store, waiverClaimPath(command.leagueId, command.seasonId, claimId), { schema_version: 1, id: claimId, league_id: command.leagueId, season_id: command.seasonId, franchise_id: franchiseId, actor_user_id: actorUserId, week, settings_version_id: ctx.settingsVersionId, roster_revision_at_submission: rosterRevision, priority_at_submission: Math.max(1, wholeNumber(teamState.data.priority, 1)), standings_rank_at_submission: Math.max(1, wholeNumber(teamState.data.standings_rank, 1)), alternatives, process_at: processAt, status: ctx.settings.transactions.commissionerWaiverReview ? "pending_review" : "pending", result: {}, failures: [], revision: 1, audit_event_id: auditRecord.auditEventId, created_at: processedAt, updated_at: processedAt }), ...auditRecord.writes]);
  return auditRecord.receipt;
}

type ClaimWork = {
  document: LeagueCommandStoredDocument;
  id: string;
  franchiseId: string;
  actorUserId: string;
  alternatives: Array<Record<string, unknown>>;
  cursor: number;
  failures: string[];
  createdAt: string;
  won: Record<string, unknown> | null;
  outcome: { priorityBefore: number; priorityAfter: number; faabRemaining: number; rosterRevisionBefore: number; rosterRevisionAfter: number } | null;
};

type MutableWaiverTeam = {
  team: LeagueCommandStoredDocument;
  state: LeagueCommandStoredDocument;
  roster: string[];
  faabRemaining: number;
  priority: number;
  weekly: Record<string, unknown>;
  rosterRevision: number;
  wins: number;
};

function comparator(ctx: Context, teamStates: Map<string, LeagueCommandStoredDocument>, left: { claim: ClaimWork; alternative: Record<string, unknown> }, right: { claim: ClaimWork; alternative: Record<string, unknown> }) {
  const leftTeam = teamStates.get(left.claim.franchiseId)!; const rightTeam = teamStates.get(right.claim.franchiseId)!;
  if (ctx.settings.transactions.waiverMode === "faab") {
    const bidDifference = wholeNumber(right.alternative.bid) - wholeNumber(left.alternative.bid); if (bidDifference) return bidDifference;
  }
  if (ctx.settings.transactions.waiverMode === "reverse_standings" || ctx.settings.transactions.waiverTiebreaker === "lowest_standing") {
    const rankDifference = wholeNumber(rightTeam.data.standings_rank) - wholeNumber(leftTeam.data.standings_rank); if (rankDifference) return rankDifference;
  }
  if (!["earliest_claim", "lowest_standing"].includes(ctx.settings.transactions.waiverTiebreaker)) {
    const priorityDifference = wholeNumber(leftTeam.data.priority) - wholeNumber(rightTeam.data.priority); if (priorityDifference) return priorityDifference;
  }
  return left.claim.createdAt.localeCompare(right.claim.createdAt) || left.claim.id.localeCompare(right.claim.id);
}

export async function executeProcessWaiverRun(input: { command: LeagueCommand<"process_waiver_run">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command as LeagueCommand<WaiverCommand>, actorUserId, processedAt, store);
  if (!isCommissioner(ctx)) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required to process the waiver job.", 403);
  if (command.expectedRevision !== ctx.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season revision is ${ctx.seasonRevision}.`, 409, ctx.seasonRevision);
  const payload = command.payload as ProcessWaiverRunPayload; const through = Date.parse(text(payload.processThrough)); if (!Number.isFinite(through) || through > Date.parse(processedAt) + 60000) throw new LeagueCommandFailure("invalid_processing_time", "Process-through must be a current or past ISO timestamp.");
  const [waiverState, claims, playerDocuments, teamStateDocuments, lockDocuments] = await Promise.all([store.get(waiverStatePath(command.leagueId, command.seasonId)), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/waiverClaims`), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/playerStates`), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/waiverTeamStates`), store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/assetLocks`)]);
  if (!waiverState) throw new LeagueCommandFailure("waiver_state_required", "Initialize waivers before processing.", 409); const waiverRevision = Math.max(1, wholeNumber(waiverState.data.revision, 1));
  if (payload.expectedWaiverStateRevision !== waiverRevision) throw new LeagueCommandFailure("stale_waiver_revision", `The waiver state revision is ${waiverRevision}.`, 409, waiverRevision);
  const eligibleClaims = claims.filter((claim) => (text(claim.data.status) === "pending" || (payload.approvePendingReview === true && text(claim.data.status) === "pending_review")) && Date.parse(text(claim.data.process_at)) <= through && wholeNumber(claim.data.week) === payload.week).slice(0, 64);
  const work: ClaimWork[] = eligibleClaims.map((document) => ({ document, id: text(document.data.id), franchiseId: text(document.data.franchise_id), actorUserId: text(document.data.actor_user_id), alternatives: Array.isArray(document.data.alternatives) ? document.data.alternatives.map(record) : [], cursor: 0, failures: [], createdAt: text(document.data.created_at), won: null, outcome: null }));
  const playerById = new Map(playerDocuments.map((document) => { const player = normalizePlayer(document); return [player.playerId, player]; })); const positions = new Map([...playerById.values()].map((player) => [player.playerId, player.position]));
  const teamStates = new Map(teamStateDocuments.map((document) => [text(document.data.franchise_id), document])); const teams = new Map(ctx.teams.map((team) => [text(team.data.franchise_id) || text(team.data.id), team])); const locks = new Map(lockDocuments.map((document) => [text(document.data.asset_id), document]));
  const mutableTeams = new Map<string, MutableWaiverTeam>();
  for (const [franchiseId, team] of teams) {
    const state = teamStates.get(franchiseId); if (!state) continue;
    const standing = Math.max(1, wholeNumber(state.data.standings_rank, 1));
    const weeklyResetPriority = ctx.settings.transactions.waiverMode === "weekly_reset" && wholeNumber(state.data.priority_week) !== payload.week ? Math.max(1, teams.size - standing + 1) : Math.max(1, wholeNumber(state.data.priority, 1));
    mutableTeams.set(franchiseId, { team, state, roster: stringList(team.data.roster_player_ids), faabRemaining: wholeNumber(state.data.faab_remaining), priority: weeklyResetPriority, weekly: { ...record(state.data.weekly_acquisitions) }, rosterRevision: Math.max(1, wholeNumber(team.data.roster_revision, 1)), wins: 0 });
  }
  const claimed = new Set<string>(); const priorityMax = Math.max(0, ...[...mutableTeams.values()].map((team) => team.priority));
  const winners: ClaimWork[] = [];
  while (work.some((claim) => !claim.won && claim.cursor < claim.alternatives.length)) {
    const candidates: Array<{ claim: ClaimWork; alternative: Record<string, unknown> }> = [];
    for (const claim of work.filter((row) => !row.won)) {
      while (claim.cursor < claim.alternatives.length) {
        const alternative = claim.alternatives[claim.cursor]!; const addId = text(alternative.add_player_id); const state = playerById.get(addId);
        const submissionIssue = text(alternative.submission_issue);
        if (submissionIssue) { claim.failures.push(`Alternative ${claim.cursor + 1}: ${submissionIssue}.`); claim.cursor += 1; continue; }
        if (!state || locks.has(addId) || claimed.has(addId) || !["free_agent", "on_waivers"].includes(state.state) || (state.droppedUntil && Date.parse(state.droppedUntil) > through)) { claim.failures.push(`Alternative ${claim.cursor + 1}: ${addId} was unavailable.`); claim.cursor += 1; continue; }
        candidates.push({ claim, alternative }); break;
      }
    }
    if (!candidates.length) break;
    const targets = [...new Set(candidates.map(({ alternative }) => text(alternative.add_player_id)))].sort();
    let progressed = false;
    for (const target of targets) {
      const competing = candidates.filter(({ alternative }) => text(alternative.add_player_id) === target).sort((left, right) => comparator(ctx, teamStates, left, right));
      for (let index = 0; index < competing.length; index += 1) {
        const candidate = competing[index]!; const claim = candidate.claim; if (claim.won || claim.cursor >= claim.alternatives.length || claimed.has(target)) continue;
        const alternative = candidate.alternative; const mutable = mutableTeams.get(claim.franchiseId); if (!mutable) { claim.failures.push("Team waiver state was unavailable."); claim.cursor += 1; progressed = true; continue; }
        const dropId = text(alternative.drop_player_id); const roster = mutable.roster; const bid = wholeNumber(alternative.bid); const acquisitions = wholeNumber(mutable.weekly[String(payload.week)]);
        const failure = dropId && (!roster.includes(dropId) || claimed.has(dropId)) ? "The conditional drop was no longer eligible." : bid > mutable.faabRemaining ? "The bid exceeded remaining FAAB." : ctx.settings.transactions.weeklyAcquisitionLimit && acquisitions >= ctx.settings.transactions.weeklyAcquisitionLimit ? "The weekly acquisition limit was reached." : rosterLegal([...roster.filter((id) => id !== dropId), target], positions, ctx.settings);
        if (failure) { claim.failures.push(`Alternative ${claim.cursor + 1}: ${failure}`); claim.cursor += 1; progressed = true; continue; }
        const priorityBefore = mutable.priority; const rosterRevisionBefore = mutable.rosterRevision;
        mutable.roster = [...roster.filter((id) => id !== dropId), target]; mutable.faabRemaining -= bid; mutable.weekly[String(payload.week)] = acquisitions + 1; mutable.rosterRevision += 1; mutable.wins += 1;
        if (["rolling", "weekly_reset", "continuous"].includes(ctx.settings.transactions.waiverMode)) mutable.priority = priorityMax + winners.length + 1;
        claim.won = alternative; claim.outcome = { priorityBefore, priorityAfter: mutable.priority, faabRemaining: mutable.faabRemaining, rosterRevisionBefore, rosterRevisionAfter: mutable.rosterRevision }; winners.push(claim); claimed.add(target); progressed = true;
        for (const loser of competing.slice(index + 1)) if (!loser.claim.won && loser.claim.cursor < loser.claim.alternatives.length) { loser.claim.failures.push(`Alternative ${loser.claim.cursor + 1}: outbid for ${target}.`); loser.claim.cursor += 1; }
        break;
      }
    }
    if (!progressed) break;
  }
  const runId = `waiver-run-${command.commandId}`; const writes: FirestoreWrite[] = []; const receipts: Array<Record<string, unknown>> = [];
  for (const [franchiseId, mutable] of mutableTeams) {
    if (!mutable.wins) continue;
    writes.push(replaceWrite(store, mutable.team, mutable.team.path, { ...mutable.team.data, roster_player_ids: mutable.roster, roster_revision: mutable.rosterRevision, updated_at: processedAt }));
    writes.push(replaceWrite(store, mutable.state, waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId), { ...mutable.state.data, faab_remaining: mutable.faabRemaining, priority: mutable.priority, priority_week: payload.week, weekly_acquisitions: mutable.weekly, revision: Math.max(1, wholeNumber(mutable.state.data.revision, 1)) + mutable.wins, updated_at: processedAt }));
  }
  for (const claim of work) {
    const teamState = teamStates.get(claim.franchiseId)!; const won = claim.won; const priorityBefore = claim.outcome?.priorityBefore ?? Math.max(1, wholeNumber(teamState.data.priority, 1)); const priorityAfter = claim.outcome?.priorityAfter ?? priorityBefore; const faabRemaining = claim.outcome?.faabRemaining ?? wholeNumber(teamState.data.faab_remaining);
    if (won) {
      const addId = text(won.add_player_id); const dropId = text(won.drop_player_id); const bid = wholeNumber(won.bid); const nextRosterRevision = claim.outcome!.rosterRevisionAfter;
      const add = playerById.get(addId)!; writes.push(replaceWrite(store, add.document, playerStatePath(command.leagueId, command.seasonId, addId), playerRecord(add, "owned", claim.franchiseId, "", processedAt)));
      writes.push(createOnlyWrite(store, assetLockPath(command.leagueId, command.seasonId, "player", addId), { schema_version: 1, asset_type: "player", asset_id: addId, franchise_id: claim.franchiseId, league_id: command.leagueId, season_id: command.seasonId, source_command_id: command.commandId, created_at: processedAt, updated_at: processedAt }));
      if (dropId) {
        const drop = playerById.get(dropId)!; const droppedUntil = new Date(Date.parse(processedAt) + ctx.settings.transactions.droppedPlayerWaiverHours * 3600000).toISOString(); const lock = locks.get(dropId);
        writes.push(replaceWrite(store, drop.document, playerStatePath(command.leagueId, command.seasonId, dropId), playerRecord(drop, ctx.settings.transactions.droppedPlayerWaiverHours ? "on_waivers" : "free_agent", "", droppedUntil, processedAt)));
        if (lock) writes.push(deleteWrite(store, lock, assetLockPath(command.leagueId, command.seasonId, "player", dropId)));
      }
      const transactionId = `${runId}-${claim.id}`;
      writes.push(createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, transactionId), { schema_version: 1, id: transactionId, league_id: command.leagueId, season_id: command.seasonId, transaction_type: "waiver_award", assets_leaving: dropId ? [{ franchise_id: claim.franchiseId, assets: [{ type: "player", id: dropId, amount: null, metadata: {} }] }] : [], assets_entering: [{ franchise_id: claim.franchiseId, assets: [{ type: "player", id: addId, amount: null, metadata: { bid } }] }], effective_at: processedAt, source_command_id: command.commandId, settings_version_id: ctx.settingsVersionId, actor_user_id: actorUserId, approval_state: "accepted", review_state: ctx.settings.transactions.commissionerWaiverReview ? "commissioner_approved" : "not_required", before_roster_revisions: { [claim.franchiseId]: nextRosterRevision - 1 }, after_roster_revisions: { [claim.franchiseId]: nextRosterRevision }, audit_event_id: `audit-${command.commandId}`, reversal_of_transaction_id: "", reversed_by_transaction_id: "" }));
    }
    const winningBid = won ? wholeNumber(won.bid) : null; const sameTargetBids = won ? work.flatMap((other) => other.alternatives.filter((alternative) => text(alternative.add_player_id) === text(won.add_player_id)).map((alternative) => wholeNumber(alternative.bid))).sort((a, b) => b - a) : [];
    const receipt = { schema_version: 1, id: `${runId}__${claim.id}`, run_id: runId, claim_id: claim.id, league_id: command.leagueId, season_id: command.seasonId, franchise_id: claim.franchiseId, actor_user_id: claim.actorUserId, claims_evaluated: claim.cursor + (won ? 1 : 0), status: won ? "won" : "failed", winning_bid: winningBid, next_highest_bid: ctx.settings.transactions.revealNextHighestBid && sameTargetBids.length > 1 ? sameTargetBids[1] : null, priority_before: priorityBefore, priority_after: priorityAfter, tiebreaker_used: ctx.settings.transactions.waiverMode === "faab" ? ctx.settings.transactions.waiverTiebreaker : ctx.settings.transactions.waiverMode, failures: claim.failures, add_player_id: won ? text(won.add_player_id) : "", drop_player_id: won ? text(won.drop_player_id) : "", remaining_faab: faabRemaining, processed_at: processedAt, settings_version_id: ctx.settingsVersionId };
    receipts.push(receipt); writes.push(createOnlyWrite(store, waiverReceiptPath(command.leagueId, command.seasonId, text(receipt.id)), receipt));
    writes.push(replaceWrite(store, claim.document, waiverClaimPath(command.leagueId, command.seasonId, claim.id), { ...claim.document.data, status: won ? "won" : "failed", result: receipt, failures: claim.failures, revision: Math.max(1, wholeNumber(claim.document.data.revision, 1)) + 1, processed_run_id: runId, updated_at: processedAt }));
  }
  const nextRevision = waiverRevision + 1; const nextProcessingAt = nextWaiverProcessingAt(processedAt, ctx.settings); const auditRecord = audit({ command: command as LeagueCommand<WaiverCommand>, actorUserId, requestHash, processedAt, previousRevision: waiverRevision, resultingRevision: nextRevision, settingsVersionId: ctx.settingsVersionId, action: "waiver_run_processed", targetId: runId, reason: command.reason || "Process scheduled waiver run", summary: `${eligibleClaims.length} waiver claim groups were processed; ${winners.length} acquisitions succeeded.`, result: { runId, waiverStateRevision: nextRevision, claimsEvaluated: eligibleClaims.length, winners: winners.length, nextProcessingAt }, store });
  writes.push(createOnlyWrite(store, waiverRunPath(command.leagueId, command.seasonId, runId), { schema_version: 1, id: runId, league_id: command.leagueId, season_id: command.seasonId, week: payload.week, settings_version_id: ctx.settingsVersionId, process_through: new Date(through).toISOString(), processed_at: processedAt, claim_count: eligibleClaims.length, winner_count: winners.length, receipt_ids: receipts.map((receipt) => text(receipt.id)), audit_event_id: auditRecord.auditEventId }));
  writes.push(replaceWrite(store, waiverState, waiverStatePath(command.leagueId, command.seasonId), { ...waiverState.data, revision: nextRevision, settings_version_id: ctx.settingsVersionId, next_processing_at: nextProcessingAt, last_run_id: runId, updated_at: processedAt }));
  await store.commit([...writes, ...auditRecord.writes]); return auditRecord.receipt;
}

export async function executeAcquireFreeAgent(input: { command: LeagueCommand<"acquire_free_agent">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input; const ctx = await context(command as LeagueCommand<WaiverCommand>, actorUserId, processedAt, store); const payload = command.payload as AcquireFreeAgentPayload;
  if (ctx.settings.transactions.waiverMode !== "first_come_first_served") throw new LeagueCommandFailure("waiver_claim_required", "This league processes player acquisitions through waivers.", 409);
  if (command.expectedRevision !== ctx.seasonRevision || payload.settingsVersionId !== ctx.settingsVersionId) throw new LeagueCommandFailure("settings_changed", "Season or acquisition rules changed. Refresh before adding the player.", 409, ctx.seasonRevision);
  const franchiseId = text(payload.franchiseId); if (!controlsTeam(ctx, franchiseId)) throw new LeagueCommandFailure("permission_denied", "You do not control this team.", 403);
  const [team, teamState, addDocument, dropDocument, addLock, dropLock] = await Promise.all([store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams/${franchiseId}`), store.get(waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId)), store.get(playerStatePath(command.leagueId, command.seasonId, payload.addPlayerId)), payload.dropPlayerId ? store.get(playerStatePath(command.leagueId, command.seasonId, payload.dropPlayerId)) : Promise.resolve(null), store.get(assetLockPath(command.leagueId, command.seasonId, "player", payload.addPlayerId)), payload.dropPlayerId ? store.get(assetLockPath(command.leagueId, command.seasonId, "player", payload.dropPlayerId)) : Promise.resolve(null)]);
  if (!team || !teamState || !addDocument || addLock) throw new LeagueCommandFailure("player_unavailable", "That player is not a free agent.", 409); const rosterRevision = Math.max(1, wholeNumber(team.data.roster_revision, 1)); if (payload.expectedRosterRevision !== rosterRevision) throw new LeagueCommandFailure("stale_roster_revision", `The roster revision is ${rosterRevision}.`, 409, rosterRevision);
  const add = normalizePlayer(addDocument); if (add.state !== "free_agent" || (add.droppedUntil && Date.parse(add.droppedUntil) > Date.parse(processedAt))) throw new LeagueCommandFailure("player_unavailable", "That player is not currently eligible for immediate acquisition.", 409);
  const roster = stringList(team.data.roster_player_ids); if (payload.dropPlayerId && (!roster.includes(payload.dropPlayerId) || !dropDocument || !dropLock)) throw new LeagueCommandFailure("invalid_drop", "The conditional drop is no longer rostered.", 409);
  const allPlayers = await store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/playerStates`); const positions = new Map(allPlayers.map((document) => [text(document.data.player_id), text(document.data.position) as WaiverPlayerPosition])); const nextRoster = [...roster.filter((id) => id !== payload.dropPlayerId), payload.addPlayerId]; const legal = rosterLegal(nextRoster, positions, ctx.settings); if (legal) throw new LeagueCommandFailure("illegal_roster", legal);
  const acquisitions = wholeNumber(record(teamState.data.weekly_acquisitions)[String(payload.week)]); if (ctx.settings.transactions.weeklyAcquisitionLimit && acquisitions >= ctx.settings.transactions.weeklyAcquisitionLimit) throw new LeagueCommandFailure("weekly_acquisition_limit", "This team reached its weekly acquisition limit.");
  const nextRosterRevision = rosterRevision + 1; const transactionId = `free-agent-${command.commandId}`; const auditRecord = audit({ command: command as LeagueCommand<WaiverCommand>, actorUserId, requestHash, processedAt, previousRevision: rosterRevision, resultingRevision: nextRosterRevision, settingsVersionId: ctx.settingsVersionId, action: "free_agent_acquired", targetId: payload.addPlayerId, reason: command.reason || "Immediate free-agent acquisition", summary: `A free agent was added through the active first-come, first-served rules.`, result: { transactionId, addPlayerId: payload.addPlayerId, dropPlayerId: payload.dropPlayerId || null, rosterRevision: nextRosterRevision }, store });
  const weekly = { ...record(teamState.data.weekly_acquisitions), [String(payload.week)]: acquisitions + 1 }; const writes: FirestoreWrite[] = [replaceWrite(store, team, team.path, { ...team.data, roster_player_ids: nextRoster, roster_revision: nextRosterRevision, updated_at: processedAt }), replaceWrite(store, teamState, waiverTeamStatePath(command.leagueId, command.seasonId, franchiseId), { ...teamState.data, weekly_acquisitions: weekly, revision: Math.max(1, wholeNumber(teamState.data.revision, 1)) + 1, updated_at: processedAt }), replaceWrite(store, addDocument, playerStatePath(command.leagueId, command.seasonId, payload.addPlayerId), playerRecord(add, "owned", franchiseId, "", processedAt)), createOnlyWrite(store, assetLockPath(command.leagueId, command.seasonId, "player", payload.addPlayerId), { schema_version: 1, asset_type: "player", asset_id: payload.addPlayerId, franchise_id: franchiseId, league_id: command.leagueId, season_id: command.seasonId, source_command_id: command.commandId, created_at: processedAt, updated_at: processedAt })];
  if (payload.dropPlayerId && dropDocument && dropLock) { const drop = normalizePlayer(dropDocument); const droppedUntil = new Date(Date.parse(processedAt) + ctx.settings.transactions.droppedPlayerWaiverHours * 3600000).toISOString(); writes.push(replaceWrite(store, dropDocument, playerStatePath(command.leagueId, command.seasonId, payload.dropPlayerId), playerRecord(drop, ctx.settings.transactions.droppedPlayerWaiverHours ? "on_waivers" : "free_agent", "", droppedUntil, processedAt)), deleteWrite(store, dropLock, assetLockPath(command.leagueId, command.seasonId, "player", payload.dropPlayerId))); }
  writes.push(createOnlyWrite(store, rosterTransactionPath(command.leagueId, command.seasonId, transactionId), { schema_version: 1, id: transactionId, league_id: command.leagueId, season_id: command.seasonId, transaction_type: "add", assets_leaving: payload.dropPlayerId ? [{ franchise_id: franchiseId, assets: [{ type: "player", id: payload.dropPlayerId, amount: null, metadata: {} }] }] : [], assets_entering: [{ franchise_id: franchiseId, assets: [{ type: "player", id: payload.addPlayerId, amount: null, metadata: {} }] }], effective_at: processedAt, source_command_id: command.commandId, settings_version_id: ctx.settingsVersionId, actor_user_id: actorUserId, approval_state: "accepted", review_state: "not_required", before_roster_revisions: { [franchiseId]: rosterRevision }, after_roster_revisions: { [franchiseId]: nextRosterRevision }, audit_event_id: auditRecord.auditEventId, reversal_of_transaction_id: "", reversed_by_transaction_id: "" }), ...auditRecord.writes);
  await store.commit(writes); return auditRecord.receipt;
}
