import { createHash } from "node:crypto";

import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  IngestScoringEventsPayload,
  LeagueCommand,
  LeagueCommandReceipt,
  NativeScoringEventInput,
  NativeScoringMatchupInput,
  NativeScoringStatistic,
} from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings, type LeagueSettingsV1 } from "../../shared/leagueSettings";
import { replayNativeScoring, scoringFreshness, type NormalizedScoringEvent } from "../../shared/nativeScoring";
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

type ScoringCommand = "ingest_scoring_events" | "recalculate_scoring_week";
type ScoringContext = {
  season: LeagueCommandStoredDocument;
  settings: LeagueSettingsV1;
  settingsVersionId: string;
  seasonRevision: number;
  teams: LeagueCommandStoredDocument[];
  roles: string[];
};

const STATISTICS = new Set<NativeScoringStatistic>([
  "passing_yards", "passing_touchdowns", "interceptions", "rushing_yards",
  "rushing_touchdowns", "receiving_yards", "receptions", "receiving_touchdowns",
]);

function scoringWeekPath(leagueId: string, seasonId: string, week: number) {
  return `leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-${week}`;
}

function scoringEventPath(leagueId: string, seasonId: string, eventKey: string) {
  return `leagues/${leagueId}/seasons/${seasonId}/scoringEvents/${eventKey}`;
}

function scoringEventRevisionPath(leagueId: string, seasonId: string, eventKey: string, revision: number) {
  return `leagues/${leagueId}/seasons/${seasonId}/scoringEventRevisions/${eventKey}__r-${revision}`;
}

function eventKey(providerKey: string, providerEventId: string) {
  return createHash("sha256").update(`${providerKey}:${providerEventId}`).digest("hex").slice(0, 40);
}

function iso(value: unknown, label: string) {
  const normalized = text(value);
  if (!Number.isFinite(Date.parse(normalized))) throw new LeagueCommandFailure("invalid_scoring_time", `${label} must be a valid ISO timestamp.`);
  return new Date(normalized).toISOString();
}

function activeRole(document: LeagueCommandStoredDocument, now: string) {
  if (text(document.data.revoked_at)) return false;
  const starts = Date.parse(text(document.data.effective_at));
  const ends = Date.parse(text(document.data.expires_at));
  return (!Number.isFinite(starts) || starts <= Date.parse(now)) && (!Number.isFinite(ends) || ends > Date.parse(now));
}

async function scoringContext(command: LeagueCommand<ScoringCommand>, actorUserId: string, processedAt: string, store: LeagueCommandStore): Promise<ScoringContext> {
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "Scoring requires a canonical GameHQ league and season.");
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_scoring_required", "This league is not using native GameHQ scoring.", 409);
  if (!season || text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh scoring before continuing.", 409);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "Active league membership is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((entry): entry is LeagueCommandStoredDocument => Boolean(entry))
    .filter((entry) => text(entry.data.user_id) === actorUserId && activeRole(entry, processedAt));
  const roles = grants.map((entry) => text(entry.data.role));
  if (!roles.some((role) => ["commissioner", "co_commissioner", "historian"].includes(role))) throw new LeagueCommandFailure("permission_denied", "A commissioner or scoring historian role is required to ingest NFL scoring events.", 403);
  const settingsVersionId = text(season.data.settings_version_id);
  const settingsDocument = settingsVersionId ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`) : null;
  if (!settingsDocument || text(settingsDocument.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Publish scoring rules before ingesting NFL events.", 409);
  const parsed = parseLeagueSettings(settingsDocument.data.settings, text(league.data.timezone) || "UTC");
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The active scoring settings are invalid.", 409);
  return {
    season,
    settings: parsed.settings,
    settingsVersionId,
    seasonRevision: Math.max(1, wholeNumber(season.data.revision, 1)),
    teams: teams.filter((team) => text(team.data.status) !== "retired"),
    roles,
  };
}

function normalizeMatchups(value: NativeScoringMatchupInput[] | undefined, teams: LeagueCommandStoredDocument[], current: LeagueCommandStoredDocument | null) {
  const source = value ?? (Array.isArray(current?.data.matchups) ? current.data.matchups.map((entry) => {
    const row = record(entry);
    return { matchupId: text(row.matchup_id), homeFranchiseId: text(row.home_franchise_id), awayFranchiseId: text(row.away_franchise_id) };
  }) : []);
  if (!source.length) throw new LeagueCommandFailure("scoring_matchups_required", "Configure at least one Week matchup before scoring events are replayed.");
  const activeIds = new Set(teams.map((team) => text(team.data.franchise_id) || text(team.data.id)));
  const used = new Set<string>();
  const ids = new Set<string>();
  const normalized = source.map((row, index) => {
    const matchupId = text(row.matchupId) || `week-matchup-${index + 1}`;
    const homeFranchiseId = text(row.homeFranchiseId);
    const awayFranchiseId = text(row.awayFranchiseId);
    if (!/^[A-Za-z0-9_.:-]{1,80}$/u.test(matchupId) || ids.has(matchupId)) throw new LeagueCommandFailure("invalid_scoring_matchup", "Each matchup needs one unique identifier.");
    if (!activeIds.has(homeFranchiseId) || !activeIds.has(awayFranchiseId) || homeFranchiseId === awayFranchiseId) throw new LeagueCommandFailure("invalid_scoring_matchup", "Each matchup must pair two different active native teams.");
    if (used.has(homeFranchiseId) || used.has(awayFranchiseId)) throw new LeagueCommandFailure("duplicate_scoring_team", "A team can appear only once in a Week scoring slate.");
    ids.add(matchupId); used.add(homeFranchiseId); used.add(awayFranchiseId);
    return { matchup_id: matchupId, home_franchise_id: homeFranchiseId, away_franchise_id: awayFranchiseId };
  });
  return normalized;
}

function normalizeGameStatuses(payload: IngestScoringEventsPayload | null, current: LeagueCommandStoredDocument | null) {
  const statuses = { ...record(current?.data.game_statuses) };
  for (const row of payload?.gameStatuses ?? []) {
    const nflGameId = text(row.nflGameId);
    if (!nflGameId || !["scheduled", "in_progress", "final", "postponed", "canceled"].includes(row.status)) throw new LeagueCommandFailure("invalid_game_status", "Every scoring game needs a supported status.");
    statuses[nflGameId] = row.status;
  }
  return statuses;
}

function eventComparable(event: NormalizedScoringEvent) {
  const { revision: _revision, corrected: _corrected, ...rest } = event;
  return JSON.stringify(rest);
}

function normalizeStoredEvent(document: LeagueCommandStoredDocument): NormalizedScoringEvent | null {
  const data = document.data;
  const statistics = (Array.isArray(data.normalized_statistics) ? data.normalized_statistics : []).flatMap((value) => {
    const row = record(value);
    const statistic = text(row.statistic) as NativeScoringStatistic;
    const amount = Number(row.value);
    return STATISTICS.has(statistic) && Number.isFinite(amount) ? [{ statistic, value: amount }] : [];
  });
  const key = text(data.event_key);
  if (!key || !statistics.length) return null;
  return {
    eventKey: key,
    providerKey: text(data.provider_key),
    providerEventId: text(data.provider_event_id),
    providerTimestamp: text(data.provider_timestamp),
    occurredAt: text(data.occurred_at),
    playerId: text(data.player_id),
    nflGameId: text(data.nfl_game_id),
    statistics,
    description: text(data.description),
    correctionOfEventKey: text(data.correction_of_event_key),
    revision: Math.max(1, wholeNumber(data.revision, 1)),
    ingestionVersion: text(data.ingestion_version),
    corrected: Boolean(data.corrected),
  };
}

function normalizeIncomingEvent(source: NativeScoringEventInput, payload: IngestScoringEventsPayload, knownPlayerIds: Set<string>, existingByKey: Map<string, NormalizedScoringEvent>) {
  const providerEventId = text(source.providerEventId);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u.test(providerEventId)) throw new LeagueCommandFailure("invalid_provider_event_id", "Every provider event needs a stable provider event ID.");
  const playerId = text(source.playerId);
  if (!knownPlayerIds.has(playerId)) throw new LeagueCommandFailure("unknown_scoring_player", `Player ${playerId || "unknown"} is not published in this Week player state.`);
  const nflGameId = text(source.nflGameId);
  if (!nflGameId || nflGameId.length > 100) throw new LeagueCommandFailure("invalid_nfl_game", "Every scoring event needs an NFL game ID.");
  const statistics = (source.statistics ?? []).map((row) => {
    const statistic = text(row.statistic) as NativeScoringStatistic;
    const value = Number(row.value);
    if (!STATISTICS.has(statistic) || !Number.isFinite(value) || Math.abs(value) > 10000) throw new LeagueCommandFailure("invalid_normalized_stat", "Every normalized statistic must use a supported rule and finite value.");
    return { statistic, value };
  });
  if (!statistics.length || statistics.length > 16 || new Set(statistics.map((row) => row.statistic)).size !== statistics.length) throw new LeagueCommandFailure("invalid_normalized_stats", "Each provider event needs between 1 and 16 unique normalized statistics.");
  const key = eventKey(payload.providerKey, providerEventId);
  const correctionOfEventKey = source.correctionOfProviderEventId ? eventKey(payload.providerKey, text(source.correctionOfProviderEventId)) : "";
  if (correctionOfEventKey && !existingByKey.has(correctionOfEventKey)) throw new LeagueCommandFailure("correction_target_missing", "The corrected provider event does not exist in the current event ledger.");
  return {
    eventKey: key,
    providerKey: payload.providerKey,
    providerEventId,
    providerTimestamp: iso(source.providerTimestamp, "Provider timestamp"),
    occurredAt: iso(source.occurredAt, "Event occurrence time"),
    playerId,
    nflGameId,
    statistics,
    description: text(source.description).slice(0, 240) || "Fantasy scoring event",
    correctionOfEventKey,
    revision: (existingByKey.get(key)?.revision ?? 0) + 1,
    ingestionVersion: payload.ingestionVersion,
    corrected: Boolean(correctionOfEventKey || existingByKey.has(key)),
  } satisfies NormalizedScoringEvent;
}

function starterSlotRows(settings: LeagueSettingsV1) {
  return settings.rosterSlots.flatMap((slot) => ["BENCH", "IR"].includes(slot.slot)
    ? []
    : Array.from({ length: slot.count }, (_, index) => ({ key: `${slot.slot}-${index + 1}`, slot: slot.slot, eligible: slot.slot === "FLEX" ? ["RB", "WR", "TE"] : [slot.slot] })));
}

function optimalLineup(team: LeagueCommandStoredDocument, settings: LeagueSettingsV1, positions: Map<string, string>, totals: Record<string, number>) {
  const remaining = new Set(stringList(team.data.roster_player_ids));
  const assignments: Record<string, string> = {};
  for (const slot of starterSlotRows(settings).sort((left, right) => left.eligible.length - right.eligible.length)) {
    const playerId = [...remaining]
      .filter((id) => slot.eligible.includes(positions.get(id) ?? ""))
      .sort((left, right) => (totals[right] ?? 0) - (totals[left] ?? 0) || left.localeCompare(right))[0];
    if (playerId) { assignments[slot.key] = playerId; remaining.delete(playerId); }
  }
  return assignments;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function buildReadModel(input: {
  command: LeagueCommand<ScoringCommand>;
  context: ScoringContext;
  current: LeagueCommandStoredDocument | null;
  revision: number;
  matchups: Array<Record<string, unknown>>;
  gameStatuses: Record<string, unknown>;
  events: NormalizedScoringEvent[];
  processedAt: string;
  providerKey: string;
  fallbackProviderKey: string;
  providerState: "live" | "delayed" | "unavailable";
  ingestionVersion: string;
  duplicateCount: number;
  correctionCount: number;
  lineups: LeagueCommandStoredDocument[];
  lineupWeek: LeagueCommandStoredDocument;
}) {
  const replay = replayNativeScoring(input.events, input.context.settings);
  const weekPlayers = Array.isArray(input.lineupWeek.data.players) ? input.lineupWeek.data.players.map(record) : [];
  const positions = new Map(weekPlayers.map((player) => [text(player.player_id), text(player.position)]));
  const playerGame = new Map(weekPlayers.map((player) => [text(player.player_id), text(player.game_id)]));
  const projected = new Map(weekPlayers.map((player) => [text(player.player_id), Number(player.projected_points) || 0]));
  const teamById = new Map(input.context.teams.map((team) => [text(team.data.franchise_id) || text(team.data.id), team]));
  const lineupByTeam = new Map(input.lineups.filter((lineup) => wholeNumber(lineup.data.week) === wholeNumber(input.command.payload.week)).map((lineup) => [text(lineup.data.franchise_id), lineup]));
  const lineupTotals = [...teamById.entries()].map(([franchiseId, team]) => {
    const lineup = lineupByTeam.get(franchiseId);
    const savedAssignments = Object.fromEntries(Object.entries(record(lineup?.data.assignments)).flatMap(([slot, value]) => text(value) ? [[slot, text(value)]] : []));
    const bestAssignments = optimalLineup(team, input.context.settings, positions, replay.playerTotals);
    const assignments = input.context.settings.lineup.automaticMode === "best_ball" ? bestAssignments : savedAssignments;
    const starterIds = Object.values(assignments);
    const starterScore = round(starterIds.reduce((sum, id) => sum + (replay.playerTotals[id] ?? 0), 0));
    const rosterScore = round(stringList(team.data.roster_player_ids).reduce((sum, id) => sum + (replay.playerTotals[id] ?? 0), 0));
    const optimalScore = round(Object.values(bestAssignments).reduce((sum, id) => sum + (replay.playerTotals[id] ?? 0), 0));
    const playersRemaining = starterIds.filter((id) => !["final", "canceled"].includes(text(input.gameStatuses[playerGame.get(id) ?? ""]))).length;
    const pointsRemaining = round(starterIds.reduce((sum, id) => sum + Math.max(0, (projected.get(id) ?? 0) - (replay.playerTotals[id] ?? 0)), 0));
    return {
      franchise_id: franchiseId,
      assignments,
      current_score: starterScore,
      projected_final: round(starterScore + pointsRemaining),
      points_remaining: pointsRemaining,
      players_remaining: playersRemaining,
      bench_points: round(rosterScore - starterScore),
      optimal_score: optimalScore,
      optimal_delta: round(optimalScore - starterScore),
    };
  });
  const totalByTeam = new Map(lineupTotals.map((row) => [row.franchise_id, row]));
  const matchupRows = input.matchups.map((matchup) => {
    const homeId = text(matchup.home_franchise_id);
    const awayId = text(matchup.away_franchise_id);
    const home = totalByTeam.get(homeId)!;
    const away = totalByTeam.get(awayId)!;
    const projectedDifference = home.projected_final - away.projected_final;
    const homeWinProbability = round(1 / (1 + Math.exp(-projectedDifference / 12)));
    return {
      matchup_id: text(matchup.matchup_id),
      home_franchise_id: homeId,
      away_franchise_id: awayId,
      home_score: home.current_score,
      away_score: away.current_score,
      home_projected_final: home.projected_final,
      away_projected_final: away.projected_final,
      home_win_probability: homeWinProbability,
      away_win_probability: round(1 - homeWinProbability),
      players_remaining: home.players_remaining + away.players_remaining,
      points_remaining: round(home.points_remaining + away.points_remaining),
    };
  });
  const startersByTeam = new Map(lineupTotals.map((row) => [row.franchise_id, new Set(Object.values(row.assignments))]));
  const leadChanges: Array<Record<string, unknown>> = [];
  for (const matchup of matchupRows) {
    let home = 0; let away = 0; let leader = "tie";
    for (const event of replay.events) {
      if (startersByTeam.get(matchup.home_franchise_id)?.has(event.playerId)) home = round(home + event.fantasyPointDelta);
      if (startersByTeam.get(matchup.away_franchise_id)?.has(event.playerId)) away = round(away + event.fantasyPointDelta);
      const nextLeader = home === away ? "tie" : home > away ? matchup.home_franchise_id : matchup.away_franchise_id;
      if (nextLeader !== leader) {
        leadChanges.push({ matchup_id: matchup.matchup_id, event_key: event.eventKey, occurred_at: event.occurredAt, leader_franchise_id: nextLeader, home_score: home, away_score: away });
        leader = nextLeader;
      }
    }
  }
  const standingsProjection = matchupRows.flatMap((matchup) => {
    const homeOutcome = matchup.home_projected_final === matchup.away_projected_final ? "tie" : matchup.home_projected_final > matchup.away_projected_final ? "win" : "loss";
    const awayOutcome = homeOutcome === "tie" ? "tie" : homeOutcome === "win" ? "loss" : "win";
    return [{ franchise_id: matchup.home_franchise_id, projected_outcome: homeOutcome }, { franchise_id: matchup.away_franchise_id, projected_outcome: awayOutcome }];
  });
  const lastProviderTimestamp = replay.events.map((event) => event.providerTimestamp).sort().at(-1) ?? text(input.current?.data.last_provider_timestamp);
  const freshness = scoringFreshness(lastProviderTimestamp, Date.parse(input.processedAt), input.providerState);
  const activeGames = Object.entries(input.gameStatuses).filter(([, status]) => status === "in_progress").map(([gameId]) => gameId);
  const topActive = Object.entries(replay.playerTotals)
    .filter(([playerId]) => activeGames.includes(playerGame.get(playerId) ?? ""))
    .sort((left, right) => right[1] - left[1])[0] ?? null;
  return {
    schema_version: 1,
    id: `week-${wholeNumber(input.command.payload.week)}`,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    week: wholeNumber(input.command.payload.week),
    settings_version_id: input.context.settingsVersionId,
    scoring_rule_version_id: input.context.settingsVersionId,
    lineup_week_revision: Math.max(1, wholeNumber(input.lineupWeek.data.revision, 1)),
    revision: input.revision,
    ingestion_version: input.ingestionVersion,
    provider_key: input.providerKey,
    fallback_provider_key: input.fallbackProviderKey,
    provider_state: input.providerState,
    provider_freshness: freshness,
    last_provider_timestamp: lastProviderTimestamp,
    event_count: replay.events.length,
    duplicate_event_count: input.duplicateCount,
    correction_count: input.correctionCount,
    stat_correction_state: input.correctionCount ? "corrected" : "none",
    player_totals: replay.playerTotals,
    player_game_totals: replay.playerGameTotals,
    lineup_totals: lineupTotals,
    matchups: matchupRows,
    standings_projection: standingsProjection,
    game_statuses: input.gameStatuses,
    active_nfl_game_ids: activeGames,
    scoring_feed: replay.events.slice(-100).reverse().map((event) => ({
      event_key: event.eventKey,
      provider_event_id: event.providerEventId,
      occurred_at: event.occurredAt,
      player_id: event.playerId,
      nfl_game_id: event.nflGameId,
      description: event.description,
      fantasy_point_delta: event.fantasyPointDelta,
      resulting_player_total: event.resultingPlayerTotal,
      scoring_rule_ids: event.components.map((component) => component.scoringRuleId),
      explanations: event.components.map((component) => component.explanation),
      corrected: event.corrected,
    })),
    lead_changes: leadChanges,
    top_active_performer: topActive ? { player_id: topActive[0], points: topActive[1] } : {},
    cached_last_known_score: freshness.state !== "live",
    created_at: text(input.current?.data.created_at) || input.processedAt,
    updated_at: input.processedAt,
  };
}

function audit(input: {
  command: LeagueCommand<ScoringCommand>;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  previousRevision: number;
  resultingRevision: number;
  settingsVersionId: string;
  action: string;
  reason: string;
  summary: string;
  result: Record<string, unknown>;
  store: LeagueCommandStore;
}) {
  const auditEventId = `audit-${input.command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: input.command.commandId, commandType: input.command.commandType, actorUserId: input.actorUserId,
    leagueId: input.command.leagueId, seasonId: input.command.seasonId, status: "accepted",
    previousRevision: input.previousRevision, resultingRevision: input.resultingRevision, auditEventId,
    serverProcessedAt: input.processedAt, requestHash: input.requestHash, result: input.result, error: null,
  };
  const common = {
    schema_version: 1, id: auditEventId, league_id: input.command.leagueId, season_id: input.command.seasonId,
    actor_user_id: input.actorUserId, action: input.action, target: { type: "scoring_week", id: `week-${wholeNumber(input.command.payload.week)}` },
    timestamp: input.processedAt, previous_revision: input.previousRevision, resulting_revision: input.resultingRevision,
    before: { revision: input.previousRevision }, after: { revision: input.resultingRevision }, material_differences: input.result,
    reason: input.reason, settings_version_id: input.settingsVersionId, command_id: input.command.commandId,
    transaction_id: "", public_summary: input.summary, private_metadata: {}, reversal_of_audit_event_id: "",
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

async function executeScoring(input: {
  command: LeagueCommand<ScoringCommand>;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
  ingest: boolean;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await scoringContext(command, actorUserId, processedAt, store);
  if (command.expectedRevision !== context.seasonRevision) throw new LeagueCommandFailure("stale_revision", `The active season changed. Its revision is ${context.seasonRevision}.`, 409, context.seasonRevision);
  const week = wholeNumber(command.payload.week);
  if (week < 1 || week > context.settings.lineup.lineupWeekCount) throw new LeagueCommandFailure("invalid_week", `Choose a scoring week from 1 to ${context.settings.lineup.lineupWeekCount}.`);
  const weekPath = scoringWeekPath(command.leagueId, command.seasonId, week);
  const [current, storedEventDocuments, lineups, lineupWeek] = await Promise.all([
    store.get(weekPath),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/scoringEvents`),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/lineups`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/lineupWeeks/week-${week}`),
  ]);
  if (!lineupWeek) throw new LeagueCommandFailure("lineup_week_required", `Publish Week ${week} player and game state before scoring.`, 409);
  const currentRevision = current ? Math.max(1, wholeNumber(current.data.revision, 1)) : 0;
  if (wholeNumber(command.payload.expectedScoringWeekRevision, -1) !== currentRevision) throw new LeagueCommandFailure("stale_scoring_revision", `Week ${week} scoring changed. The current revision is ${currentRevision}.`, 409, currentRevision);
  const payload = input.ingest ? command.payload as IngestScoringEventsPayload : null;
  if (payload && (!/^[a-z0-9][a-z0-9_.-]{1,63}$/u.test(payload.providerKey) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/u.test(payload.ingestionVersion))) throw new LeagueCommandFailure("invalid_scoring_provider", "Use a stable provider key and ingestion version.");
  if (payload && payload.events.length > 96) throw new LeagueCommandFailure("scoring_batch_too_large", "Ingest no more than 96 scoring events in one command.");
  const matchups = normalizeMatchups(payload?.matchups, context.teams, current);
  const gameStatuses = normalizeGameStatuses(payload, current);
  const existing = storedEventDocuments
    .filter((document) => wholeNumber(document.data.week) === week)
    .map(normalizeStoredEvent)
    .filter((event): event is NormalizedScoringEvent => Boolean(event));
  const existingByKey = new Map(existing.map((event) => [event.eventKey, event]));
  const knownPlayerIds = new Set((Array.isArray(lineupWeek.data.players) ? lineupWeek.data.players : []).map((row) => text(record(row).player_id)).filter(Boolean));
  const eventWrites: FirestoreWrite[] = [];
  let duplicateCount = 0;
  let correctionCount = 0;
  for (const source of payload?.events ?? []) {
    const event = normalizeIncomingEvent(source, payload!, knownPlayerIds, existingByKey);
    const prior = existingByKey.get(event.eventKey);
    if (prior && eventComparable({ ...event, revision: prior.revision, corrected: prior.corrected }) === eventComparable(prior)) { duplicateCount += 1; continue; }
    if (event.corrected && command.reason.trim().length < 5) throw new LeagueCommandFailure("correction_reason_required", "Explain every corrected scoring event in at least five characters.");
    if (event.corrected) correctionCount += 1;
    const eventDocument = storedEventDocuments.find((document) => text(document.data.event_key) === event.eventKey) ?? null;
    const data = {
      schema_version: 1, event_key: event.eventKey, league_id: command.leagueId, season_id: command.seasonId, week,
      provider_key: event.providerKey, provider_event_id: event.providerEventId, provider_timestamp: event.providerTimestamp,
      occurred_at: event.occurredAt, player_id: event.playerId, nfl_game_id: event.nflGameId,
      normalized_statistics: event.statistics, description: event.description, correction_of_event_key: event.correctionOfEventKey,
      corrected: event.corrected, correction_reason: event.corrected ? command.reason : "", revision: event.revision,
      ingestion_version: event.ingestionVersion, ingested_by_user_id: actorUserId,
      created_at: text(eventDocument?.data.created_at) || processedAt, updated_at: processedAt,
    };
    eventWrites.push(replaceWrite(store, eventDocument, scoringEventPath(command.leagueId, command.seasonId, event.eventKey), data));
    eventWrites.push(createOnlyWrite(store, scoringEventRevisionPath(command.leagueId, command.seasonId, event.eventKey, event.revision), data));
    existingByKey.set(event.eventKey, event);
  }
  const revision = currentRevision + 1;
  const providerKey = payload?.providerKey ?? text(current?.data.provider_key);
  const providerState = payload?.providerState ?? ((text(current?.data.provider_state) as "live" | "delayed" | "unavailable") || "unavailable");
  const ingestionVersion = payload?.ingestionVersion ?? (text(current?.data.ingestion_version) || "replay-v1");
  const model = buildReadModel({
    command, context, current, revision, matchups, gameStatuses, events: [...existingByKey.values()], processedAt,
    providerKey, fallbackProviderKey: text(payload?.fallbackProviderKey) || text(current?.data.fallback_provider_key),
    providerState, ingestionVersion, duplicateCount, correctionCount: correctionCount + wholeNumber(current?.data.correction_count), lineups, lineupWeek,
  });
  const action = input.ingest ? correctionCount ? "scoring_events_corrected" : "scoring_events_ingested" : "scoring_week_recalculated";
  const reason = command.reason || (input.ingest ? `Ingest ${payload?.events.length ?? 0} normalized scoring events` : `Replay Week ${week} scoring`);
  const auditRecord = audit({
    command, actorUserId, requestHash, processedAt, previousRevision: currentRevision, resultingRevision: revision,
    settingsVersionId: context.settingsVersionId, action, reason,
    summary: input.ingest ? `Week ${week} scoring accepted ${Math.max(0, (payload?.events.length ?? 0) - duplicateCount)} event updates and ignored ${duplicateCount} duplicates.` : `Week ${week} scoring was fully replayed from the normalized event ledger.`,
    result: { week, scoringWeekRevision: revision, acceptedEvents: Math.max(0, (payload?.events.length ?? 0) - duplicateCount), duplicateEvents: duplicateCount, correctedEvents: correctionCount, settingsVersionId: context.settingsVersionId }, store,
  });
  try {
    await store.commit([replaceWrite(store, current, weekPath, { ...model, audit_event_id: auditRecord.auditEventId }), ...eventWrites, ...auditRecord.writes]);
  } catch (error) {
    const latest = await store.get(weekPath);
    const latestRevision = latest ? Math.max(1, wholeNumber(latest.data.revision, 1)) : 0;
    if (latestRevision !== currentRevision) throw new LeagueCommandFailure("stale_scoring_revision", `Week ${week} scoring changed during ingestion. The current revision is ${latestRevision}.`, 409, latestRevision);
    throw error;
  }
  return auditRecord.receipt;
}

export function executeIngestScoringEvents(input: Omit<Parameters<typeof executeScoring>[0], "ingest" | "command"> & { command: LeagueCommand<"ingest_scoring_events"> }) {
  return executeScoring({ ...input, command: input.command as LeagueCommand<ScoringCommand>, ingest: true });
}

export function executeRecalculateScoringWeek(input: Omit<Parameters<typeof executeScoring>[0], "ingest" | "command"> & { command: LeagueCommand<"recalculate_scoring_week"> }) {
  return executeScoring({ ...input, command: input.command as LeagueCommand<ScoringCommand>, ingest: false });
}
