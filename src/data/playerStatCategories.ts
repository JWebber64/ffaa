import type { Player } from "@/types/draft";
import type { HistoricalPlayerAggregate } from "./historicalPlayerStats";
import espnRowsJson from "./players-2026-espn.json";
import espnClayRowsJson from "./players-2026-espn-clay-projections.json";
import winWithOddsRowsJson from "./players-2026-winwithodds.json";

export const STAT_CATEGORY_GROUPS = [
  "Identity",
  "Draft Market",
  "Fantasy",
  "Passing",
  "Rushing",
  "Receiving",
  "Kicking",
  "Defense/ST",
  "IDP",
  "Advanced",
  "Next Gen",
  "Vegas Team",
  "Vegas Props",
  "Projection Compare",
] as const;

export type StatCategoryGroup = (typeof STAT_CATEGORY_GROUPS)[number];
export type StatAvailability = "live" | "schema";
export type StatMode = "all" | "projections" | "historical";
export type StatValueFormat =
  | "integer"
  | "oneDecimal"
  | "twoDecimal"
  | "percent"
  | "money"
  | "odds"
  | "text"
  | "date";
export type StatCellValue = number | string | null;

export type PlayerStatColumn = {
  id: string;
  label: string;
  shortLabel: string;
  group: StatCategoryGroup;
  description: string;
  source: string;
  availability: StatAvailability;
  mode?: StatMode;
  format: StatValueFormat;
  align?: "left" | "right";
  getValue: (row: PlayerStatRow) => StatCellValue;
};

type JsonRecord = Record<string, unknown>;

type EspnClayProjectionRow = JsonRecord & {
  id?: string;
  name?: string;
  pos?: string;
  nflTeam?: string;
  source?: string;
  updatedAt?: string;
  rank?: number;
  projectedPoints?: number;
  games?: number;
  attempts?: number;
  completions?: number;
  passYards?: number;
  passTds?: number;
  interceptions?: number;
  sacks?: number;
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  targets?: number;
  receptions?: number;
  recYards?: number;
  recTds?: number;
  fieldGoalsMade?: number;
  fieldGoalAttempts?: number;
  fieldGoalPercentage?: number;
  extraPointsMade?: number;
  extraPointAttempts?: number;
  extraPointPercentage?: number;
};

export type SleeperPlayerRow = JsonRecord & {
  playerId?: string;
  name?: string;
  pos?: string;
  team?: string | null;
  status?: string | null;
  injuryStatus?: string | null;
  searchRank?: number;
  fantasyPositions?: string[];
  fantasyDataId?: number | null;
  espnId?: number | null;
  yahooId?: number | null;
  rotowireId?: number | null;
};

type EspnValueRow = JsonRecord & {
  id?: string;
  name?: string;
  position?: string;
  team?: string;
  rank?: number;
  value?: number;
  bye?: number;
};

type WinWithOddsProjectionRow = JsonRecord & {
  id?: string;
  season?: number;
  source?: string;
  rank?: number;
  name?: string;
  pos?: string;
  projectedPoints?: number;
  updatedAt?: string;
  attempts?: number;
  completions?: number;
  passTds?: number;
  passYards?: number;
  interceptions?: number;
  receptions?: number;
  recYards?: number;
  recTds?: number;
  recFirstDowns?: number;
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  rushFirstDowns?: number;
  fumbles?: number;
};

export type PlayerStatDerivedValues = {
  projectedFantasyPoints: number | null;
  projectedFantasyPointsPerGame: number | null;
  totalProjectedTouchdowns: number | null;
  totalProjectedYards: number | null;
  projectedTouches: number | null;
  projectedYardsPerTouch: number | null;
  valueSourceCount: number;
  directValueSourceCount: number;
  projectionSourceCount: number;
};

export type PlayerStatSubject = Omit<Player, "pos" | "nflTeam" | "byeWeek"> & {
  pos: string;
  nflTeam?: string;
  byeWeek?: number;
  historicalOnly?: boolean;
};

export type PlayerStatRow = {
  player: PlayerStatSubject;
  derived: PlayerStatDerivedValues;
  historical?: HistoricalPlayerAggregate;
  espnClay?: EspnClayProjectionRow;
  sleeper?: SleeperPlayerRow;
  espn?: EspnValueRow;
  winWithOdds?: WinWithOddsProjectionRow;
};

const espnClayRows = espnClayRowsJson as EspnClayProjectionRow[];
const espnRows = espnRowsJson as EspnValueRow[];
const winWithOddsRows = winWithOddsRowsJson as WinWithOddsProjectionRow[];

const TEAM_ALIASES: Record<string, string> = {
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
const PLAYER_NAME_ALIASES: Record<string, string> = {
  "ken walker": "kenneth walker",
};

function normalizeTeam(team: unknown) {
  const raw = typeof team === "string" ? team.trim().toUpperCase() : "";
  return TEAM_ALIASES[raw] ?? raw;
}

function normalizeName(name: unknown) {
  if (typeof name !== "string") return "";
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'`]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  return PLAYER_NAME_ALIASES[normalized] ?? normalized;
}

function identityKey(name: unknown, pos: unknown, team: unknown) {
  const cleanName = normalizeName(name);
  const cleanPos = typeof pos === "string" ? pos.toUpperCase() : "";
  const cleanTeam = normalizeTeam(team);
  return [cleanName, cleanPos, cleanTeam].filter(Boolean).join("|");
}

function namePositionKey(name: unknown, pos: unknown) {
  const cleanName = normalizeName(name);
  const cleanPos = typeof pos === "string" ? pos.toUpperCase() : "";
  return [cleanName, cleanPos].filter(Boolean).join("|");
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value.replace(/[$,%\s,]/g, "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function statNumber(row: PlayerStatRow, key: string) {
  const historicalKey = PROJECTION_TO_NFLVERSE_FIELD[key];
  if (historicalKey) {
    const historicalValue = historicalTotal(row, historicalKey);
    if (historicalValue !== null) return historicalValue;
  }
  return numberValue(row.espnClay?.[key]);
}

const PROJECTION_TO_NFLVERSE_FIELD: Record<string, string> = {
  attempts: "attempts",
  completions: "completions",
  passTds: "passing_tds",
  passYards: "passing_yards",
  interceptions: "passing_interceptions",
  rushAttempts: "carries",
  rushYards: "rushing_yards",
  rushTds: "rushing_tds",
  rushFirstDowns: "rushing_first_downs",
  receptions: "receptions",
  recYards: "receiving_yards",
  recTds: "receiving_tds",
  recFirstDowns: "receiving_first_downs",
};

function historicalTotal(row: PlayerStatRow, key: string) {
  const value = row.historical?.totals[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function historicalAverage(row: PlayerStatRow, key: string) {
  const value = row.historical?.averages[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function historicalFumbles(row: PlayerStatRow) {
  const value = sumAvailable([
    historicalTotal(row, "sack_fumbles"),
    historicalTotal(row, "rushing_fumbles"),
    historicalTotal(row, "receiving_fumbles"),
  ]);
  return value;
}

function safeDivide(numerator: number | null, denominator: number | null, multiplier = 1) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * multiplier;
}

function sumAvailable(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  if (!available.length) return null;
  return available.reduce((sum, value) => sum + value, 0);
}

function makeIdMap<T extends { id?: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row.id) map.set(row.id, row);
  }
  return map;
}

function makeIdentityMap<T extends JsonRecord>(
  rows: T[],
  fields: { name: string; pos: string; team: string }
) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = identityKey(row[fields.name], row[fields.pos], row[fields.team]);
    if (key) map.set(key, row);
  }
  return map;
}

function makeNamePositionMap<T extends JsonRecord>(
  rows: T[],
  fields: { name: string; pos: string }
) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = namePositionKey(row[fields.name], row[fields.pos]);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

const clayById = makeIdMap(espnClayRows);
const clayByIdentity = makeIdentityMap(espnClayRows, {
  name: "name",
  pos: "pos",
  team: "nflTeam",
});
const clayByNamePosition = makeNamePositionMap(espnClayRows, {
  name: "name",
  pos: "pos",
});
const espnById = makeIdMap(espnRows);
const espnByIdentity = makeIdentityMap(espnRows, {
  name: "name",
  pos: "position",
  team: "team",
});
const winWithOddsById = makeIdMap(winWithOddsRows);
const winWithOddsByNamePosition = makeNamePositionMap(winWithOddsRows, {
  name: "name",
  pos: "pos",
});
const winWithOddsDefenseByTeam = new Map<string, WinWithOddsProjectionRow>();

for (const row of winWithOddsRows) {
  if (String(row.pos ?? "").toUpperCase() !== "DEF") continue;
  const team = normalizeTeam(row.name);
  if (team) winWithOddsDefenseByTeam.set(team, row);
}

function findWinWithOddsProjection(subject: {
  id?: unknown;
  name?: unknown;
  pos?: unknown;
  nflTeam?: unknown;
  team?: unknown;
}) {
  const id = typeof subject.id === "string" ? subject.id : "";
  const byId = id ? winWithOddsById.get(id) : undefined;
  if (byId) return byId;

  const byNamePosition = winWithOddsByNamePosition.get(
    namePositionKey(subject.name, subject.pos)
  );
  if (byNamePosition) return byNamePosition;

  if (String(subject.pos ?? "").toUpperCase() !== "DEF") return undefined;

  const team = normalizeTeam(subject.nflTeam ?? subject.team);
  return team ? winWithOddsDefenseByTeam.get(team) : undefined;
}

function buildDerivedValues(
  player: PlayerStatSubject,
  espnClay: EspnClayProjectionRow | undefined,
  historical: HistoricalPlayerAggregate | undefined
) {
  if (historical) {
    return {
      projectedFantasyPoints: historical.selectedFantasyPoints,
      projectedFantasyPointsPerGame: historical.selectedFantasyPointsPerGame,
      totalProjectedTouchdowns: sumAvailable([
        historicalTotal({ player, derived: {} as PlayerStatDerivedValues, historical }, "passing_tds"),
        historicalTotal({ player, derived: {} as PlayerStatDerivedValues, historical }, "rushing_tds"),
        historicalTotal({ player, derived: {} as PlayerStatDerivedValues, historical }, "receiving_tds"),
        historicalTotal({ player, derived: {} as PlayerStatDerivedValues, historical }, "special_teams_tds"),
        historicalTotal({ player, derived: {} as PlayerStatDerivedValues, historical }, "def_tds"),
      ]),
      totalProjectedYards: sumAvailable([
        historical.totals.passing_yards ?? null,
        historical.totals.rushing_yards ?? null,
        historical.totals.receiving_yards ?? null,
        historical.totals.misc_yards ?? null,
      ]),
      projectedTouches: sumAvailable([
        historical.totals.carries ?? null,
        historical.totals.receptions ?? null,
      ]),
      projectedYardsPerTouch: safeDivide(
        sumAvailable([historical.totals.rushing_yards ?? null, historical.totals.receiving_yards ?? null]),
        sumAvailable([historical.totals.carries ?? null, historical.totals.receptions ?? null])
      ),
      valueSourceCount: player.valueSources?.length ?? 0,
      directValueSourceCount:
        player.valueSources?.filter(
          (source) => source.kind === "auction"
        ).length ?? 0,
      projectionSourceCount:
        player.valueSources?.filter((source) => source.kind === "projection").length ?? 0,
    };
  }

  const passYards = numberValue(espnClay?.passYards);
  const rushYards = numberValue(espnClay?.rushYards);
  const recYards = numberValue(espnClay?.recYards);
  const rushAttempts = numberValue(espnClay?.rushAttempts);
  const receptions = numberValue(espnClay?.receptions);
  const projectedFantasyPoints = numberValue(espnClay?.projectedPoints);
  const projectedGames = numberValue(espnClay?.games) ?? 17;
  const projectedTouches = sumAvailable([rushAttempts, receptions]);
  const totalProjectedYards = sumAvailable([passYards, rushYards, recYards]);
  const valueSources = player.valueSources ?? [];

  return {
    projectedFantasyPoints,
    projectedFantasyPointsPerGame: safeDivide(projectedFantasyPoints, projectedGames),
    totalProjectedTouchdowns: sumAvailable([
      numberValue(espnClay?.passTds),
      numberValue(espnClay?.rushTds),
      numberValue(espnClay?.recTds),
    ]),
    totalProjectedYards,
    projectedTouches,
    projectedYardsPerTouch: safeDivide(sumAvailable([rushYards, recYards]), projectedTouches),
    valueSourceCount: valueSources.length,
    directValueSourceCount: valueSources.filter(
      (source) => source.kind === "auction"
    ).length,
    projectionSourceCount: valueSources.filter((source) => source.kind === "projection").length,
  };
}

function historicalKey(name: unknown, pos: unknown) {
  const cleanName = normalizeName(name);
  const cleanPos = typeof pos === "string" ? pos.toUpperCase() : "";
  return [cleanName, cleanPos].filter(Boolean).join("|");
}

function historicalSubjectFromAggregate(aggregate: HistoricalPlayerAggregate): PlayerStatSubject {
  const subject: PlayerStatSubject = {
    id: `historical-${aggregate.playerId}`,
    name: aggregate.playerName,
    pos: aggregate.position,
    rank: 999,
    search_rank: 999,
    search_rank_ppr: 999,
    historicalOnly: true,
  };

  if (aggregate.teams.length) subject.nflTeam = aggregate.teams.join("/");

  return subject;
}

function projectionSubjectFromClay(row: EspnClayProjectionRow): PlayerStatSubject {
  const subject: PlayerStatSubject = {
    id: row.id ?? `projection-${identityKey(row.name, row.pos, row.nflTeam)}`,
    name: textValue(row.name) ?? "Unknown Player",
    pos: textValue(row.pos) ?? "UNK",
    rank: 999,
    search_rank: 999,
    search_rank_ppr: 999,
  };

  const nflTeam = textValue(row.nflTeam);
  if (nflTeam) subject.nflTeam = nflTeam;

  return subject;
}

function playerSubjectWithProjection(player: Player, row: EspnClayProjectionRow): PlayerStatSubject {
  const subject: PlayerStatSubject = {
    ...player,
    name: player.name,
    pos: textValue(row.pos) ?? player.pos,
  };

  const nflTeam = textValue(row.nflTeam);
  if (nflTeam) subject.nflTeam = nflTeam;

  return subject;
}

export function buildPlayerStatRows(
  players: Player[],
  historicalAggregates: HistoricalPlayerAggregate[] = [],
  sleeperRows: SleeperPlayerRow[] = [],
) {
  const sleeperByIdentity = makeIdentityMap(sleeperRows, {
    name: "name",
    pos: "pos",
    team: "team",
  });
  const historicalByKey = new Map<string, HistoricalPlayerAggregate>();
  const usedHistoricalIds = new Set<string>();
  const usedClayIds = new Set<string>();
  const usedClayKeys = new Set<string>();
  const usedClayNamePositions = new Set<string>();
  const projectionMode = historicalAggregates.length === 0;

  for (const aggregate of historicalAggregates) {
    historicalByKey.set(historicalKey(aggregate.playerName, aggregate.position), aggregate);
  }

  const currentRows = players.map((player) => {
    const key = identityKey(player.name, player.pos, player.nflTeam);
    const historical = historicalByKey.get(historicalKey(player.name, player.pos));
    if (historical) usedHistoricalIds.add(historical.playerId);

    const espnClay =
      clayById.get(player.id) ??
      clayByIdentity.get(key) ??
      clayByNamePosition.get(namePositionKey(player.name, player.pos));
    if (espnClay?.id) usedClayIds.add(espnClay.id);
    if (espnClay) usedClayKeys.add(identityKey(espnClay.name, espnClay.pos, espnClay.nflTeam));
    if (espnClay) usedClayNamePositions.add(namePositionKey(espnClay.name, espnClay.pos));

    const sleeper = sleeperByIdentity.get(key);
    const espn = espnById.get(player.id) ?? espnByIdentity.get(key);
    const winWithOdds = findWinWithOddsProjection(player);
    const subject = projectionMode && espnClay ? playerSubjectWithProjection(player, espnClay) : player;
    const statRow: PlayerStatRow = {
      player: subject,
      derived: buildDerivedValues(subject, espnClay, historical),
    };

    if (historical) statRow.historical = historical;
    if (espnClay) statRow.espnClay = espnClay;
    if (sleeper) statRow.sleeper = sleeper;
    if (espn) statRow.espn = espn;
    if (winWithOdds) statRow.winWithOdds = winWithOdds;

    return statRow;
  });

  const historicalOnlyRows = historicalAggregates.flatMap((aggregate): PlayerStatRow[] => {
    if (usedHistoricalIds.has(aggregate.playerId)) return [];

    const player = historicalSubjectFromAggregate(aggregate);
    return [
      {
        player,
        historical: aggregate,
        derived: buildDerivedValues(player, undefined, aggregate),
      },
    ];
      });

  const projectionOnlyRows = historicalAggregates.length
    ? []
    : espnClayRows.flatMap((espnClay): PlayerStatRow[] => {
        const key = identityKey(espnClay.name, espnClay.pos, espnClay.nflTeam);
        const playerKey = namePositionKey(espnClay.name, espnClay.pos);
        if (
          (espnClay.id && usedClayIds.has(espnClay.id)) ||
          usedClayKeys.has(key) ||
          usedClayNamePositions.has(playerKey)
        ) {
          return [];
        }

        const player = projectionSubjectFromClay(espnClay);
        const espn = espnById.get(player.id) ?? espnByIdentity.get(key);
        const sleeper = sleeperByIdentity.get(key);
        const winWithOdds = findWinWithOddsProjection(player);
        const statRow: PlayerStatRow = {
          player,
          espnClay,
          derived: buildDerivedValues(player, espnClay, undefined),
        };

        if (espn) statRow.espn = espn;
        if (sleeper) statRow.sleeper = sleeper;
        if (winWithOdds) statRow.winWithOdds = winWithOdds;

        return [statRow];
      });

  return [...currentRows, ...projectionOnlyRows, ...historicalOnlyRows];
}

function liveColumn(
  definition: Omit<PlayerStatColumn, "availability" | "getValue"> & {
    getValue: (row: PlayerStatRow) => StatCellValue;
  }
): PlayerStatColumn {
  return {
    availability: "live",
    ...definition,
  };
}

function schemaColumn(
  definition: Omit<PlayerStatColumn, "availability" | "getValue">
): PlayerStatColumn {
  return {
    availability: "schema",
    getValue: () => null,
    ...definition,
  };
}

function historicalColumn(
  definition: Omit<PlayerStatColumn, "availability"> & {
    getValue: (row: PlayerStatRow) => StatCellValue;
  }
): PlayerStatColumn {
  return {
    availability: "live",
    mode: "historical",
    ...definition,
  };
}

const CORE_COLUMNS: PlayerStatColumn[] = [
  liveColumn({
    id: "rank",
    label: "Overall Rank",
    shortLabel: "Rank",
    group: "Identity",
    description: "Current overall draft ranking from the loaded player pool.",
    source: "Local player pool",
    format: "integer",
    getValue: (row) => (row.player.historicalOnly ? null : numberValue(row.player.rank)),
  }),
  liveColumn({
    id: "position",
    label: "Position",
    shortLabel: "Pos",
    group: "Identity",
    description: "Fantasy position.",
    source: "Local player pool",
    format: "text",
    align: "left",
    getValue: (row) => row.player.pos,
  }),
  liveColumn({
    id: "team",
    label: "NFL Team",
    shortLabel: "Team",
    group: "Identity",
    description: "NFL team abbreviation.",
    source: "Local player pool",
    format: "text",
    align: "left",
    getValue: (row) => row.player.nflTeam ?? null,
  }),
  liveColumn({
    id: "byeWeek",
    label: "Bye Week",
    shortLabel: "Bye",
    group: "Identity",
    description: "Scheduled bye week.",
    source: "Local player pool",
    format: "integer",
    getValue: (row) => numberValue(row.player.byeWeek),
  }),
  liveColumn({
    id: "sleeperStatus",
    label: "Sleeper Status",
    shortLabel: "Status",
    group: "Identity",
    description: "Player activity status from Sleeper metadata.",
    source: "Sleeper import",
    format: "text",
    align: "left",
    getValue: (row) => textValue(row.sleeper?.status),
  }),
  liveColumn({
    id: "injuryStatus",
    label: "Injury Status",
    shortLabel: "Injury",
    group: "Identity",
    description: "Injury status from Sleeper metadata when available.",
    source: "Sleeper import",
    format: "text",
    align: "left",
    getValue: (row) => textValue(row.sleeper?.injuryStatus),
  }),
  liveColumn({
    id: "sleeperPlayerId",
    label: "Sleeper Player ID",
    shortLabel: "Sleeper ID",
    group: "Identity",
    description: "Sleeper player identifier.",
    source: "Sleeper import",
    format: "text",
    align: "left",
    getValue: (row) => textValue(row.sleeper?.playerId),
  }),
  liveColumn({
    id: "fantasyDataId",
    label: "FantasyData ID",
    shortLabel: "FD ID",
    group: "Identity",
    description: "FantasyData player identifier from Sleeper metadata.",
    source: "Sleeper import",
    format: "integer",
    getValue: (row) => numberValue(row.sleeper?.fantasyDataId),
  }),
  liveColumn({
    id: "espnId",
    label: "ESPN ID",
    shortLabel: "ESPN ID",
    group: "Identity",
    description: "ESPN player identifier from Sleeper metadata.",
    source: "Sleeper import",
    format: "integer",
    getValue: (row) => numberValue(row.sleeper?.espnId),
  }),
  liveColumn({
    id: "yahooId",
    label: "Yahoo ID",
    shortLabel: "Yahoo ID",
    group: "Identity",
    description: "Yahoo player identifier from Sleeper metadata.",
    source: "Sleeper import",
    format: "integer",
    getValue: (row) => numberValue(row.sleeper?.yahooId),
  }),
  liveColumn({
    id: "rotowireId",
    label: "RotoWire ID",
    shortLabel: "RW ID",
    group: "Identity",
    description: "RotoWire player identifier from Sleeper metadata.",
    source: "Sleeper import",
    format: "integer",
    getValue: (row) => numberValue(row.sleeper?.rotowireId),
  }),
  liveColumn({
    id: "adp",
    label: "Average Draft Position",
    shortLabel: "ADP",
    group: "Draft Market",
    description: "Average draft position when imported.",
    source: "Local player pool and imported ADP sources",
    format: "oneDecimal",
    getValue: (row) => numberValue(row.player.adp),
  }),
  liveColumn({
    id: "adpSource",
    label: "ADP Source",
    shortLabel: "ADP Src",
    group: "Draft Market",
    description: "Source label attached to the player rank or ADP.",
    source: "Local player pool",
    format: "text",
    align: "left",
    getValue: (row) => row.player.adpSource ?? null,
  }),
  liveColumn({
    id: "auctionValue",
    label: "GameHQ Fair Value",
    shortLabel: "Fair",
    group: "Draft Market",
    description: "GameHQ fair value normalized to the configured league settings and budget.",
    source: "Consensus value engine",
    format: "money",
    getValue: (row) => numberValue(row.player.auctionValue ?? row.player.projectedValue),
  }),
  liveColumn({
    id: "marketValue",
    label: "Market Median",
    shortLabel: "Market",
    group: "Draft Market",
    description: "Median of compatible imported published auction-dollar sources.",
    source: "Consensus value engine",
    format: "money",
    getValue: (row) => numberValue(row.player.marketValue),
  }),
  liveColumn({
    id: "espnSalaryValue",
    label: "ESPN Salary-Cap Value",
    shortLabel: "ESPN $",
    group: "Draft Market",
    description: "Salary-cap value imported from ESPN.",
    source: "ESPN salary-cap values",
    format: "money",
    getValue: (row) => numberValue(row.espn?.value),
  }),
  liveColumn({
    id: "espnRank",
    label: "ESPN Rank",
    shortLabel: "ESPN Rk",
    group: "Draft Market",
    description: "ESPN salary-cap row rank.",
    source: "ESPN salary-cap values",
    format: "integer",
    getValue: (row) => numberValue(row.espn?.rank),
  }),
  liveColumn({
    id: "projectionRank",
    label: "Projection Rank",
    shortLabel: "Proj Rk",
    group: "Draft Market",
    description: "Rank in the current projection import.",
    source: "ESPN Mike Clay 2026 projections",
    format: "integer",
    getValue: (row) => numberValue(row.espnClay?.rank),
  }),
  liveColumn({
    id: "valueConfidence",
    label: "Value Confidence",
    shortLabel: "Conf",
    group: "Draft Market",
    description: "Confidence based primarily on the number of independent auction-dollar sources.",
    source: "Consensus value engine",
    format: "percent",
    getValue: (row) => {
      const confidence = numberValue(row.player.valueConfidence);
      return confidence === null ? null : confidence * 100;
    },
  }),
  liveColumn({
    id: "valueSourceCount",
    label: "Value Source Count",
    shortLabel: "Srcs",
    group: "Draft Market",
    description: "Number of value sources matched to the player.",
    source: "Consensus value engine",
    format: "integer",
    getValue: (row) => row.derived.valueSourceCount,
  }),
  liveColumn({
    id: "directValueSourceCount",
    label: "Auction Source Count",
    shortLabel: "Auction",
    group: "Draft Market",
    description: "Number of compatible published auction-dollar sources matched to the player.",
    source: "Consensus value engine",
    format: "integer",
    getValue: (row) => row.derived.directValueSourceCount,
  }),
  liveColumn({
    id: "projectionSourceCount",
    label: "Projection Source Count",
    shortLabel: "Proj Src",
    group: "Draft Market",
    description: "Number of projection sources matched to the player.",
    source: "Consensus value engine",
    format: "integer",
    getValue: (row) => row.derived.projectionSourceCount,
  }),
  liveColumn({
    id: "valueUpdatedAt",
    label: "Value Updated",
    shortLabel: "Updated",
    group: "Draft Market",
    description: "Date attached to the consensus player value.",
    source: "Consensus value engine",
    format: "date",
    align: "left",
    getValue: (row) => row.espnClay?.updatedAt ?? row.player.valueUpdatedAt ?? null,
  }),
  liveColumn({
    id: "historicalSeasons",
    label: "Selected Seasons",
    shortLabel: "Seasons",
    group: "Fantasy",
    description: "Actual seasons included in the selected historical aggregate.",
    source: "nflverse player stats",
    mode: "historical",
    format: "text",
    align: "left",
    getValue: (row) => row.historical?.seasons.join(", ") ?? null,
  }),
  liveColumn({
    id: "historicalGames",
    label: "Games",
    shortLabel: "G",
    group: "Fantasy",
    description: "Games/weeks with a player-stat row in the selected seasons.",
    source: "nflverse player stats",
    mode: "historical",
    format: "integer",
    getValue: (row) => row.historical?.games ?? null,
  }),
  liveColumn({
    id: "standardFantasyPointsActual",
    label: "Standard Fantasy Points",
    shortLabel: "Std Pts",
    group: "Fantasy",
    description: "Standard fantasy points for selected seasons.",
    source: "nflverse player stats",
    mode: "historical",
    format: "oneDecimal",
    getValue: (row) => row.historical?.standardFantasyPoints ?? null,
  }),
  liveColumn({
    id: "halfPprFantasyPointsActual",
    label: "Half-PPR Fantasy Points",
    shortLabel: "Half PPR",
    group: "Fantasy",
    description: "Half-PPR fantasy points for selected seasons, derived from standard points plus half a point per reception.",
    source: "nflverse player stats",
    mode: "historical",
    format: "oneDecimal",
    getValue: (row) => row.historical?.halfPprFantasyPoints ?? null,
  }),
  liveColumn({
    id: "pprFantasyPointsActual",
    label: "PPR Fantasy Points",
    shortLabel: "PPR Pts",
    group: "Fantasy",
    description: "PPR fantasy points for selected seasons.",
    source: "nflverse player stats",
    mode: "historical",
    format: "oneDecimal",
    getValue: (row) => row.historical?.pprFantasyPoints ?? null,
  }),
  liveColumn({
    id: "projectedFantasyPoints",
    label: "Fantasy Points",
    shortLabel: "Fant Pts",
    group: "Fantasy",
    description: "Current projected fantasy points in projection mode; selected-season actual points in historical mode.",
    source: "nflverse player stats and ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => row.derived.projectedFantasyPoints,
  }),
  liveColumn({
    id: "projectedFantasyPointsPerGame",
    label: "Fantasy Points Per Game",
    shortLabel: "FPG",
    group: "Fantasy",
    description: "Current projected fantasy points per game in projection mode; selected-season actual FPG in historical mode.",
    source: "nflverse player stats and ESPN Mike Clay 2026 projections",
    format: "twoDecimal",
    getValue: (row) => row.derived.projectedFantasyPointsPerGame,
  }),
  liveColumn({
    id: "totalProjectedTouchdowns",
    label: "Total Projected Touchdowns",
    shortLabel: "Tot TD",
    group: "Fantasy",
    description: "Passing plus rushing plus receiving touchdowns from available projections.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => row.derived.totalProjectedTouchdowns,
  }),
  liveColumn({
    id: "totalProjectedYards",
    label: "Total Projected Yards",
    shortLabel: "Tot Yds",
    group: "Fantasy",
    description: "Passing plus rushing plus receiving projected yards.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => row.derived.totalProjectedYards,
  }),
  liveColumn({
    id: "projectedTouches",
    label: "Projected Touches",
    shortLabel: "Touches",
    group: "Fantasy",
    description: "Projected carries plus receptions.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => row.derived.projectedTouches,
  }),
  liveColumn({
    id: "projectedYardsPerTouch",
    label: "Projected Yards Per Touch",
    shortLabel: "Y/Tch",
    group: "Fantasy",
    description: "Projected rushing and receiving yards per carry plus reception.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "twoDecimal",
    getValue: (row) => row.derived.projectedYardsPerTouch,
  }),
  liveColumn({
    id: "passAttempts",
    label: "Pass Attempts",
    shortLabel: "Pass Att",
    group: "Passing",
    description: "Projected passing attempts.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "attempts"),
  }),
  liveColumn({
    id: "passCompletions",
    label: "Pass Completions",
    shortLabel: "Comp",
    group: "Passing",
    description: "Projected passing completions.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "completions"),
  }),
  liveColumn({
    id: "completionPercentage",
    label: "Completion Percentage",
    shortLabel: "Comp%",
    group: "Passing",
    description: "Projected completions divided by attempts.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "percent",
    getValue: (row) => safeDivide(statNumber(row, "completions"), statNumber(row, "attempts"), 100),
  }),
  liveColumn({
    id: "passYards",
    label: "Passing Yards",
    shortLabel: "Pass Yds",
    group: "Passing",
    description: "Projected passing yards.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "passYards"),
  }),
  liveColumn({
    id: "yardsPerPassAttempt",
    label: "Passing Yards Per Attempt",
    shortLabel: "YPA",
    group: "Passing",
    description: "Projected passing yards divided by attempts.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "twoDecimal",
    getValue: (row) => safeDivide(statNumber(row, "passYards"), statNumber(row, "attempts")),
  }),
  liveColumn({
    id: "passTouchdowns",
    label: "Passing Touchdowns",
    shortLabel: "Pass TD",
    group: "Passing",
    description: "Projected passing touchdowns.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "passTds"),
  }),
  liveColumn({
    id: "passingTouchdownRate",
    label: "Passing Touchdown Rate",
    shortLabel: "TD%",
    group: "Passing",
    description: "Projected passing touchdowns divided by attempts.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "percent",
    getValue: (row) => safeDivide(statNumber(row, "passTds"), statNumber(row, "attempts"), 100),
  }),
  liveColumn({
    id: "interceptions",
    label: "Interceptions Thrown",
    shortLabel: "INT",
    group: "Passing",
    description: "Projected interceptions thrown.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "interceptions"),
  }),
  liveColumn({
    id: "interceptionRate",
    label: "Interception Rate",
    shortLabel: "INT%",
    group: "Passing",
    description: "Projected interceptions divided by attempts.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "percent",
    getValue: (row) => safeDivide(statNumber(row, "interceptions"), statNumber(row, "attempts"), 100),
  }),
  liveColumn({
    id: "rushAttempts",
    label: "Rush Attempts",
    shortLabel: "Rush Att",
    group: "Rushing",
    description: "Projected rushing attempts.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "rushAttempts"),
  }),
  liveColumn({
    id: "rushYards",
    label: "Rushing Yards",
    shortLabel: "Rush Yds",
    group: "Rushing",
    description: "Projected rushing yards.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "rushYards"),
  }),
  liveColumn({
    id: "yardsPerRushAttempt",
    label: "Rushing Yards Per Attempt",
    shortLabel: "YPC",
    group: "Rushing",
    description: "Projected rushing yards divided by rush attempts.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "twoDecimal",
    getValue: (row) => safeDivide(statNumber(row, "rushYards"), statNumber(row, "rushAttempts")),
  }),
  liveColumn({
    id: "rushTouchdowns",
    label: "Rushing Touchdowns",
    shortLabel: "Rush TD",
    group: "Rushing",
    description: "Projected rushing touchdowns.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "rushTds"),
  }),
  liveColumn({
    id: "rushFirstDowns",
    label: "Rushing First Downs",
    shortLabel: "Rush 1D",
    group: "Rushing",
    description: "Projected rushing first downs.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "rushFirstDowns"),
  }),
  liveColumn({
    id: "receptions",
    label: "Receptions",
    shortLabel: "Rec",
    group: "Receiving",
    description: "Projected receptions.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "receptions"),
  }),
  liveColumn({
    id: "receivingYards",
    label: "Receiving Yards",
    shortLabel: "Rec Yds",
    group: "Receiving",
    description: "Projected receiving yards.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "recYards"),
  }),
  liveColumn({
    id: "yardsPerReception",
    label: "Yards Per Reception",
    shortLabel: "YPR",
    group: "Receiving",
    description: "Projected receiving yards divided by receptions.",
    source: "Derived from ESPN Mike Clay 2026 projections",
    format: "twoDecimal",
    getValue: (row) => safeDivide(statNumber(row, "recYards"), statNumber(row, "receptions")),
  }),
  liveColumn({
    id: "receivingTouchdowns",
    label: "Receiving Touchdowns",
    shortLabel: "Rec TD",
    group: "Receiving",
    description: "Projected receiving touchdowns.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "recTds"),
  }),
  liveColumn({
    id: "receivingFirstDowns",
    label: "Receiving First Downs",
    shortLabel: "Rec 1D",
    group: "Receiving",
    description: "Projected receiving first downs.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => statNumber(row, "recFirstDowns"),
  }),
  liveColumn({
    id: "fumbles",
    label: "Fumbles",
    shortLabel: "Fum",
    group: "Fantasy",
    description: "Projected fumbles.",
    source: "ESPN Mike Clay 2026 projections",
    format: "oneDecimal",
    getValue: (row) => historicalFumbles(row) ?? statNumber(row, "fumbles"),
  }),
];

const SCHEMA_COLUMNS: PlayerStatColumn[] = [
  schemaColumn({
    id: "standardFantasyPoints",
    label: "Standard Fantasy Points",
    shortLabel: "Std Pts",
    group: "Fantasy",
    description: "Standard fantasy points.",
    source: "FantasyPros and NFL Fantasy scoring categories",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "halfPprFantasyPoints",
    label: "Half PPR Fantasy Points",
    shortLabel: "Half PPR",
    group: "Fantasy",
    description: "Half-PPR fantasy points.",
    source: "FantasyPros default scoring",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "pprFantasyPoints",
    label: "PPR Fantasy Points",
    shortLabel: "PPR Pts",
    group: "Fantasy",
    description: "Full-PPR fantasy points.",
    source: "FantasyPros scoring glossary",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "draftKingsFantasyPoints",
    label: "DraftKings Fantasy Points",
    shortLabel: "DK Pts",
    group: "Fantasy",
    description: "DraftKings fantasy points.",
    source: "SportsDataIO DFS fantasy scoring fields",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "fanDuelFantasyPoints",
    label: "FanDuel Fantasy Points",
    shortLabel: "FD Pts",
    group: "Fantasy",
    description: "FanDuel fantasy points.",
    source: "SportsDataIO DFS fantasy scoring fields",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "yahooFantasyPoints",
    label: "Yahoo Fantasy Points",
    shortLabel: "Yahoo Pts",
    group: "Fantasy",
    description: "Yahoo fantasy points.",
    source: "SportsDataIO DFS fantasy scoring fields",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "fantasyCeiling",
    label: "Fantasy Ceiling",
    shortLabel: "Ceiling",
    group: "Fantasy",
    description: "High-end projection or ceiling outcome.",
    source: "Fantasy analysis providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "fantasyFloor",
    label: "Fantasy Floor",
    shortLabel: "Floor",
    group: "Fantasy",
    description: "Low-end projection or floor outcome.",
    source: "Fantasy analysis providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "boomRate",
    label: "Boom Rate",
    shortLabel: "Boom%",
    group: "Fantasy",
    description: "Rate of games above a high fantasy threshold.",
    source: "Fantasy analysis providers",
    format: "percent",
  }),
  schemaColumn({
    id: "bustRate",
    label: "Bust Rate",
    shortLabel: "Bust%",
    group: "Fantasy",
    description: "Rate of games below a low fantasy threshold.",
    source: "Fantasy analysis providers",
    format: "percent",
  }),
  schemaColumn({
    id: "rosteredPercentage",
    label: "Rostered Percentage",
    shortLabel: "Roster%",
    group: "Fantasy",
    description: "Share of fantasy leagues where the player is rostered.",
    source: "Fantasy platforms",
    format: "percent",
  }),
  schemaColumn({
    id: "startPercentage",
    label: "Start Percentage",
    shortLabel: "Start%",
    group: "Fantasy",
    description: "Share of fantasy leagues where the player is started.",
    source: "Fantasy platforms",
    format: "percent",
  }),
  schemaColumn({
    id: "passerRating",
    label: "Passer Rating",
    shortLabel: "Rate",
    group: "Passing",
    description: "NFL passer rating.",
    source: "NFL box-score statistics",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "qbr",
    label: "Total QBR",
    shortLabel: "QBR",
    group: "Passing",
    description: "Quarterback rating metric.",
    source: "ESPN football statistics",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "passSacksTaken",
    label: "Sacks Taken",
    shortLabel: "Sck",
    group: "Passing",
    description: "Times sacked.",
    source: "NFL box-score statistics",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "passSackYardsLost",
    label: "Sack Yards Lost",
    shortLabel: "SckYds",
    group: "Passing",
    description: "Yards lost on sacks.",
    source: "NFL box-score statistics",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "longestPassCompletion",
    label: "Longest Pass Completion",
    shortLabel: "Long Cmp",
    group: "Passing",
    description: "Longest completed pass.",
    source: "The Odds API and NFL box-score statistics",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "passingFirstDowns",
    label: "Passing First Downs",
    shortLabel: "Pass 1D",
    group: "Passing",
    description: "First downs gained by passing.",
    source: "nflfastR player stats",
    format: "oneDecimal",
  }),
  historicalColumn({
    id: "passingEpa",
    label: "Passing EPA",
    shortLabel: "Pass EPA",
    group: "Advanced",
    description: "Expected points added on passing plays.",
    source: "nflfastR player stats",
    format: "twoDecimal",
    getValue: (row) => historicalTotal(row, "passing_epa"),
  }),
  historicalColumn({
    id: "passingTwoPointConversions",
    label: "Passing Two-Point Conversions",
    shortLabel: "Pass 2PT",
    group: "Passing",
    description: "Two-point conversion passes.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "passing_2pt_conversions"),
  }),
  schemaColumn({
    id: "rushLongest",
    label: "Longest Rush",
    shortLabel: "Long Rush",
    group: "Rushing",
    description: "Longest rush attempt.",
    source: "The Odds API and NFL box-score statistics",
    format: "oneDecimal",
  }),
  historicalColumn({
    id: "rushingTwoPointConversions",
    label: "Rushing Two-Point Conversions",
    shortLabel: "Rush 2PT",
    group: "Rushing",
    description: "Two-point conversion rushes.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "rushing_2pt_conversions"),
  }),
  historicalColumn({
    id: "rushingFumblesLost",
    label: "Rushing Fumbles Lost",
    shortLabel: "Rush FL",
    group: "Rushing",
    description: "Lost fumbles on rushing attempts.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "rushing_fumbles_lost"),
  }),
  historicalColumn({
    id: "rushingEpa",
    label: "Rushing EPA",
    shortLabel: "Rush EPA",
    group: "Advanced",
    description: "Expected points added on rush attempts.",
    source: "nflfastR player stats",
    format: "twoDecimal",
    getValue: (row) => historicalTotal(row, "rushing_epa"),
  }),
  schemaColumn({
    id: "redZoneCarries",
    label: "Red Zone Carries",
    shortLabel: "RZ Car",
    group: "Rushing",
    description: "Rushing attempts inside the opponent 20.",
    source: "Fantasy football usage providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "carriesInsideTen",
    label: "Carries Inside 10",
    shortLabel: "I10 Car",
    group: "Rushing",
    description: "Rushing attempts inside the opponent 10.",
    source: "Fantasy football usage providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "carriesInsideFive",
    label: "Carries Inside 5",
    shortLabel: "I5 Car",
    group: "Rushing",
    description: "Rushing attempts inside the opponent 5.",
    source: "Fantasy football usage providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "yardsAfterContact",
    label: "Yards After Contact",
    shortLabel: "YACON",
    group: "Advanced",
    description: "Rushing yards gained after first contact.",
    source: "FantasyPros glossary and advanced providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "brokenTackles",
    label: "Broken Tackles",
    shortLabel: "BrkTkl",
    group: "Advanced",
    description: "Broken or missed tackles forced by the ball carrier.",
    source: "FantasyPros glossary and advanced providers",
    format: "oneDecimal",
  }),
  historicalColumn({
    id: "targets",
    label: "Targets",
    shortLabel: "Tgt",
    group: "Receiving",
    description: "Pass plays where the player was targeted.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "targets"),
  }),
  historicalColumn({
    id: "catchRate",
    label: "Catch Rate",
    shortLabel: "Catch%",
    group: "Receiving",
    description: "Receptions divided by targets.",
    source: "Fantasy football stat providers",
    format: "percent",
    getValue: (row) => safeDivide(historicalTotal(row, "receptions"), historicalTotal(row, "targets"), 100),
  }),
  historicalColumn({
    id: "targetShare",
    label: "Target Share",
    shortLabel: "Tgt%",
    group: "Receiving",
    description: "Share of team pass attempts directed to the receiver.",
    source: "FantasyPros glossary and nflfastR",
    format: "percent",
    getValue: (row) => {
      const value = historicalAverage(row, "target_share");
      return value === null ? null : value * 100;
    },
  }),
  historicalColumn({
    id: "receivingAirYards",
    label: "Receiving Air Yards",
    shortLabel: "Air Yds",
    group: "Receiving",
    description: "Air yards on targets.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "receiving_air_yards"),
  }),
  historicalColumn({
    id: "airYardsShare",
    label: "Air Yards Share",
    shortLabel: "Air%",
    group: "Receiving",
    description: "Share of team air yards.",
    source: "FantasyPros glossary and nflfastR",
    format: "percent",
    getValue: (row) => {
      const value = historicalAverage(row, "air_yards_share");
      return value === null ? null : value * 100;
    },
  }),
  schemaColumn({
    id: "averageDepthOfTarget",
    label: "Average Depth of Target",
    shortLabel: "aDOT",
    group: "Receiving",
    description: "Average target depth.",
    source: "FantasyPros glossary",
    format: "twoDecimal",
  }),
  historicalColumn({
    id: "receivingYardsAfterCatch",
    label: "Receiving Yards After Catch",
    shortLabel: "YAC",
    group: "Receiving",
    description: "Yards gained after the catch.",
    source: "nflfastR player stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "receiving_yards_after_catch"),
  }),
  historicalColumn({
    id: "receiverAirConversionRatio",
    label: "Receiver Air Conversion Ratio",
    shortLabel: "RACR",
    group: "Advanced",
    description: "Receiving yards divided by receiving air yards.",
    source: "nflfastR player stats",
    format: "twoDecimal",
    getValue: (row) => historicalAverage(row, "racr"),
  }),
  historicalColumn({
    id: "wopr",
    label: "Weighted Opportunity Rating",
    shortLabel: "WOPR",
    group: "Advanced",
    description: "Weighted blend of target share and air yards share.",
    source: "FantasyPros glossary and nflfastR",
    format: "twoDecimal",
    getValue: (row) => historicalAverage(row, "wopr"),
  }),
  schemaColumn({
    id: "yardsPerRouteRun",
    label: "Yards Per Route Run",
    shortLabel: "YPRR",
    group: "Advanced",
    description: "Receiving yards per route run.",
    source: "Advanced receiving providers",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "routeParticipation",
    label: "Route Participation",
    shortLabel: "Route%",
    group: "Receiving",
    description: "Share of pass plays where the player ran a route.",
    source: "FantasyPros glossary and usage providers",
    format: "percent",
  }),
  schemaColumn({
    id: "redZoneTargets",
    label: "Red Zone Targets",
    shortLabel: "RZ Tgt",
    group: "Receiving",
    description: "Targets inside the opponent 20.",
    source: "Fantasy football usage providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "endZoneTargets",
    label: "End Zone Targets",
    shortLabel: "EZ Tgt",
    group: "Receiving",
    description: "Targets in the end zone.",
    source: "Fantasy football usage providers",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "drops",
    label: "Drops",
    shortLabel: "Drops",
    group: "Receiving",
    description: "Dropped passes.",
    source: "Advanced receiving providers",
    format: "oneDecimal",
  }),
  historicalColumn({
    id: "fieldGoalsMade",
    label: "Field Goals Made",
    shortLabel: "FGM",
    group: "Kicking",
    description: "Field goals made.",
    source: "FantasyPros scoring settings and NFL kicking stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "fg_made"),
  }),
  historicalColumn({
    id: "fieldGoalAttempts",
    label: "Field Goal Attempts",
    shortLabel: "FGA",
    group: "Kicking",
    description: "Field goal attempts.",
    source: "NFL kicking stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "fg_att"),
  }),
  historicalColumn({
    id: "fieldGoalPercentage",
    label: "Field Goal Percentage",
    shortLabel: "FG%",
    group: "Kicking",
    description: "Field goals made divided by attempts.",
    source: "NFL kicking stats",
    format: "percent",
    getValue: (row) => {
      const value = historicalAverage(row, "fg_pct");
      return value === null ? null : value * 100;
    },
  }),
  historicalColumn({
    id: "fieldGoals0To39",
    label: "Field Goals 0-39",
    shortLabel: "FG 0-39",
    group: "Kicking",
    description: "Field goals made from 0 to 39 yards.",
    source: "FantasyPros scoring settings",
    format: "oneDecimal",
    getValue: (row) =>
      sumAvailable([
        historicalTotal(row, "fg_made_0_19"),
        historicalTotal(row, "fg_made_20_29"),
        historicalTotal(row, "fg_made_30_39"),
      ]),
  }),
  historicalColumn({
    id: "fieldGoals40To49",
    label: "Field Goals 40-49",
    shortLabel: "FG 40",
    group: "Kicking",
    description: "Field goals made from 40 to 49 yards.",
    source: "FantasyPros scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "fg_made_40_49"),
  }),
  historicalColumn({
    id: "fieldGoals50Plus",
    label: "Field Goals 50+",
    shortLabel: "FG 50",
    group: "Kicking",
    description: "Field goals made from 50 or more yards.",
    source: "FantasyPros scoring settings",
    format: "oneDecimal",
    getValue: (row) =>
      sumAvailable([historicalTotal(row, "fg_made_50_59"), historicalTotal(row, "fg_made_60_")]),
  }),
  historicalColumn({
    id: "extraPointsMade",
    label: "Extra Points Made",
    shortLabel: "XPM",
    group: "Kicking",
    description: "Extra points made.",
    source: "FantasyPros scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "pat_made"),
  }),
  historicalColumn({
    id: "extraPointAttempts",
    label: "Extra Point Attempts",
    shortLabel: "XPA",
    group: "Kicking",
    description: "Extra point attempts.",
    source: "NFL kicking stats",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "pat_att"),
  }),
  schemaColumn({
    id: "kickingPoints",
    label: "Kicking Points",
    shortLabel: "Kick Pts",
    group: "Kicking",
    description: "Fantasy or sportsbook kicking points.",
    source: "The Odds API and fantasy scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstSacks",
    label: "Defense Sacks",
    shortLabel: "DST Sck",
    group: "Defense/ST",
    description: "Team defense sacks.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstInterceptions",
    label: "Defense Interceptions",
    shortLabel: "DST INT",
    group: "Defense/ST",
    description: "Team defense interceptions.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstFumbleRecoveries",
    label: "Defense Fumble Recoveries",
    shortLabel: "DST FR",
    group: "Defense/ST",
    description: "Team defense fumble recoveries.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstSafeties",
    label: "Defense Safeties",
    shortLabel: "Safety",
    group: "Defense/ST",
    description: "Team defense safeties.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstBlockedKicks",
    label: "Blocked Kicks",
    shortLabel: "Blk Kick",
    group: "Defense/ST",
    description: "Blocked field goals, extra points, or punts.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstTouchdowns",
    label: "Defense/Special Teams Touchdowns",
    shortLabel: "DST TD",
    group: "Defense/ST",
    description: "Defensive and special-teams touchdowns.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstPointsAllowed",
    label: "Points Allowed",
    shortLabel: "PA",
    group: "Defense/ST",
    description: "Points allowed by the team defense.",
    source: "FantasyPros defense scoring settings",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "dstYardsAllowed",
    label: "Yards Allowed",
    shortLabel: "YA",
    group: "Defense/ST",
    description: "Yards allowed by the team defense.",
    source: "Team defense stat providers",
    format: "oneDecimal",
  }),
  historicalColumn({
    id: "soloTackles",
    label: "Solo Tackles",
    shortLabel: "Solo",
    group: "IDP",
    description: "Solo tackles.",
    source: "FantasyPros IDP scoring settings and The Odds API",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_tackles_solo"),
  }),
  historicalColumn({
    id: "assistedTackles",
    label: "Assisted Tackles",
    shortLabel: "Ast",
    group: "IDP",
    description: "Assisted tackles.",
    source: "FantasyPros IDP scoring settings and The Odds API",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_tackle_assists"),
  }),
  historicalColumn({
    id: "totalTackles",
    label: "Total Tackles",
    shortLabel: "Tkl",
    group: "IDP",
    description: "Solo tackles plus assists.",
    source: "FantasyPros IDP scoring settings and The Odds API",
    format: "oneDecimal",
    getValue: (row) =>
      sumAvailable([
        historicalTotal(row, "def_tackles_solo"),
        historicalTotal(row, "def_tackle_assists"),
      ]),
  }),
  historicalColumn({
    id: "tacklesForLoss",
    label: "Tackles For Loss",
    shortLabel: "TFL",
    group: "IDP",
    description: "Tackles behind the line of scrimmage.",
    source: "FantasyPros IDP scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_tackles_for_loss"),
  }),
  historicalColumn({
    id: "idpSacks",
    label: "IDP Sacks",
    shortLabel: "Sack",
    group: "IDP",
    description: "Individual defensive sacks.",
    source: "FantasyPros IDP scoring settings and The Odds API",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_sacks"),
  }),
  historicalColumn({
    id: "qbHits",
    label: "QB Hits",
    shortLabel: "QB Hit",
    group: "IDP",
    description: "Quarterback hits.",
    source: "IDP stat providers",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_qb_hits"),
  }),
  historicalColumn({
    id: "passesDefended",
    label: "Passes Defended",
    shortLabel: "PD",
    group: "IDP",
    description: "Passes defended.",
    source: "FantasyPros IDP scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_pass_defended"),
  }),
  historicalColumn({
    id: "forcedFumbles",
    label: "Forced Fumbles",
    shortLabel: "FF",
    group: "IDP",
    description: "Fumbles forced.",
    source: "FantasyPros IDP scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "def_fumbles_forced"),
  }),
  historicalColumn({
    id: "fumbleRecoveries",
    label: "Fumble Recoveries",
    shortLabel: "FR",
    group: "IDP",
    description: "Fumbles recovered.",
    source: "FantasyPros IDP scoring settings",
    format: "oneDecimal",
    getValue: (row) => historicalTotal(row, "fumble_recovery_opp"),
  }),
  schemaColumn({
    id: "timeToThrow",
    label: "Time To Throw",
    shortLabel: "TT",
    group: "Next Gen",
    description: "Average time from snap to pass throw.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "averageCompletedAirYards",
    label: "Average Completed Air Yards",
    shortLabel: "CAY",
    group: "Next Gen",
    description: "Average air yards on completed passes.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "averageIntendedAirYards",
    label: "Average Intended Air Yards",
    shortLabel: "IAY",
    group: "Next Gen",
    description: "Average air yards on all pass attempts.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "airYardsDifferential",
    label: "Air Yards Differential",
    shortLabel: "AYD",
    group: "Next Gen",
    description: "Completed air yards minus intended air yards.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "longestCompletedAirDistance",
    label: "Longest Completed Air Distance",
    shortLabel: "LCAD",
    group: "Next Gen",
    description: "Longest completed pass air distance.",
    source: "NFL Next Gen Stats",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "aggressiveness",
    label: "Aggressiveness",
    shortLabel: "AGG%",
    group: "Next Gen",
    description: "Share of tight-window attempts.",
    source: "NFL Next Gen Stats",
    format: "percent",
  }),
  schemaColumn({
    id: "airYardsToSticks",
    label: "Air Yards To Sticks",
    shortLabel: "AYTS",
    group: "Next Gen",
    description: "Average pass depth relative to the first-down marker.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "expectedCompletionPercentage",
    label: "Expected Completion Percentage",
    shortLabel: "xCOMP",
    group: "Next Gen",
    description: "Expected completion rate based on throw difficulty.",
    source: "NFL Next Gen Stats",
    format: "percent",
  }),
  schemaColumn({
    id: "completionPercentageOverExpected",
    label: "Completion Percentage Over Expected",
    shortLabel: "CPOE",
    group: "Next Gen",
    description: "Actual completion rate minus expected completion rate.",
    source: "NFL Next Gen Stats",
    format: "percent",
  }),
  schemaColumn({
    id: "interceptionProbability",
    label: "Interception Probability",
    shortLabel: "INT Prob",
    group: "Next Gen",
    description: "Modeled interception probability.",
    source: "NFL Next Gen Stats passing score model",
    format: "percent",
  }),
  schemaColumn({
    id: "passingScore",
    label: "Passing Score",
    shortLabel: "Pass Score",
    group: "Next Gen",
    description: "Next Gen passing score.",
    source: "NFL Next Gen Stats passing score model",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "rushingEfficiency",
    label: "Rushing Efficiency",
    shortLabel: "Eff",
    group: "Next Gen",
    description: "Distance traveled per rushing yard gained.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "defendersInBoxRate",
    label: "8+ Defenders In Box",
    shortLabel: "8+D%",
    group: "Next Gen",
    description: "Share of carries faced with eight or more defenders in the box.",
    source: "NFL Next Gen Stats",
    format: "percent",
  }),
  schemaColumn({
    id: "timeBehindLineOfScrimmage",
    label: "Time Behind Line Of Scrimmage",
    shortLabel: "TLOS",
    group: "Next Gen",
    description: "Average time spent behind the line of scrimmage on carries.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "expectedRushingYards",
    label: "Expected Rushing Yards",
    shortLabel: "xRush",
    group: "Next Gen",
    description: "Modeled expected rushing yards.",
    source: "NFL Next Gen Stats powered by AWS",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "rushingYardsOverExpected",
    label: "Rushing Yards Over Expected",
    shortLabel: "RYOE",
    group: "Next Gen",
    description: "Actual rushing yards minus expected rushing yards.",
    source: "NFL Next Gen Stats powered by AWS",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "rushingYardsOverExpectedPerAttempt",
    label: "Rushing Yards Over Expected Per Attempt",
    shortLabel: "RYOE/Att",
    group: "Next Gen",
    description: "Rushing yards over expected per attempt.",
    source: "NFL Next Gen Stats powered by AWS",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "rushPercentageOverExpected",
    label: "Rush Percentage Over Expected",
    shortLabel: "ROE%",
    group: "Next Gen",
    description: "Rate of successful rushes above expectation.",
    source: "NFL Next Gen Stats powered by AWS",
    format: "percent",
  }),
  schemaColumn({
    id: "averageCushion",
    label: "Average Cushion",
    shortLabel: "CUSH",
    group: "Next Gen",
    description: "Average pre-snap cushion for receivers.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "averageSeparation",
    label: "Average Separation",
    shortLabel: "SEP",
    group: "Next Gen",
    description: "Average separation at target arrival.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "averageTargetedAirYards",
    label: "Average Targeted Air Yards",
    shortLabel: "TAY",
    group: "Next Gen",
    description: "Average air yards when targeted.",
    source: "NFL Next Gen Stats",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "teamAirYardsShare",
    label: "Team Air Yards Share",
    shortLabel: "TAY%",
    group: "Next Gen",
    description: "Share of team air yards.",
    source: "NFL Next Gen Stats",
    format: "percent",
  }),
  schemaColumn({
    id: "expectedYardsAfterCatch",
    label: "Expected Yards After Catch",
    shortLabel: "xYAC",
    group: "Next Gen",
    description: "Expected yards after catch.",
    source: "NFL Next Gen Stats",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "yacAboveExpectation",
    label: "YAC Above Expectation",
    shortLabel: "YACOE",
    group: "Next Gen",
    description: "Yards after catch over expectation.",
    source: "NFL Next Gen Stats",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "topSpeed",
    label: "Top Speed",
    shortLabel: "Top MPH",
    group: "Next Gen",
    description: "Fastest speed on a carry or reception.",
    source: "NFL Next Gen Stats top plays",
    format: "twoDecimal",
  }),
  schemaColumn({
    id: "opponent",
    label: "Opponent",
    shortLabel: "Opp",
    group: "Vegas Team",
    description: "Upcoming opponent.",
    source: "Schedule and odds feed",
    format: "text",
    align: "left",
  }),
  schemaColumn({
    id: "homeAway",
    label: "Home/Away",
    shortLabel: "H/A",
    group: "Vegas Team",
    description: "Game location split.",
    source: "Schedule and odds feed",
    format: "text",
    align: "left",
  }),
  schemaColumn({
    id: "gameTotal",
    label: "Vegas Game Total",
    shortLabel: "Total",
    group: "Vegas Team",
    description: "Sportsbook projected combined score.",
    source: "FantasyPros glossary and sportsbook odds",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "impliedTeamTotal",
    label: "Implied Team Total",
    shortLabel: "Imp Total",
    group: "Vegas Team",
    description: "Team projected points derived from spread and total.",
    source: "FantasyPros glossary and sportsbook odds",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "pointSpread",
    label: "Point Spread",
    shortLabel: "Spread",
    group: "Vegas Team",
    description: "Team spread.",
    source: "The Odds API featured markets",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "moneyline",
    label: "Moneyline",
    shortLabel: "ML",
    group: "Vegas Team",
    description: "Team moneyline price.",
    source: "The Odds API featured markets",
    format: "odds",
  }),
  schemaColumn({
    id: "teamTotalLine",
    label: "Team Total Line",
    shortLabel: "Tm Total",
    group: "Vegas Team",
    description: "Team total points line.",
    source: "The Odds API additional markets",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "projectedPlays",
    label: "Projected Plays",
    shortLabel: "Plays",
    group: "Vegas Team",
    description: "Projected offensive plays.",
    source: "Fantasy and betting model feeds",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "projectedPassRate",
    label: "Projected Pass Rate",
    shortLabel: "Pass%",
    group: "Vegas Team",
    description: "Projected team pass rate.",
    source: "Fantasy and betting model feeds",
    format: "percent",
  }),
  schemaColumn({
    id: "projectedRunRate",
    label: "Projected Run Rate",
    shortLabel: "Run%",
    group: "Vegas Team",
    description: "Projected team run rate.",
    source: "Fantasy and betting model feeds",
    format: "percent",
  }),
  schemaColumn({
    id: "weatherWindMph",
    label: "Wind MPH",
    shortLabel: "Wind",
    group: "Vegas Team",
    description: "Projected wind speed for the game.",
    source: "Weather feed",
    format: "oneDecimal",
  }),
  schemaColumn({
    id: "weatherTemperature",
    label: "Temperature",
    shortLabel: "Temp",
    group: "Vegas Team",
    description: "Projected game temperature.",
    source: "Weather feed",
    format: "oneDecimal",
  }),
];

type OddsMarketDefinition = {
  id: string;
  label: string;
};

const NFL_PROP_MARKETS: OddsMarketDefinition[] = [
  { id: "player_pass_yds", label: "Pass Yards" },
  { id: "player_pass_attempts", label: "Pass Attempts" },
  { id: "player_pass_completions", label: "Pass Completions" },
  { id: "player_pass_tds", label: "Pass Touchdowns" },
  { id: "player_pass_interceptions", label: "Pass Interceptions" },
  { id: "player_pass_longest_completion", label: "Longest Pass Completion" },
  { id: "player_pass_rush_yds", label: "Pass + Rush Yards" },
  { id: "player_pass_rush_reception_yds", label: "Pass + Rush + Reception Yards" },
  { id: "player_pass_rush_reception_tds", label: "Pass + Rush + Reception Touchdowns" },
  { id: "player_pass_yds_q1", label: "1st Quarter Pass Yards" },
  { id: "player_rush_yds", label: "Rush Yards" },
  { id: "player_rush_attempts", label: "Rush Attempts" },
  { id: "player_rush_tds", label: "Rush Touchdowns" },
  { id: "player_rush_longest", label: "Longest Rush" },
  { id: "player_rush_reception_yds", label: "Rush + Reception Yards" },
  { id: "player_rush_reception_tds", label: "Rush + Reception Touchdowns" },
  { id: "player_receptions", label: "Receptions" },
  { id: "player_reception_yds", label: "Reception Yards" },
  { id: "player_reception_tds", label: "Reception Touchdowns" },
  { id: "player_reception_longest", label: "Longest Reception" },
  { id: "player_tds_over", label: "Touchdowns Over" },
  { id: "player_anytime_td", label: "Anytime Touchdown" },
  { id: "player_1st_td", label: "First Touchdown" },
  { id: "player_last_td", label: "Last Touchdown" },
  { id: "player_field_goals", label: "Field Goals" },
  { id: "player_kicking_points", label: "Kicking Points" },
  { id: "player_pats", label: "Points After Touchdown" },
  { id: "player_sacks", label: "Sacks" },
  { id: "player_solo_tackles", label: "Solo Tackles" },
  { id: "player_assists", label: "Assists" },
  { id: "player_tackles_assists", label: "Tackles + Assists" },
  { id: "player_defensive_interceptions", label: "Defensive Interceptions" },
];

const ALTERNATE_NFL_PROP_MARKETS: OddsMarketDefinition[] = [
  { id: "player_pass_yds_alternate", label: "Alt Pass Yards" },
  { id: "player_pass_attempts_alternate", label: "Alt Pass Attempts" },
  { id: "player_pass_completions_alternate", label: "Alt Pass Completions" },
  { id: "player_pass_tds_alternate", label: "Alt Pass Touchdowns" },
  { id: "player_pass_interceptions_alternate", label: "Alt Pass Interceptions" },
  { id: "player_pass_longest_completion_alternate", label: "Alt Longest Pass Completion" },
  { id: "player_pass_rush_yds_alternate", label: "Alt Pass + Rush Yards" },
  { id: "player_pass_rush_reception_yds_alternate", label: "Alt Pass + Rush + Reception Yards" },
  { id: "player_pass_rush_reception_tds_alternate", label: "Alt Pass + Rush + Reception Touchdowns" },
  { id: "player_rush_yds_alternate", label: "Alt Rush Yards" },
  { id: "player_rush_attempts_alternate", label: "Alt Rush Attempts" },
  { id: "player_rush_tds_alternate", label: "Alt Rush Touchdowns" },
  { id: "player_rush_longest_alternate", label: "Alt Longest Rush" },
  { id: "player_rush_reception_yds_alternate", label: "Alt Rush + Reception Yards" },
  { id: "player_rush_reception_tds_alternate", label: "Alt Rush + Reception Touchdowns" },
  { id: "player_receptions_alternate", label: "Alt Receptions" },
  { id: "player_reception_yds_alternate", label: "Alt Reception Yards" },
  { id: "player_reception_tds_alternate", label: "Alt Reception Touchdowns" },
  { id: "player_reception_longest_alternate", label: "Alt Longest Reception" },
  { id: "player_field_goals_alternate", label: "Alt Field Goals" },
  { id: "player_kicking_points_alternate", label: "Alt Kicking Points" },
  { id: "player_pats_alternate", label: "Alt Points After Touchdown" },
  { id: "player_sacks_alternate", label: "Alt Sacks" },
  { id: "player_solo_tackles_alternate", label: "Alt Solo Tackles" },
  { id: "player_assists_alternate", label: "Alt Assists" },
  { id: "player_tackles_assists_alternate", label: "Alt Tackles + Assists" },
];

function oddsColumnsForMarket(market: OddsMarketDefinition): PlayerStatColumn[] {
  const source = "The Odds API NFL player props";
  return [
    schemaColumn({
      id: `${market.id}_line`,
      label: `${market.label} Line`,
      shortLabel: `${market.label} Line`,
      group: "Vegas Props",
      description: `${market.label} sportsbook line.`,
      source,
      format: "oneDecimal",
    }),
    schemaColumn({
      id: `${market.id}_over`,
      label: `${market.label} Over Odds`,
      shortLabel: `${market.label} O`,
      group: "Vegas Props",
      description: `${market.label} over price.`,
      source,
      format: "odds",
    }),
    schemaColumn({
      id: `${market.id}_under`,
      label: `${market.label} Under Odds`,
      shortLabel: `${market.label} U`,
      group: "Vegas Props",
      description: `${market.label} under price.`,
      source,
      format: "odds",
    }),
  ];
}

type WinWithOddsStatKey = keyof Pick<
  WinWithOddsProjectionRow,
  | "rank"
  | "projectedPoints"
  | "attempts"
  | "completions"
  | "passTds"
  | "passYards"
  | "interceptions"
  | "receptions"
  | "recYards"
  | "recTds"
  | "recFirstDowns"
  | "rushAttempts"
  | "rushYards"
  | "rushTds"
  | "rushFirstDowns"
  | "fumbles"
>;

function winWithOddsColumn(definition: {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  key: WinWithOddsStatKey;
  format?: StatValueFormat;
}) {
  return liveColumn({
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    group: "Vegas Props",
    description: definition.description,
    source: "WinWithOdds season-long Vegas projections",
    format: definition.format ?? "oneDecimal",
    getValue: (row) => numberValue(row.winWithOdds?.[definition.key]),
  });
}

const WIN_WITH_ODDS_PROP_COLUMNS: PlayerStatColumn[] = [
  winWithOddsColumn({
    id: "winWithOddsRank",
    label: "WinWithOdds Rank",
    shortLabel: "WWO Rk",
    description: "Rank from the WinWithOdds season-long Vegas projection table.",
    key: "rank",
    format: "integer",
  }),
  winWithOddsColumn({
    id: "winWithOddsFantasyPoints",
    label: "Vegas Projected Fantasy Points",
    shortLabel: "Vegas Pts",
    description: "Season-long fantasy projection from WinWithOdds sportsbook-derived props.",
    key: "projectedPoints",
  }),
  liveColumn({
    id: "winWithOddsFantasyPointsPerGame",
    label: "Vegas Projected Fantasy Points Per Game",
    shortLabel: "Vegas FPG",
    group: "Vegas Props",
    description: "WinWithOdds season-long fantasy projection divided by 17 games.",
    source: "WinWithOdds season-long Vegas projections",
    format: "twoDecimal",
    getValue: (row) => safeDivide(numberValue(row.winWithOdds?.projectedPoints), 17),
  }),
  winWithOddsColumn({
    id: "winWithOddsPassAttempts",
    label: "Vegas Pass Attempts Projection",
    shortLabel: "Pass Att",
    description: "Season-long pass attempts projection from WinWithOdds.",
    key: "attempts",
  }),
  winWithOddsColumn({
    id: "winWithOddsCompletions",
    label: "Vegas Completions Projection",
    shortLabel: "Comp",
    description: "Season-long completions projection from WinWithOdds.",
    key: "completions",
  }),
  winWithOddsColumn({
    id: "winWithOddsPassYards",
    label: "Vegas Pass Yards Projection",
    shortLabel: "Pass Yds",
    description: "Season-long passing yards projection from WinWithOdds.",
    key: "passYards",
  }),
  winWithOddsColumn({
    id: "winWithOddsPassTouchdowns",
    label: "Vegas Pass Touchdowns Projection",
    shortLabel: "Pass TD",
    description: "Season-long passing touchdowns projection from WinWithOdds.",
    key: "passTds",
  }),
  winWithOddsColumn({
    id: "winWithOddsInterceptions",
    label: "Vegas Interceptions Projection",
    shortLabel: "INT",
    description: "Season-long thrown interceptions projection from WinWithOdds.",
    key: "interceptions",
  }),
  winWithOddsColumn({
    id: "winWithOddsRushAttempts",
    label: "Vegas Rush Attempts Projection",
    shortLabel: "Rush Att",
    description: "Season-long rushing attempts projection from WinWithOdds.",
    key: "rushAttempts",
  }),
  winWithOddsColumn({
    id: "winWithOddsRushYards",
    label: "Vegas Rush Yards Projection",
    shortLabel: "Rush Yds",
    description: "Season-long rushing yards projection from WinWithOdds.",
    key: "rushYards",
  }),
  winWithOddsColumn({
    id: "winWithOddsRushTouchdowns",
    label: "Vegas Rush Touchdowns Projection",
    shortLabel: "Rush TD",
    description: "Season-long rushing touchdowns projection from WinWithOdds.",
    key: "rushTds",
  }),
  winWithOddsColumn({
    id: "winWithOddsRushFirstDowns",
    label: "Vegas Rush First Downs Projection",
    shortLabel: "Rush FD",
    description: "Season-long rushing first downs projection from WinWithOdds.",
    key: "rushFirstDowns",
  }),
  winWithOddsColumn({
    id: "winWithOddsReceptions",
    label: "Vegas Receptions Projection",
    shortLabel: "Rec",
    description: "Season-long receptions projection from WinWithOdds.",
    key: "receptions",
  }),
  winWithOddsColumn({
    id: "winWithOddsReceivingYards",
    label: "Vegas Receiving Yards Projection",
    shortLabel: "Rec Yds",
    description: "Season-long receiving yards projection from WinWithOdds.",
    key: "recYards",
  }),
  winWithOddsColumn({
    id: "winWithOddsReceivingTouchdowns",
    label: "Vegas Receiving Touchdowns Projection",
    shortLabel: "Rec TD",
    description: "Season-long receiving touchdowns projection from WinWithOdds.",
    key: "recTds",
  }),
  winWithOddsColumn({
    id: "winWithOddsReceivingFirstDowns",
    label: "Vegas Receiving First Downs Projection",
    shortLabel: "Rec FD",
    description: "Season-long receiving first downs projection from WinWithOdds.",
    key: "recFirstDowns",
  }),
  winWithOddsColumn({
    id: "winWithOddsFumbles",
    label: "Vegas Fumbles Projection",
    shortLabel: "Fum",
    description: "Season-long fumbles projection from WinWithOdds.",
    key: "fumbles",
  }),
  liveColumn({
    id: "winWithOddsUpdatedAt",
    label: "WinWithOdds Updated",
    shortLabel: "WWO Date",
    group: "Vegas Props",
    description: "Date the WinWithOdds projection cache was last pulled.",
    source: "WinWithOdds season-long Vegas projections",
    format: "date",
    align: "left",
    getValue: (row) => row.winWithOdds?.updatedAt ?? null,
  }),
];

function statDelta(left: unknown, right: unknown) {
  const leftValue = numberValue(left);
  const rightValue = numberValue(right);
  if (leftValue === null || rightValue === null) return null;
  return leftValue - rightValue;
}

function sumWinWithOdds(row: PlayerStatRow, keys: WinWithOddsStatKey[]) {
  return sumAvailable(keys.map((key) => numberValue(row.winWithOdds?.[key])));
}

function projectionCompareColumn(definition: {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  format?: StatValueFormat;
  getValue: (row: PlayerStatRow) => StatCellValue;
}) {
  return liveColumn({
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    group: "Projection Compare",
    description: `${definition.description} Positive values mean WinWithOdds is higher than ESPN.`,
    source: "ESPN Mike Clay 2026 projections vs WinWithOdds season-long Vegas projections",
    mode: "projections",
    format: definition.format ?? "oneDecimal",
    getValue: definition.getValue,
  });
}

const PROJECTION_COMPARISON_COLUMNS: PlayerStatColumn[] = [
  projectionCompareColumn({
    id: "vegasMinusEspnFantasyPoints",
    label: "Vegas Minus ESPN Fantasy Points",
    shortLabel: "Vegas-ESPN Pts",
    description: "WinWithOdds projected fantasy points minus ESPN projected fantasy points.",
    getValue: (row) =>
      statDelta(row.winWithOdds?.projectedPoints, row.derived.projectedFantasyPoints),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnFantasyPointsPerGame",
    label: "Vegas Minus ESPN Fantasy Points Per Game",
    shortLabel: "Vegas-ESPN FPG",
    description: "WinWithOdds projected fantasy points per game minus ESPN projected fantasy points per game.",
    format: "twoDecimal",
    getValue: (row) =>
      statDelta(
        safeDivide(numberValue(row.winWithOdds?.projectedPoints), 17),
        row.derived.projectedFantasyPointsPerGame
      ),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnRank",
    label: "Vegas Rank Minus ESPN Projection Rank",
    shortLabel: "WWO-ESPN Rk",
    description: "WinWithOdds rank number minus ESPN projection rank number. Lower rank numbers are better.",
    format: "integer",
    getValue: (row) => statDelta(row.winWithOdds?.rank, row.espnClay?.rank),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnTotalYards",
    label: "Vegas Minus ESPN Total Yards",
    shortLabel: "Yds Diff",
    description: "WinWithOdds passing plus rushing plus receiving yards minus ESPN total projected yards.",
    getValue: (row) =>
      statDelta(
        sumWinWithOdds(row, ["passYards", "rushYards", "recYards"]),
        row.derived.totalProjectedYards
      ),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnTotalTouchdowns",
    label: "Vegas Minus ESPN Total Touchdowns",
    shortLabel: "TD Diff",
    description: "WinWithOdds passing plus rushing plus receiving touchdowns minus ESPN total projected touchdowns.",
    getValue: (row) =>
      statDelta(
        sumWinWithOdds(row, ["passTds", "rushTds", "recTds"]),
        row.derived.totalProjectedTouchdowns
      ),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnPassAttempts",
    label: "Vegas Minus ESPN Pass Attempts",
    shortLabel: "Pass Att Diff",
    description: "WinWithOdds pass attempts projection minus ESPN pass attempts projection.",
    getValue: (row) => statDelta(row.winWithOdds?.attempts, statNumber(row, "attempts")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnCompletions",
    label: "Vegas Minus ESPN Completions",
    shortLabel: "Comp Diff",
    description: "WinWithOdds completions projection minus ESPN completions projection.",
    getValue: (row) => statDelta(row.winWithOdds?.completions, statNumber(row, "completions")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnPassYards",
    label: "Vegas Minus ESPN Pass Yards",
    shortLabel: "Pass Yds Diff",
    description: "WinWithOdds passing yards projection minus ESPN passing yards projection.",
    getValue: (row) => statDelta(row.winWithOdds?.passYards, statNumber(row, "passYards")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnPassTouchdowns",
    label: "Vegas Minus ESPN Pass Touchdowns",
    shortLabel: "Pass TD Diff",
    description: "WinWithOdds passing touchdowns projection minus ESPN passing touchdowns projection.",
    getValue: (row) => statDelta(row.winWithOdds?.passTds, statNumber(row, "passTds")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnInterceptions",
    label: "Vegas Minus ESPN Interceptions",
    shortLabel: "INT Diff",
    description: "WinWithOdds interceptions projection minus ESPN interceptions projection.",
    getValue: (row) => statDelta(row.winWithOdds?.interceptions, statNumber(row, "interceptions")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnRushAttempts",
    label: "Vegas Minus ESPN Rush Attempts",
    shortLabel: "Rush Att Diff",
    description: "WinWithOdds rushing attempts projection minus ESPN rushing attempts projection.",
    getValue: (row) => statDelta(row.winWithOdds?.rushAttempts, statNumber(row, "rushAttempts")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnRushYards",
    label: "Vegas Minus ESPN Rush Yards",
    shortLabel: "Rush Yds Diff",
    description: "WinWithOdds rushing yards projection minus ESPN rushing yards projection.",
    getValue: (row) => statDelta(row.winWithOdds?.rushYards, statNumber(row, "rushYards")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnRushTouchdowns",
    label: "Vegas Minus ESPN Rush Touchdowns",
    shortLabel: "Rush TD Diff",
    description: "WinWithOdds rushing touchdowns projection minus ESPN rushing touchdowns projection.",
    getValue: (row) => statDelta(row.winWithOdds?.rushTds, statNumber(row, "rushTds")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnReceptions",
    label: "Vegas Minus ESPN Receptions",
    shortLabel: "Rec Diff",
    description: "WinWithOdds receptions projection minus ESPN receptions projection.",
    getValue: (row) => statDelta(row.winWithOdds?.receptions, statNumber(row, "receptions")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnReceivingYards",
    label: "Vegas Minus ESPN Receiving Yards",
    shortLabel: "Rec Yds Diff",
    description: "WinWithOdds receiving yards projection minus ESPN receiving yards projection.",
    getValue: (row) => statDelta(row.winWithOdds?.recYards, statNumber(row, "recYards")),
  }),
  projectionCompareColumn({
    id: "vegasMinusEspnReceivingTouchdowns",
    label: "Vegas Minus ESPN Receiving Touchdowns",
    shortLabel: "Rec TD Diff",
    description: "WinWithOdds receiving touchdowns projection minus ESPN receiving touchdowns projection.",
    getValue: (row) => statDelta(row.winWithOdds?.recTds, statNumber(row, "recTds")),
  }),
];

const VEGAS_PROP_COLUMNS = [
  ...WIN_WITH_ODDS_PROP_COLUMNS,
  ...NFL_PROP_MARKETS.flatMap(oddsColumnsForMarket),
  ...ALTERNATE_NFL_PROP_MARKETS.flatMap(oddsColumnsForMarket),
];

export const PLAYER_STAT_COLUMNS = [
  ...CORE_COLUMNS,
  ...SCHEMA_COLUMNS,
  ...VEGAS_PROP_COLUMNS,
  ...PROJECTION_COMPARISON_COLUMNS,
] as const;

export function getColumnValue(column: PlayerStatColumn, row: PlayerStatRow) {
  return column.getValue(row);
}

export function formatStatValue(value: StatCellValue, format: StatValueFormat) {
  if (value === null || value === "") return "--";
  if (typeof value === "string") return value;

  switch (format) {
    case "integer":
      return Math.round(value).toLocaleString();
    case "oneDecimal":
      return value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
    case "twoDecimal":
      return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    case "percent":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    case "money":
      return `$${Math.round(value).toLocaleString()}`;
    case "odds":
      return value > 0 ? `+${Math.round(value)}` : String(Math.round(value));
    case "date":
      return String(value);
    case "text":
    default:
      return String(value);
  }
}
