import espnRowsJson from "@/data/players-2026-espn.json";
import playerPoolJson from "@/data/player-pool-2026.json";
import publicRowsJson from "@/data/players-2026-public-auction-values.json";

import { AUCTION_VALUE_SOURCE_REGISTRY } from "./sourceRegistry";
import type {
  AuctionComparisonRow,
  AuctionPlayerValue,
  AuctionValueMode,
  AuctionValueSource,
  AuctionSortKey,
  PlayerMatchWarning,
  ScoringFormat,
  SourceCompatibility,
} from "./auctionValueTypes";

type PublicAuctionRow = {
  sourceId?: string;
  name?: string;
  pos?: string;
  team?: string;
  auctionValue?: number;
  rank?: number;
  scoring?: "standard" | "halfPpr" | "ppr";
  budget?: number;
  updatedAt?: string;
};

type EspnAuctionRow = {
  id?: string;
  name?: string;
  position?: string;
  team?: string;
  value?: number;
  rank?: number;
  bye?: number;
  updatedAt?: string;
};

type CanonicalPlayer = {
  id?: string;
  name?: string;
  pos?: string;
  nflTeam?: string;
  byeWeek?: number;
};

const publicRows = publicRowsJson as PublicAuctionRow[];
const espnRows = espnRowsJson as EspnAuctionRow[];
const canonicalPlayers = playerPoolJson as CanonicalPlayer[];

const NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "gabe davis": "gabriel davis",
  "hollywood brown": "marquise brown",
  "mike williams": "michael williams",
  "pat mahomes": "patrick mahomes",
  "tank dell": "nathaniel dell",
});

const TEAM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ARZ: "ARI",
  JAC: "JAX",
  LA: "LAR",
  LVR: "LV",
  NOR: "NO",
  NWE: "NE",
  SFO: "SF",
  TAM: "TB",
  WSH: "WAS",
});

function normalizePosition(value: string | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (normalized === "PK") return "K";
  return normalized;
}

function normalizeTeam(value: string | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();
  return TEAM_ALIASES[normalized] ?? normalized;
}

export function normalizeAuctionPlayerName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  return NAME_ALIASES[normalized] ?? normalized;
}

function playerKey(name: string, position: string, team?: string) {
  return `${normalizeAuctionPlayerName(name)}|${normalizePosition(position)}|${normalizeTeam(team)}`;
}

function playerNamePositionKey(name: string, position: string) {
  return `${normalizeAuctionPlayerName(name)}|${normalizePosition(position)}`;
}

const canonicalByExactKey = new Map<string, CanonicalPlayer[]>();
const canonicalByNamePosition = new Map<string, CanonicalPlayer[]>();
const canonicalById = new Map(canonicalPlayers.flatMap((player) => player.id ? [[player.id, player] as const] : []));
const canonicalDefenseByTeam = new Map<string, CanonicalPlayer>();

for (const player of canonicalPlayers) {
  if (!player.id || !player.name || !player.pos) continue;
  const exactKey = playerKey(player.name, player.pos, player.nflTeam);
  const namePositionKey = playerNamePositionKey(player.name, player.pos);
  canonicalByExactKey.set(exactKey, [...(canonicalByExactKey.get(exactKey) ?? []), player]);
  canonicalByNamePosition.set(namePositionKey, [...(canonicalByNamePosition.get(namePositionKey) ?? []), player]);
  if (normalizePosition(player.pos) === "DEF" && player.nflTeam) canonicalDefenseByTeam.set(normalizeTeam(player.nflTeam), player);
}

function fallbackPlayerId(sourceId: string, name: string, position: string) {
  const slug = normalizeAuctionPlayerName(name).replace(/\s+/g, "-") || "unknown";
  return `unmatched-${sourceId}-${normalizePosition(position).toLowerCase()}-${slug}`;
}

function matchCanonicalPlayer(
  sourceId: string,
  name: string,
  position: string,
  team?: string,
  stableId?: string,
) {
  if (stableId) {
    const byId = canonicalById.get(stableId);
    if (byId) return { player: byId, warning: null };
  }

  if (normalizePosition(position) === "DEF" && team) {
    const defense = canonicalDefenseByTeam.get(normalizeTeam(team));
    if (defense) return { player: defense, warning: null };
  }

  const exactMatches = canonicalByExactKey.get(playerKey(name, position, team)) ?? [];
  if (exactMatches.length === 1) return { player: exactMatches[0]!, warning: null };
  if (exactMatches.length > 1) {
    return {
      player: null,
      warning: { sourceId, playerName: name, position, ...(team ? { nflTeam: team } : {}), reason: "ambiguous" as const },
    };
  }

  const nameMatches = canonicalByNamePosition.get(playerNamePositionKey(name, position)) ?? [];
  if (nameMatches.length === 1) return { player: nameMatches[0]!, warning: null };

  return {
    player: null,
    warning: {
      sourceId,
      playerName: name,
      position,
      ...(team ? { nflTeam: team } : {}),
      reason: nameMatches.length > 1 ? "ambiguous" as const : "unmatched" as const,
    },
  };
}

function mapPublicFormat(value: PublicAuctionRow["scoring"]): ScoringFormat | null {
  if (value === "standard") return "standard";
  if (value === "halfPpr") return "half_ppr";
  if (value === "ppr") return "ppr";
  return null;
}

const matchWarnings: PlayerMatchWarning[] = [];
const matchWarningKeys = new Set<string>();

function addMatchWarning(warning: PlayerMatchWarning | null) {
  if (!warning) return;
  const key = `${warning.sourceId}|${normalizeAuctionPlayerName(warning.playerName)}|${warning.position}|${warning.nflTeam ?? ""}|${warning.reason}`;
  if (matchWarningKeys.has(key)) return;
  matchWarningKeys.add(key);
  matchWarnings.push(warning);
}

function normalizedPublicRows(): AuctionPlayerValue[] {
  return publicRows.flatMap((row) => {
    const sourceId = row.sourceId?.trim();
    const name = row.name?.trim();
    const position = normalizePosition(row.pos);
    const scoringFormat = mapPublicFormat(row.scoring);
    const rawValue = Number(row.auctionValue);
    if (!sourceId || !name || !position || !scoringFormat || !Number.isFinite(rawValue)) return [];

    const team = normalizeTeam(row.team);
    const matched = matchCanonicalPlayer(sourceId, name, position, team);
    addMatchWarning(matched.warning);
    const source = AUCTION_VALUE_SOURCE_REGISTRY.find((entry) => entry.id === sourceId);
    const canonical = matched.player;

    return [{
      sourceId,
      season: 2026,
      scoringFormat,
      ...(source?.defaultLeagueSize ? { leagueSize: source.defaultLeagueSize } : {}),
      sourceBudget: row.budget ?? source?.sourceBudget ?? 200,
      playerId: canonical?.id ?? fallbackPlayerId(sourceId, name, position),
      playerName: canonical?.name ?? name,
      position: canonical?.pos ?? position,
      ...(canonical?.nflTeam || team ? { nflTeam: canonical?.nflTeam ?? team } : {}),
      ...(canonical?.byeWeek ? { byeWeek: canonical.byeWeek } : {}),
      ...(Number.isFinite(row.rank) ? { rank: row.rank } : {}),
      rawValue,
      ...(row.updatedAt ? { sourceUpdatedAt: row.updatedAt } : {}),
      matched: Boolean(canonical),
    }];
  });
}

function normalizedEspnRows(): AuctionPlayerValue[] {
  return espnRows.flatMap((row) => {
    const name = row.name?.trim();
    const position = normalizePosition(row.position);
    const rawValue = Number(row.value);
    if (!name || !position || !Number.isFinite(rawValue)) return [];

    const team = normalizeTeam(row.team);
    const matched = matchCanonicalPlayer("espn", name, position, team, row.id);
    addMatchWarning(matched.warning);
    const canonical = matched.player;

    return [{
      sourceId: "espn",
      season: 2026,
      scoringFormat: "ppr",
      leagueSize: 10,
      sourceBudget: 200,
      playerId: canonical?.id ?? row.id ?? fallbackPlayerId("espn", name, position),
      playerName: canonical?.name ?? name,
      position: canonical?.pos ?? position,
      ...(canonical?.nflTeam || team ? { nflTeam: canonical?.nflTeam ?? team } : {}),
      ...(canonical?.byeWeek ?? row.bye ? { byeWeek: canonical?.byeWeek ?? row.bye } : {}),
      ...(Number.isFinite(row.rank) ? { rank: row.rank } : {}),
      rawValue,
      ...(row.updatedAt ? { sourceUpdatedAt: row.updatedAt } : {}),
      matched: Boolean(canonical),
    }];
  });
}

export const AUCTION_PLAYER_VALUES: readonly AuctionPlayerValue[] = [
  ...normalizedPublicRows(),
  ...normalizedEspnRows(),
];

export const PLAYER_MATCH_WARNINGS: readonly PlayerMatchWarning[] = matchWarnings;

const rawImportedCounts = new Map<string, number>();
for (const row of publicRows) {
  if (!row.sourceId) continue;
  rawImportedCounts.set(row.sourceId, (rawImportedCounts.get(row.sourceId) ?? 0) + 1);
}
rawImportedCounts.set("espn", espnRows.length);

function latestDate(values: readonly (string | undefined)[]) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

export const AUCTION_VALUE_SOURCES: readonly AuctionValueSource[] = AUCTION_VALUE_SOURCE_REGISTRY.map((entry) => {
  const importedRows = AUCTION_PLAYER_VALUES.filter((row) => row.sourceId === entry.id);
  const importedPlayerCount = new Set(importedRows.map((row) => row.playerId)).size;
  const importedRowCount = rawImportedCounts.get(entry.id) ?? importedRows.length;
  const actualFormats = [...new Set(importedRows.map((row) => row.scoringFormat))];
  const hasUsableRows = importedRows.length > 0;

  const sourceUpdatedAt = latestDate(importedRows.map((row) => row.sourceUpdatedAt)) ?? entry.sourceUpdatedAt;
  return {
    ...entry,
    formats: actualFormats.length ? actualFormats : entry.formats,
    importedPlayerCount,
    importedRowCount,
    comparisonReady: entry.comparisonReady && hasUsableRows,
    printableInsideFFAA: entry.printableInsideFFAA && hasUsableRows,
    externalOnly: !(entry.printableInsideFFAA && hasUsableRows),
    ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
  };
});

export const AUCTION_VALUE_SOURCE_MAP = new Map(AUCTION_VALUE_SOURCES.map((entry) => [entry.id, entry]));

export function normalizeAuctionValue(rawValue: number, sourceBudget: number, selectedBudget: number) {
  if (!Number.isFinite(rawValue) || !Number.isFinite(sourceBudget) || sourceBudget <= 0 || !Number.isFinite(selectedBudget)) {
    return null;
  }
  return Math.round((rawValue * selectedBudget / sourceBudget) * 100) / 100;
}

export function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
    : sorted[midpoint] ?? null;
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function sourceCompatibility(
  source: AuctionValueSource,
  scoringFormat: ScoringFormat,
  leagueSize: number,
): SourceCompatibility {
  const reasons: string[] = [];
  if (!source.comparisonReady) reasons.push("No format-specific imported player rows are available.");
  if (source.season !== 2026) reasons.push("The source is not a current 2026 dataset.");
  if (!source.formats.includes(scoringFormat)) reasons.push("The source does not publish the selected scoring format.");
  if (source.qbFormat !== "one_qb" && source.qbFormat !== "both") reasons.push("The source's QB format is not confirmed as one-QB compatible.");
  if (!source.supportedLeagueSizes.length) reasons.push("The source does not disclose a comparable league size.");
  else if (!source.supportedLeagueSizes.includes(leagueSize)) reasons.push(`The source is not a ${leagueSize}-team board.`);
  return { compatible: reasons.length === 0, reasons };
}

function aggregate(values: readonly number[]) {
  if (!values.length) {
    return { average: null, median: null, minimum: null, maximum: null, spread: null };
  }
  let minimum = values[0]!;
  let maximum = values[0]!;
  for (const value of values) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  return {
    average: average(values),
    median: median(values),
    minimum,
    maximum,
    spread: maximum - minimum,
  };
}

export type BuildComparisonOptions = {
  selectedSourceIds: readonly string[];
  scoringFormat: ScoringFormat;
  leagueSize: number;
  selectedBudget: number;
  valueMode: AuctionValueMode;
  includeMarketInConsensus?: boolean;
};

export function buildAuctionComparison(options: BuildComparisonOptions): AuctionComparisonRow[] {
  const selectedIds = new Set(options.selectedSourceIds);
  const sources = options.selectedSourceIds.flatMap((id) => {
    const source = AUCTION_VALUE_SOURCE_MAP.get(id);
    return source ? [source] : [];
  });
  const sourceMap = new Map(sources.map((entry) => [entry.id, entry]));
  const rowsByPlayer = new Map<string, AuctionComparisonRow>();

  for (const value of AUCTION_PLAYER_VALUES) {
    if (!selectedIds.has(value.sourceId) || value.scoringFormat !== options.scoringFormat) continue;
    const normalizedValue = normalizeAuctionValue(value.rawValue, value.sourceBudget, options.selectedBudget);
    if (normalizedValue === null) continue;
    const source = sourceMap.get(value.sourceId);
    if (!source) continue;
    const compatibility = sourceCompatibility(source, options.scoringFormat, options.leagueSize);
    const consensusSource = compatibility.compatible && Boolean(
      source.sourceType === "expert_projection" ||
      (options.includeMarketInConsensus && source.sourceType === "market_aav")
    );
    const current = rowsByPlayer.get(value.playerId) ?? {
      playerId: value.playerId,
      playerName: value.playerName,
      position: value.position,
      ...(value.nflTeam ? { nflTeam: value.nflTeam } : {}),
      ...(value.byeWeek ? { byeWeek: value.byeWeek } : {}),
      sourceValues: {},
      average: null,
      median: null,
      minimum: null,
      maximum: null,
      spread: null,
      contributingSourceCount: 0,
      expertFairValue: null,
      marketAav: null,
      fairMarketDifference: null,
    };
    current.sourceValues[value.sourceId] = {
      sourceId: value.sourceId,
      rawValue: value.rawValue,
      normalizedValue,
      displayValue: options.valueMode === "normalized" ? normalizedValue : value.rawValue,
      includedInConsensus: consensusSource,
    };
    rowsByPlayer.set(value.playerId, current);
  }

  for (const row of rowsByPlayer.values()) {
    const sourceValues = Object.values(row.sourceValues).filter((value) => value !== undefined);
    const consensusValues = sourceValues.filter((value) => value.includedInConsensus).map((value) => value.displayValue);
    const expertValues = sourceValues.filter((value) => sourceMap.get(value.sourceId)?.sourceType === "expert_projection" && sourceCompatibility(sourceMap.get(value.sourceId)!, options.scoringFormat, options.leagueSize).compatible).map((value) => value.displayValue);
    const marketValues = sourceValues.filter((value) => sourceMap.get(value.sourceId)?.sourceType === "market_aav" && sourceCompatibility(sourceMap.get(value.sourceId)!, options.scoringFormat, options.leagueSize).compatible).map((value) => value.displayValue);
    const result = aggregate(consensusValues);
    row.average = result.average;
    row.median = result.median;
    row.minimum = result.minimum;
    row.maximum = result.maximum;
    row.spread = result.spread;
    row.contributingSourceCount = consensusValues.length;
    row.expertFairValue = median(expertValues);
    row.marketAav = median(marketValues);
    row.fairMarketDifference = row.expertFairValue !== null && row.marketAav !== null
      ? row.expertFairValue - row.marketAav
      : null;
  }

  return [...rowsByPlayer.values()].sort((left, right) => {
    const leftValue = left.median ?? left.expertFairValue ?? left.marketAav ?? -1;
    const rightValue = right.median ?? right.expertFairValue ?? right.marketAav ?? -1;
    return rightValue - leftValue || left.playerName.localeCompare(right.playerName);
  });
}

function sortableValue(row: AuctionComparisonRow, key: AuctionSortKey) {
  if (key.startsWith("source:")) return row.sourceValues[key.slice(7)]?.displayValue ?? null;
  if (key === "player") return row.playerName;
  if (key === "position") return row.position;
  if (key === "team") return row.nflTeam ?? "";
  if (key === "average") return row.average;
  if (key === "median") return row.median;
  if (key === "minimum") return row.minimum;
  if (key === "maximum") return row.maximum;
  if (key === "spread") return row.spread;
  if (key === "count") return row.contributingSourceCount;
  if (key === "expert") return row.expertFairValue;
  if (key === "market") return row.marketAav;
  return row.fairMarketDifference;
}

export function sortAuctionComparisonRows(
  rows: readonly AuctionComparisonRow[],
  key: AuctionSortKey,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = sortableValue(left, key);
    const rightValue = sortableValue(right, key);
    if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? left.playerName.localeCompare(right.playerName) : 1;
    if (rightValue === null || rightValue === undefined) return -1;
    if (typeof leftValue === "string" && typeof rightValue === "string") return leftValue.localeCompare(rightValue) * multiplier;
    return (Number(leftValue) - Number(rightValue)) * multiplier || left.playerName.localeCompare(right.playerName);
  });
}

export function sourceSheetValues(sourceId: string, scoringFormat: ScoringFormat, selectedBudget: number) {
  return AUCTION_PLAYER_VALUES
    .filter((row) => row.sourceId === sourceId && row.scoringFormat === scoringFormat)
    .map((row) => ({
      ...row,
      normalizedValue: normalizeAuctionValue(row.rawValue, row.sourceBudget, selectedBudget) ?? row.rawValue,
    }))
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) || right.rawValue - left.rawValue);
}

export function formatLabel(format: ScoringFormat) {
  if (format === "standard") return "Standard";
  if (format === "half_ppr") return "Half PPR";
  return "Full PPR";
}

export function sourceFreshness(source: AuctionValueSource, today = new Date()) {
  if (source.category === "archive" || source.verificationStatus === "archived") return "archived" as const;
  if (!source.sourceUpdatedAt) return "unknown" as const;
  const updated = new Date(`${source.sourceUpdatedAt.slice(0, 10)}T00:00:00Z`);
  const ageDays = Math.floor((today.getTime() - updated.getTime()) / 86_400_000);
  if (ageDays > 30 || source.season !== 2026) return "stale" as const;
  if (ageDays > 14) return "aging" as const;
  return "fresh" as const;
}
