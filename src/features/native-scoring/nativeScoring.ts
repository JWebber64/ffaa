import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import type {
  NativeScoringFeedEvent,
  NativeScoringLineupTotal,
  NativeScoringMatchup,
  NativeScoringWeek,
} from "../league-domain/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeLineup(value: unknown): NativeScoringLineupTotal | null {
  const data = record(value);
  const franchiseId = text(data.franchise_id);
  if (!franchiseId) return null;
  return {
    franchiseId,
    assignments: Object.fromEntries(Object.entries(record(data.assignments)).flatMap(([slot, player]) => text(player) ? [[slot, text(player)]] : [])),
    currentScore: numberValue(data.current_score),
    projectedFinal: numberValue(data.projected_final),
    pointsRemaining: numberValue(data.points_remaining),
    playersRemaining: Math.max(0, Math.round(numberValue(data.players_remaining))),
    benchPoints: numberValue(data.bench_points),
    optimalScore: numberValue(data.optimal_score),
    optimalDelta: numberValue(data.optimal_delta),
  };
}

function normalizeMatchup(value: unknown): NativeScoringMatchup | null {
  const data = record(value);
  const matchupId = text(data.matchup_id);
  const homeFranchiseId = text(data.home_franchise_id);
  const awayFranchiseId = text(data.away_franchise_id);
  if (!matchupId || !homeFranchiseId || !awayFranchiseId) return null;
  return {
    matchupId, homeFranchiseId, awayFranchiseId,
    homeScore: numberValue(data.home_score), awayScore: numberValue(data.away_score),
    homeProjectedFinal: numberValue(data.home_projected_final), awayProjectedFinal: numberValue(data.away_projected_final),
    homeWinProbability: numberValue(data.home_win_probability), awayWinProbability: numberValue(data.away_win_probability),
    playersRemaining: Math.max(0, Math.round(numberValue(data.players_remaining))), pointsRemaining: numberValue(data.points_remaining),
  };
}

function normalizeFeed(value: unknown): NativeScoringFeedEvent | null {
  const data = record(value);
  const eventKey = text(data.event_key);
  if (!eventKey) return null;
  return {
    eventKey, providerEventId: text(data.provider_event_id), occurredAt: text(data.occurred_at), playerId: text(data.player_id),
    nflGameId: text(data.nfl_game_id), description: text(data.description), fantasyPointDelta: numberValue(data.fantasy_point_delta),
    resultingPlayerTotal: numberValue(data.resulting_player_total), scoringRuleIds: strings(data.scoring_rule_ids),
    explanations: strings(data.explanations), corrected: Boolean(data.corrected),
  };
}

export function normalizeNativeScoringWeek(value: unknown, leagueId: string, seasonId: string, week: number): NativeScoringWeek | null {
  const data = record(value);
  if (text(data.league_id) !== leagueId || text(data.season_id) !== seasonId || Math.round(numberValue(data.week)) !== week) return null;
  const freshness = record(data.provider_freshness);
  const top = record(data.top_active_performer);
  return {
    id: text(data.id) || `week-${week}`, leagueId, seasonId, week,
    settingsVersionId: text(data.settings_version_id), scoringRuleVersionId: text(data.scoring_rule_version_id),
    lineupWeekRevision: Math.max(1, Math.round(numberValue(data.lineup_week_revision))), revision: Math.max(1, Math.round(numberValue(data.revision))),
    ingestionVersion: text(data.ingestion_version), providerKey: text(data.provider_key), fallbackProviderKey: text(data.fallback_provider_key),
    providerState: ["live", "delayed"].includes(text(data.provider_state)) ? text(data.provider_state) as "live" | "delayed" : "unavailable",
    freshness: {
      state: ["live", "delayed"].includes(text(freshness.state)) ? text(freshness.state) as "live" | "delayed" : "stale",
      ageSeconds: freshness.ageSeconds === null || freshness.age_seconds === null ? null : Math.max(0, Math.round(numberValue(freshness.ageSeconds ?? freshness.age_seconds))),
      message: text(freshness.message),
    },
    lastProviderTimestamp: text(data.last_provider_timestamp), eventCount: Math.max(0, Math.round(numberValue(data.event_count))),
    duplicateEventCount: Math.max(0, Math.round(numberValue(data.duplicate_event_count))), correctionCount: Math.max(0, Math.round(numberValue(data.correction_count))),
    statCorrectionState: text(data.stat_correction_state) === "corrected" ? "corrected" : "none",
    playerTotals: Object.fromEntries(Object.entries(record(data.player_totals)).map(([id, total]) => [id, numberValue(total)])),
    lineupTotals: (Array.isArray(data.lineup_totals) ? data.lineup_totals : []).map(normalizeLineup).filter((entry): entry is NativeScoringLineupTotal => Boolean(entry)),
    matchups: (Array.isArray(data.matchups) ? data.matchups : []).map(normalizeMatchup).filter((entry): entry is NativeScoringMatchup => Boolean(entry)),
    standingsProjection: (Array.isArray(data.standings_projection) ? data.standings_projection : []).flatMap((entry) => {
      const row = record(entry); const outcome = text(row.projected_outcome);
      return text(row.franchise_id) && ["win", "loss", "tie"].includes(outcome) ? [{ franchiseId: text(row.franchise_id), projectedOutcome: outcome as "win" | "loss" | "tie" }] : [];
    }),
    gameStatuses: Object.fromEntries(Object.entries(record(data.game_statuses)).map(([id, status]) => [id, text(status)])),
    activeNflGameIds: strings(data.active_nfl_game_ids),
    scoringFeed: (Array.isArray(data.scoring_feed) ? data.scoring_feed : []).map(normalizeFeed).filter((entry): entry is NativeScoringFeedEvent => Boolean(entry)),
    leadChanges: (Array.isArray(data.lead_changes) ? data.lead_changes : []).map(record).flatMap((row) => text(row.matchup_id) ? [{ matchupId: text(row.matchup_id), eventKey: text(row.event_key), occurredAt: text(row.occurred_at), leaderFranchiseId: text(row.leader_franchise_id), homeScore: numberValue(row.home_score), awayScore: numberValue(row.away_score) }] : []),
    topActivePerformer: text(top.player_id) ? { playerId: text(top.player_id), points: numberValue(top.points) } : null,
    cachedLastKnownScore: Boolean(data.cached_last_known_score), updatedAt: text(data.updated_at),
  };
}

export function subscribeNativeScoringWeek(leagueId: string, seasonId: string, week: number, onValue: (value: NativeScoringWeek | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(firestore, "leagues", leagueId, "seasons", seasonId, "scoringWeeks", `week-${week}`),
    (snapshot) => onValue(snapshot.exists() ? normalizeNativeScoringWeek(snapshot.data(), leagueId, seasonId, week) : null),
    (error) => onError(error instanceof Error ? error : new Error(String(error))),
  );
}
