import { appUrl } from "@/lib/appBasePath";

export type FantasyScoringMode = "standard" | "halfPpr" | "ppr";
export type HistoricalSeasonType = "REG" | "POST" | "ALL";

export const NFLVERSE_LATEST_AVAILABLE_SEASON = 2025;
export const NFLVERSE_MIN_PLAYER_STATS_SEASON = 2022;
export const BUNDLED_HISTORICAL_SEASONS = [2022, 2023, 2024, 2025] as const;
export const DEFAULT_HISTORICAL_SEASONS = [NFLVERSE_LATEST_AVAILABLE_SEASON];

export type HistoricalPlayerAggregate = {
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
  selectedFantasyPointsPerGame: number | null;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

type CsvRow = Record<string, string>;

const cache = new Map<number, Promise<CsvRow[]>>();
const LOCAL_PLAYER_STATS_URL = appUrl("data/nflverse-player-stats");
const NFLVERSE_PLAYER_STATS_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/stats_player";

const ID_FIELDS = new Set([
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

const AVERAGE_FIELDS = new Set([
  "passing_cpoe",
  "pacr",
  "racr",
  "target_share",
  "air_yards_share",
  "wopr",
  "fg_pct",
  "pat_pct",
]);

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows[0] ?? [];
  return rows.slice(1).flatMap((values) => {
    if (!values.length || values.every((value) => !value)) return [];
    const parsed: CsvRow = {};
    headers.forEach((header, index) => {
      parsed[header] = values[index] ?? "";
    });
    return [parsed];
  });
}

function cleanNumber(value: string | undefined) {
  if (value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanNullableNumber(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addToSetList(list: string[], value: string) {
  const clean = value.trim();
  if (clean && !list.includes(clean)) list.push(clean);
}

async function fetchSeasonRows(season: number, signal?: AbortSignal) {
  const cached = cache.get(season);
  if (cached) return cached;

  const init: RequestInit = signal ? { signal } : {};
  const request = (async () => {
    const localResponse = await fetch(
      `${LOCAL_PLAYER_STATS_URL}/stats_player_week_${season}.csv?v=${season}`,
      init
    );
    if (localResponse.ok) return parseCsv(await localResponse.text());

    const response = await fetch(
      `${NFLVERSE_PLAYER_STATS_URL}/stats_player_week_${season}.csv`,
      init
    );
    if (!response.ok) {
      throw new Error(`nflverse player stats ${season} returned ${response.status}`);
    }
    return parseCsv(await response.text());
  })();

  cache.set(
    season,
    request.catch((error) => {
      cache.delete(season);
      throw error;
    })
  );
  return request;
}

function selectedFantasyPoints(
  standard: number,
  halfPpr: number,
  ppr: number,
  scoring: FantasyScoringMode
) {
  if (scoring === "standard") return standard;
  if (scoring === "halfPpr") return halfPpr;
  return ppr;
}

function normalizeSeasonType(rowType: string, requested: HistoricalSeasonType) {
  if (requested === "ALL") return true;
  return rowType === requested;
}

export function seasonOptions() {
  return [...BUNDLED_HISTORICAL_SEASONS].sort((left, right) => right - left);
}

export async function loadHistoricalPlayerStats({
  seasons,
  scoring,
  seasonType,
  signal,
}: {
  seasons: number[];
  scoring: FantasyScoringMode;
  seasonType: HistoricalSeasonType;
  signal?: AbortSignal;
}) {
  const uniqueSeasons = [...new Set(seasons)]
    .filter((season) => Number.isInteger(season))
    .sort((left, right) => left - right);
  const aggregates = new Map<string, HistoricalPlayerAggregate>();
  const unavailableSeasons: number[] = [];

  await Promise.all(
    uniqueSeasons.map(async (season) => {
      try {
        const rows = await fetchSeasonRows(season, signal);

        for (const row of rows) {
          if (!normalizeSeasonType(row.season_type ?? "", seasonType)) continue;

          const playerId = row.player_id;
          if (!playerId) continue;

          const aggregate =
            aggregates.get(playerId) ??
            ({
              playerId,
              playerName: row.player_display_name || row.player_name || playerId,
              shortName: row.player_name || row.player_display_name || playerId,
              position: row.position || row.position_group || "UNK",
              positionGroup: row.position_group || row.position || "UNK",
              headshotUrl: row.headshot_url || null,
              teams: [],
              seasons: [],
              games: 0,
              standardFantasyPoints: 0,
              halfPprFantasyPoints: 0,
              pprFantasyPoints: 0,
              selectedFantasyPoints: 0,
              selectedFantasyPointsPerGame: null,
              totals: {},
              averages: {},
            } satisfies HistoricalPlayerAggregate);

          addToSetList(aggregate.teams, row.team ?? "");
          if (!aggregate.seasons.includes(season)) aggregate.seasons.push(season);
          aggregate.games += 1;

          const standardPoints = cleanNumber(row.fantasy_points);
          const receptions = cleanNumber(row.receptions);
          const pprPoints = cleanNumber(row.fantasy_points_ppr);
          const halfPprPoints = standardPoints + receptions * 0.5;

          aggregate.standardFantasyPoints += standardPoints;
          aggregate.halfPprFantasyPoints += halfPprPoints;
          aggregate.pprFantasyPoints += pprPoints;

          for (const [key, value] of Object.entries(row)) {
            if (ID_FIELDS.has(key)) continue;

            const numericValue = cleanNullableNumber(value);
            if (numericValue === null) continue;

            if (AVERAGE_FIELDS.has(key)) {
              aggregate.averages[`${key}__sum`] =
                (aggregate.averages[`${key}__sum`] ?? 0) + numericValue;
              aggregate.averages[`${key}__count`] =
                (aggregate.averages[`${key}__count`] ?? 0) + 1;
            } else {
              aggregate.totals[key] = (aggregate.totals[key] ?? 0) + numericValue;
            }
          }

          aggregates.set(playerId, aggregate);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        unavailableSeasons.push(season);
      }
    })
  );

  for (const aggregate of aggregates.values()) {
    aggregate.seasons.sort((left, right) => left - right);
    aggregate.selectedFantasyPoints = selectedFantasyPoints(
      aggregate.standardFantasyPoints,
      aggregate.halfPprFantasyPoints,
      aggregate.pprFantasyPoints,
      scoring
    );
    aggregate.selectedFantasyPointsPerGame =
      aggregate.games > 0 ? aggregate.selectedFantasyPoints / aggregate.games : null;

    for (const key of AVERAGE_FIELDS) {
      const sum = aggregate.averages[`${key}__sum`];
      const count = aggregate.averages[`${key}__count`];
      if (typeof sum === "number" && typeof count === "number" && count > 0) {
        aggregate.averages[key] = sum / count;
      }
    }
  }

  return {
    rows: [...aggregates.values()],
    unavailableSeasons: unavailableSeasons.sort((left, right) => left - right),
  };
}

export function parseSeasonInput(input: string) {
  const seasons = new Set<number>();

  for (const part of input.split(/[,\s]+/)) {
    const clean = part.trim();
    if (!clean) continue;

    const range = clean.match(/^(\d{4})-(\d{4})$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let season = min; season <= max; season += 1) seasons.add(season);
      continue;
    }

    const season = Number(clean);
    if (Number.isInteger(season)) seasons.add(season);
  }

  return [...seasons].sort((left, right) => left - right);
}
