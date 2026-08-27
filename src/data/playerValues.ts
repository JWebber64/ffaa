import type { Player, PlayerValueSource, PlayerValueSourceKind } from "@/types/draft";
import {
  PROJECTION_POSITION_MULTIPLIERS,
  VALUE_CONFIDENCE_WEIGHTS,
  VALUE_SOURCE_WEIGHTS,
} from "@/config/valueSourceWeights";
import { FANTASY_SEASON_VALUE_UPDATED_AT } from "@/config/fantasySeason";
import espnRows from "./players-2026-espn.json";
import sleeperSuggestedRows from "./players-2026-sleeper-values.json";
import publicAuctionRows from "./players-2026-public-auction-values.json";
import { PUBLIC_AUCTION_VALUE_SOURCES } from "./publicAuctionValueSources";
import espnClayRows from "./players-2026-espn-clay-projections.json";
import sleeperProjectionRows from "./players-2026-sleeper-projections.json";
import publicProjectionRows from "./players-2026-public-projections.json";
import winWithOddsRows from "./players-2026-winwithodds.json";
import fantasyProsValueRows from "./players-2026-fantasypros-values.json";
import rotoWireRows from "./players-2026-rotowire.json";
import yahooRows from "./players-2026-yahoo-values.json";
import sharpRows from "./players-2026-sharp.json";
import fourForFourRows from "./players-2026-4for4.json";
import fantasyFootballCalculatorRows from "./players-2026-fantasyfootballcalculator.json";
import rotoBallerRows from "./players-2026-rotoballer.json";
import footballersRows from "./players-2026-footballers.json";
import ffToolboxRows from "./players-2026-fftoolbox.json";
import beatAdpRows from "./players-2026-beatadp.json";
import leagueLogsRows from "./players-2026-leaguelogs.json";

const DEFAULT_VALUE_BUDGET = 200;
const DEFAULT_TEAM_COUNT = 12;
const DEFAULT_ROSTER_SIZE = 15;
const VALUE_UPDATED_AT = FANTASY_SEASON_VALUE_UPDATED_AT;

export type AuctionScoring = "standard" | "halfPpr" | "ppr";

export type AuctionValueRosterSlot = {
  slot?: unknown;
  count?: unknown;
};

export type AuctionValueOptions = {
  scoring?: AuctionScoring;
  teamCount?: number;
  rosterSize?: number;
  rosterSlots?: readonly AuctionValueRosterSlot[];
  calibrate?: boolean;
};

const DEFAULT_AUCTION_ROSTER_SLOTS: AuctionValueRosterSlot[] = [
  { slot: "QB", count: 1 },
  { slot: "RB", count: 2 },
  { slot: "WR", count: 2 },
  { slot: "TE", count: 1 },
  { slot: "FLEX", count: 1 },
  { slot: "K", count: 1 },
  { slot: "DEF", count: 1 },
  { slot: "BENCH", count: 6 },
];
const MINIMUM_BID_SHARE = 0.15;
const PREMIUM_CURVE_EXPONENT = 1.05;

export const AUCTION_VALUE_SOURCE_COLUMNS = [
  { id: "sleeper-paid", label: "Sleeper Paid", shortLabel: "SL Paid" },
  { id: "sleeper-suggested", label: "Sleeper Suggested", shortLabel: "Sleeper" },
  { id: "espn", label: "ESPN", shortLabel: "ESPN" },
  { id: "fftoday", label: "FFToday", shortLabel: "FFToday" },
  { id: "sports-illustrated", label: "Sports Illustrated", shortLabel: "SI" },
  { id: "usa-today", label: "USA TODAY", shortLabel: "USA Today" },
  { id: "rtsports-aav", label: "RT Sports AAV", shortLabel: "RT AAV" },
  { id: "yafsb-aav", label: "YAFSB Half-PPR AAV", shortLabel: "YAFSB .5" },
  { id: "fantasypros", label: "FantasyPros", shortLabel: "FPros" },
  { id: "yahoo", label: "Yahoo", shortLabel: "Yahoo" },
  { id: "rotowire", label: "RotoWire", shortLabel: "RWire" },
  { id: "draftsharks", label: "DraftSharks", shortLabel: "DSharks" },
  { id: "footballguys", label: "Footballguys", shortLabel: "FBGuys" },
  { id: "fantasynerds", label: "FantasyNerds", shortLabel: "FNerds" },
  { id: "sportsbrackets", label: "SportsBrackets", shortLabel: "SBrkt" },
  { id: "fftoolbox", label: "FFToolbox", shortLabel: "FFTool" },
  { id: "leaguelogs-ppr-rank", label: "LL PPR Market $", shortLabel: "LL PPR" },
  { id: "leaguelogs-half-ppr-rank", label: "LL Half Market $", shortLabel: "LL Half" },
] as const;

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const VALID_TEAMS = new Set([
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LV",
  "LAC",
  "LAR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
  "FA",
]);

const DEFENSE_NAME_ALIASES: Record<string, string> = {
  ari: "ari",
  "arizona cardinals": "ari",
  atl: "atl",
  "atlanta falcons": "atl",
  bal: "bal",
  "baltimore ravens": "bal",
  buf: "buf",
  "buffalo bills": "buf",
  car: "car",
  "carolina panthers": "car",
  chi: "chi",
  "chicago bears": "chi",
  cin: "cin",
  "cincinnati bengals": "cin",
  cle: "cle",
  "cleveland browns": "cle",
  dal: "dal",
  "dallas cowboys": "dal",
  den: "den",
  "denver broncos": "den",
  det: "det",
  "detroit lions": "det",
  gb: "gb",
  "green bay packers": "gb",
  hou: "hou",
  "houston texans": "hou",
  ind: "ind",
  "indianapolis colts": "ind",
  jac: "jax",
  jax: "jax",
  "jacksonville jaguars": "jax",
  kc: "kc",
  "kansas city chiefs": "kc",
  lv: "lv",
  "las vegas raiders": "lv",
  lac: "lac",
  "los angeles chargers": "lac",
  lar: "lar",
  "los angeles rams": "lar",
  mia: "mia",
  "miami dolphins": "mia",
  min: "min",
  "minnesota vikings": "min",
  ne: "ne",
  "new england patriots": "ne",
  no: "no",
  "new orleans saints": "no",
  nyg: "nyg",
  "new york giants": "nyg",
  nyj: "nyj",
  "new york jets": "nyj",
  phi: "phi",
  "philadelphia eagles": "phi",
  pit: "pit",
  "pittsburgh steelers": "pit",
  sea: "sea",
  "seattle seahawks": "sea",
  sf: "sf",
  sfo: "sf",
  "san francisco 49ers": "sf",
  tb: "tb",
  "tampa bay buccaneers": "tb",
  ten: "ten",
  "tennessee titans": "ten",
  was: "was",
  wsh: "was",
  "washington commanders": "was",
};

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    sourceId: "sleeper-suggested",
    source: "Sleeper suggested auction values",
    rows: sleeperSuggestedRows,
    kind: "auction",
    weight: VALUE_SOURCE_WEIGHTS.sleeperSuggested,
    sourceBudget: 200,
    consensusScoring: "ppr",
    valueFields: ["auctionValue", "value"],
  },
  {
    sourceId: "espn",
    source: "ESPN salary-cap values",
    sourceUrl: "https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300",
    rows: espnRows,
    kind: "auction",
    weight: VALUE_SOURCE_WEIGHTS.espnSalaryCap,
    sourceBudget: 200,
    consensusScoring: "ppr",
    valueFields: ["value", "auctionValue", "projectedValue"],
  },
  ...PUBLIC_AUCTION_VALUE_SOURCES
    .filter((source) => [
      "fftoday",
      "sports-illustrated",
      "usa-today",
      "rtsports-aav",
      "yafsb-aav",
      "draftsharks",
      "footballguys",
      "fantasynerds",
      "sportsbrackets",
    ].includes(source.id))
    .map((source): SourceDefinition => ({
      sourceId: source.id,
      source: source.label,
      sourceUrl: source.url,
      rows: publicAuctionRows.filter((row) => row.sourceId === source.id),
      kind: "auction",
      weight: source.weight,
      sourceBudget: source.budget ?? 200,
      valueFields: ["auctionValue", "value"],
      ...(source.scoring ? { consensusScoring: source.scoring } : {}),
      displayOnly: !source.includedInConsensus,
    })),
  {
    sourceId: "leaguelogs-ppr",
    source: "LeagueLogs PPR Market Index",
    sourceUrl: "https://developer.leaguelogs.com/",
    rows: leagueLogsRows,
    kind: "mixed",
    weight: 0.55,
    rankFields: ["pprRank"],
    consensusScoring: "ppr",
  },
  {
    sourceId: "leaguelogs-half-ppr",
    source: "LeagueLogs half-PPR Market Index",
    sourceUrl: "https://developer.leaguelogs.com/",
    rows: leagueLogsRows,
    kind: "mixed",
    weight: 0.55,
    rankFields: ["halfPprRank"],
    consensusScoring: "halfPpr",
  },
  {
    sourceId: "espn-clay",
    source: "ESPN Mike Clay projections",
    sourceUrl: "https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf",
    rows: espnClayRows,
    kind: "projection",
    weight: 1,
    projectionFields: ["projectedPoints"],
    projectionScoring: "ppr",
    rescoreStatLine: true,
  },
  {
    sourceId: "sleeper-season",
    source: "Sleeper season projections",
    sourceUrl: "https://sleeper.com/leagues/1385319428408774656/players",
    rows: sleeperProjectionRows,
    kind: "projection",
    weight: 1,
    projectionFields: ["projectedPoints"],
    projectionScoring: "ppr",
  },
  {
    sourceId: "winwithodds",
    source: "WinWithOdds Vegas projections",
    sourceUrl: "https://www.winwithodds.com/season_long_full_stats",
    rows: winWithOddsRows,
    kind: "projection",
    weight: VALUE_SOURCE_WEIGHTS.winWithOddsProjection,
    projectionFields: ["projectedPoints", "Projections", "projection", "points"],
    projectionScoring: "ppr",
    rescoreStatLine: true,
    updatedAt: VALUE_UPDATED_AT,
  },
  {
    sourceId: "fftoday-projections",
    source: "FFToday projections",
    sourceUrl: "https://www.fftoday.com/rankings/playerproj.php?Season=2026",
    rows: publicProjectionRows.filter((row) => row.sourceId === "fftoday-projections"),
    kind: "projection",
    weight: 1,
    projectionFields: ["projectedPoints"],
    projectionScoring: "halfPpr",
  },
  {
    sourceId: "cbs-projections",
    source: "CBS Sports projections",
    sourceUrl: "https://www.cbssports.com/fantasy/football/stats/",
    rows: publicProjectionRows.filter((row) => row.sourceId === "cbs-projections"),
    kind: "projection",
    weight: 1,
    projectionFields: ["projectedPoints"],
    projectionScoring: "standard",
  },
  {
    sourceId: "fantasypros",
    source: "FantasyPros auction values",
    sourceUrl: "https://www.fantasypros.com/nfl/auction-values/calculator.php",
    rows: fantasyProsValueRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.fantasyProsImport,
    valueFields: ["auctionValue", "value", "salaryCapValue", "avgSalary", "averageSalary"],
    projectionFields: ["projectedPoints", "projection", "points", "fantasyPoints"],
    adpFields: ["adp", "averagePick"],
    consensusScoring: "ppr",
  },
  {
    sourceId: "rotowire",
    source: "RotoWire values",
    sourceUrl: "https://www.rotowire.com/football/auction-values.php",
    rows: rotoWireRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.rotoWireImport,
    valueFields: ["auctionValue", "value", "salaryCapValue"],
    projectionFields: ["projectedPoints", "projection", "points", "fantasyPoints"],
  },
  {
    sourceId: "yahoo",
    source: "Yahoo salary-cap values",
    sourceUrl: "https://football.fantasysports.yahoo.com/f1/draftanalysis",
    rows: yahooRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.yahooImport,
    valueFields: ["auctionValue", "avgSalary", "averageSalary", "value"],
    adpFields: ["adp", "averagePick"],
  },
  {
    source: "Sharp Football Analysis projections",
    rows: sharpRows,
    kind: "projection",
    weight: VALUE_SOURCE_WEIGHTS.sharpProjection,
    projectionFields: ["projectedPoints", "projection", "points", "fantasyPoints"],
  },
  {
    source: "4for4 ADP",
    rows: fourForFourRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.fourForFourAdp,
    adpFields: ["adp", "averagePick", "consensus"],
    rankFields: ["rank"],
  },
  {
    source: "Fantasy Football Calculator ADP",
    rows: fantasyFootballCalculatorRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.fantasyFootballCalculatorAdp,
    adpFields: ["adp", "averagePick"],
    rankFields: ["rank"],
  },
  {
    source: "RotoBaller cheat sheet",
    rows: rotoBallerRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.rotoBallerImport,
    projectionFields: ["projectedPoints", "projection", "points", "fantasyPoints"],
    adpFields: ["adp", "averagePick"],
    rankFields: ["rank"],
  },
  {
    source: "Fantasy Footballers rankings",
    rows: footballersRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.footballersRankings,
    rankFields: ["rank"],
  },
  {
    sourceId: "fftoolbox",
    source: "FullTime Fantasy / FFToolbox auction values",
    sourceUrl: "https://fftoolbox.fulltimefantasy.com/football/auction-values.cfm",
    rows: ffToolboxRows,
    kind: "auction",
    weight: VALUE_SOURCE_WEIGHTS.ffToolboxAuction,
    sourceBudget: 200,
    valueFields: ["auctionValue", "value", "avgPrice", "averagePrice", "price"],
  },
  {
    source: "BeatADP market ADP",
    rows: beatAdpRows,
    kind: "mixed",
    weight: VALUE_SOURCE_WEIGHTS.beatAdpMarket,
    adpFields: ["adp", "averagePick", "consensus"],
    rankFields: ["rank"],
  },
];

type NormalizedPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

type ExternalValueRow = Record<string, unknown>;

type SourceCandidate = PlayerValueSource & {
  direct: boolean;
};

type SourceDefinition = {
  sourceId?: string;
  source: string;
  sourceUrl?: string;
  rows: unknown;
  kind: "auction" | "projection" | "mixed";
  weight: number;
  sourceBudget?: number;
  valueFields?: string[];
  projectionFields?: string[];
  adpFields?: string[];
  rankFields?: string[];
  updatedAt?: string;
  consensusScoring?: AuctionScoring;
  projectionScoring?: AuctionScoring;
  rescoreStatLine?: boolean;
  displayOnly?: boolean;
};

type ParsedProjectionRow = {
  keys: string[];
  projectedPoints: number;
  pos: NormalizedPosition;
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  weight: number;
  includedInConsensus: boolean;
  scoring: AuctionScoring;
  updatedAt?: string;
};

function normalizedRosterSlot(value: unknown) {
  const slot = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (slot === "DST" || slot === "D/ST") return "DEF";
  if (slot === "BN") return "BENCH";
  if (slot === "REC_FLEX" || slot === "WRRB_FLEX" || slot === "RB_WR_TE") return "FLEX";
  return slot;
}

function rosterSlotCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

function rosterPositionDemand(
  teamCount: number,
  rosterSlots: readonly AuctionValueRosterSlot[] | undefined,
) {
  const slots = rosterSlots?.length ? rosterSlots : DEFAULT_AUCTION_ROSTER_SLOTS;
  const perTeam: Record<NormalizedPosition, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  let flex = 0;
  let superFlex = 0;

  for (const entry of slots) {
    const slot = normalizedRosterSlot(entry.slot);
    const count = rosterSlotCount(entry.count);
    if (!count) continue;
    if (slot in perTeam) perTeam[slot as NormalizedPosition] += count;
    else if (slot === "FLEX") flex += count;
    else if (slot === "SUPER_FLEX") superFlex += count;
  }

  return {
    allowed: new Set<NormalizedPosition>([
      ...(perTeam.QB > 0 || superFlex > 0 ? ["QB" as const] : []),
      ...(perTeam.RB > 0 || flex > 0 || superFlex > 0 ? ["RB" as const] : []),
      ...(perTeam.WR > 0 || flex > 0 || superFlex > 0 ? ["WR" as const] : []),
      ...(perTeam.TE > 0 || flex > 0 || superFlex > 0 ? ["TE" as const] : []),
      ...(perTeam.K > 0 ? ["K" as const] : []),
      ...(perTeam.DEF > 0 ? ["DEF" as const] : []),
    ]),
    required: Object.fromEntries(
      (Object.keys(perTeam) as NormalizedPosition[]).map((position) => [
        position,
        Math.round(perTeam[position] * teamCount),
      ]),
    ) as Record<NormalizedPosition, number>,
    replacement: {
      QB: teamCount * (perTeam.QB + superFlex * 0.7),
      RB: teamCount * (perTeam.RB + flex * 0.5 + superFlex * 0.1),
      WR: teamCount * (perTeam.WR + flex * 0.5 + superFlex * 0.1),
      TE: teamCount * (perTeam.TE + superFlex * 0.1),
      K: teamCount * perTeam.K,
      DEF: teamCount * perTeam.DEF,
    } satisfies Record<NormalizedPosition, number>,
  };
}

function cleanNumber(value: unknown): number | null {
  const numberValue =
    typeof value === "string" ? Number(value.replace(/[$,%\s,]/g, "")) : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function finiteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue =
    typeof value === "string" ? Number(value.replace(/[$,%\s,]/g, "")) : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readString(row: ExternalValueRow, fields: string[]) {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readNumber(row: ExternalValueRow, fields: string[]) {
  for (const field of fields) {
    const value = cleanNumber(row[field]);
    if (value !== null) return value;
  }
  return null;
}

function readFiniteNumber(row: ExternalValueRow, fields: string[]) {
  for (const field of fields) {
    const value = finiteNumber(row[field]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizePosition(pos: string | undefined): NormalizedPosition | "" {
  const normalized = (pos ?? "").toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return VALID_POSITIONS.has(normalized) ? (normalized as NormalizedPosition) : "";
}

function normalizeTeam(team: string | undefined) {
  const normalized = (team ?? "").replace(/\s+/g, "").toUpperCase();
  const aliases: Record<string, string> = {
    ARZ: "ARI",
    JAC: "JAX",
    WSH: "WAS",
    LA: "LAR",
    SFO: "SF",
    KAN: "KC",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeNameForPosition(name: string, pos?: string) {
  const normalizedName = normalizeName(name);
  if (normalizePosition(pos) !== "DEF") return normalizedName;
  return DEFENSE_NAME_ALIASES[normalizedName] ?? normalizedName;
}

function playerKeys(name: string, pos?: string, team?: string) {
  const normalizedName = normalizeNameForPosition(name, pos);
  const normalizedPos = normalizePosition(pos);
  const normalizedTeam = normalizeTeam(team);
  const keys = [];

  if (normalizedName && normalizedPos && normalizedTeam) {
    keys.push(`${normalizedName}|${normalizedPos}|${normalizedTeam}`);
  }
  if (normalizedName && normalizedPos) {
    keys.push(`${normalizedName}|${normalizedPos}`);
  }
  if (normalizedName) {
    keys.push(normalizedName);
  }

  return keys;
}

function rowIdentity(row: ExternalValueRow) {
  const name = readString(row, ["name", "Name", "player", "Player"]);
  const pos = normalizePosition(readString(row, ["pos", "position", "Pos", "Position"]));
  const rawTeam = readString(row, ["nflTeam", "team", "Team"]);
  const team = normalizeTeam(rawTeam);

  if (!name || !pos) return null;
  if (team && !VALID_TEAMS.has(team)) return null;

  return {
    name,
    pos,
    team,
  };
}

function normalizeBudgetValue(value: number, sourceBudget: number, targetBudget: number) {
  const scaled = (value * targetBudget) / sourceBudget;
  return Math.max(1, Math.round(scaled * 100) / 100);
}

function addCandidate(
  map: Map<string, SourceCandidate[]>,
  keys: string[],
  candidate: SourceCandidate
) {
  for (const key of keys) {
    const list = map.get(key) ?? [];
    list.push(candidate);
    map.set(key, list);
  }
}

function rowsFromSource(source: SourceDefinition) {
  return Array.isArray(source.rows) ? (source.rows as ExternalValueRow[]) : [];
}

function rowUpdatedAt(row: ExternalValueRow, source: SourceDefinition) {
  return readString(row, ["updatedAt", "updated at", "date", "asOf", "as of"]) || source.updatedAt;
}

function projectionReplacementPointsForLeague(
  rows: ParsedProjectionRow[],
  teamCount: number,
  rosterSlots: readonly AuctionValueRosterSlot[] | undefined,
) {
  const replacementCounts = rosterSlots?.length
    ? rosterPositionDemand(teamCount, rosterSlots).replacement
    : {
        QB: teamCount,
        RB: teamCount * 2.5,
        WR: teamCount * 3,
        TE: teamCount,
        K: teamCount,
        DEF: teamCount,
      };
  const replacements: Partial<Record<NormalizedPosition, number>> = {};

  for (const pos of Object.keys(replacementCounts) as NormalizedPosition[]) {
    const sorted = rows
      .filter((row) => row.pos === pos)
      .map((row) => row.projectedPoints)
      .sort((left, right) => right - left);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(replacementCounts[pos]) - 1));
    replacements[pos] = sorted[index] ?? 0;
  }

  return replacements;
}

function projectionDollarCandidates(
  rows: ParsedProjectionRow[],
  budget: number,
  teamCount: number,
  rosterSlots: readonly AuctionValueRosterSlot[] | undefined,
) {
  const replacements = projectionReplacementPointsForLeague(rows, teamCount, rosterSlots);

  const withSurplus = rows.map((row) => {
    const replacement = replacements[row.pos] ?? 0;
    const surplus =
      Math.max(0, row.projectedPoints - replacement) *
      PROJECTION_POSITION_MULTIPLIERS[row.pos];
    return {
      ...row,
      surplus,
    };
  });
  const maxSurplus = Math.max(...withSurplus.map((row) => row.surplus), 0);

  if (maxSurplus <= 0) return [];

  return withSurplus.flatMap((row) => {
    const maxValue = Math.max(1, budget * 0.32);
    const normalizedValue =
      row.surplus <= 0
        ? 1
        : Math.max(
            1,
            Math.round(1 + (maxValue - 1) * Math.pow(row.surplus / maxSurplus, 0.9))
          );

    const candidate: SourceCandidate = {
      source: row.source,
      ...(row.sourceId ? { sourceId: row.sourceId } : {}),
      ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
      kind: "projection",
      value: row.projectedPoints,
      normalizedValue,
      projectedPoints: row.projectedPoints,
      weight: row.weight,
      direct: true,
      includedInConsensus: row.includedInConsensus,
      scoring: row.scoring,
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
    };

    return [{ keys: row.keys, candidate }];
  });
}

function normalizeAuctionScoring(value: unknown): AuctionScoring | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
  if (normalized === "ppr" || normalized === "fullppr") return "ppr";
  if (normalized === "halfppr" || normalized === "05ppr") return "halfPpr";
  if (normalized === "standard" || normalized === "nonppr" || normalized === "0ppr") {
    return "standard";
  }
  return null;
}

function compatibleScoring(
  row: ExternalValueRow,
  source: SourceDefinition,
  targetScoring: AuctionScoring,
) {
  const rowScoring = normalizeAuctionScoring(
    row.scoring ?? row.format ?? row.scoringType ?? row["scoring type"],
  );
  const sourceScoring = rowScoring ?? source.consensusScoring;
  return !sourceScoring || sourceScoring === targetScoring;
}

function receptionPointValue(scoring: AuctionScoring) {
  return scoring === "ppr" ? 1 : scoring === "halfPpr" ? 0.5 : 0;
}

function statLineProjectedPoints(row: ExternalValueRow, scoring: AuctionScoring) {
  const passYards = readFiniteNumber(row, ["passYards", "passingYards"]);
  const passTds = readFiniteNumber(row, ["passTds", "passingTouchdowns"]);
  const interceptions = readFiniteNumber(row, ["interceptions", "ints"]);
  const rushYards = readFiniteNumber(row, ["rushYards", "rushingYards"]);
  const rushTds = readFiniteNumber(row, ["rushTds", "rushingTouchdowns"]);
  const receptions = readFiniteNumber(row, ["receptions", "recs", "rec"]);
  const recYards = readFiniteNumber(row, ["recYards", "receivingYards"]);
  const recTds = readFiniteNumber(row, ["recTds", "receivingTouchdowns"]);
  const hasStatLine = [
    passYards,
    passTds,
    interceptions,
    rushYards,
    rushTds,
    receptions,
    recYards,
    recTds,
  ].some((value) => value !== null);
  if (!hasStatLine) return null;

  return (
    (passYards ?? 0) / 25 +
    (passTds ?? 0) * 4 -
    (interceptions ?? 0) * 2 +
    (rushYards ?? 0) / 10 +
    (rushTds ?? 0) * 6 +
    (recYards ?? 0) / 10 +
    (recTds ?? 0) * 6 +
    (receptions ?? 0) * receptionPointValue(scoring)
  );
}

function buildProjectionRows(source: SourceDefinition, scoring: AuctionScoring) {
  if (!source.projectionFields?.length) return [];

  return rowsFromSource(source).flatMap((row): ParsedProjectionRow[] => {
    const identity = rowIdentity(row);
    const baseProjectedPoints = readNumber(row, source.projectionFields ?? []);

    if (!identity || baseProjectedPoints === null) return [];

    const projectionScoring = normalizeAuctionScoring(
      row.scoring ?? row.format ?? row.scoringType ?? row["scoring type"],
    ) ?? source.projectionScoring ?? scoring;
    const receptions = readFiniteNumber(row, ["receptions", "recs", "rec"]);
    const rescoredPoints = source.rescoreStatLine ? statLineProjectedPoints(row, scoring) : null;
    const projectedPoints = rescoredPoints ?? (
      baseProjectedPoints +
      (receptions ?? 0) * (receptionPointValue(scoring) - receptionPointValue(projectionScoring))
    );

    return [
      {
        keys: playerKeys(identity.name, identity.pos, identity.team),
        projectedPoints,
        pos: identity.pos,
        source: source.source,
        ...(source.sourceId ? { sourceId: source.sourceId } : {}),
        ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
        weight: source.weight,
        includedInConsensus: !source.displayOnly,
        scoring,
        ...(rowUpdatedAt(row, source) ? { updatedAt: rowUpdatedAt(row, source) } : {}),
      },
    ];
  });
}

function buildExternalValueMap(
  targetBudget: number,
  scoring: AuctionScoring,
  teamCount: number,
  rosterSlots: readonly AuctionValueRosterSlot[] | undefined,
) {
  const map = new Map<string, SourceCandidate[]>();

  for (const source of SOURCE_DEFINITIONS) {
    for (const row of rowsFromSource(source)) {
      const identity = rowIdentity(row);
      if (!identity || !source.valueFields?.length) continue;

      const value = readNumber(row, source.valueFields);
      if (value === null) continue;

      const sourceBudget = readNumber(row, ["budget", "auctionBudget", "salaryCap"])
        ?? source.sourceBudget
        ?? DEFAULT_VALUE_BUDGET;
      const normalizedValue = normalizeBudgetValue(value, sourceBudget, targetBudget);
      const candidate: SourceCandidate = {
        source: source.source,
        ...(source.sourceId ? { sourceId: source.sourceId } : {}),
        ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
        kind: "auction",
        value,
        normalizedValue,
        weight: source.weight,
        direct: true,
        includedInConsensus: !source.displayOnly && compatibleScoring(row, source, scoring),
        ...(normalizeAuctionScoring(row.scoring) ?? source.consensusScoring
          ? { scoring: (normalizeAuctionScoring(row.scoring) ?? source.consensusScoring)! }
          : {}),
        ...(rowUpdatedAt(row, source) ? { updatedAt: rowUpdatedAt(row, source) } : {}),
      };

      addCandidate(map, playerKeys(identity.name, identity.pos, identity.team), candidate);
    }

    const projectionRows = buildProjectionRows(source, scoring);
    for (const { keys, candidate } of projectionDollarCandidates(
      projectionRows,
      targetBudget,
      teamCount,
      rosterSlots,
    )) {
      addCandidate(map, keys, candidate);
    }

    if (source.adpFields?.length) {
      for (const row of rowsFromSource(source)) {
        const identity = rowIdentity(row);
        if (!identity) continue;

        const adp = readNumber(row, source.adpFields);
        const normalizedValue = rankToAuctionValue(adp ?? undefined, targetBudget);
        if (adp === null || normalizedValue === null) continue;

        const candidate: SourceCandidate = {
          source: `${source.source} ADP-derived market value`,
          ...(source.sourceId ? { sourceId: `${source.sourceId}-adp` } : {}),
          ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
          kind: "adp-derived",
          value: adp,
          normalizedValue,
          weight: source.weight * VALUE_SOURCE_WEIGHTS.importedAdpDerivedMultiplier,
          direct: false,
          includedInConsensus:
            !source.displayOnly &&
            (!source.consensusScoring || source.consensusScoring === scoring),
        };
        addCandidate(map, playerKeys(identity.name, identity.pos, identity.team), candidate);
      }
    }

    if (source.rankFields?.length) {
      for (const row of rowsFromSource(source)) {
        const identity = rowIdentity(row);
        if (!identity) continue;

        const rank = readNumber(row, source.rankFields);
        const normalizedValue = rankToAuctionValue(rank ?? undefined, targetBudget);
        if (rank === null || normalizedValue === null) continue;

        const candidate: SourceCandidate = {
          source: `${source.source} rank-derived market value`,
          ...(source.sourceId ? { sourceId: `${source.sourceId}-rank` } : {}),
          ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
          kind: "rank-derived",
          value: rank,
          normalizedValue,
          weight: source.weight * VALUE_SOURCE_WEIGHTS.importedRankDerivedMultiplier,
          direct: false,
          includedInConsensus:
            !source.displayOnly &&
            (!source.consensusScoring || source.consensusScoring === scoring),
        };
        addCandidate(map, playerKeys(identity.name, identity.pos, identity.team), candidate);
      }
    }
  }

  return map;
}

export function rankToAuctionValue(rank: number | undefined, budget = DEFAULT_VALUE_BUDGET) {
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank <= 0) return null;

  const maxValue = Math.max(1, budget * 0.32);
  const base = 1 + (maxValue - 1) * Math.exp(-(Math.max(1, rank) - 1) / 42);
  const lateDiscount = rank > 180 ? 0.55 : rank > 140 ? 0.72 : rank > 100 ? 0.86 : 1;
  return Math.max(1, Math.round(base * lateDiscount));
}

function buildDerivedSources(player: Player, budget: number): SourceCandidate[] {
  const sources: SourceCandidate[] = [];
  const rankValue = rankToAuctionValue(player.rank ?? player.search_rank, budget);
  if (rankValue !== null) {
    sources.push({
      source: `${player.adpSource ?? "Player rank"} rank-derived market value`,
      kind: "rank-derived",
      value: rankValue,
      normalizedValue: rankValue,
      weight: VALUE_SOURCE_WEIGHTS.rankDerived,
      direct: false,
      includedInConsensus: true,
    });
  }

  const adpValue = rankToAuctionValue(player.adp, budget);
  if (adpValue !== null) {
    sources.push({
      source: `${player.adpSource ?? "ADP"}-derived market value`,
      kind: "adp-derived",
      value: adpValue,
      normalizedValue: adpValue,
      weight: VALUE_SOURCE_WEIGHTS.adpDerived,
      direct: false,
      includedInConsensus: true,
    });
  }

  return sources;
}

function uniqueSources(sources: SourceCandidate[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source}|${source.kind}|${source.normalizedValue}|${source.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function weightedAverage(sources: SourceCandidate[]) {
  const weightTotal = sources.reduce((sum, source) => sum + source.weight, 0);
  if (weightTotal <= 0) return null;

  const value =
    sources.reduce((sum, source) => sum + source.normalizedValue * source.weight, 0) /
    weightTotal;

  return Math.max(1, value);
}

function medianValue(sources: SourceCandidate[]) {
  const values = sources
    .map((source) => source.normalizedValue)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!values.length) return null;

  const middle = Math.floor(values.length / 2);
  const value = values.length % 2 === 1
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
  return Math.max(1, Math.round(value * 100) / 100);
}

function includedAuctionSources(sources: SourceCandidate[]) {
  return sources.filter(
    (source) => source.kind === "auction" && source.includedInConsensus !== false,
  );
}

function preliminaryAuctionValue(sources: SourceCandidate[]) {
  const included = sources.filter((source) => source.includedInConsensus !== false);
  const directAuction = includedAuctionSources(included);
  if (!directAuction.length) return weightedAverage(included);

  // Published dollar boards are combined with a robust median so one high or
  // low board cannot pull the entire consensus away from the market.
  const directValue = medianValue(directAuction);
  const supportingValue = weightedAverage(included.filter((source) => source.kind !== "auction"));
  if (directValue === null || supportingValue === null) return directValue;

  // Direct published auction dollars remain the anchor. Projection, ADP, rank,
  // and market signals can move the order without receiving another full vote.
  return directValue * 0.88 + supportingValue * 0.12;
}

function confidenceForSources(sources: SourceCandidate[]) {
  const included = sources.filter((source) => source.includedInConsensus !== false);
  const auctionCount = includedAuctionSources(included).length;
  const supportingCount = included.length - auctionCount;

  if (auctionCount === 0) {
    return Math.min(
      VALUE_CONFIDENCE_WEIGHTS.maxWithoutAuctionSource,
      supportingCount * VALUE_CONFIDENCE_WEIGHTS.supportingSource,
    );
  }

  let confidence = VALUE_CONFIDENCE_WEIGHTS.singleAuctionSource;
  if (auctionCount >= 2) confidence += VALUE_CONFIDENCE_WEIGHTS.secondAuctionSource;
  if (auctionCount >= 3) {
    confidence += (auctionCount - 2) * VALUE_CONFIDENCE_WEIGHTS.additionalAuctionSource;
  }
  confidence += supportingCount * VALUE_CONFIDENCE_WEIGHTS.supportingSource;

  return Math.min(
    auctionCount === 1 ? VALUE_CONFIDENCE_WEIGHTS.maxWithOneAuctionSource : 0.98,
    confidence,
  );
}

function latestSourceUpdate(sources: readonly { updatedAt?: string }[]) {
  return sources
    .map((source) => source.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];
}

export type ProjectionConsensusSummary = {
  points: number;
  sourceCount: number;
  low: number;
  high: number;
  updatedAt?: string;
};

export function projectionConsensusSummary(
  sources: readonly PlayerValueSource[],
): ProjectionConsensusSummary | null {
  const byPublisher = new Map<string, PlayerValueSource>();
  for (const source of sources) {
    if (
      source.kind !== "projection" ||
      source.includedInConsensus === false ||
      typeof source.projectedPoints !== "number" ||
      !Number.isFinite(source.projectedPoints)
    ) continue;
    const publisher = source.sourceId ?? source.source;
    if (!byPublisher.has(publisher)) byPublisher.set(publisher, source);
  }

  const projectionSources = [...byPublisher.values()];
  const values = projectionSources
    .map((source) => source.projectedPoints!)
    .sort((left, right) => left - right);
  if (!values.length) return null;

  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 1
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
  const updatedAt = latestSourceUpdate(projectionSources);

  return {
    points: Math.round(median * 100) / 100,
    sourceCount: values.length,
    low: Math.round(values[0]! * 100) / 100,
    high: Math.round(values.at(-1)! * 100) / 100,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function toPlayerValueSource(source: SourceCandidate): PlayerValueSource {
  const valueSource: PlayerValueSource = {
    source: source.source,
    ...(source.sourceId ? { sourceId: source.sourceId } : {}),
    ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
    kind: source.kind as PlayerValueSourceKind,
    value: source.value,
    normalizedValue: source.normalizedValue,
    weight: source.weight,
    ...(typeof source.includedInConsensus === "boolean"
      ? { includedInConsensus: source.includedInConsensus }
      : {}),
    ...(source.scoring ? { scoring: source.scoring } : {}),
  };

  if (typeof source.projectedPoints === "number") {
    valueSource.projectedPoints = source.projectedPoints;
  }
  if (source.updatedAt) {
    valueSource.updatedAt = source.updatedAt;
  }

  return valueSource;
}

type PreliminaryPlayerValue = {
  player: Player;
  sources: SourceCandidate[];
  preliminaryValue: number;
  marketValue: number | null;
  marketValueSourceCount: number;
  marketValueUpdatedAt?: string;
  projectedPoints: number | null;
  projectionSourceCount: number;
  projectionLow?: number;
  projectionHigh?: number;
  projectionUpdatedAt?: string;
};

function calibrationUniverse(
  values: PreliminaryPlayerValue[],
  teamCount: number,
  draftedPlayerCount: number,
  rosterSlots: readonly AuctionValueRosterSlot[] | undefined,
) {
  const demand = rosterPositionDemand(teamCount, rosterSlots);
  const sorted = values
    .filter((entry) => !rosterSlots?.length || demand.allowed.has(entry.player.pos as NormalizedPosition))
    .sort(
    (left, right) =>
      right.preliminaryValue - left.preliminaryValue ||
      (left.player.rank ?? Number.MAX_SAFE_INTEGER) -
        (right.player.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const selected = new Map<string, PreliminaryPlayerValue>();

  for (const position of Object.keys(demand.required) as NormalizedPosition[]) {
    if (demand.required[position] <= 0) continue;
    sorted
      .filter((entry) => entry.player.pos === position)
      .slice(0, demand.required[position])
      .forEach((entry) => selected.set(entry.player.id, entry));
  }

  for (const entry of sorted) {
    if (selected.size >= draftedPlayerCount) break;
    selected.set(entry.player.id, entry);
  }

  return [...selected.values()];
}

function calibratedDollarMap(
  values: PreliminaryPlayerValue[],
  budget: number,
  options: Required<Pick<AuctionValueOptions, "teamCount" | "rosterSize">> & {
    rosterSlots: readonly AuctionValueRosterSlot[] | undefined;
  },
) {
  const draftedPlayerCount = options.teamCount * options.rosterSize;
  const totalBudget = options.teamCount * budget;
  if (
    values.length < draftedPlayerCount ||
    draftedPlayerCount <= 0 ||
    totalBudget < draftedPlayerCount
  ) {
    return null;
  }

  const universe = calibrationUniverse(
    values,
    options.teamCount,
    draftedPlayerCount,
    options.rosterSlots,
  );
  if (universe.length !== draftedPlayerCount) return null;

  const sortedUniverse = [...universe].sort(
    (left, right) =>
      right.preliminaryValue - left.preliminaryValue ||
      (left.player.rank ?? Number.MAX_SAFE_INTEGER) -
        (right.player.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const minimumBidCount = Math.max(1, Math.round(draftedPlayerCount * MINIMUM_BID_SHARE));
  const minimumBidIds = new Set(
    sortedUniverse.slice(Math.max(0, sortedUniverse.length - minimumBidCount)).map((entry) => entry.player.id),
  );
  const premiumPool = totalBudget - draftedPlayerCount;
  const premiumWeights = new Map(
    universe.map((entry) => [
      entry.player.id,
      minimumBidIds.has(entry.player.id)
        ? 0
        : Math.pow(Math.max(0, entry.preliminaryValue - 1), PREMIUM_CURVE_EXPONENT),
    ]),
  );
  const premiumWeightTotal = [...premiumWeights.values()].reduce((sum, value) => sum + value, 0);
  if (premiumWeightTotal <= 0) return null;

  // Auction rooms concentrate their budget on starters and leave a real $1
  // replacement tier. Shape only the premiums, preserve every minimum bid,
  // and continue to conserve the complete league budget exactly.
  const scaled = universe.map((entry) => {
    const weight = premiumWeights.get(entry.player.id) ?? 0;
    const exact = 1 + premiumPool * weight / premiumWeightTotal;
    const floor = Math.max(1, Math.floor(exact));
    return { id: entry.player.id, exact, floor, fraction: exact - floor };
  });
  let remainder = Math.round(totalBudget - scaled.reduce((sum, entry) => sum + entry.floor, 0));
  if (remainder > 0) {
    scaled.sort((left, right) => right.fraction - left.fraction || right.exact - left.exact);
    for (let index = 0; index < scaled.length && remainder > 0; index += 1) {
      scaled[index]!.floor += 1;
      remainder -= 1;
    }
  } else if (remainder < 0) {
    scaled.sort((left, right) => left.fraction - right.fraction || right.floor - left.floor);
    for (let index = 0; index < scaled.length && remainder < 0; index += 1) {
      if (scaled[index]!.floor <= 1) continue;
      scaled[index]!.floor -= 1;
      remainder += 1;
    }
  }

  return new Map(scaled.map((entry) => [entry.id, entry.floor]));
}

export function applyConsensusAuctionValues(
  players: Player[],
  budget = DEFAULT_VALUE_BUDGET,
  options: AuctionValueOptions = {},
): Player[] {
  const scoring = options.scoring ?? "ppr";
  const teamCount = Math.max(1, Math.round(options.teamCount ?? DEFAULT_TEAM_COUNT));
  const rosterSize = Math.max(1, Math.round(options.rosterSize ?? DEFAULT_ROSTER_SIZE));
  const rosterSlots = options.rosterSlots;
  const externalValues = buildExternalValueMap(budget, scoring, teamCount, rosterSlots);

  const preliminary = players.flatMap((player): PreliminaryPlayerValue[] => {
    const externalSources = playerKeys(player.name, player.pos, player.nflTeam).flatMap(
      (key) => externalValues.get(key) ?? []
    );
    const sources = uniqueSources([...externalSources, ...buildDerivedSources(player, budget)]);
    const preliminaryValue = preliminaryAuctionValue(sources);

    if (preliminaryValue === null) return [];

    const projectionSummary = projectionConsensusSummary(sources);
    const auctionSources = includedAuctionSources(sources);
    const marketValue = medianValue(auctionSources);
    const marketValueUpdatedAt = latestSourceUpdate(auctionSources);

    return [{
      player,
      sources,
      preliminaryValue,
      marketValue,
      marketValueSourceCount: auctionSources.length,
      ...(marketValueUpdatedAt ? { marketValueUpdatedAt } : {}),
      projectedPoints: projectionSummary?.points ?? null,
      projectionSourceCount: projectionSummary?.sourceCount ?? 0,
      ...(projectionSummary ? { projectionLow: projectionSummary.low } : {}),
      ...(projectionSummary ? { projectionHigh: projectionSummary.high } : {}),
      ...(projectionSummary?.updatedAt
        ? { projectionUpdatedAt: projectionSummary.updatedAt }
        : {}),
    }];
  });

  const calibrated = options.calibrate === false
    ? null
    : calibratedDollarMap(preliminary, budget, { teamCount, rosterSize, rosterSlots });
  const preliminaryMap = new Map(preliminary.map((entry) => [entry.player.id, entry]));

  return players.map((player) => {
    const entry = preliminaryMap.get(player.id);
    if (!entry) return player;
    const auctionValue = calibrated?.get(player.id) ?? (calibrated ? 1 : Math.round(entry.preliminaryValue));
    return {
      ...player,
      auctionValue,
      projectedValue: auctionValue,
      ...(entry.marketValue !== null ? { marketValue: entry.marketValue } : {}),
      marketValueSourceCount: entry.marketValueSourceCount,
      ...(entry.marketValueUpdatedAt
        ? { marketValueUpdatedAt: entry.marketValueUpdatedAt }
        : {}),
      ...(entry.projectedPoints !== null ? { projectedPoints: entry.projectedPoints } : {}),
      projectionSourceCount: entry.projectionSourceCount,
      ...(entry.projectionLow !== undefined ? { projectionLow: entry.projectionLow } : {}),
      ...(entry.projectionHigh !== undefined ? { projectionHigh: entry.projectionHigh } : {}),
      ...(entry.projectionUpdatedAt
        ? { projectionUpdatedAt: entry.projectionUpdatedAt }
        : {}),
      valueSources: entry.sources.map(toPlayerValueSource),
      valueConfidence: confidenceForSources(entry.sources),
      valueUpdatedAt: VALUE_UPDATED_AT,
    };
  });
}
