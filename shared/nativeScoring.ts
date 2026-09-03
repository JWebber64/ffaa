import type { NativeScoringStatistic } from "./leagueCommandProtocol";
import type { LeagueSettingsV1 } from "./leagueSettings";

export type NativeScoringRule = {
  id: string;
  statistic: NativeScoringStatistic;
  pointsPerUnit: number;
  label: string;
};

export type NormalizedScoringEvent = {
  eventKey: string;
  providerKey: string;
  providerEventId: string;
  providerTimestamp: string;
  occurredAt: string;
  playerId: string;
  nflGameId: string;
  statistics: Array<{ statistic: NativeScoringStatistic; value: number }>;
  description: string;
  correctionOfEventKey: string;
  revision: number;
  ingestionVersion: string;
  corrected: boolean;
};

export type ScoredFantasyEvent = NormalizedScoringEvent & {
  components: Array<{
    statistic: NativeScoringStatistic;
    value: number;
    scoringRuleId: string;
    pointsPerUnit: number;
    fantasyPointDelta: number;
    explanation: string;
  }>;
  fantasyPointDelta: number;
  resultingPlayerTotal: number;
};

export type ScoringReplay = {
  events: ScoredFantasyEvent[];
  playerTotals: Record<string, number>;
  playerGameTotals: Record<string, number>;
};

export interface NativeScoringProviderAdapter<TSourceEvent = unknown> {
  readonly providerKey: string;
  readonly fallbackProviderKey?: string;
  normalize(source: TSourceEvent): Omit<NormalizedScoringEvent, "eventKey" | "providerKey" | "revision" | "ingestionVersion" | "corrected" | "correctionOfEventKey"> & { correctionOfProviderEventId?: string };
}

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function scoringRules(settings: LeagueSettingsV1): NativeScoringRule[] {
  return [
    { id: "passing-yards", statistic: "passing_yards", pointsPerUnit: 1 / settings.scoring.passingYardsPerPoint, label: "passing yards" },
    { id: "passing-touchdowns", statistic: "passing_touchdowns", pointsPerUnit: settings.scoring.passingTouchdown, label: "passing touchdown" },
    { id: "interceptions", statistic: "interceptions", pointsPerUnit: settings.scoring.interception, label: "interception" },
    { id: "rushing-yards", statistic: "rushing_yards", pointsPerUnit: 1 / settings.scoring.rushingReceivingYardsPerPoint, label: "rushing yards" },
    { id: "rushing-touchdowns", statistic: "rushing_touchdowns", pointsPerUnit: settings.scoring.rushingReceivingTouchdown, label: "rushing touchdown" },
    { id: "receiving-yards", statistic: "receiving_yards", pointsPerUnit: 1 / settings.scoring.rushingReceivingYardsPerPoint, label: "receiving yards" },
    { id: "receptions", statistic: "receptions", pointsPerUnit: settings.scoring.receptionPoints, label: "reception" },
    { id: "receiving-touchdowns", statistic: "receiving_touchdowns", pointsPerUnit: settings.scoring.rushingReceivingTouchdown, label: "receiving touchdown" },
  ];
}

export function scoreNativeStatistic(statistic: NativeScoringStatistic, value: number, settings: LeagueSettingsV1) {
  const rule = scoringRules(settings).find((candidate) => candidate.statistic === statistic);
  if (!rule) throw new Error(`No scoring rule exists for ${statistic}.`);
  const fantasyPointDelta = rounded(value * rule.pointsPerUnit);
  const sign = fantasyPointDelta >= 0 ? "+" : "";
  return {
    statistic,
    value,
    scoringRuleId: rule.id,
    pointsPerUnit: rule.pointsPerUnit,
    fantasyPointDelta,
    explanation: `${sign}${fantasyPointDelta.toFixed(2)} ${rule.label}`,
  };
}

export function replayNativeScoring(events: NormalizedScoringEvent[], settings: LeagueSettingsV1): ScoringReplay {
  const superseded = new Set(events.map((event) => event.correctionOfEventKey).filter(Boolean));
  const ordered = events
    .filter((event) => !superseded.has(event.eventKey))
    .slice()
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)
      || left.providerTimestamp.localeCompare(right.providerTimestamp)
      || left.eventKey.localeCompare(right.eventKey));
  const playerTotals: Record<string, number> = {};
  const playerGameTotals: Record<string, number> = {};
  const scored = ordered.map((event) => {
    const components = event.statistics.map((row) => scoreNativeStatistic(row.statistic, row.value, settings));
    const fantasyPointDelta = rounded(components.reduce((sum, component) => sum + component.fantasyPointDelta, 0));
    playerTotals[event.playerId] = rounded((playerTotals[event.playerId] ?? 0) + fantasyPointDelta);
    const playerGameKey = `${event.playerId}__${event.nflGameId}`;
    playerGameTotals[playerGameKey] = rounded((playerGameTotals[playerGameKey] ?? 0) + fantasyPointDelta);
    return { ...event, components, fantasyPointDelta, resultingPlayerTotal: playerTotals[event.playerId] ?? 0 };
  });
  return { events: scored, playerTotals, playerGameTotals };
}

export function scoringFreshness(providerTimestamp: string, now: number, providerState: "live" | "delayed" | "unavailable") {
  if (providerState === "unavailable") return { state: "stale" as const, ageSeconds: null, message: "Provider unavailable; showing cached last-known scores." };
  const timestamp = Date.parse(providerTimestamp);
  if (!Number.isFinite(timestamp)) return { state: "stale" as const, ageSeconds: null, message: "No provider timestamp; showing cached last-known scores." };
  const ageSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (providerState === "delayed" || ageSeconds > 300) return { state: "stale" as const, ageSeconds, message: `Score data is stale by ${ageSeconds} seconds; cached totals remain visible.` };
  if (ageSeconds > 90) return { state: "delayed" as const, ageSeconds, message: `Score data is delayed by ${ageSeconds} seconds.` };
  return { state: "live" as const, ageSeconds, message: "Provider data is current." };
}
