const SLEEPER_STATS_API = "https://api.sleeper.com/stats/nfl";
const STATS_CACHE_MS = 60 * 1_000;

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

export type SleeperWeeklyStatLine = {
  playerId: string;
  season: string;
  week: number;
  team: string;
  opponent: string;
  gameDate: string;
  gameId: string;
  stats: Record<string, number>;
};

type SleeperWeeklyStatRow = {
  player_id?: unknown;
  season?: unknown;
  week?: unknown;
  team?: unknown;
  opponent?: unknown;
  date?: unknown;
  game_id?: unknown;
  stats?: unknown;
};

const statsPromises = new Map<string, { expiresAt: number; promise: Promise<SleeperWeeklyStatRow[]> }>();

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object";
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSleeperWeeklyStatRow(
  row: SleeperWeeklyStatRow,
  season: string,
  week: number,
): SleeperWeeklyStatLine | null {
  const playerId = String(row.player_id ?? "").trim();
  if (!playerId || !isRecord(row.stats)) return null;
  const stats = Object.fromEntries(
    Object.entries(row.stats)
      .map(([key, value]) => [key, finiteNumber(value)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null),
  );
  if (!Object.keys(stats).length) return null;
  return {
    playerId,
    season: String(row.season ?? season).trim() || season,
    week: Math.max(1, Math.round(finiteNumber(row.week) ?? week)),
    team: String(row.team ?? "").trim().toUpperCase(),
    opponent: String(row.opponent ?? "").trim().toUpperCase(),
    gameDate: String(row.date ?? "").trim(),
    gameId: String(row.game_id ?? "").trim(),
    stats,
  };
}

async function fetchStatsRows(season: string, week: number, seasonType: string, fetcher: Fetcher) {
  const params = new URLSearchParams({ season_type: seasonType });
  const response = await fetcher(`${SLEEPER_STATS_API}/${encodeURIComponent(season)}/${week}?${params.toString()}`);
  if (!response.ok) throw new Error(`Sleeper weekly stats returned ${response.status}.`);
  const rows = await response.json() as unknown;
  if (!Array.isArray(rows)) throw new Error("Sleeper weekly stats returned an invalid response.");
  return rows as SleeperWeeklyStatRow[];
}

function loadStatsRows(season: string, week: number, seasonType: string, fetcher: Fetcher) {
  if (fetcher !== fetch) return fetchStatsRows(season, week, seasonType, fetcher);
  const key = `${season}|${seasonType}|${week}`;
  const cached = statsPromises.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const request = fetchStatsRows(season, week, seasonType, fetcher).catch((error) => {
    if (statsPromises.get(key)?.promise === request) statsPromises.delete(key);
    throw error;
  });
  statsPromises.set(key, { expiresAt: Date.now() + STATS_CACHE_MS, promise: request });
  return request;
}

export async function loadSleeperWeeklyStats(
  season: string,
  week: number,
  seasonType: string,
  fetcher: Fetcher = fetch,
) {
  const normalizedWeek = Math.max(1, Math.round(week));
  const normalizedSeasonType = ["pre", "regular", "post"].includes(seasonType) ? seasonType : "regular";
  const rows = await loadStatsRows(season, normalizedWeek, normalizedSeasonType, fetcher);
  const statLines = new Map<string, SleeperWeeklyStatLine>();
  for (const row of rows) {
    const line = normalizeSleeperWeeklyStatRow(row, season, normalizedWeek);
    if (line) statLines.set(line.playerId, line);
  }
  return statLines;
}
