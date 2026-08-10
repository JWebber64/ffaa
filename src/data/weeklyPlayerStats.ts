import { appUrl } from "@/lib/appBasePath";

export type WeeklyFantasyScoringMode = "standard" | "halfPpr" | "ppr";
export type WeeklySeasonType = "REG" | "POST" | "ALL";

export type WeeklyPlayerStatRow = {
  playerId: string;
  playerName: string;
  shortName: string;
  position: string;
  positionGroup: string;
  headshotUrl: string | null;
  team: string;
  opponent: string;
  season: number;
  week: number;
  seasonType: Exclude<WeeklySeasonType, "ALL">;
  gameId: string;
  standardFantasyPoints: number;
  halfPprFantasyPoints: number;
  pprFantasyPoints: number;
  selectedFantasyPoints: number;
  stats: Record<string, number>;
};

export type WeeklyPlayerAggregateTotals = {
  carries: number;
  targets: number;
  receptions: number;
  rushingYards: number;
  receivingYards: number;
  passingYards: number;
  rushingTouchdowns: number;
  receivingTouchdowns: number;
  passingTouchdowns: number;
};

export type WeeklyPlayerAverageMetrics = {
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
};

export type WeeklyPlayerSummary = {
  playerId: string;
  playerName: string;
  shortName: string;
  position: string;
  positionGroup: string;
  headshotUrl: string | null;
  teams: string[];
  seasons: number[];
  games: number;
  standardFantasyPoints: number;
  halfPprFantasyPoints: number;
  pprFantasyPoints: number;
  selectedFantasyPoints: number;
  selectedFantasyPointsPerGame: number;
  last3FantasyPointsPerGame: number;
  last5FantasyPointsPerGame: number;
  medianFantasyPoints: number;
  floorFantasyPoints: number;
  ceilingFantasyPoints: number;
  fantasyPointsStandardDeviation: number;
  latestSeason: number;
  latestWeek: number;
  latestGameId: string;
  latestTeam: string;
  latestOpponent: string;
  totals: WeeklyPlayerAggregateTotals;
  averageMetrics: WeeklyPlayerAverageMetrics;
  weeklyRows: WeeklyPlayerStatRow[];
};

export type LoadWeeklyPlayerStatsOptions = {
  seasons: number[];
  seasonType: WeeklySeasonType;
  scoring: WeeklyFantasyScoringMode;
  weekStart?: number;
  weekEnd?: number;
  signal?: AbortSignal;
};

export type WeeklyPlayerStatsResult = {
  rows: WeeklyPlayerStatRow[];
  summaries: WeeklyPlayerSummary[];
  unavailableSeasons: number[];
};

type CsvRow = Record<string, string>;

const LOCAL_PLAYER_STATS_URL = appUrl("data/nflverse-player-stats");
const NFLVERSE_PLAYER_STATS_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/stats_player";

const resolvedSeasonCache = new Map<number, CsvRow[]>();
const pendingSeasonCache = new Map<number, Promise<CsvRow[]>>();

const NON_STAT_FIELDS = new Set([
  "player_id",
  "player_name",
  "player_display_name",
  "position",
  "position_group",
  "headshot_url",
  "season",
  "week",
  "season_type",
  "game_id",
  "team",
  "opponent_team",
  "fg_made_list",
  "fg_missed_list",
  "fg_blocked_list",
  "fg_made_distance",
  "fg_missed_distance",
  "fg_blocked_distance",
  "gwfg_distance",
]);

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(cell);
      cell = "";
    } else if (character === "\n") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell || record.length) {
    record.push(cell);
    records.push(record);
  }

  const headers = records[0] ?? [];
  return records.slice(1).flatMap((values) => {
    if (!values.length || values.every((value) => value === "")) return [];

    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return [row];
  });
}

function nullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: string | undefined): number {
  return nullableNumber(value) ?? 0;
}

function abortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The weekly player stats request was aborted.", "AbortError");
  }

  const error = new Error("The weekly player stats request was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

async function requestSeasonRows(season: number, signal?: AbortSignal): Promise<CsvRow[]> {
  throwIfAborted(signal);
  const init: RequestInit = signal ? { signal } : {};

  try {
    const localResponse = await fetch(
      LOCAL_PLAYER_STATS_URL + "/stats_player_week_" + season + ".csv?v=" + season,
      init
    );
    throwIfAborted(signal);
    if (localResponse.ok) {
      const text = await localResponse.text();
      throwIfAborted(signal);
      return parseCsv(text);
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
  }

  const response = await fetch(
    NFLVERSE_PLAYER_STATS_URL + "/stats_player_week_" + season + ".csv",
    init
  );
  throwIfAborted(signal);
  if (!response.ok) {
    throw new Error("nflverse weekly player stats " + season + " returned " + response.status);
  }

  const text = await response.text();
  throwIfAborted(signal);
  return parseCsv(text);
}

async function fetchSeasonRows(season: number, signal?: AbortSignal): Promise<CsvRow[]> {
  throwIfAborted(signal);

  const resolved = resolvedSeasonCache.get(season);
  if (resolved) return resolved;

  // A request with its own AbortSignal is not shared with unrelated callers. A
  // successful response is still retained for later reads.
  if (signal) {
    const rows = await requestSeasonRows(season, signal);
    resolvedSeasonCache.set(season, rows);
    return rows;
  }

  const pending = pendingSeasonCache.get(season);
  if (pending) return pending;

  const request = requestSeasonRows(season)
    .then((rows) => {
      resolvedSeasonCache.set(season, rows);
      return rows;
    })
    .finally(() => {
      pendingSeasonCache.delete(season);
    });

  pendingSeasonCache.set(season, request);
  return request;
}

function selectedFantasyPoints(
  standard: number,
  halfPpr: number,
  ppr: number,
  scoring: WeeklyFantasyScoringMode
) {
  if (scoring === "standard") return standard;
  if (scoring === "halfPpr") return halfPpr;
  return ppr;
}

function toWeeklyRow(
  source: CsvRow,
  requestedSeason: number,
  scoring: WeeklyFantasyScoringMode
): WeeklyPlayerStatRow | null {
  const playerId = source.player_id?.trim();
  const week = nullableNumber(source.week);
  if (!playerId || week === null) return null;

  const season = nullableNumber(source.season) ?? requestedSeason;
  const receptions = numberOrZero(source.receptions);
  const sourceStandardPoints = nullableNumber(source.fantasy_points);
  const sourcePprPoints = nullableNumber(source.fantasy_points_ppr);
  const standardFantasyPoints =
    sourceStandardPoints ?? (sourcePprPoints ?? receptions) - receptions;
  const pprFantasyPoints = sourcePprPoints ?? standardFantasyPoints + receptions;
  const halfPprFantasyPoints = standardFantasyPoints + receptions * 0.5;
  const stats: Record<string, number> = {};

  for (const [key, value] of Object.entries(source)) {
    if (NON_STAT_FIELDS.has(key)) continue;
    const numericValue = nullableNumber(value);
    if (numericValue !== null) stats[key] = numericValue;
  }

  return {
    playerId,
    playerName: source.player_display_name || source.player_name || playerId,
    shortName: source.player_name || source.player_display_name || playerId,
    position: source.position || source.position_group || "UNK",
    positionGroup: source.position_group || source.position || "UNK",
    headshotUrl: source.headshot_url || null,
    team: source.team || "",
    opponent: source.opponent_team || "",
    season,
    week,
    seasonType: source.season_type?.toUpperCase() === "POST" ? "POST" : "REG",
    gameId: source.game_id || "",
    standardFantasyPoints,
    halfPprFantasyPoints,
    pprFantasyPoints,
    selectedFantasyPoints: selectedFantasyPoints(
      standardFantasyPoints,
      halfPprFantasyPoints,
      pprFantasyPoints,
      scoring
    ),
    stats,
  };
}

function compareWeeklyRows(left: WeeklyPlayerStatRow, right: WeeklyPlayerStatRow) {
  return (
    left.season - right.season ||
    left.week - right.week ||
    left.gameId.localeCompare(right.gameId)
  );
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function percentile(sortedValues: number[], requestedPercentile: number) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0]!;

  const position = (sortedValues.length - 1) * requestedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex]!;
  const upperValue = sortedValues[upperIndex]!;

  if (lowerIndex === upperIndex) return lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function totalStat(rows: WeeklyPlayerStatRow[], key: string) {
  return rows.reduce((total, row) => total + (row.stats[key] ?? 0), 0);
}

function averagePresentStat(rows: WeeklyPlayerStatRow[], key: string): number | null {
  const values = rows.flatMap((row) => {
    const value = row.stats[key];
    return typeof value === "number" ? [value] : [];
  });
  return values.length > 0 ? average(values) : null;
}

function summarizePlayerRows(rows: WeeklyPlayerStatRow[]): WeeklyPlayerSummary {
  const weeklyRows = [...rows].sort(compareWeeklyRows);
  const latest = weeklyRows[weeklyRows.length - 1]!;
  const selectedPoints = weeklyRows.map((row) => row.selectedFantasyPoints);
  const sortedPoints = [...selectedPoints].sort((left, right) => left - right);
  const selectedFantasyPoints = sum(selectedPoints);
  const selectedFantasyPointsPerGame = average(selectedPoints);
  const variance = average(
    selectedPoints.map((points) => (points - selectedFantasyPointsPerGame) ** 2)
  );

  return {
    playerId: latest.playerId,
    playerName: latest.playerName,
    shortName: latest.shortName,
    position: latest.position,
    positionGroup: latest.positionGroup,
    headshotUrl: latest.headshotUrl,
    teams: uniqueValues(weeklyRows.map((row) => row.team).filter(Boolean)),
    seasons: uniqueValues(weeklyRows.map((row) => row.season)),
    games: weeklyRows.length,
    standardFantasyPoints: sum(weeklyRows.map((row) => row.standardFantasyPoints)),
    halfPprFantasyPoints: sum(weeklyRows.map((row) => row.halfPprFantasyPoints)),
    pprFantasyPoints: sum(weeklyRows.map((row) => row.pprFantasyPoints)),
    selectedFantasyPoints,
    selectedFantasyPointsPerGame,
    last3FantasyPointsPerGame: average(selectedPoints.slice(-3)),
    last5FantasyPointsPerGame: average(selectedPoints.slice(-5)),
    medianFantasyPoints: percentile(sortedPoints, 0.5),
    floorFantasyPoints: percentile(sortedPoints, 0.25),
    ceilingFantasyPoints: percentile(sortedPoints, 0.75),
    fantasyPointsStandardDeviation: Math.sqrt(variance),
    latestSeason: latest.season,
    latestWeek: latest.week,
    latestGameId: latest.gameId,
    latestTeam: latest.team,
    latestOpponent: latest.opponent,
    totals: {
      carries: totalStat(weeklyRows, "carries"),
      targets: totalStat(weeklyRows, "targets"),
      receptions: totalStat(weeklyRows, "receptions"),
      rushingYards: totalStat(weeklyRows, "rushing_yards"),
      receivingYards: totalStat(weeklyRows, "receiving_yards"),
      passingYards: totalStat(weeklyRows, "passing_yards"),
      rushingTouchdowns: totalStat(weeklyRows, "rushing_tds"),
      receivingTouchdowns: totalStat(weeklyRows, "receiving_tds"),
      passingTouchdowns: totalStat(weeklyRows, "passing_tds"),
    },
    averageMetrics: {
      targetShare: averagePresentStat(weeklyRows, "target_share"),
      airYardsShare: averagePresentStat(weeklyRows, "air_yards_share"),
      wopr: averagePresentStat(weeklyRows, "wopr"),
    },
    weeklyRows,
  };
}

/**
 * Builds player-level trend and consistency summaries from already-normalized
 * weekly rows. This function is pure so UI consumers and tests can reuse the
 * exact same calculations without fetching data.
 */
export function summarizeWeeklyPlayerStats(
  rows: WeeklyPlayerStatRow[]
): WeeklyPlayerSummary[] {
  const players = new Map<string, WeeklyPlayerStatRow[]>();

  for (const row of rows) {
    const playerRows = players.get(row.playerId) ?? [];
    playerRows.push(row);
    players.set(row.playerId, playerRows);
  }

  return [...players.values()]
    .map(summarizePlayerRows)
    .sort(
      (left, right) =>
        right.selectedFantasyPoints - left.selectedFantasyPoints ||
        left.playerName.localeCompare(right.playerName)
    );
}

function normalizedWeekRange(weekStart?: number, weekEnd?: number) {
  const start = Number.isFinite(weekStart) ? Math.trunc(weekStart as number) : null;
  const end = Number.isFinite(weekEnd) ? Math.trunc(weekEnd as number) : null;

  if (start !== null && end !== null) {
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }
  return { start, end };
}

/**
 * Loads nflverse weekly player data from the bundled public assets, falling
 * back to the matching nflverse GitHub release when a season is not bundled.
 */
export async function loadWeeklyPlayerStats({
  seasons,
  seasonType,
  scoring,
  weekStart,
  weekEnd,
  signal,
}: LoadWeeklyPlayerStatsOptions): Promise<WeeklyPlayerStatsResult> {
  throwIfAborted(signal);

  const requestedSeasons = uniqueValues(seasons)
    .filter((season) => Number.isInteger(season))
    .sort((left, right) => left - right);
  const weekRange = normalizedWeekRange(weekStart, weekEnd);
  const rows: WeeklyPlayerStatRow[] = [];
  const unavailableSeasons: number[] = [];

  await Promise.all(
    requestedSeasons.map(async (season) => {
      try {
        const seasonRows = await fetchSeasonRows(season, signal);
        throwIfAborted(signal);

        for (const source of seasonRows) {
          const sourceSeasonType = (source.season_type || "REG").toUpperCase();
          if (seasonType !== "ALL" && sourceSeasonType !== seasonType) continue;

          const week = nullableNumber(source.week);
          if (week === null) continue;
          if (weekRange.start !== null && week < weekRange.start) continue;
          if (weekRange.end !== null && week > weekRange.end) continue;

          const weeklyRow = toWeeklyRow(source, season, scoring);
          if (weeklyRow) rows.push(weeklyRow);
        }
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
          throw error;
        }
        unavailableSeasons.push(season);
      }
    })
  );

  rows.sort(compareWeeklyRows);
  return {
    rows,
    summaries: summarizeWeeklyPlayerStats(rows),
    unavailableSeasons: unavailableSeasons.sort((left, right) => left - right),
  };
}
