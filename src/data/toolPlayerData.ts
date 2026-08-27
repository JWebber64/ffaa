import { buildPlayerStatRows } from "@/data/playerStatCategories";
import type { PlayerStatRow } from "@/data/playerStatCategories";
import type { SleeperPlayerRow } from "@/data/playerStatCategories";
import { loadPlayerPool } from "@/data/loadPlayerPool";
import type { WeeklyPlayerSummary } from "@/data/weeklyPlayerStats";
import type { PlayerValueSource } from "@/types/draft";
import type { LoadPlayerPoolOptions } from "@/data/loadPlayerPool";

export type ToolScoring = "standard" | "halfPpr" | "ppr";
export type ToolPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export interface ToolPlayer {
  id: string;
  name: string;
  position: ToolPosition;
  team: string;
  rank: number | null;
  positionRank: number | null;
  byeWeek: number | null;
  adp: number | null;
  auctionValue: number | null;
  marketValue: number | null;
  projectedPoints: number | null;
  projectedPointsPerGame: number | null;
  projectionSourceCount?: number;
  projectionLow?: number | null;
  projectionHigh?: number | null;
  projectionUpdatedAt?: string;
  valueConfidence: number | null;
  valueSources: PlayerValueSource[];
  status: string;
  injuryStatus: string;
  historicalGames: number;
  historicalPoints: number | null;
  historicalPointsPerGame: number | null;
  last3PointsPerGame: number | null;
  floorPoints: number | null;
  ceilingPoints: number | null;
  standardDeviation: number | null;
  opportunitiesPerGame: number | null;
  targetsPerGame: number | null;
  carriesPerGame: number | null;
  targetShare: number | null;
  airYardsShare: number | null;
  weeklyPoints: number[];
  summary: WeeklyPlayerSummary | null;
}

const TOOL_POSITIONS = new Set<ToolPosition>(["QB", "RB", "WR", "TE", "K", "DEF"]);

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeToolName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'`]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function normalizeToolTeam(team: unknown) {
  const normalized = String(team ?? "").trim().toUpperCase();
  const aliases: Record<string, string> = {
    ARZ: "ARI",
    JAC: "JAX",
    LA: "LAR",
    LVR: "LV",
    NOR: "NO",
    NWE: "NE",
    SFO: "SF",
    TAM: "TB",
    WSH: "WAS",
  };
  return aliases[normalized] ?? normalized;
}

export function normalizeToolPosition(position: unknown): ToolPosition | null {
  const normalized = String(position ?? "").trim().toUpperCase();
  const canonical = normalized === "DST" || normalized === "D/ST"
    ? "DEF"
    : normalized === "PK"
      ? "K"
      : normalized === "FB"
        ? "RB"
        : normalized;
  return TOOL_POSITIONS.has(canonical as ToolPosition) ? canonical as ToolPosition : null;
}

export function toolPlayerKey(name: string, position: unknown) {
  return `${normalizeToolName(name)}|${normalizeToolPosition(position) ?? String(position).toUpperCase()}`;
}

/**
 * Uses the scoring-aware public projection consensus when the player pool has
 * already been valued. ESPN Clay remains a fallback for isolated stat rows.
 */
export function projectedPointsForScoring(row: PlayerStatRow, scoring: ToolScoring) {
  const consensus = numberValue(row.player.projectedPoints);
  if (consensus !== null) return consensus;
  const clay = row.espnClay;
  const position = normalizeToolPosition(row.player.pos);
  if (!clay) {
    return numberValue(row.player.projectedPoints ?? row.winWithOdds?.projectedPoints);
  }
  if (position === "K" || position === "DEF") {
    return numberValue(clay.projectedPoints ?? row.player.projectedPoints);
  }

  const passYards = numberValue(clay.passYards);
  const passTouchdowns = numberValue(clay.passTds);
  const interceptions = numberValue(clay.interceptions);
  const rushYards = numberValue(clay.rushYards);
  const rushTouchdowns = numberValue(clay.rushTds);
  const receptions = numberValue(clay.receptions);
  const receivingYards = numberValue(clay.recYards);
  const receivingTouchdowns = numberValue(clay.recTds);
  const hasStatLine = [
    passYards,
    passTouchdowns,
    interceptions,
    rushYards,
    rushTouchdowns,
    receptions,
    receivingYards,
    receivingTouchdowns,
  ].some((value) => value !== null);

  if (!hasStatLine) {
    return numberValue(clay.projectedPoints ?? row.player.projectedPoints);
  }

  const receptionPoints = scoring === "ppr" ? 1 : scoring === "halfPpr" ? 0.5 : 0;
  return (
    (passYards ?? 0) / 25 +
    (passTouchdowns ?? 0) * 4 -
    (interceptions ?? 0) * 2 +
    (rushYards ?? 0) / 10 +
    (rushTouchdowns ?? 0) * 6 +
    (receivingYards ?? 0) / 10 +
    (receivingTouchdowns ?? 0) * 6 +
    (receptions ?? 0) * receptionPoints
  );
}

export function buildToolPlayers(
  projectionRows: PlayerStatRow[],
  weeklySummaries: WeeklyPlayerSummary[],
  scoring: ToolScoring,
): ToolPlayer[] {
  const summaryMap = new Map(
    weeklySummaries.map((summary) => [toolPlayerKey(summary.playerName, summary.position), summary]),
  );

  return projectionRows.flatMap((row): ToolPlayer[] => {
    const position = normalizeToolPosition(row.player.pos);
    if (!position) return [];

    const summary = summaryMap.get(toolPlayerKey(row.player.name, position)) ?? null;
    const projectedPoints = projectedPointsForScoring(row, scoring);
    const projectedGames = Math.max(1, numberValue(row.espnClay?.games) ?? 17);
    const historicalGames = summary?.games ?? 0;
    const opportunities = summary
      ? summary.totals.carries + summary.totals.targets
      : null;

    return [{
      id: row.player.id,
      name: row.player.name,
      position,
      team: normalizeToolTeam(row.player.nflTeam),
      rank: numberValue(row.player.rank),
      positionRank: numberValue(row.player.posRank),
      byeWeek: numberValue(row.player.byeWeek),
      adp: numberValue(row.player.adp),
      auctionValue: numberValue(row.player.auctionValue ?? row.player.projectedValue),
      marketValue: numberValue(row.player.marketValue),
      projectedPoints,
      projectedPointsPerGame: projectedPoints === null ? null : projectedPoints / projectedGames,
      projectionSourceCount: Math.max(0, numberValue(row.player.projectionSourceCount) ?? 0),
      projectionLow: numberValue(row.player.projectionLow),
      projectionHigh: numberValue(row.player.projectionHigh),
      projectionUpdatedAt: String(row.player.projectionUpdatedAt ?? ""),
      valueConfidence: numberValue(row.player.valueConfidence),
      valueSources: row.player.valueSources ?? [],
      status: String(row.sleeper?.status ?? ""),
      injuryStatus: String(row.sleeper?.injuryStatus ?? ""),
      historicalGames,
      historicalPoints: summary?.selectedFantasyPoints ?? null,
      historicalPointsPerGame: summary?.selectedFantasyPointsPerGame ?? null,
      last3PointsPerGame: summary?.last3FantasyPointsPerGame ?? null,
      floorPoints: summary?.floorFantasyPoints ?? null,
      ceilingPoints: summary?.ceilingFantasyPoints ?? null,
      standardDeviation: summary?.fantasyPointsStandardDeviation ?? null,
      opportunitiesPerGame:
        opportunities === null || historicalGames === 0 ? null : opportunities / historicalGames,
      targetsPerGame:
        summary && historicalGames > 0 ? summary.totals.targets / historicalGames : null,
      carriesPerGame:
        summary && historicalGames > 0 ? summary.totals.carries / historicalGames : null,
      targetShare: summary?.averageMetrics.targetShare ?? null,
      airYardsShare: summary?.averageMetrics.airYardsShare ?? null,
      weeklyPoints: summary?.weeklyRows.map((week) => week.selectedFantasyPoints) ?? [],
      summary,
    }];
  }).sort((left, right) =>
    (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
    (right.projectedPoints ?? 0) - (left.projectedPoints ?? 0) ||
    left.name.localeCompare(right.name)
  );
}

export function buildCurrentToolPlayers(
  scoring: ToolScoring,
  weeklySummaries: WeeklyPlayerSummary[] = [],
  valueOptions: Omit<LoadPlayerPoolOptions, "scoring"> = {},
  sleeperRows: SleeperPlayerRow[] = [],
) {
  const playerPool = loadPlayerPool({ ...valueOptions, scoring });
  return buildToolPlayers(buildPlayerStatRows(playerPool, [], sleeperRows), weeklySummaries, scoring);
}

export function formatToolScoring(scoring: ToolScoring) {
  if (scoring === "halfPpr") return "Half PPR";
  if (scoring === "ppr") return "PPR";
  return "Standard";
}
