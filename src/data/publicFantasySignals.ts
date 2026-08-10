export const FANTASY_FOOTBALL_CALCULATOR_SOURCE = Object.freeze({
  id: "fantasy-football-calculator-adp",
  name: "Fantasy Football Calculator",
  homepageUrl: "https://fantasyfootballcalculator.com/",
  documentationUrl: "https://help.fantasyfootballcalculator.com/article/42-adp-rest-api",
  attribution: "ADP data provided by Fantasy Football Calculator.",
} as const);

export const SLEEPER_TRENDING_SOURCE = Object.freeze({
  id: "sleeper-trending",
  name: "Sleeper",
  homepageUrl: "https://sleeper.com/",
  documentationUrl: "https://docs.sleeper.com/",
  attribution: "Player trending data provided by Sleeper.",
} as const);

export const PUBLIC_FANTASY_SIGNAL_SOURCES = Object.freeze({
  ffcAdp: FANTASY_FOOTBALL_CALCULATOR_SOURCE,
  sleeperTrending: SLEEPER_TRENDING_SOURCE,
} as const);

export type FfcAdpScoring = "standard" | "half" | "ppr";
export type SleeperTrendingType = "add" | "drop";

export interface PublicFantasyParseWarning {
  path: string;
  message: string;
}

export type FfcAdpMeta = Record<string, unknown>;

/**
 * A normalized FFC row. Provider-specific fields not listed here are retained.
 */
export interface FfcAdpPlayer extends Record<string, unknown> {
  player_id: string | number;
  name: string;
  position: string;
  team: string;
  adp: number | null;
  /** Stable alias for FFC's `adp_formatted` field. */
  formatted: string;
  adp_formatted: string;
  times_drafted: number | null;
  high: number | null;
  low: number | null;
  stdev: number | null;
  bye: number | null;
}

export interface FfcAdpResult {
  status: string | null;
  meta: FfcAdpMeta;
  players: FfcAdpPlayer[];
  warnings: PublicFantasyParseWarning[];
  source: typeof FANTASY_FOOTBALL_CALCULATOR_SOURCE;
}

export interface LoadFfcAdpOptions {
  scoring?: FfcAdpScoring;
  year?: number;
  teams?: number;
  signal?: AbortSignal;
  /** Primarily useful for server rendering and deterministic tests. */
  fetcher?: typeof fetch;
  /** Keep the app on its same-origin proxy by default. */
  baseUrl?: string;
}

export interface SleeperTrendingSignal {
  playerId: string;
  count: number;
  type: SleeperTrendingType;
}

export interface LoadSleeperTrendingOptions {
  type?: SleeperTrendingType;
  lookbackHours?: number;
  limit?: number;
  signal?: AbortSignal;
  /** Primarily useful for server rendering and deterministic tests. */
  fetcher?: typeof fetch;
  baseUrl?: string;
}

const TEAM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ARZ: "ARI",
  JAC: "JAX",
  KAN: "KC",
  LA: "LAR",
  LVR: "LV",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  GNB: "GB",
  NWE: "NE",
  NOR: "NO",
  SFO: "SF",
  TAM: "TB",
  WSH: "WAS",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return value;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function normalizePublicFantasyPosition(position: unknown) {
  const normalized = String(position ?? "").trim().toUpperCase();
  if (normalized === "D/ST" || normalized === "DST" || normalized === "DEF") return "DEF";
  if (normalized === "PK" || normalized === "K") return "K";
  return normalized;
}

export function normalizePublicFantasyTeam(team: unknown) {
  const normalized = String(team ?? "").trim().toUpperCase();
  if (!normalized) return "";
  return TEAM_ALIASES[normalized] ?? normalized;
}

function parsePlayerId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return nonEmptyString(value);
}

function normalizedNumberField(
  row: Record<string, unknown>,
  key: string,
  path: string,
  warnings: PublicFantasyParseWarning[],
) {
  const value = finiteNumber(row[key]);
  if (row[key] !== undefined && row[key] !== null && row[key] !== "" && value === null) {
    warnings.push({ path: `${path}.${key}`, message: "Expected a finite number." });
  }
  return value;
}

function parseFfcPlayer(
  value: unknown,
  index: number,
  warnings: PublicFantasyParseWarning[],
): FfcAdpPlayer | null {
  const path = `players[${index}]`;
  if (!isRecord(value)) {
    warnings.push({ path, message: "Expected a player object; row was skipped." });
    return null;
  }

  const playerId = parsePlayerId(value.player_id);
  const name = nonEmptyString(value.name);
  const position = normalizePublicFantasyPosition(value.position);

  if (playerId === null || !name || !position) {
    warnings.push({
      path,
      message: "Missing player_id, name, or position; row was skipped.",
    });
    return null;
  }

  const formatted = nonEmptyString(value.formatted) ?? nonEmptyString(value.adp_formatted) ?? "";

  return {
    ...value,
    player_id: playerId,
    name,
    position,
    team: normalizePublicFantasyTeam(value.team),
    adp: normalizedNumberField(value, "adp", path, warnings),
    formatted,
    adp_formatted: formatted,
    times_drafted: normalizedNumberField(value, "times_drafted", path, warnings),
    high: normalizedNumberField(value, "high", path, warnings),
    low: normalizedNumberField(value, "low", path, warnings),
    stdev: normalizedNumberField(value, "stdev", path, warnings),
    bye: normalizedNumberField(value, "bye", path, warnings),
  };
}

export function parseFfcAdpPayload(payload: unknown): FfcAdpResult {
  const warnings: PublicFantasyParseWarning[] = [];
  const root = isRecord(payload) ? payload : null;
  const rawPlayers = Array.isArray(payload)
    ? payload
    : root && Array.isArray(root.players)
      ? root.players
      : [];

  if (!Array.isArray(payload) && (!root || !Array.isArray(root.players))) {
    warnings.push({ path: "players", message: "Expected a players array." });
  }

  if (root?.meta !== undefined && !isRecord(root.meta)) {
    warnings.push({ path: "meta", message: "Expected a metadata object." });
  }

  return {
    status: nonEmptyString(root?.status),
    meta: isRecord(root?.meta) ? { ...root.meta } : {},
    players: rawPlayers
      .map((player, index) => parseFfcPlayer(player, index, warnings))
      .filter((player): player is FfcAdpPlayer => player !== null),
    warnings,
    source: FANTASY_FOOTBALL_CALCULATOR_SOURCE,
  };
}

async function readJson(response: Response, sourceName: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${sourceName} returned an unreadable JSON response: ${reason}`);
  }
}

export async function loadFfcAdp(options: LoadFfcAdpOptions = {}): Promise<FfcAdpResult> {
  const {
    scoring = "ppr",
    year = new Date().getFullYear(),
    teams = 12,
    signal,
    fetcher = globalThis.fetch,
    baseUrl = "/ffc-api",
  } = options;

  positiveInteger(year, "year");
  positiveInteger(teams, "teams");

  const query = new URLSearchParams({ year: String(year), teams: String(teams) });
  const endpointScoring = scoring === "half" ? "half-ppr" : scoring;
  const url = `${normalizeBaseUrl(baseUrl)}/adp/${endpointScoring}?${query.toString()}`;
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Fantasy Football Calculator ADP request failed (${response.status}).`);
  }

  return parseFfcAdpPayload(await readJson(response, "Fantasy Football Calculator"));
}

export const loadFantasyFootballCalculatorAdp = loadFfcAdp;

export function parseSleeperTrendingPayload(
  payload: unknown,
  type: SleeperTrendingType,
): SleeperTrendingSignal[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((value): SleeperTrendingSignal[] => {
    if (!isRecord(value)) return [];
    const playerId = parsePlayerId(value.player_id);
    const count = finiteNumber(value.count);
    if (playerId === null || count === null || count < 0) return [];
    return [{ playerId: String(playerId), count, type }];
  });
}

export async function loadSleeperTrending(
  options: LoadSleeperTrendingOptions = {},
): Promise<SleeperTrendingSignal[]> {
  const {
    type = "add",
    lookbackHours = 24,
    limit = 25,
    signal,
    fetcher = globalThis.fetch,
    baseUrl = "https://api.sleeper.app/v1",
  } = options;

  positiveInteger(lookbackHours, "lookbackHours");
  positiveInteger(limit, "limit");

  const query = new URLSearchParams({
    lookback_hours: String(lookbackHours),
    limit: String(limit),
  });
  const url = `${normalizeBaseUrl(baseUrl)}/players/nfl/trending/${type}?${query.toString()}`;
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Sleeper trending request failed (${response.status}).`);
  }

  return parseSleeperTrendingPayload(await readJson(response, "Sleeper"), type);
}
