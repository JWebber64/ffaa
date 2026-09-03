import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  ConfigureLineupWeekPayload,
  LeagueCommand,
  LeagueCommandReceipt,
  LineupPlayerAvailability,
  LineupWeekPlayerInput,
} from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings, type LeagueRosterSlot, type LeagueSettingsV1 } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  auditPrivatePath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  receiptRecord,
  record,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type NativeLineupCommandType = "configure_lineup_week" | "set_lineup_lock_override" | "save_weekly_lineup";
type ActiveRole = { role: string; franchiseId: string };

type NativeLineupContext = {
  league: LeagueCommandStoredDocument;
  season: LeagueCommandStoredDocument;
  settings: LeagueSettingsV1;
  settingsVersionId: string;
  seasonRevision: number;
  roles: ActiveRole[];
  teams: LeagueCommandStoredDocument[];
};

type StoredPlayerState = {
  player_id: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nfl_team: string;
  game_id: string;
  original_scheduled_start_at: string;
  scheduled_start_at: string;
  actual_started_at: string;
  game_status: "scheduled" | "in_progress" | "postponed" | "canceled" | "final";
  availability: LineupPlayerAvailability;
  projected_points: number;
};

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);
const VALID_GAME_STATUSES = new Set(["scheduled", "in_progress", "postponed", "canceled", "final"]);
const VALID_AVAILABILITY = new Set(["active", "questionable", "doubtful", "inactive", "out", "ir"]);

function nativeWeekPath(leagueId: string, seasonId: string, week: number) {
  return `leagues/${leagueId}/seasons/${seasonId}/lineupWeeks/week-${week}`;
}

function nativeLineupPath(leagueId: string, seasonId: string, franchiseId: string, week: number) {
  return `leagues/${leagueId}/seasons/${seasonId}/lineups/${franchiseId}_week-${week}`;
}

function roleActive(document: LeagueCommandStoredDocument, processedAt: string) {
  if (text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(processedAt)) return false;
  const expiresAt = Date.parse(text(document.data.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt);
}

async function nativeLineupContext(input: {
  command: LeagueCommand<NativeLineupCommandType>;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<NativeLineupContext> {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) {
    throw new LeagueCommandFailure("invalid_native_context", "Lineup operations require a canonical GameHQ league and season.");
  }
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_lineup_required", "This league is not using native GameHQ lineups.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId || text(league.data.current_season_id) !== command.seasonId) {
    throw new LeagueCommandFailure("season_changed", "The active native season changed. Refresh before editing the lineup.", 409);
  }
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active GameHQ league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant))
    .filter((grant) => text(grant.data.user_id) === actorUserId && roleActive(grant, processedAt));
  const roles = grants.map((grant) => ({ role: text(grant.data.role), franchiseId: text(grant.data.franchise_id) }));
  const settingsVersionId = text(season.data.settings_version_id);
  const settingsVersion = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null;
  if (!settingsVersion || text(settingsVersion.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Publish league rules before operating native lineups.", 409);
  const parsed = parseLeagueSettings(settingsVersion.data.settings, text(league.data.timezone) || "UTC");
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The published rules cannot validate this lineup.", 409);
  return {
    league,
    season,
    settings: parsed.settings,
    settingsVersionId,
    seasonRevision: Math.max(1, wholeNumber(season.data.revision, 1)),
    roles,
    teams: teams.filter((team) => text(team.data.status) !== "retired"),
  };
}

function isCommissioner(context: NativeLineupContext) {
  return context.roles.some(({ role }) => role === "commissioner" || role === "co_commissioner");
}

function canConfigureWeek(context: NativeLineupContext) {
  return context.roles.some(({ role }) => ["commissioner", "co_commissioner", "scheduler"].includes(role));
}

function validPlayerId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value);
}

function iso(value: unknown, required = false) {
  const normalized = text(value);
  if (!normalized && !required) return "";
  if (!Number.isFinite(Date.parse(normalized))) throw new LeagueCommandFailure("invalid_game_time", "Every lineup game time must be a valid ISO timestamp.");
  return new Date(normalized).toISOString();
}

function normalizeWeekPlayers(payload: ConfigureLineupWeekPayload, rosterPlayerIds: Set<string>): StoredPlayerState[] {
  if (!Array.isArray(payload.players) || !payload.players.length || payload.players.length > 512) {
    throw new LeagueCommandFailure("invalid_week_players", "Publish between 1 and 512 rostered player game states.");
  }
  const players = payload.players.map((source: LineupWeekPlayerInput) => {
    const playerId = text(source.playerId);
    const position = text(source.position).toUpperCase() === "DEF" ? "DST" : text(source.position).toUpperCase();
    const gameStatus = text(source.gameStatus);
    const availability = text(source.availability);
    if (!validPlayerId(playerId) || !rosterPlayerIds.has(playerId)) throw new LeagueCommandFailure("player_not_rostered", `Player ${playerId || "unknown"} is not on an active native roster.`);
    if (!VALID_POSITIONS.has(position)) throw new LeagueCommandFailure("invalid_player_position", `Player ${playerId} needs a supported lineup position.`);
    if (!VALID_GAME_STATUSES.has(gameStatus)) throw new LeagueCommandFailure("invalid_game_status", `Player ${playerId} has an unsupported game status.`);
    if (!VALID_AVAILABILITY.has(availability)) throw new LeagueCommandFailure("invalid_player_availability", `Player ${playerId} has an unsupported availability status.`);
    const scheduledStartAt = iso(source.scheduledStartAt, true);
    const originalScheduledStartAt = iso(source.originalScheduledStartAt || scheduledStartAt, true);
    const actualStartedAt = iso(source.actualStartedAt);
    const projectedPoints = Number(source.projectedPoints);
    return {
      player_id: playerId,
      position: position as StoredPlayerState["position"],
      nfl_team: text(source.nflTeam).toUpperCase().slice(0, 4),
      game_id: text(source.gameId).slice(0, 80) || `${text(source.nflTeam).toUpperCase()}-week-${payload.week}`,
      original_scheduled_start_at: originalScheduledStartAt,
      scheduled_start_at: scheduledStartAt,
      actual_started_at: actualStartedAt,
      game_status: gameStatus as StoredPlayerState["game_status"],
      availability: availability as StoredPlayerState["availability"],
      projected_points: Number.isFinite(projectedPoints) ? Math.max(-100, Math.min(200, projectedPoints)) : 0,
    };
  });
  if (new Set(players.map((player) => player.player_id)).size !== players.length) throw new LeagueCommandFailure("duplicate_week_player", "Each player can have only one Week game state.");
  return players.sort((left, right) => left.player_id.localeCompare(right.player_id));
}

function auditWrites(input: {
  command: LeagueCommand<NativeLineupCommandType>;
  actorUserId: string;
  processedAt: string;
  requestHash: string;
  context: NativeLineupContext;
  previousRevision: number;
  resultingRevision: number;
  action: string;
  target: { type: string; id: string };
  before: unknown;
  after: unknown;
  differences: unknown;
  reason: string;
  summary: string;
  result: Record<string, unknown>;
  store: LeagueCommandStore;
}) {
  const auditEventId = `audit-${input.command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: input.command.commandId,
    commandType: input.command.commandType,
    actorUserId: input.actorUserId,
    leagueId: input.command.leagueId,
    seasonId: input.command.seasonId,
    status: "accepted",
    previousRevision: input.previousRevision,
    resultingRevision: input.resultingRevision,
    auditEventId,
    serverProcessedAt: input.processedAt,
    requestHash: input.requestHash,
    result: input.result,
    error: null,
  };
  const common = {
    schema_version: 1,
    id: auditEventId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    actor_user_id: input.actorUserId,
    action: input.action,
    target: input.target,
    timestamp: input.processedAt,
    previous_revision: input.previousRevision,
    resulting_revision: input.resultingRevision,
    before: input.before,
    after: input.after,
    material_differences: input.differences,
    reason: input.reason,
    settings_version_id: input.context.settingsVersionId,
    command_id: input.command.commandId,
    transaction_id: "",
    public_summary: input.summary,
    private_metadata: {},
    reversal_of_audit_event_id: "",
  };
  return {
    receipt,
    auditEventId,
    writes: [
      createOnlyWrite(input.store, auditPath(input.command.leagueId, auditEventId), common),
      createOnlyWrite(input.store, auditPrivatePath(input.command.leagueId, auditEventId), { ...common, private_metadata: { command_payload: input.command.payload } }),
      createOnlyWrite(input.store, commandPath(input.command.leagueId, input.command.commandId), receiptRecord(receipt)),
    ] satisfies FirestoreWrite[],
  };
}

function seasonRevisionWrite(store: LeagueCommandStore, command: LeagueCommand<NativeLineupCommandType>, context: NativeLineupContext, processedAt: string) {
  return replaceWrite(store, context.season, `leagues/${command.leagueId}/seasons/${command.seasonId}`, {
    ...context.season.data,
    revision: context.seasonRevision + 1,
    updated_at: processedAt,
  });
}

export async function executeConfigureLineupWeek(input: {
  command: LeagueCommand<"configure_lineup_week">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await nativeLineupContext({ command, actorUserId, processedAt, store });
  if (!canConfigureWeek(context)) throw new LeagueCommandFailure("permission_denied", "A commissioner or scheduler role is required to publish weekly player game states.", 403);
  if (command.expectedRevision !== context.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season changed after this week was opened. The current revision is ${context.seasonRevision}.`, 409, context.seasonRevision);
  const week = wholeNumber(command.payload.week);
  if (week < 1 || week > context.settings.lineup.lineupWeekCount) throw new LeagueCommandFailure("invalid_week", `Choose a lineup week from 1 to ${context.settings.lineup.lineupWeekCount}.`);
  const weekPath = nativeWeekPath(command.leagueId, command.seasonId, week);
  const current = await store.get(weekPath);
  const currentRevision = current ? Math.max(1, wholeNumber(current.data.revision, 1)) : 0;
  if (wholeNumber(command.payload.expectedWeekRevision, -1) !== currentRevision) throw new LeagueCommandFailure("stale_week_revision", `Week ${week} game states changed. The current revision is ${currentRevision}.`, 409, currentRevision);
  const rosterIds = new Set(context.teams.flatMap((team) => stringList(team.data.roster_player_ids)));
  const players = normalizeWeekPlayers(command.payload, rosterIds);
  const nextRevision = currentRevision + 1;
  const audit = auditWrites({
    command,
    actorUserId,
    processedAt,
    requestHash,
    context,
    previousRevision: context.seasonRevision,
    resultingRevision: context.seasonRevision + 1,
    action: "lineup_week_configured",
    target: { type: "lineup_week", id: `week-${week}` },
    before: { revision: currentRevision },
    after: { revision: nextRevision, player_count: players.length },
    differences: { player_count: players.length },
    reason: command.reason || `Publish Week ${week} player game states`,
    summary: `Week ${week} player game and lock states were published.`,
    result: { week, weekRevision: nextRevision, playerCount: players.length },
    store,
  });
  const nextWeek = {
    schema_version: 1,
    id: `week-${week}`,
    league_id: command.leagueId,
    season_id: command.seasonId,
    week,
    settings_version_id: context.settingsVersionId,
    timezone: context.settings.timezone,
    revision: nextRevision,
    players,
    lock_overrides: record(current?.data.lock_overrides),
    published_by_user_id: actorUserId,
    audit_event_id: audit.auditEventId,
    created_at: text(current?.data.created_at) || processedAt,
    updated_at: processedAt,
  };
  try {
    await store.commit([
      replaceWrite(store, current, weekPath, nextWeek),
      seasonRevisionWrite(store, command, context, processedAt),
      ...audit.writes,
    ]);
  } catch (error) {
    const latest = await store.get(weekPath);
    const latestRevision = latest ? Math.max(1, wholeNumber(latest.data.revision, 1)) : 0;
    if (latestRevision !== currentRevision) throw new LeagueCommandFailure("stale_week_revision", `Week ${week} changed while publishing. The current revision is ${latestRevision}.`, 409, latestRevision);
    throw error;
  }
  return audit.receipt;
}

export async function executeSetLineupLockOverride(input: {
  command: LeagueCommand<"set_lineup_lock_override">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await nativeLineupContext({ command, actorUserId, processedAt, store });
  if (!isCommissioner(context)) throw new LeagueCommandFailure("permission_denied", "A commissioner role is required for an emergency lineup reopening.", 403);
  if (command.reason.trim().length < 5) throw new LeagueCommandFailure("override_reason_required", "Explain the emergency reopening in at least five characters.");
  if (command.expectedRevision !== context.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The season changed after this week was opened. The current revision is ${context.seasonRevision}.`, 409, context.seasonRevision);
  const week = wholeNumber(command.payload.week);
  const weekPath = nativeWeekPath(command.leagueId, command.seasonId, week);
  const current = await store.get(weekPath);
  if (!current) throw new LeagueCommandFailure("lineup_week_not_ready", `Publish Week ${week} game states before reopening players.`, 409);
  const currentRevision = Math.max(1, wholeNumber(current.data.revision, 1));
  if (wholeNumber(command.payload.expectedWeekRevision, -1) !== currentRevision) throw new LeagueCommandFailure("stale_week_revision", `Week ${week} changed. The current revision is ${currentRevision}.`, 409, currentRevision);
  const availableIds = new Set((Array.isArray(current.data.players) ? current.data.players : []).map((value) => text(record(value).player_id)));
  const playerIds = [...new Set(stringList(command.payload.playerIds).map((id) => id.trim()).filter(Boolean))];
  if (!playerIds.length || playerIds.length > 64 || playerIds.some((id) => !availableIds.has(id))) throw new LeagueCommandFailure("invalid_override_players", "Choose between 1 and 64 players published for this week.");
  const reopenedUntil = command.payload.reopenedUntil === null ? "" : iso(command.payload.reopenedUntil, true);
  if (reopenedUntil && Date.parse(reopenedUntil) <= Date.parse(processedAt)) throw new LeagueCommandFailure("invalid_reopen_deadline", "The emergency reopening deadline must be in the future.");
  const beforeOverrides = record(current.data.lock_overrides);
  const nextOverrides = { ...beforeOverrides };
  for (const playerId of playerIds) {
    if (!reopenedUntil) delete nextOverrides[playerId];
    else nextOverrides[playerId] = { reopened_until: reopenedUntil, reason: command.reason, actor_user_id: actorUserId, command_id: command.commandId, created_at: processedAt };
  }
  const nextRevision = currentRevision + 1;
  const audit = auditWrites({
    command,
    actorUserId,
    processedAt,
    requestHash,
    context,
    previousRevision: context.seasonRevision,
    resultingRevision: context.seasonRevision + 1,
    action: reopenedUntil ? "lineup_players_reopened" : "lineup_player_reopenings_cleared",
    target: { type: "lineup_week", id: `week-${week}` },
    before: { lock_overrides: beforeOverrides },
    after: { lock_overrides: nextOverrides },
    differences: { player_ids: playerIds, reopened_until: reopenedUntil },
    reason: command.reason,
    summary: reopenedUntil ? `${playerIds.length} Week ${week} player lock${playerIds.length === 1 ? "" : "s"} were reopened until ${reopenedUntil}.` : `${playerIds.length} Week ${week} emergency reopening${playerIds.length === 1 ? " was" : "s were"} cleared.`,
    result: { week, weekRevision: nextRevision, playerIds, reopenedUntil: reopenedUntil || null },
    store,
  });
  await store.commit([
    replaceWrite(store, current, weekPath, { ...current.data, revision: nextRevision, lock_overrides: nextOverrides, audit_event_id: audit.auditEventId, updated_at: processedAt }),
    seasonRevisionWrite(store, command, context, processedAt),
    ...audit.writes,
  ]);
  return audit.receipt;
}

function assignments(value: unknown) {
  return Object.fromEntries(Object.entries(record(value)).flatMap(([slot, playerValue]) => {
    const playerId = text(playerValue);
    return slot && playerId ? [[slot, playerId]] : [];
  }));
}

function starterSlots(settings: LeagueSettingsV1) {
  return settings.rosterSlots.flatMap((row) => ["BENCH", "IR"].includes(row.slot)
    ? []
    : Array.from({ length: row.count }, (_, index) => ({ key: `${row.slot}-${index + 1}`, slot: row.slot, eligible: row.eligible })));
}

function eligible(position: string, slot: { slot: LeagueRosterSlot; eligible: LeagueRosterSlot[] }) {
  const normalized = position === "DEF" ? "DST" : position;
  return slot.slot === normalized || slot.eligible.includes(normalized as LeagueRosterSlot);
}

function bestBallAssignments(settings: LeagueSettingsV1, rosterIds: string[], playerById: Map<string, StoredPlayerState>) {
  const used = new Set<string>();
  const result: Record<string, string> = {};
  for (const slot of starterSlots(settings)) {
    const candidate = rosterIds
      .map((id) => playerById.get(id))
      .filter((player): player is StoredPlayerState => {
        if (!player) return false;
        return !used.has(player.player_id) && !["inactive", "out", "ir"].includes(player.availability) && eligible(player.position, slot);
      })
      .sort((left, right) => right.projected_points - left.projected_points || left.player_id.localeCompare(right.player_id))[0];
    if (candidate) {
      result[slot.key] = candidate.player_id;
      used.add(candidate.player_id);
    }
  }
  return result;
}

function applyInactiveFallbacks(input: {
  assignments: Record<string, string>;
  fallbackIds: string[];
  settings: LeagueSettingsV1;
  rosterIds: Set<string>;
  playerById: Map<string, StoredPlayerState>;
}) {
  const result = { ...input.assignments };
  const substitutions: Array<{ slot: string; from: string; to: string }> = [];
  if (input.settings.lineup.inactiveSubstitution !== "ordered_fallback") return { assignments: result, substitutions };
  const used = new Set(Object.values(result));
  const slotByKey = new Map(starterSlots(input.settings).map((slot) => [slot.key, slot]));
  for (const [slotKey, playerId] of Object.entries(result)) {
    const player = input.playerById.get(playerId);
    if (!player || !["inactive", "out"].includes(player.availability)) continue;
    const slot = slotByKey.get(slotKey);
    if (!slot) continue;
    const replacement = input.fallbackIds.find((candidateId) => {
      const candidate = input.playerById.get(candidateId);
      return input.rosterIds.has(candidateId) && !used.has(candidateId) && candidate && !["inactive", "out", "ir"].includes(candidate.availability) && eligible(candidate.position, slot);
    });
    if (!replacement) continue;
    result[slotKey] = replacement;
    used.delete(playerId);
    used.add(replacement);
    substitutions.push({ slot: slotKey, from: playerId, to: replacement });
  }
  return { assignments: result, substitutions };
}

function playerLock(input: {
  player: StoredPlayerState;
  settings: LeagueSettingsV1;
  firstGameAt: number;
  override: Record<string, unknown>;
  now: number;
}) {
  const reopenedUntil = Date.parse(text(input.override.reopened_until));
  if (Number.isFinite(reopenedUntil) && reopenedUntil > input.now) return { locked: false, lockAt: new Date(reopenedUntil).toISOString(), reason: `Emergency reopening until ${new Date(reopenedUntil).toISOString()}` };
  const { player, settings, now } = input;
  if (player.game_status === "canceled") {
    return settings.lineup.canceledGamePolicy === "lock"
      ? { locked: true, lockAt: player.scheduled_start_at, reason: "Canceled-game policy keeps this player locked." }
      : { locked: false, lockAt: "", reason: "Canceled-game policy leaves this player unlocked." };
  }
  const effectivePolicy = !settings.lineup.lateSwap ? "first_game" : settings.lineup.lockPolicy;
  if (effectivePolicy === "first_game") {
    return { locked: Number.isFinite(input.firstGameAt) && now >= input.firstGameAt, lockAt: Number.isFinite(input.firstGameAt) ? new Date(input.firstGameAt).toISOString() : "", reason: "The league locks every lineup when the first game begins." };
  }
  if (effectivePolicy === "actual_start" || (player.game_status === "postponed" && settings.lineup.postponedGamePolicy === "unlock_until_actual")) {
    const actual = Date.parse(player.actual_started_at);
    const started = Number.isFinite(actual) && now >= actual || ["in_progress", "final"].includes(player.game_status);
    return { locked: started, lockAt: Number.isFinite(actual) ? new Date(actual).toISOString() : "", reason: started ? "This player's game has actually started." : "This player stays open until the game actually starts." };
  }
  const startSource = player.game_status === "postponed" && settings.lineup.postponedGamePolicy === "original_start"
    ? player.original_scheduled_start_at
    : player.scheduled_start_at;
  const start = Date.parse(startSource);
  const locked = Number.isFinite(start) && now >= start;
  return { locked, lockAt: Number.isFinite(start) ? new Date(start).toISOString() : "", reason: locked ? "This player's scheduled lock time has passed." : "This player remains editable until the scheduled lock time." };
}

function validateLineup(input: {
  assignments: Record<string, string>;
  settings: LeagueSettingsV1;
  rosterIds: Set<string>;
  irIds: Set<string>;
  playerById: Map<string, StoredPlayerState>;
}) {
  const slots = starterSlots(input.settings);
  const allowedKeys = new Set(slots.map((slot) => slot.key));
  if (Object.keys(input.assignments).some((key) => !allowedKeys.has(key))) throw new LeagueCommandFailure("invalid_lineup_slot", "The lineup contains a slot that is not in the published rulebook.");
  if (slots.some((slot) => !input.assignments[slot.key])) throw new LeagueCommandFailure("incomplete_lineup", `Fill all ${slots.length} required starter slots.`);
  const playerIds = Object.values(input.assignments);
  if (new Set(playerIds).size !== playerIds.length) throw new LeagueCommandFailure("duplicate_starter", "A player can start only once.");
  for (const slot of slots) {
    const playerId = input.assignments[slot.key]!;
    if (!input.rosterIds.has(playerId)) throw new LeagueCommandFailure("player_not_rostered", `Player ${playerId} is not on this team's active roster.`);
    if (input.irIds.has(playerId)) throw new LeagueCommandFailure("ir_player_started", `Player ${playerId} must leave injured reserve before starting.`);
    const player = input.playerById.get(playerId);
    if (!player) throw new LeagueCommandFailure("player_game_state_missing", `Player ${playerId} has no published game or lock state for this week.`);
    if (!eligible(player.position, slot)) throw new LeagueCommandFailure("position_ineligible", `Player ${playerId} is not eligible for ${slot.key}.`);
  }
}

function changedPlayers(before: Record<string, string>, after: Record<string, string>) {
  const changedSlots = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((slot) => before[slot] !== after[slot]);
  return [...new Set(changedSlots.flatMap((slot) => [before[slot], after[slot]]).filter((id): id is string => Boolean(id)))];
}

export async function executeSaveNativeWeeklyLineup(input: {
  command: LeagueCommand<"save_weekly_lineup">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await nativeLineupContext({ command, actorUserId, processedAt, store });
  const expectedSeasonRevision = wholeNumber(command.payload.expectedSeasonRevision, -1);
  if (expectedSeasonRevision !== context.seasonRevision) throw new LeagueCommandFailure("stale_season_revision", `The season changed after this lineup was opened. The current revision is ${context.seasonRevision}.`, 409, context.seasonRevision);
  if (text(command.payload.settingsVersionId) !== context.settingsVersionId) throw new LeagueCommandFailure("settings_changed", "The published lineup settings changed. Refresh before saving.", 409);
  const week = wholeNumber(command.payload.week);
  if (week < 1 || week > context.settings.lineup.lineupWeekCount) throw new LeagueCommandFailure("invalid_week", `Choose a lineup week from 1 to ${context.settings.lineup.lineupWeekCount}.`);
  const franchiseId = text(command.payload.franchiseId);
  const team = context.teams.find((candidate) => text(candidate.data.franchise_id) === franchiseId || text(candidate.data.id) === franchiseId);
  if (!team) throw new LeagueCommandFailure("team_not_found", "The selected native team no longer exists.", 404);
  const commissioner = isCommissioner(context);
  const controlsTeam = context.roles.some(({ role, franchiseId: controlledId }) => ["team_owner", "co_manager"].includes(role) && controlledId === franchiseId);
  if (!commissioner && !controlsTeam) throw new LeagueCommandFailure("permission_denied", "Your active GameHQ role does not control this franchise.", 403);
  const rosterRevision = Math.max(1, wholeNumber(team.data.roster_revision, 1));
  if (wholeNumber(command.payload.expectedRosterRevision, -1) !== rosterRevision) throw new LeagueCommandFailure("stale_roster_revision", `The team roster changed. The current roster revision is ${rosterRevision}.`, 409, rosterRevision);
  const weekPath = nativeWeekPath(command.leagueId, command.seasonId, week);
  const lineupPath = nativeLineupPath(command.leagueId, command.seasonId, franchiseId, week);
  const [weekState, currentLineup] = await Promise.all([store.get(weekPath), store.get(lineupPath)]);
  if (!weekState || text(weekState.data.settings_version_id) !== context.settingsVersionId) throw new LeagueCommandFailure("lineup_week_not_ready", `Week ${week} player game states are not published for the active rulebook.`, 409);
  const currentRevision = currentLineup ? Math.max(1, wholeNumber(currentLineup.data.revision, 1)) : 0;
  if (command.expectedRevision !== currentRevision) throw new LeagueCommandFailure("stale_revision", `This lineup changed after you opened it. The current revision is ${currentRevision}.`, 409, currentRevision);
  const playerStates = (Array.isArray(weekState.data.players) ? weekState.data.players : []).map((value) => record(value) as StoredPlayerState);
  const playerById = new Map(playerStates.map((player) => [text(player.player_id), player]));
  const rosterIds = new Set(stringList(team.data.roster_player_ids));
  const irIds = new Set(stringList(team.data.ir_player_ids));
  const fallbackIds = [...new Set(stringList(command.payload.orderedFallbackPlayerIds).filter((id) => rosterIds.has(id)))];
  const submitted = context.settings.lineup.automaticMode === "best_ball"
    ? bestBallAssignments(context.settings, [...rosterIds], playerById)
    : assignments(command.payload.assignments);
  const fallbackResult = applyInactiveFallbacks({ assignments: submitted, fallbackIds, settings: context.settings, rosterIds, playerById });
  validateLineup({ assignments: fallbackResult.assignments, settings: context.settings, rosterIds, irIds, playerById });
  const beforeAssignments = assignments(currentLineup?.data.assignments);
  const overrides = record(weekState.data.lock_overrides);
  const firstGameAt = playerStates.map((player) => Date.parse(player.original_scheduled_start_at || player.scheduled_start_at)).filter(Number.isFinite).sort((a, b) => a - b)[0] ?? Number.NaN;
  const now = Date.parse(processedAt);
  const autoChanged = new Set(fallbackResult.substitutions.flatMap((entry) => [entry.from, entry.to]));
  const blocked = changedPlayers(beforeAssignments, fallbackResult.assignments).flatMap((playerId) => {
    if (autoChanged.has(playerId)) return [];
    const player = playerById.get(playerId);
    if (!player) return [];
    const lock = playerLock({ player, settings: context.settings, firstGameAt, override: record(overrides[playerId]), now });
    return lock.locked ? [{ playerId, ...lock }] : [];
  });
  const overrideReason = text(command.payload.overrideReason).replace(/\s+/gu, " ").slice(0, 240);
  if (blocked.length && !commissioner) throw new LeagueCommandFailure("player_locked", `${blocked[0]!.playerId} cannot move. ${blocked[0]!.reason}`, 409, currentRevision);
  if (blocked.length && overrideReason.length < 5) throw new LeagueCommandFailure("override_reason_required", "Explain the commissioner lineup override in at least five characters.");
  const nextRevision = currentRevision + 1;
  const action = blocked.length ? "lineup_override" : "lineup_saved";
  const audit = auditWrites({
    command,
    actorUserId,
    processedAt,
    requestHash,
    context,
    previousRevision: currentRevision,
    resultingRevision: nextRevision,
    action,
    target: { type: "lineup", id: `${franchiseId}_week-${week}` },
    before: beforeAssignments,
    after: fallbackResult.assignments,
    differences: { changed_players: changedPlayers(beforeAssignments, fallbackResult.assignments), locked_overrides: blocked, automatic_substitutions: fallbackResult.substitutions },
    reason: overrideReason,
    summary: `Week ${week} lineup for ${text(team.data.name) || "a native team"} was ${blocked.length ? "overridden" : "saved"}.`,
    result: { lineupId: `${franchiseId}_week-${week}`, week, rosterRevision, automaticSubstitutions: fallbackResult.substitutions },
    store,
  });
  const nextLineup = {
    schema_version: 1,
    id: `${franchiseId}_week-${week}`,
    league_id: command.leagueId,
    season_id: command.seasonId,
    franchise_id: franchiseId,
    week,
    settings_version_id: context.settingsVersionId,
    season_revision: context.seasonRevision,
    roster_revision: rosterRevision,
    lineup_week_revision: Math.max(1, wholeNumber(weekState.data.revision, 1)),
    assignments: fallbackResult.assignments,
    ordered_fallback_player_ids: fallbackIds,
    selection_mode: context.settings.lineup.automaticMode,
    automatic_substitutions: fallbackResult.substitutions,
    revision: nextRevision,
    audit_event_id: audit.auditEventId,
    updated_by_user_id: actorUserId,
    created_at: text(currentLineup?.data.created_at) || processedAt,
    updated_at: processedAt,
  };
  try {
    await store.commit([replaceWrite(store, currentLineup, lineupPath, nextLineup), ...audit.writes]);
  } catch (error) {
    const latest = await store.get(lineupPath);
    const latestRevision = latest ? Math.max(1, wholeNumber(latest.data.revision, 1)) : 0;
    if (latestRevision !== currentRevision) throw new LeagueCommandFailure("stale_revision", `This lineup changed while saving. The current revision is ${latestRevision}.`, 409, latestRevision);
    throw error;
  }
  return audit.receipt;
}

export function describeNativePlayerLock(input: {
  player: StoredPlayerState;
  settings: LeagueSettingsV1;
  firstGameAt: number;
  override: Record<string, unknown>;
  now: number;
}) {
  return playerLock(input);
}
