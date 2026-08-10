import type { WeeklyPlayerStatRow } from "@/data/weeklyPlayerStats";
import { normalizeToolTeam } from "@/data/toolPlayerData";

export interface OffensiveLineEnvironment {
  id: string;
  team: string;
  games: number;
  dropbacks: number;
  rushAttempts: number;
  sackRate: number | null;
  passEpaPerDropback: number | null;
  rushEpaPerCarry: number | null;
  rushingYardsPerCarry: number | null;
  rushingFirstDownRate: number | null;
  passEnvironmentScore: number | null;
  runEnvironmentScore: number | null;
  overallEnvironmentScore: number | null;
  overallRank: number;
}

interface MutableLineEnvironment {
  team: string;
  games: Set<string>;
  attempts: number;
  sacks: number;
  passingEpa: number;
  carries: number;
  rushingYards: number;
  rushingEpa: number;
  rushingFirstDowns: number;
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length
    ? available.reduce((total, value) => total + value, 0) / available.length
    : null;
}

function percentileScores<Row>(
  rows: Row[],
  value: (row: Row) => number | null,
  lowerIsBetter = false,
) {
  const available = rows
    .map((row, index) => ({ index, value: value(row) }))
    .filter((entry): entry is { index: number; value: number } => entry.value !== null)
    .sort((left, right) => left.value - right.value);
  const scores = new Map<number, number>();

  available.forEach((entry, rank) => {
    const percentile = available.length <= 1 ? 50 : (rank / (available.length - 1)) * 100;
    scores.set(entry.index, lowerIsBetter ? 100 - percentile : percentile);
  });
  return scores;
}

/**
 * Aggregates outcome metrics influenced by the offensive line. These are team
 * environment signals, not isolated player grades: quarterback behavior,
 * scheme, backs, opponents, and game state also affect every metric.
 */
export function buildOffensiveLineEnvironments(
  rows: WeeklyPlayerStatRow[],
): OffensiveLineEnvironment[] {
  const teams = new Map<string, MutableLineEnvironment>();

  for (const row of rows) {
    const team = normalizeToolTeam(row.team);
    if (!team) continue;
    const aggregate = teams.get(team) ?? {
      team,
      games: new Set<string>(),
      attempts: 0,
      sacks: 0,
      passingEpa: 0,
      carries: 0,
      rushingYards: 0,
      rushingEpa: 0,
      rushingFirstDowns: 0,
    };
    aggregate.games.add(row.gameId || `${row.season}-${row.week}-${team}-${row.opponent}`);
    aggregate.attempts += finite(row.stats.attempts);
    aggregate.sacks += finite(row.stats.sacks_suffered);
    aggregate.passingEpa += finite(row.stats.passing_epa);
    aggregate.carries += finite(row.stats.carries);
    aggregate.rushingYards += finite(row.stats.rushing_yards);
    aggregate.rushingEpa += finite(row.stats.rushing_epa);
    aggregate.rushingFirstDowns += finite(row.stats.rushing_first_downs);
    teams.set(team, aggregate);
  }

  const baseRows = [...teams.values()].map((aggregate) => {
    const dropbacks = aggregate.attempts + aggregate.sacks;
    return {
      id: aggregate.team,
      team: aggregate.team,
      games: aggregate.games.size,
      dropbacks,
      rushAttempts: aggregate.carries,
      sackRate: safeDivide(aggregate.sacks, dropbacks),
      passEpaPerDropback: safeDivide(aggregate.passingEpa, dropbacks),
      rushEpaPerCarry: safeDivide(aggregate.rushingEpa, aggregate.carries),
      rushingYardsPerCarry: safeDivide(aggregate.rushingYards, aggregate.carries),
      rushingFirstDownRate: safeDivide(aggregate.rushingFirstDowns, aggregate.carries),
    };
  });

  const sackScores = percentileScores(baseRows, (row) => row.sackRate, true);
  const passEpaScores = percentileScores(baseRows, (row) => row.passEpaPerDropback);
  const rushEpaScores = percentileScores(baseRows, (row) => row.rushEpaPerCarry);
  const yardsScores = percentileScores(baseRows, (row) => row.rushingYardsPerCarry);
  const firstDownScores = percentileScores(baseRows, (row) => row.rushingFirstDownRate);

  const scored: OffensiveLineEnvironment[] = baseRows.map((row, index) => {
    const passEnvironmentScore = average([
      sackScores.get(index) ?? null,
      passEpaScores.get(index) ?? null,
    ]);
    const runEnvironmentScore = average([
      rushEpaScores.get(index) ?? null,
      yardsScores.get(index) ?? null,
      firstDownScores.get(index) ?? null,
    ]);
    return {
      ...row,
      passEnvironmentScore,
      runEnvironmentScore,
      overallEnvironmentScore: average([passEnvironmentScore, runEnvironmentScore]),
      overallRank: 0,
    };
  });

  return scored
    .sort((left, right) =>
      (right.overallEnvironmentScore ?? -1) - (left.overallEnvironmentScore ?? -1) ||
      left.team.localeCompare(right.team)
    )
    .map((row, index) => ({ ...row, overallRank: index + 1 }));
}
