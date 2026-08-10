import { appUrl } from "@/lib/appBasePath";

export type AnalyticsScoringMode = "standard" | "halfPpr" | "ppr";
export type AnalyticsPosition = "ALL" | "QB" | "RB" | "WR" | "TE";

export type AnalyticsLoadOptions = {
  season: number;
  scoring: AnalyticsScoringMode;
  position: AnalyticsPosition;
  team: string;
  weekStart: number;
  weekEnd: number;
  minGames: number;
};

export type AnalyticsPlayerMetric = {
  id: string;
  name: string;
  position: Exclude<AnalyticsPosition, "ALL">;
  team: string;
  games: number;
  actualPoints: number;
  actualPointsPerGame: number;
  expectedPoints: number;
  expectedPointsPerGame: number;
  opportunityPerGame: number;
  targetsPerGame: number;
  targetShare: number | null;
  airYardsShare: number | null;
  carriesPerGame: number;
  rushAttempts: number;
  expectedRushYards: number | null;
  rushingYardsOverExpected: number | null;
  rushingYardsOverExpectedPerAttempt: number | null;
  rushingYardsOverExpectedRate: number | null;
  boxRate: number | null;
  completionPercentageOverExpected: number | null;
  expectedCompletionPercentage: number | null;
  timeToThrow: number | null;
};

export type AnalyticsTeamMetric = {
  team: string;
  games: number;
  actualPointsPerGame: number;
  expectedPointsPerGame: number;
  deltaPerGame: number;
};

export type AnalyticsDataResult = {
  players: AnalyticsPlayerMetric[];
  teams: AnalyticsTeamMetric[];
};

type CsvRow = Record<string, string>;

type MutablePlayerMetric = Omit<AnalyticsPlayerMetric, "actualPointsPerGame" | "expectedPointsPerGame" | "opportunityPerGame" | "targetsPerGame" | "targetShare" | "airYardsShare" | "carriesPerGame" | "expectedRushYards" | "rushingYardsOverExpected" | "rushingYardsOverExpectedPerAttempt" | "rushingYardsOverExpectedRate" | "boxRate" | "completionPercentageOverExpected" | "expectedCompletionPercentage" | "timeToThrow"> & {
  gameIds: Set<string>;
  targets: number;
  teamTargets: number;
  airYards: number;
  teamAirYards: number;
  opportunities: number;
  carries: number;
  rushExpectedYards: number;
  rushYardsOverExpected: number;
  boxRateWeighted: number;
  boxRateAttempts: number;
  passAttempts: number;
  cpoeWeighted: number;
  expectedCompletionWeighted: number;
  timeToThrowWeighted: number;
};

type MutableTeamMetric = {
  gameIds: Set<string>;
  actualPoints: number;
  expectedPoints: number;
};

const FF_OPPORTUNITY_URL =
  "https://github.com/ffverse/ffopportunity/releases/download/latest-data";
const NEXT_GEN_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats";
const LOCAL_ANALYTICS_URL = appUrl("data/analytics");

const expectedCache = new Map<number, Promise<CsvRow[]>>();
const nextGenCache = new Map<"passing" | "rushing", Promise<CsvRow[]>>();

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

function numberValue(value: string | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoringReceptionValue(scoring: AnalyticsScoringMode) {
  if (scoring === "ppr") return 1;
  if (scoring === "halfPpr") return 0.5;
  return 0;
}

function isAnalyticsPosition(value: string | undefined): value is Exclude<AnalyticsPosition, "ALL"> {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

function inRange(value: number, start: number, end: number) {
  return value >= Math.min(start, end) && value <= Math.max(start, end);
}

async function requestText(localUrl: string, fallbackUrl: string) {
  const localResponse = await fetch(localUrl);
  if (localResponse.ok) return localResponse.text();

  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`Public analytics data returned ${response.status}.`);
  return response.text();
}

async function requestGzipText(localUrl: string, fallbackUrl: string) {
  const localResponse = await fetch(localUrl);
  const response = localResponse.ok ? localResponse : await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`NFL Next Gen Stats returned ${response.status}.`);

  // Vite serves bundled `.gz` assets with Content-Encoding: gzip, which browsers
  // transparently decode. GitHub's release response is a raw gzip stream, so only
  // decompress when the browser has not already done it for us.
  if (response.headers.get("content-encoding")?.includes("gzip")) {
    return response.text();
  }
  if (!response.body || typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress the public Next Gen data file.");
  }

  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).text();
}

function loadExpectedRows(season: number) {
  const cached = expectedCache.get(season);
  if (cached) return cached;

  const request = requestText(
    `${LOCAL_ANALYTICS_URL}/ffopportunity/ep_weekly_${season}.csv`,
    `${FF_OPPORTUNITY_URL}/ep_weekly_${season}.csv`
  ).then(parseCsv);
  expectedCache.set(season, request);
  return request;
}

function loadNextGenRows(type: "passing" | "rushing") {
  const cached = nextGenCache.get(type);
  if (cached) return cached;

  const request = requestGzipText(
    `${LOCAL_ANALYTICS_URL}/nflverse-nextgen/ngs_${type}.csv.gz`,
    `${NEXT_GEN_URL}/ngs_${type}.csv.gz`
  ).then(parseCsv);
  nextGenCache.set(type, request);
  return request;
}

function playerMetricFromOpportunity(row: CsvRow): MutablePlayerMetric | null {
  const id = row.player_id?.trim();
  const position = row.position?.trim().toUpperCase();
  if (!id || !isAnalyticsPosition(position)) return null;

  return {
    id,
    name: row.full_name?.trim() || id,
    position,
    team: row.posteam?.trim() || "FA",
    games: 0,
    actualPoints: 0,
    expectedPoints: 0,
    rushAttempts: 0,
    gameIds: new Set<string>(),
    targets: 0,
    teamTargets: 0,
    airYards: 0,
    teamAirYards: 0,
    opportunities: 0,
    carries: 0,
    rushExpectedYards: 0,
    rushYardsOverExpected: 0,
    boxRateWeighted: 0,
    boxRateAttempts: 0,
    passAttempts: 0,
    cpoeWeighted: 0,
    expectedCompletionWeighted: 0,
    timeToThrowWeighted: 0,
  };
}

function ensureNextGenMetric(
  metrics: Map<string, MutablePlayerMetric>,
  row: CsvRow
): MutablePlayerMetric | null {
  const id = row.player_gsis_id?.trim();
  const position = row.player_position?.trim().toUpperCase();
  if (!id || !isAnalyticsPosition(position)) return null;

  const existing = metrics.get(id);
  if (existing) return existing;

  const created: MutablePlayerMetric = {
    id,
    name: row.player_display_name?.trim() || id,
    position,
    team: row.team_abbr?.trim() || "FA",
    games: 0,
    actualPoints: 0,
    expectedPoints: 0,
    rushAttempts: 0,
    gameIds: new Set<string>(),
    targets: 0,
    teamTargets: 0,
    airYards: 0,
    teamAirYards: 0,
    opportunities: 0,
    carries: 0,
    rushExpectedYards: 0,
    rushYardsOverExpected: 0,
    boxRateWeighted: 0,
    boxRateAttempts: 0,
    passAttempts: 0,
    cpoeWeighted: 0,
    expectedCompletionWeighted: 0,
    timeToThrowWeighted: 0,
  };
  metrics.set(id, created);
  return created;
}

function toPlayerMetric(metric: MutablePlayerMetric): AnalyticsPlayerMetric {
  const games = metric.gameIds.size;
  const rushingYardsOverExpected = metric.rushAttempts > 0 ? metric.rushYardsOverExpected : null;
  const expectedRushYards = metric.rushAttempts > 0 ? metric.rushExpectedYards : null;
  const passAttempts = metric.passAttempts;

  return {
    id: metric.id,
    name: metric.name,
    position: metric.position,
    team: metric.team,
    games,
    actualPoints: metric.actualPoints,
    actualPointsPerGame: games > 0 ? metric.actualPoints / games : 0,
    expectedPoints: metric.expectedPoints,
    expectedPointsPerGame: games > 0 ? metric.expectedPoints / games : 0,
    opportunityPerGame: games > 0 ? metric.opportunities / games : 0,
    targetsPerGame: games > 0 ? metric.targets / games : 0,
    targetShare: metric.teamTargets > 0 ? metric.targets / metric.teamTargets : null,
    airYardsShare: metric.teamAirYards > 0 ? metric.airYards / metric.teamAirYards : null,
    carriesPerGame: games > 0 ? metric.carries / games : 0,
    rushAttempts: metric.rushAttempts,
    expectedRushYards,
    rushingYardsOverExpected,
    rushingYardsOverExpectedPerAttempt:
      rushingYardsOverExpected === null ? null : rushingYardsOverExpected / metric.rushAttempts,
    rushingYardsOverExpectedRate:
      rushingYardsOverExpected === null || !expectedRushYards
        ? null
        : (rushingYardsOverExpected / expectedRushYards) * 100,
    boxRate:
      metric.boxRateAttempts > 0 ? metric.boxRateWeighted / metric.boxRateAttempts : null,
    completionPercentageOverExpected:
      passAttempts > 0 ? metric.cpoeWeighted / passAttempts : null,
    expectedCompletionPercentage:
      passAttempts > 0 ? metric.expectedCompletionWeighted / passAttempts : null,
    timeToThrow: passAttempts > 0 ? metric.timeToThrowWeighted / passAttempts : null,
  };
}

/**
 * Loads only public, directly released nflverse / ffverse data and derives the
 * player-level metrics used by the Analytics Lab. All joins use GSIS player IDs.
 */
export async function loadAnalyticsData(options: AnalyticsLoadOptions): Promise<AnalyticsDataResult> {
  const [opportunityRows, rushingRows, passingRows] = await Promise.all([
    loadExpectedRows(options.season),
    loadNextGenRows("rushing"),
    loadNextGenRows("passing"),
  ]);
  const receptionValue = scoringReceptionValue(options.scoring);
  const metrics = new Map<string, MutablePlayerMetric>();
  const teams = new Map<string, MutableTeamMetric>();

  for (const row of opportunityRows) {
    const week = numberValue(row.week);
    const position = row.position?.trim().toUpperCase();
    const team = row.posteam?.trim() || "FA";
    if (
      numberValue(row.season) !== options.season ||
      !isAnalyticsPosition(position) ||
      !inRange(week, options.weekStart, options.weekEnd) ||
      (options.position !== "ALL" && position !== options.position) ||
      (options.team !== "ALL" && team !== options.team)
    ) {
      continue;
    }

    const created = playerMetricFromOpportunity(row);
    if (!created) continue;
    const metric = metrics.get(created.id) ?? created;
    metrics.set(metric.id, metric);

    const receptions = numberValue(row.receptions);
    const expectedReceptions = numberValue(row.receptions_exp);
    const actualPoints = numberValue(row.total_fantasy_points) + receptions * receptionValue;
    const expectedPoints = numberValue(row.total_fantasy_points_exp) + expectedReceptions * receptionValue;
    metric.actualPoints += actualPoints;
    metric.expectedPoints += expectedPoints;
    metric.targets += numberValue(row.rec_attempt);
    metric.teamTargets += numberValue(row.rec_attempt_team);
    metric.airYards += numberValue(row.rec_air_yards);
    metric.teamAirYards += numberValue(row.rec_air_yards_team);
    metric.carries += numberValue(row.rush_attempt);
    metric.opportunities += numberValue(row.rec_attempt) + numberValue(row.rush_attempt);
    metric.gameIds.add(row.game_id || `${options.season}-${week}-${team}`);
    metric.team = team;

    const teamMetric = teams.get(team) ?? { gameIds: new Set<string>(), actualPoints: 0, expectedPoints: 0 };
    teamMetric.actualPoints += actualPoints;
    teamMetric.expectedPoints += expectedPoints;
    teamMetric.gameIds.add(row.game_id || `${options.season}-${week}-${team}`);
    teams.set(team, teamMetric);
  }

  for (const row of rushingRows) {
    const week = numberValue(row.week);
    const team = row.team_abbr?.trim() || "FA";
    if (
      numberValue(row.season) !== options.season ||
      row.season_type !== "REG" ||
      week === 0 ||
      !inRange(week, options.weekStart, options.weekEnd) ||
      (options.position !== "ALL" && row.player_position !== options.position) ||
      (options.team !== "ALL" && team !== options.team)
    ) {
      continue;
    }

    const metric = ensureNextGenMetric(metrics, row);
    if (!metric) continue;
    const attempts = numberValue(row.rush_attempts);
    metric.rushAttempts += attempts;
    metric.rushExpectedYards += numberValue(row.expected_rush_yards);
    metric.rushYardsOverExpected += numberValue(row.rush_yards_over_expected);
    const boxRate = nullableNumber(row.percent_attempts_gte_eight_defenders);
    if (boxRate !== null) {
      metric.boxRateWeighted += boxRate * attempts;
      metric.boxRateAttempts += attempts;
    }
  }

  for (const row of passingRows) {
    const week = numberValue(row.week);
    const team = row.team_abbr?.trim() || "FA";
    if (
      numberValue(row.season) !== options.season ||
      row.season_type !== "REG" ||
      week === 0 ||
      !inRange(week, options.weekStart, options.weekEnd) ||
      (options.position !== "ALL" && row.player_position !== options.position) ||
      (options.team !== "ALL" && team !== options.team)
    ) {
      continue;
    }

    const metric = ensureNextGenMetric(metrics, row);
    if (!metric) continue;
    const attempts = numberValue(row.attempts);
    metric.passAttempts += attempts;
    metric.cpoeWeighted += numberValue(row.completion_percentage_above_expectation) * attempts;
    metric.expectedCompletionWeighted += numberValue(row.expected_completion_percentage) * attempts;
    metric.timeToThrowWeighted += numberValue(row.avg_time_to_throw) * attempts;
  }

  const players = [...metrics.values()]
    .map(toPlayerMetric)
    .filter((player) => player.games >= options.minGames)
    .sort(
      (left, right) =>
        right.expectedPointsPerGame - left.expectedPointsPerGame ||
        left.name.localeCompare(right.name)
    );

  const teamMetrics = [...teams.entries()]
    .map(([team, metric]) => ({
      team,
      games: metric.gameIds.size,
      actualPointsPerGame: metric.gameIds.size ? metric.actualPoints / metric.gameIds.size : 0,
      expectedPointsPerGame: metric.gameIds.size ? metric.expectedPoints / metric.gameIds.size : 0,
    }))
    .filter((metric) => metric.games >= options.minGames)
    .map((metric) => ({ ...metric, deltaPerGame: metric.actualPointsPerGame - metric.expectedPointsPerGame }))
    .sort((left, right) => right.expectedPointsPerGame - left.expectedPointsPerGame);

  return { players, teams: teamMetrics };
}
