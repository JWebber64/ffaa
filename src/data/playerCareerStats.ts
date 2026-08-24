import { appUrl } from "@/lib/appBasePath";

export type PlayerCareerScoringMode = "standard" | "halfPpr" | "ppr";

export const NFLVERSE_CAREER_MIN_SEASON = 1999;
export const NFLVERSE_CAREER_LATEST_SEASON = 2025;

export type PlayerCareerSeason = {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season: number;
  games: number;
  fantasyPoints: number;
  fantasyPointsPerGame: number | null;
  completions: number;
  passingAttempts: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  carries: number;
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  targets: number;
  receivingYards: number;
  receivingTouchdowns: number;
  fumblesLost: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPercentage: number | null;
  extraPointsMade: number;
  extraPointsAttempted: number;
};

export type PlayerCareerStatsResult = {
  seasons: PlayerCareerSeason[];
  unavailableSeasons: number[];
  coverageStart: number;
  coverageEnd: number;
};

type CareerSourceRow = Omit<PlayerCareerSeason, "fantasyPoints" | "fantasyPointsPerGame"> & {
  standardFantasyPoints: number;
  pprFantasyPoints: number;
};

type LoadPlayerCareerStatsOptions = {
  playerId?: string;
  playerName: string;
  position: string;
  scoring: PlayerCareerScoringMode;
  signal?: AbortSignal;
};

const NFLVERSE_PLAYER_STATS_URL =
  "https://github.com/nflverse/nflverse-data/releases/download/stats_player";
const LOCAL_CAREER_STATS_URL = appUrl("data/nflverse-player-careers.json");
const resolvedSeasonCache = new Map<number, CareerSourceRow[]>();
let resolvedCareerBundle: {
  rows: CareerSourceRow[];
  coverageStart: number;
  coverageEnd: number;
} | null = null;

type CompactCareerBundle = {
  version: number;
  coverageStart: number;
  coverageEnd: number;
  players: Record<string, { n: string; s: Array<Array<string | number | null>> }>;
};

const CAREER_FIELDS = [
  "player_id",
  "player_display_name",
  "player_name",
  "position",
  "recent_team",
  "season",
  "games",
  "fantasy_points",
  "fantasy_points_ppr",
  "completions",
  "attempts",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "carries",
  "rushing_yards",
  "rushing_tds",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_tds",
  "fumbles_lost_total",
  "fg_made",
  "fg_att",
  "fg_pct",
  "pat_made",
  "pat_att",
] as const;

function abortError() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The player career request was aborted.", "AbortError");
  }
  const error = new Error("The player career request was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function parseCsvRecord(record: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    const nextCharacter = record[index + 1];
    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function numberOrZero(value: string | undefined) {
  const parsed = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePlayerCareerCsv(text: string, requestedSeason: number): CareerSourceRow[] {
  const records = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvRecord(records[0] ?? "");
  const fieldIndexes = new Map(
    CAREER_FIELDS.map((field) => [field, headers.indexOf(field)]),
  );

  function field(values: string[], name: (typeof CAREER_FIELDS)[number]) {
    const index = fieldIndexes.get(name) ?? -1;
    return index >= 0 ? values[index] : undefined;
  }

  return records.slice(1).flatMap((record): CareerSourceRow[] => {
    const values = parseCsvRecord(record);
    const playerId = field(values, "player_id")?.trim() ?? "";
    if (!playerId) return [];
    const games = numberOrZero(field(values, "games"));
    return [{
      playerId,
      playerName:
        field(values, "player_display_name")?.trim() ||
        field(values, "player_name")?.trim() ||
        playerId,
      position: field(values, "position")?.trim() || "UNK",
      team: field(values, "recent_team")?.trim() || "",
      season: numberOrZero(field(values, "season")) || requestedSeason,
      games,
      standardFantasyPoints: numberOrZero(field(values, "fantasy_points")),
      pprFantasyPoints: numberOrZero(field(values, "fantasy_points_ppr")),
      completions: numberOrZero(field(values, "completions")),
      passingAttempts: numberOrZero(field(values, "attempts")),
      passingYards: numberOrZero(field(values, "passing_yards")),
      passingTouchdowns: numberOrZero(field(values, "passing_tds")),
      interceptions: numberOrZero(field(values, "passing_interceptions")),
      carries: numberOrZero(field(values, "carries")),
      rushingYards: numberOrZero(field(values, "rushing_yards")),
      rushingTouchdowns: numberOrZero(field(values, "rushing_tds")),
      receptions: numberOrZero(field(values, "receptions")),
      targets: numberOrZero(field(values, "targets")),
      receivingYards: numberOrZero(field(values, "receiving_yards")),
      receivingTouchdowns: numberOrZero(field(values, "receiving_tds")),
      fumblesLost: numberOrZero(field(values, "fumbles_lost_total")),
      fieldGoalsMade: numberOrZero(field(values, "fg_made")),
      fieldGoalsAttempted: numberOrZero(field(values, "fg_att")),
      fieldGoalPercentage: nullableNumber(field(values, "fg_pct")),
      extraPointsMade: numberOrZero(field(values, "pat_made")),
      extraPointsAttempted: numberOrZero(field(values, "pat_att")),
    }];
  });
}

async function decompressGzip(response: Response) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress nflverse career data.");
  }
  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

async function requestSeasonRows(season: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  const init: RequestInit = signal ? { signal } : {};
  const baseName = `stats_player_reg_${season}.csv`;

  try {
    const compressedResponse = await fetch(`${NFLVERSE_PLAYER_STATS_URL}/${baseName}.gz`, init);
    throwIfAborted(signal);
    if (compressedResponse.ok) {
      const text = await decompressGzip(compressedResponse);
      throwIfAborted(signal);
      return parsePlayerCareerCsv(text, season);
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
  }

  const response = await fetch(`${NFLVERSE_PLAYER_STATS_URL}/${baseName}`, init);
  throwIfAborted(signal);
  if (!response.ok) {
    throw new Error(`nflverse career stats ${season} returned ${response.status}`);
  }
  return parsePlayerCareerCsv(await response.text(), season);
}

async function loadSeasonRows(season: number, signal?: AbortSignal) {
  const resolved = resolvedSeasonCache.get(season);
  if (resolved) return resolved;
  const rows = await requestSeasonRows(season, signal);
  resolvedSeasonCache.set(season, rows);
  return rows;
}

async function loadBundledCareerRows(signal?: AbortSignal) {
  if (resolvedCareerBundle) return resolvedCareerBundle;
  const response = await fetch(
    `${LOCAL_CAREER_STATS_URL}?v=${NFLVERSE_CAREER_LATEST_SEASON}`,
    signal ? { signal } : {},
  );
  throwIfAborted(signal);
  if (!response.ok) throw new Error(`Bundled career stats returned ${response.status}`);
  const bundle = await response.json() as CompactCareerBundle;
  if (bundle.version !== 1 || !bundle.players || !Number.isInteger(bundle.coverageStart) || !Number.isInteger(bundle.coverageEnd)) {
    throw new Error("Bundled career stats have an unsupported format.");
  }

  const rows: CareerSourceRow[] = [];
  for (const [playerId, player] of Object.entries(bundle.players)) {
    for (const values of player.s) {
      const numberAt = (index: number) => typeof values[index] === "number" ? values[index] as number : 0;
      const stringAt = (index: number) => typeof values[index] === "string" ? values[index] as string : "";
      rows.push({
        playerId,
        playerName: player.n,
        season: numberAt(0),
        position: stringAt(1),
        team: stringAt(2),
        games: numberAt(3),
        standardFantasyPoints: numberAt(4),
        pprFantasyPoints: numberAt(5),
        completions: numberAt(6),
        passingAttempts: numberAt(7),
        passingYards: numberAt(8),
        passingTouchdowns: numberAt(9),
        interceptions: numberAt(10),
        carries: numberAt(11),
        rushingYards: numberAt(12),
        rushingTouchdowns: numberAt(13),
        receptions: numberAt(14),
        targets: numberAt(15),
        receivingYards: numberAt(16),
        receivingTouchdowns: numberAt(17),
        fumblesLost: numberAt(18),
        fieldGoalsMade: numberAt(19),
        fieldGoalsAttempted: numberAt(20),
        fieldGoalPercentage: typeof values[21] === "number" ? values[21] : null,
        extraPointsMade: numberAt(22),
        extraPointsAttempted: numberAt(23),
      });
    }
  }

  resolvedCareerBundle = {
    rows,
    coverageStart: bundle.coverageStart,
    coverageEnd: bundle.coverageEnd,
  };
  return resolvedCareerBundle;
}

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'`]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizePosition(position: string) {
  const normalized = position.trim().toUpperCase();
  if (normalized === "FB") return "RB";
  if (normalized === "PK") return "K";
  return normalized;
}

export function selectPlayerCareerRows(
  rows: CareerSourceRow[],
  identity: Pick<LoadPlayerCareerStatsOptions, "playerId" | "playerName" | "position">,
) {
  const exactId = identity.playerId?.trim();
  if (exactId) {
    return rows.filter((row) => row.playerId === exactId);
  }

  const requestedName = normalizeName(identity.playerName);
  const requestedPosition = normalizePosition(identity.position);
  const candidates = rows.filter((row) => normalizeName(row.playerName) === requestedName);
  const groups = new Map<string, CareerSourceRow[]>();
  for (const row of candidates) {
    const group = groups.get(row.playerId) ?? [];
    group.push(row);
    groups.set(row.playerId, group);
  }

  return [...groups.values()].sort((left, right) => {
    const leftPositionMatch = left.some((row) => normalizePosition(row.position) === requestedPosition);
    const rightPositionMatch = right.some((row) => normalizePosition(row.position) === requestedPosition);
    if (leftPositionMatch !== rightPositionMatch) return rightPositionMatch ? 1 : -1;
    const leftLatest = Math.max(...left.map((row) => row.season));
    const rightLatest = Math.max(...right.map((row) => row.season));
    if (leftLatest !== rightLatest) return rightLatest - leftLatest;
    return right.reduce((sum, row) => sum + row.games, 0) - left.reduce((sum, row) => sum + row.games, 0);
  })[0] ?? [];
}

function selectedFantasyPoints(row: CareerSourceRow, scoring: PlayerCareerScoringMode) {
  if (scoring === "standard") return row.standardFantasyPoints;
  if (scoring === "halfPpr") {
    return row.standardFantasyPoints + row.receptions * 0.5;
  }
  return row.pprFantasyPoints;
}

async function loadAllSeasons(signal?: AbortSignal) {
  const seasons = Array.from(
    { length: NFLVERSE_CAREER_LATEST_SEASON - NFLVERSE_CAREER_MIN_SEASON + 1 },
    (_, index) => NFLVERSE_CAREER_MIN_SEASON + index,
  );
  const rows: CareerSourceRow[] = [];
  const unavailableSeasons: number[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < seasons.length) {
      const season = seasons[nextIndex];
      nextIndex += 1;
      if (season === undefined) return;
      try {
        rows.push(...await loadSeasonRows(season, signal));
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        unavailableSeasons.push(season);
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));
  if (unavailableSeasons.length === seasons.length) {
    throw new Error("Career stats could not be loaded from nflverse. Check your connection and try again.");
  }
  return { rows, unavailableSeasons };
}

export async function loadPlayerCareerStats({
  playerId,
  playerName,
  position,
  scoring,
  signal,
}: LoadPlayerCareerStatsOptions): Promise<PlayerCareerStatsResult> {
  let rows: CareerSourceRow[];
  let unavailableSeasons: number[];
  let coverageStart = NFLVERSE_CAREER_MIN_SEASON;
  let coverageEnd = NFLVERSE_CAREER_LATEST_SEASON;
  try {
    const bundle = await loadBundledCareerRows(signal);
    rows = bundle.rows;
    unavailableSeasons = [];
    coverageStart = bundle.coverageStart;
    coverageEnd = bundle.coverageEnd;
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    const remote = await loadAllSeasons(signal);
    rows = remote.rows;
    unavailableSeasons = remote.unavailableSeasons;
  }
  throwIfAborted(signal);
  const selectedRows = selectPlayerCareerRows(rows, {
    ...(playerId ? { playerId } : {}),
    playerName,
    position,
  });
  const seasons = selectedRows
    .map((row): PlayerCareerSeason => {
      const fantasyPoints = selectedFantasyPoints(row, scoring);
      const { standardFantasyPoints: _standard, pprFantasyPoints: _ppr, ...season } = row;
      return {
        ...season,
        fantasyPoints,
        fantasyPointsPerGame: row.games > 0 ? fantasyPoints / row.games : null,
      };
    })
    .sort((left, right) => right.season - left.season);

  return {
    seasons,
    unavailableSeasons: unavailableSeasons.sort((left, right) => left - right),
    coverageStart,
    coverageEnd,
  };
}

