import type { ToolScoring } from "../../data/toolPlayerData";

const SLEEPER_PROJECTION_API = "https://api.sleeper.app/projections/nfl";
const PROJECTION_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const PROJECTION_CACHE_MS = 10 * 60 * 1_000;

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

export type SleeperWeeklyProjection = {
  playerId: string;
  points: number;
  opponent: string;
  week: number;
  season: string;
  updatedAt: number | null;
};

type SleeperWeeklyProjectionRow = {
  player_id?: unknown;
  opponent?: unknown;
  week?: unknown;
  season?: unknown;
  updated_at?: unknown;
  stats?: unknown;
};

const projectionPromises = new Map<string, {
  expiresAt: number;
  promise: Promise<SleeperWeeklyProjectionRow[]>;
}>();

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object";
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectionStat(scoring: ToolScoring) {
  if (scoring === "ppr") return "pts_ppr";
  if (scoring === "halfPpr") return "pts_half_ppr";
  return "pts_std";
}

function projectionUrl(season: string, week: number, seasonType: string) {
  const params = new URLSearchParams({ season_type: seasonType });
  for (const position of PROJECTION_POSITIONS) params.append("position[]", position);
  return `${SLEEPER_PROJECTION_API}/${encodeURIComponent(season)}/${week}?${params.toString()}`;
}

async function fetchProjectionRows(
  season: string,
  week: number,
  seasonType: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(projectionUrl(season, week, seasonType));
  if (!response.ok) {
    throw new Error(`Sleeper weekly projections returned ${response.status}.`);
  }
  const rows = await response.json() as unknown;
  if (!Array.isArray(rows)) throw new Error("Sleeper weekly projections returned an invalid response.");
  return rows as SleeperWeeklyProjectionRow[];
}

function loadProjectionRows(
  season: string,
  week: number,
  seasonType: string,
  fetcher: Fetcher,
) {
  if (fetcher !== fetch) return fetchProjectionRows(season, week, seasonType, fetcher);
  const key = `${season}|${seasonType}|${week}`;
  const cached = projectionPromises.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const request = fetchProjectionRows(season, week, seasonType, fetcher).catch((error) => {
    if (projectionPromises.get(key)?.promise === request) projectionPromises.delete(key);
    throw error;
  });
  projectionPromises.set(key, {
    expiresAt: Date.now() + PROJECTION_CACHE_MS,
    promise: request,
  });
  return request;
}

export function indexSleeperWeeklyProjections(
  rows: SleeperWeeklyProjectionRow[],
  scoring: ToolScoring,
) {
  const pointsField = projectionStat(scoring);
  const projections = new Map<string, SleeperWeeklyProjection>();
  for (const row of rows) {
    const playerId = String(row.player_id ?? "").trim();
    if (!playerId || !isRecord(row.stats)) continue;
    const points = finiteNumber(row.stats[pointsField]);
    if (points === null) continue;
    const candidate: SleeperWeeklyProjection = {
      playerId,
      points,
      opponent: String(row.opponent ?? "").trim().toUpperCase(),
      week: Math.max(1, Math.round(finiteNumber(row.week) ?? 1)),
      season: String(row.season ?? "").trim(),
      updatedAt: finiteNumber(row.updated_at),
    };
    const current = projections.get(playerId);
    if (!current || (candidate.updatedAt ?? 0) >= (current.updatedAt ?? 0)) {
      projections.set(playerId, candidate);
    }
  }
  return projections;
}

export async function loadSleeperWeeklyProjections(
  season: string,
  week: number,
  seasonType: string,
  scoring: ToolScoring,
  fetcher: Fetcher = fetch,
) {
  const normalizedWeek = Math.max(1, Math.round(week));
  const normalizedSeasonType = ["pre", "regular", "post"].includes(seasonType)
    ? seasonType
    : "regular";
  const rows = await loadProjectionRows(season, normalizedWeek, normalizedSeasonType, fetcher);
  return indexSleeperWeeklyProjections(rows, scoring);
}
