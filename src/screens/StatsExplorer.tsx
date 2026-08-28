import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  ChartNoAxesCombined,
  Database,
  Download,
  ExternalLink,
  Info,
  Layers3,
  Radio,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { TeamMark } from "@/components/player/TeamMark";
import { StatsDataTable } from "@/components/stats/StatsDataTable";
import type {
  StatsSortState,
  StatsTableColumn,
} from "@/components/stats/StatsDataTable";
import { StatsPlayerDrawer } from "@/components/stats/StatsPlayerDrawer";
import type {
  StatsPlayerDetail,
  StatsPlayerMetric,
  StatsPlayerSource,
} from "@/components/stats/StatsPlayerDrawer";
import { StatsSparkline } from "@/components/stats/StatsSparkline";
import { StatsViewTabs } from "@/components/stats/StatsViewTabs";
import type { StatsView } from "@/components/stats/statsViewOptions";
import "@/components/stats/auctionValues.css";
import { loadPlayerPool } from "@/data/loadPlayerPool";
import {
  normalizeAuctionValueRosterSlots,
  normalizeAuctionValueScoring,
} from "@/data/auctionValueSettings";
import { FANTASY_SEASON } from "@/config/fantasySeason";
import { NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import { buildPlayerGameLog } from "@/data/playerGameLog";
import { buildPlayerStatRows } from "@/data/playerStatCategories";
import type { PlayerStatRow } from "@/data/playerStatCategories";
import type { SleeperPlayerRow } from "@/data/playerStatCategories";
import { loadSleeperPlayerDirectory } from "@/data/sleeperPlayerDirectory";
import {
  FANTASY_FOOTBALL_CALCULATOR_SOURCE,
  loadFfcAdp,
  loadSleeperTrending,
  SLEEPER_TRENDING_SOURCE,
} from "@/data/publicFantasySignals";
import type {
  FfcAdpPlayer,
  FfcAdpResult,
  SleeperTrendingSignal,
} from "@/data/publicFantasySignals";
import { AUCTION_VALUE_SOURCE_COLUMNS } from "@/data/playerValues";
import type { AuctionValueRosterSlot } from "@/data/playerValues";
import { loadSleeperAuctionDraft } from "@/data/sleeperAuctionDraft";
import type { SleeperAuctionDraftResult } from "@/data/sleeperAuctionDraft";
import {
  loadWeeklyPlayerStats,
} from "@/data/weeklyPlayerStats";
import type {
  WeeklyFantasyScoringMode,
  WeeklyPlayerStatRow,
  WeeklyPlayerStatsResult,
  WeeklyPlayerSummary,
  WeeklySeasonType,
} from "@/data/weeklyPlayerStats";
import winWithOddsRowsJson from "@/data/players-2026-winwithodds.json";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { PositionToggle } from "@/ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";
import { SelectItem, SelectWrapper } from "@/ui/SelectWrapper";
import type { PlayerValueSource } from "@/types/draft";
import { appUrl } from "@/lib/appBasePath";
import { matchesPositionFilter } from "@/utils/positionFilter";
import {
  auctionSettingsSummary,
  useSleeperLeagueConnections,
} from "@/features/league-hq/sleeperConnections";

type HubScoring = WeeklyFantasyScoringMode;
type FantasyPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
type PositionFilter = "ALL" | "FLEX" | FantasyPosition;
const POSITION_FILTER_ORDER: readonly PositionFilter[] = [
  "ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DEF",
];
const POSITION_FILTERS: ReadonlySet<PositionFilter> = new Set(POSITION_FILTER_ORDER);

type WinWithOddsProjection = Record<string, unknown> & {
  id?: string;
  name?: string;
  pos?: string;
  rank?: number;
  projectedPoints?: number;
  updatedAt?: string;
  attempts?: number;
  completions?: number;
  passYards?: number;
  passTds?: number;
  interceptions?: number;
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  receptions?: number;
  recYards?: number;
  recTds?: number;
};

interface HubPlayerRow {
  id: string;
  name: string;
  position: FantasyPosition;
  team: string;
  opponent: string;
  status: string;
  injuryStatus: string;
  sleeperId: string;
  positionRank: number | null;
  overallRank: number | null;
  bye: number | null;
  games: number;
  fantasyPoints: number;
  fantasyPointsPerGame: number;
  last3FantasyPointsPerGame: number;
  last5FantasyPointsPerGame: number;
  medianFantasyPoints: number;
  floorFantasyPoints: number;
  ceilingFantasyPoints: number;
  standardDeviation: number;
  carriesPerGame: number;
  targetsPerGame: number;
  receptionsPerGame: number;
  opportunitiesPerGame: number;
  totalYardsPerGame: number;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
  projectedFantasyPoints: number | null;
  projectedFantasyPointsPerGame: number | null;
  auctionValue: number | null;
  marketValue: number | null;
  auctionSourceValues?: Record<string, number | null>;
  auctionSourceAverage?: number | null;
  auctionSourceLow?: number | null;
  auctionSourceHigh?: number | null;
  auctionSourceSpread?: number | null;
  auctionSourceCount?: number;
  auctionUpdatedAt?: string;
  projectionSpread: number | null;
  adp: number | null;
  adpFormatted: string;
  adpHigh: number | null;
  adpLow: number | null;
  adpStdDev: number | null;
  timesDrafted: number | null;
  trendingAdds: number;
  trendingDrops: number;
  weeklyPoints: number[];
  summary: WeeklyPlayerSummary | null;
  projection: PlayerStatRow | null;
  adpRow: FfcAdpPlayer | null;
  vegas: WinWithOddsProjection | null;
}

interface DefenseMatchupRow {
  id: string;
  team: string;
  games: number;
  overall: number;
  qb: number;
  rb: number;
  wr: number;
  te: number;
  k: number;
  difficultyRank: number;
}

interface TeamSummaryRow {
  id: string;
  team: string;
  games: number;
  fantasyPointsPerGame: number;
  passingYardsPerGame: number;
  rushingYardsPerGame: number;
  receivingYardsPerGame: number;
  touchdownsPerGame: number;
  topScorer: string;
  topScorerPoints: number;
  opponentFantasyPointsAllowed: number;
}

interface SummaryCard {
  label: string;
  value: string;
  helper: string;
}

const DRAFT_SEASON = FANTASY_SEASON;
const TREND_BASELINE_SEASON = DRAFT_SEASON - 1;
const ACTUAL_SEASONS = [
  TREND_BASELINE_SEASON,
  TREND_BASELINE_SEASON - 1,
  TREND_BASELINE_SEASON - 2,
  TREND_BASELINE_SEASON - 3,
] as const;
const WEEK_OPTIONS = Array.from({ length: 22 }, (_, index) => index + 1);
const TEAM_COUNT_OPTIONS = [8, 10, 12, 14] as const;
const ROW_LIMIT_OPTIONS = [25, 50, 100, 250, 1000] as const;
const FANTASY_POSITIONS: ReadonlySet<FantasyPosition> = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const OFFENSIVE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const WIN_WITH_ODDS_ROWS = winWithOddsRowsJson as WinWithOddsProjection[];
const AUCTION_GATEWAY_URL = String(import.meta.env.VITE_AUCTION_GATEWAY_URL ?? "").replace(/\/+$/, "");
const FFC_ADP_BASE_URL = import.meta.env.PROD && AUCTION_GATEWAY_URL
  ? `${AUCTION_GATEWAY_URL}/public/ffc-api`
  : appUrl("ffc-api");

const VIEW_COPY: Record<StatsView, { title: string; description: string }> = {
  leaders: {
    title: "Fantasy leaders",
    description: "Scoring leaders with recent form, consistency, and a week-by-week game log.",
  },
  draft: {
    title: "Draft market",
    description: "Free ADP, source-aware projections, ranges, and auction values for every draft format.",
  },
  auction: {
    title: "Auction value board",
    description: "A sortable fair-value and market-median board with every available source and imported Sleeper sale prices.",
  },
  opportunity: {
    title: "Opportunity",
    description: "Carries, targets, receptions, workload shares, and efficiency—not just the final score.",
  },
  trends: {
    title: "Trends",
    description: "Live 2026 Sleeper add/drop activity across the current player pool, with clearly labeled 2025 form context.",
  },
  matchups: {
    title: "Defense vs position",
    description: "Fantasy points allowed by each defense, split by position for the selected scoring format.",
  },
  teams: {
    title: "Team production",
    description: "Team-level fantasy production and opponent scoring allowed. D/ST projections remain available in Draft.",
  },
};

const DEFAULT_SORTS: Record<StatsView, StatsSortState> = {
  leaders: { columnId: "fantasyPoints", direction: "desc" },
  draft: { columnId: "adp", direction: "asc" },
  auction: { columnId: "auctionValue", direction: "desc" },
  opportunity: { columnId: "opportunitiesPerGame", direction: "desc" },
  trends: { columnId: "netTrending", direction: "desc" },
  matchups: { columnId: "overall", direction: "asc" },
  teams: { columnId: "fantasyPointsPerGame", direction: "desc" },
};

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function perGame(value: number, games: number) {
  return games > 0 ? value / games : 0;
}

function formatNumber(value: number | null, decimals = 1) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}

function formatInteger(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString();
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

function formatMoney(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `$${Math.round(value)}`;
}

function formatUpdatedAt(value: string | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function mostRecentUpdate(valueSources: PlayerValueSource[], fallback?: string) {
  const values = [fallback, ...valueSources.map((source) => source.updatedAt)].filter(
    (value): value is string => Boolean(value),
  );
  return values.sort((left, right) => {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime - leftTime;
    return right.localeCompare(left);
  })[0] ?? "";
}

function auctionMetrics(
  valueSources: PlayerValueSource[],
  sleeperPaid: number | null,
  valueUpdatedAt?: string,
) {
  const sourceValues: Record<string, number | null> = {};
  for (const sourceColumn of AUCTION_VALUE_SOURCE_COLUMNS) {
    const sourceValue =
      valueSources.find(
        (source) =>
          source.sourceId === sourceColumn.id && source.includedInConsensus !== false,
      ) ?? valueSources.find((source) => source.sourceId === sourceColumn.id);
    sourceValues[sourceColumn.id] = sourceColumn.id === "sleeper-paid"
      ? sleeperPaid
      : numberValue(sourceValue?.normalizedValue);
  }

  const comparableSourceIds = new Set(
    valueSources
      .filter((source) => source.includedInConsensus !== false)
      .map((source) => source.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
  );
  const values = Object.entries(sourceValues).flatMap(([sourceId, value]) =>
    value !== null &&
    Number.isFinite(value) &&
    (sourceId === "sleeper-paid" || comparableSourceIds.has(sourceId))
      ? [value]
      : [],
  );
  const low = values.length ? Math.min(...values) : null;
  const high = values.length ? Math.max(...values) : null;

  return {
    auctionSourceValues: sourceValues,
    auctionSourceAverage: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    auctionSourceLow: low,
    auctionSourceHigh: high,
    auctionSourceSpread: low === null || high === null ? null : high - low,
    auctionSourceCount: values.length,
    auctionUpdatedAt: mostRecentUpdate(valueSources, valueUpdatedAt),
  };
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

function normalizeTeam(team: string | undefined) {
  const raw = String(team ?? "").trim().toUpperCase();
  const aliases: Record<string, string> = {
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
  return aliases[raw] ?? raw;
}

function normalizePosition(position: string | undefined, positionGroup?: string): FantasyPosition | null {
  const raw = String(position ?? "").trim().toUpperCase();
  const group = String(positionGroup ?? "").trim().toUpperCase();
  if (raw === "DST" || raw === "D/ST") return "DEF";
  if (raw === "PK") return "K";
  if (raw === "FB" || group === "RB") return "RB";
  return FANTASY_POSITIONS.has(raw as FantasyPosition) ? raw as FantasyPosition : null;
}

function playerKey(name: string, position: string) {
  return `${normalizeName(name)}|${normalizePosition(position) ?? position.toUpperCase()}`;
}

function projectedFantasyPoints(projection: PlayerStatRow | null, scoring: HubScoring) {
  const clay = projection?.espnClay;
  if (!clay) return numberValue(projection?.winWithOdds?.projectedPoints);

  const position = normalizePosition(projection.player.pos);
  if (position === "K" || position === "DEF") return numberValue(clay.projectedPoints);

  const statValues = [
    clay.passYards,
    clay.passTds,
    clay.interceptions,
    clay.rushYards,
    clay.rushTds,
    clay.receptions,
    clay.recYards,
    clay.recTds,
  ];
  const hasStatProjection = statValues.some((value) => numberValue(value) !== null);
  if (!hasStatProjection) return numberValue(clay.projectedPoints);

  const receptionValue = scoring === "ppr" ? 1 : scoring === "halfPpr" ? 0.5 : 0;
  return (
    (numberValue(clay.passYards) ?? 0) / 25 +
    (numberValue(clay.passTds) ?? 0) * 4 -
    (numberValue(clay.interceptions) ?? 0) * 2 +
    (numberValue(clay.rushYards) ?? 0) / 10 +
    (numberValue(clay.rushTds) ?? 0) * 6 +
    (numberValue(clay.recYards) ?? 0) / 10 +
    (numberValue(clay.recTds) ?? 0) * 6 +
    (numberValue(clay.receptions) ?? 0) * receptionValue
  );
}

function projectionMetrics(
  projection: PlayerStatRow | null,
  vegas: WinWithOddsProjection | null,
  scoring: HubScoring,
) {
  const fantasyPoints =
    projectedFantasyPoints(projection, scoring) ?? numberValue(vegas?.projectedPoints);
  const games = numberValue(projection?.espnClay?.games) ?? 17;
  const vegasPoints =
    numberValue(projection?.winWithOdds?.projectedPoints) ?? numberValue(vegas?.projectedPoints);
  return {
    fantasyPoints,
    fantasyPointsPerGame: fantasyPoints === null ? null : fantasyPoints / Math.max(games, 1),
    spread:
      fantasyPoints === null || vegasPoints === null ? null : vegasPoints - fantasyPoints,
  };
}

function trendMap(signals: SleeperTrendingSignal[]) {
  return new Map(signals.map((signal) => [signal.playerId, signal.count]));
}

function withPositionRanks(rows: HubPlayerRow[], selector: (row: HubPlayerRow) => number | null) {
  const ranks = new Map<string, number>();
  const groups = new Map<string, HubPlayerRow[]>();

  for (const row of rows) {
    const group = groups.get(row.position) ?? [];
    group.push(row);
    groups.set(row.position, group);
  }

  for (const group of groups.values()) {
    group
      .filter((row) => selector(row) !== null)
      .sort((left, right) => (selector(right) ?? 0) - (selector(left) ?? 0))
      .forEach((row, index) => ranks.set(row.id, index + 1));
  }

  return rows.map((row) => ({ ...row, positionRank: ranks.get(row.id) ?? null }));
}

function makePlayerIdentity(row: HubPlayerRow) {
  const status = row.injuryStatus || row.status;
  return (
    <span className="stats-hub-player">
      <TeamMark team={row.team} size="xs" />
      <span className="stats-hub-player-copy">
        <strong>{row.name}</strong>
        <small>
          {row.position}
          {row.positionRank ? row.positionRank : ""} · {row.team || "FA"}
          {status ? ` · ${status}` : ""}
        </small>
      </span>
    </span>
  );
}

function deltaClass(value: number) {
  if (value > 0.15) return "is-positive";
  if (value < -0.15) return "is-negative";
  return "is-neutral";
}

function playerColumns(view: StatsView): StatsTableColumn<HubPlayerRow>[] {
  const playerColumn: StatsTableColumn<HubPlayerRow> = {
    id: "player",
    label: "Player",
    description: "Open the player card for full career seasons, season game logs, usage, and source details.",
    align: "left",
    sticky: true,
    sortValue: (row) => row.name,
    render: makePlayerIdentity,
  };

  if (view === "auction") {
    const sourceColumns = AUCTION_VALUE_SOURCE_COLUMNS.map<StatsTableColumn<HubPlayerRow>>(
      (source) => ({
        id: `auction-source-${source.id}`,
        label: source.shortLabel,
        description: source.id === "sleeper-paid"
          ? "Actual winning bid from the completed Sleeper auction draft you import, normalized to a $200 budget when needed."
          : source.id === "leaguelogs-ppr-rank"
            ? "GameHQ dollar conversion of the public LeagueLogs PPR market index."
            : `${source.label} auction value normalized to a $200 budget. Blank means the source is not currently licensed or imported.`,
        sortValue: (row) => row.auctionSourceValues?.[source.id] ?? null,
        render: (row) => formatMoney(row.auctionSourceValues?.[source.id] ?? null),
      }),
    );

    return [
      playerColumn,
      {
        id: "auctionValue",
        label: "GameHQ Fair",
        description: "GameHQ fair value for the selected scoring, league size, roster demand, and budget.",
        sortValue: (row) => row.auctionValue,
        render: (row) => <strong className="stats-auction-consensus">{formatMoney(row.auctionValue)}</strong>,
      },
      {
        id: "marketValue",
        label: "Market Median",
        description: "Median of compatible imported published auction-dollar sources before GameHQ projection and roster-demand adjustments.",
        sortValue: (row) => row.marketValue,
        render: (row) => formatMoney(row.marketValue),
      },
      ...sourceColumns,
      {
        id: "auctionSourceAverage",
        label: "Src Avg",
        description: "Simple average of currently available, scoring-compatible source columns, including an imported Sleeper paid price.",
        sortValue: (row) => row.auctionSourceAverage ?? null,
        render: (row) => formatMoney(row.auctionSourceAverage ?? null),
      },
      {
        id: "auctionSourceLow",
        label: "Low",
        sortValue: (row) => row.auctionSourceLow ?? null,
        render: (row) => formatMoney(row.auctionSourceLow ?? null),
      },
      {
        id: "auctionSourceHigh",
        label: "High",
        sortValue: (row) => row.auctionSourceHigh ?? null,
        render: (row) => formatMoney(row.auctionSourceHigh ?? null),
      },
      {
        id: "auctionSourceSpread",
        label: "Spread",
        description: "Highest available source value minus the lowest.",
        sortValue: (row) => row.auctionSourceSpread ?? null,
        render: (row) => formatMoney(row.auctionSourceSpread ?? null),
      },
      {
        id: "auctionSourceCount",
        label: "# Src",
        sortValue: (row) => row.auctionSourceCount ?? null,
        render: (row) => formatInteger(row.auctionSourceCount ?? null),
      },
      {
        id: "auctionUpdatedAt",
        label: "Updated",
        description: "Most recent update found across this player's value sources.",
        sortValue: (row) => row.auctionUpdatedAt || null,
        render: (row) => formatUpdatedAt(row.auctionUpdatedAt),
      },
    ];
  }

  if (view === "draft") {
    return [
      playerColumn,
      {
        id: "adp",
        label: "ADP",
        description: "Average draft position from Fantasy Football Calculator.",
        sortValue: (row) => row.adp,
        render: (row) => row.adpFormatted || formatNumber(row.adp),
      },
      {
        id: "adpRange",
        label: "Pick Range",
        description: "Highest and lowest observed draft position in the current sample.",
        sortValue: (row) => row.adpStdDev,
        render: (row) =>
          row.adpHigh === null || row.adpLow === null
            ? "—"
            : `${formatInteger(row.adpHigh)}–${formatInteger(row.adpLow)}`,
      },
      {
        id: "timesDrafted",
        label: "Drafts",
        sortValue: (row) => row.timesDrafted,
        render: (row) => formatInteger(row.timesDrafted),
      },
      {
        id: "projectedFantasyPoints",
        label: "Proj FPTS",
        sortValue: (row) => row.projectedFantasyPoints,
        render: (row) => formatNumber(row.projectedFantasyPoints),
      },
      {
        id: "projectedFantasyPointsPerGame",
        label: "Proj FPG",
        sortValue: (row) => row.projectedFantasyPointsPerGame,
        render: (row) => formatNumber(row.projectedFantasyPointsPerGame),
      },
      {
        id: "auctionValue",
        label: "Fair Value",
        description: "GameHQ fair value recalculated for the selected scoring and league size.",
        sortValue: (row) => row.auctionValue,
        render: (row) => formatMoney(row.auctionValue),
      },
      {
        id: "projectionSpread",
        label: "Src Δ",
        description: "WinWithOdds projection minus the scoring-adjusted ESPN Clay projection.",
        sortValue: (row) => row.projectionSpread,
        render: (row) => (
          <span className={`stats-hub-delta ${deltaClass(row.projectionSpread ?? 0)}`}>
            {row.projectionSpread === null
              ? "—"
              : `${row.projectionSpread > 0 ? "+" : ""}${row.projectionSpread.toFixed(1)}`}
          </span>
        ),
      },
      {
        id: "bye",
        label: "Bye",
        sortValue: (row) => row.bye,
        render: (row) => formatInteger(row.bye),
      },
    ];
  }

  if (view === "opportunity") {
    return [
      playerColumn,
      {
        id: "games",
        label: "G",
        sortValue: (row) => row.games,
        render: (row) => row.games,
      },
      {
        id: "opportunitiesPerGame",
        label: "Opp/G",
        description: "Carries plus targets per game.",
        sortValue: (row) => row.opportunitiesPerGame,
        render: (row) => formatNumber(row.opportunitiesPerGame),
      },
      {
        id: "carriesPerGame",
        label: "Car/G",
        sortValue: (row) => row.carriesPerGame,
        render: (row) => formatNumber(row.carriesPerGame),
      },
      {
        id: "targetsPerGame",
        label: "Tgt/G",
        sortValue: (row) => row.targetsPerGame,
        render: (row) => formatNumber(row.targetsPerGame),
      },
      {
        id: "receptionsPerGame",
        label: "Rec/G",
        sortValue: (row) => row.receptionsPerGame,
        render: (row) => formatNumber(row.receptionsPerGame),
      },
      {
        id: "targetShare",
        label: "Tgt Share",
        sortValue: (row) => row.targetShare,
        render: (row) => formatPercent(row.targetShare),
      },
      {
        id: "airYardsShare",
        label: "Air Share",
        sortValue: (row) => row.airYardsShare,
        render: (row) => formatPercent(row.airYardsShare),
      },
      {
        id: "wopr",
        label: "WOPR",
        sortValue: (row) => row.wopr,
        render: (row) => formatNumber(row.wopr, 2),
      },
      {
        id: "totalYardsPerGame",
        label: "Yds/G",
        sortValue: (row) => row.totalYardsPerGame,
        render: (row) => formatNumber(row.totalYardsPerGame),
      },
    ];
  }

  if (view === "trends") {
    return [
      playerColumn,
      {
        id: "trendingAdds",
        label: "Adds 24h",
        sortValue: (row) => row.trendingAdds,
        render: (row) => row.trendingAdds ? `+${row.trendingAdds.toLocaleString()}` : "—",
      },
      {
        id: "trendingDrops",
        label: "Drops 24h",
        sortValue: (row) => row.trendingDrops,
        render: (row) => row.trendingDrops ? `-${row.trendingDrops.toLocaleString()}` : "—",
      },
      {
        id: "netTrending",
        label: "Net 24h",
        sortValue: (row) => row.trendingAdds - row.trendingDrops,
        render: (row) => {
          const delta = row.trendingAdds - row.trendingDrops;
          if (delta === 0) return "—";
          return (
            <span className={`stats-hub-delta ${deltaClass(delta)}`}>
              {delta > 0 ? "+" : ""}{delta.toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "projectedFantasyPointsPerGame",
        label: `${DRAFT_SEASON} Proj/G`,
        sortValue: (row) => row.projectedFantasyPointsPerGame,
        render: (row) => formatNumber(row.projectedFantasyPointsPerGame),
      },
      {
        id: "fantasyPointsPerGame",
        label: `${TREND_BASELINE_SEASON} FPG`,
        sortValue: (row) => row.games > 0 ? row.fantasyPointsPerGame : null,
        render: (row) => row.games > 0 ? formatNumber(row.fantasyPointsPerGame) : "—",
      },
      {
        id: "last3FantasyPointsPerGame",
        label: `${TREND_BASELINE_SEASON} Last 3`,
        sortValue: (row) => row.games > 0 ? row.last3FantasyPointsPerGame : null,
        render: (row) => row.games > 0 ? formatNumber(row.last3FantasyPointsPerGame) : "—",
      },
      {
        id: "recentChange",
        label: `${TREND_BASELINE_SEASON} Form Δ`,
        sortValue: (row) => row.games > 0
          ? row.last3FantasyPointsPerGame - row.fantasyPointsPerGame
          : null,
        render: (row) => {
          if (row.games === 0) return "—";
          const delta = row.last3FantasyPointsPerGame - row.fantasyPointsPerGame;
          return (
            <span className={`stats-hub-delta ${deltaClass(delta)}`}>
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}
            </span>
          );
        },
      },
      {
        id: "weeklyTrend",
        label: `${TREND_BASELINE_SEASON} Recent`,
        sortValue: (row) => row.games > 0 ? row.last3FantasyPointsPerGame : null,
        render: (row) => row.games > 0 ? (
          <StatsSparkline
            values={row.weeklyPoints.slice(-8)}
            label={`${row.name} ${TREND_BASELINE_SEASON} fantasy points over the last ${Math.min(row.weeklyPoints.length, 8)} games`}
          />
        ) : "—",
      },
    ];
  }

  return [
    playerColumn,
    {
      id: "positionRank",
      label: "Pos Rk",
      sortValue: (row) => row.positionRank,
      render: (row) => (
        <span className="stats-hub-rank-pill">
          {row.positionRank ? `${row.position}${row.positionRank}` : "—"}
        </span>
      ),
    },
    {
      id: "games",
      label: "G",
      sortValue: (row) => row.games,
      render: (row) => row.games,
    },
    {
      id: "fantasyPoints",
      label: "FPTS",
      sortValue: (row) => row.fantasyPoints,
      render: (row) => formatNumber(row.fantasyPoints),
    },
    {
      id: "fantasyPointsPerGame",
      label: "FPG",
      sortValue: (row) => row.fantasyPointsPerGame,
      render: (row) => formatNumber(row.fantasyPointsPerGame),
    },
    {
      id: "last3FantasyPointsPerGame",
      label: "Last 3",
      sortValue: (row) => row.last3FantasyPointsPerGame,
      render: (row) => formatNumber(row.last3FantasyPointsPerGame),
    },
    {
      id: "last5FantasyPointsPerGame",
      label: "Last 5",
      sortValue: (row) => row.last5FantasyPointsPerGame,
      render: (row) => formatNumber(row.last5FantasyPointsPerGame),
    },
    {
      id: "medianFantasyPoints",
      label: "Median",
      sortValue: (row) => row.medianFantasyPoints,
      render: (row) => formatNumber(row.medianFantasyPoints),
    },
    {
      id: "floorFantasyPoints",
      label: "Floor",
      sortValue: (row) => row.floorFantasyPoints,
      render: (row) => formatNumber(row.floorFantasyPoints),
    },
    {
      id: "ceilingFantasyPoints",
      label: "Ceiling",
      sortValue: (row) => row.ceilingFantasyPoints,
      render: (row) => formatNumber(row.ceilingFantasyPoints),
    },
    {
      id: "weeklyTrend",
      label: "Recent",
      sortValue: (row) => row.last3FantasyPointsPerGame,
      render: (row) => (
        <StatsSparkline
          values={row.weeklyPoints.slice(-8)}
          label={`${row.name} fantasy points over the last ${Math.min(row.weeklyPoints.length, 8)} games`}
        />
      ),
    },
  ];
}

function defenseColumns(): StatsTableColumn<DefenseMatchupRow>[] {
  const pointsColumn = (id: keyof DefenseMatchupRow, label: string): StatsTableColumn<DefenseMatchupRow> => ({
    id,
    label,
    sortValue: (row) => Number(row[id]),
    render: (row) => formatNumber(Number(row[id])),
  });
  return [
    {
      id: "team",
      label: "Defense",
      align: "left",
      sticky: true,
      sortValue: (row) => row.team,
      render: (row) => (
        <span className="stats-hub-player">
          <TeamMark team={row.team} size="xs" />
          <span className="stats-hub-player-copy">
            <strong>{row.team}</strong>
            <small>{row.games} games measured</small>
          </span>
        </span>
      ),
    },
    pointsColumn("overall", "All FPG"),
    pointsColumn("qb", "QB"),
    pointsColumn("rb", "RB"),
    pointsColumn("wr", "WR"),
    pointsColumn("te", "TE"),
    pointsColumn("k", "K"),
    {
      id: "difficultyRank",
      label: "Difficulty",
      sortValue: (row) => row.difficultyRank,
      render: (row) => {
        const tone = row.difficultyRank <= 10 ? "is-tough" : row.difficultyRank >= 23 ? "is-good" : "";
        const label = row.difficultyRank <= 10 ? "Tough" : row.difficultyRank >= 23 ? "Favorable" : "Neutral";
        return <span className={`stats-hub-rating-pill ${tone}`}>{label} · {row.difficultyRank}</span>;
      },
    },
  ];
}

function teamColumns(): StatsTableColumn<TeamSummaryRow>[] {
  return [
    {
      id: "team",
      label: "Team",
      align: "left",
      sticky: true,
      sortValue: (row) => row.team,
      render: (row) => (
        <span className="stats-hub-player">
          <TeamMark team={row.team} size="xs" />
          <span className="stats-hub-player-copy">
            <strong>{row.team}</strong>
            <small>{row.games} games measured</small>
          </span>
        </span>
      ),
    },
    {
      id: "fantasyPointsPerGame",
      label: "Off FPG",
      sortValue: (row) => row.fantasyPointsPerGame,
      render: (row) => formatNumber(row.fantasyPointsPerGame),
    },
    {
      id: "passingYardsPerGame",
      label: "Pass Yds/G",
      sortValue: (row) => row.passingYardsPerGame,
      render: (row) => formatNumber(row.passingYardsPerGame),
    },
    {
      id: "rushingYardsPerGame",
      label: "Rush Yds/G",
      sortValue: (row) => row.rushingYardsPerGame,
      render: (row) => formatNumber(row.rushingYardsPerGame),
    },
    {
      id: "receivingYardsPerGame",
      label: "Rec Yds/G",
      sortValue: (row) => row.receivingYardsPerGame,
      render: (row) => formatNumber(row.receivingYardsPerGame),
    },
    {
      id: "touchdownsPerGame",
      label: "TD/G",
      sortValue: (row) => row.touchdownsPerGame,
      render: (row) => formatNumber(row.touchdownsPerGame, 2),
    },
    {
      id: "topScorer",
      label: "Top Scorer",
      align: "left",
      sortValue: (row) => row.topScorerPoints,
      render: (row) => `${row.topScorer} · ${formatNumber(row.topScorerPoints)} FPG`,
    },
    {
      id: "opponentFantasyPointsAllowed",
      label: "Opp FPG",
      description: "Fantasy points allowed to opposing QB, RB, WR, TE, and K combined.",
      sortValue: (row) => row.opponentFantasyPointsAllowed,
      render: (row) => formatNumber(row.opponentFantasyPointsAllowed),
    },
  ];
}

function compareValues(
  left: number | string | null,
  right: number | string | null,
  direction: StatsSortState["direction"],
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") return (left - right) * multiplier;
  return String(left).localeCompare(String(right), undefined, { numeric: true }) * multiplier;
}

function sortRows<Row extends { id: string }>(
  rows: Row[],
  columns: StatsTableColumn<Row>[],
  sort: StatsSortState,
) {
  const column = columns.find((candidate) => candidate.id === sort.columnId) ?? columns[0];
  if (!column) return rows;
  return [...rows].sort((left, right) => {
    const primary = compareValues(column.sortValue(left), column.sortValue(right), sort.direction);
    return primary || left.id.localeCompare(right.id);
  });
}

function buildDefenseMatchups(rows: WeeklyPlayerStatRow[]): DefenseMatchupRow[] {
  const defenses = new Map<
    string,
    { games: Set<string>; points: Record<"QB" | "RB" | "WR" | "TE" | "K", number> }
  >();

  for (const row of rows) {
    const position = normalizePosition(row.position, row.positionGroup);
    const defense = normalizeTeam(row.opponent);
    if (!position || position === "DEF" || !defense || !OFFENSIVE_POSITIONS.has(position)) continue;
    const current = defenses.get(defense) ?? {
      games: new Set<string>(),
      points: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0 },
    };
    current.games.add(row.gameId || `${row.season}-${row.week}-${row.team}-${defense}`);
    current.points[position as keyof typeof current.points] += row.selectedFantasyPoints;
    defenses.set(defense, current);
  }

  const result = [...defenses.entries()].map(([team, data]) => {
    const games = Math.max(data.games.size, 1);
    const qb = data.points.QB / games;
    const rb = data.points.RB / games;
    const wr = data.points.WR / games;
    const te = data.points.TE / games;
    const k = data.points.K / games;
    return {
      id: team,
      team,
      games,
      overall: qb + rb + wr + te + k,
      qb,
      rb,
      wr,
      te,
      k,
      difficultyRank: 0,
    };
  });

  const ranks = new Map(
    [...result]
      .sort((left, right) => left.overall - right.overall)
      .map((row, index) => [row.id, index + 1]),
  );
  return result.map((row) => ({ ...row, difficultyRank: ranks.get(row.id) ?? 0 }));
}

function buildTeamSummaries(
  rows: WeeklyPlayerStatRow[],
  defenseRows: DefenseMatchupRow[],
): TeamSummaryRow[] {
  const teams = new Map<
    string,
    {
      games: Set<string>;
      fantasyPoints: number;
      passingYards: number;
      rushingYards: number;
      receivingYards: number;
      touchdowns: number;
      playerPoints: Map<string, number>;
      playerGames: Map<string, Set<string>>;
    }
  >();

  for (const row of rows) {
    const position = normalizePosition(row.position, row.positionGroup);
    const team = normalizeTeam(row.team);
    if (!position || !OFFENSIVE_POSITIONS.has(position) || !team) continue;
    const current = teams.get(team) ?? {
      games: new Set<string>(),
      fantasyPoints: 0,
      passingYards: 0,
      rushingYards: 0,
      receivingYards: 0,
      touchdowns: 0,
      playerPoints: new Map<string, number>(),
      playerGames: new Map<string, Set<string>>(),
    };
    const gameKey = row.gameId || `${row.season}-${row.week}-${team}-${row.opponent}`;
    current.games.add(gameKey);
    current.fantasyPoints += row.selectedFantasyPoints;
    current.passingYards += row.stats.passing_yards ?? 0;
    current.rushingYards += row.stats.rushing_yards ?? 0;
    current.receivingYards += row.stats.receiving_yards ?? 0;
    // A passing touchdown appears on both the passer and receiver rows. Count
    // the passer side plus rushing scores so the team total is not doubled.
    current.touchdowns += (row.stats.passing_tds ?? 0) + (row.stats.rushing_tds ?? 0);
    current.playerPoints.set(
      row.playerName,
      (current.playerPoints.get(row.playerName) ?? 0) + row.selectedFantasyPoints,
    );
    const playerGames = current.playerGames.get(row.playerName) ?? new Set<string>();
    playerGames.add(gameKey);
    current.playerGames.set(row.playerName, playerGames);
    teams.set(team, current);
  }

  const defenseMap = new Map(defenseRows.map((row) => [row.team, row.overall]));
  return [...teams.entries()].map(([team, data]) => {
    const games = Math.max(data.games.size, 1);
    const scorer = [...data.playerPoints.entries()]
      .map(([name, points]) => ({
        name,
        pointsPerGame: points / Math.max(data.playerGames.get(name)?.size ?? 0, 1),
      }))
      .sort((left, right) => right.pointsPerGame - left.pointsPerGame)[0];
    return {
      id: team,
      team,
      games,
      fantasyPointsPerGame: data.fantasyPoints / games,
      passingYardsPerGame: data.passingYards / games,
      rushingYardsPerGame: data.rushingYards / games,
      receivingYardsPerGame: data.receivingYards / games,
      touchdownsPerGame: data.touchdowns / games,
      topScorer: scorer?.name ?? "—",
      topScorerPoints: scorer?.pointsPerGame ?? 0,
      opponentFantasyPointsAllowed: defenseMap.get(team) ?? 0,
    };
  });
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function metric(label: string, value: string, helper?: string, tone?: StatsPlayerMetric["tone"]): StatsPlayerMetric {
  return {
    label,
    value,
    ...(helper ? { helper } : {}),
    ...(tone ? { tone } : {}),
  };
}

function playerDetail(
  row: HubPlayerRow,
  scoring: HubScoring,
  season: number,
  teamCount: number,
  rosterSize: number,
  budget: number,
  leagueName?: string,
): StatsPlayerDetail {
  const recentDelta = row.last3FantasyPointsPerGame - row.fantasyPointsPerGame;
  const sources: StatsPlayerSource[] = [{
    name: "nflverse",
    detail: "Regular-season career summaries plus weekly player stats, fantasy scoring, opportunity, and game context.",
    updatedAt: row.summary
      ? `${season} weekly · career through ${NFLVERSE_CAREER_LATEST_SEASON}`
      : `Career through ${NFLVERSE_CAREER_LATEST_SEASON}`,
  }];
  if (row.adpRow) {
    sources.push({
      name: FANTASY_FOOTBALL_CALCULATOR_SOURCE.name,
      detail: FANTASY_FOOTBALL_CALCULATOR_SOURCE.attribution,
      updatedAt: "Daily public ADP",
    });
  }
  if (row.sleeperId) {
    sources.push({
      name: SLEEPER_TRENDING_SOURCE.name,
      detail: `${SLEEPER_TRENDING_SOURCE.attribution} Current status and IDs come from the public player map.`,
      updatedAt: "24-hour trend window",
    });
  }
  if (row.projection?.espnClay) {
    sources.push({
      name: "ESPN Mike Clay projection import",
      detail: "Season projection components recalculated for the selected reception scoring.",
      ...(row.projection.espnClay.updatedAt
        ? { updatedAt: String(row.projection.espnClay.updatedAt) }
        : {}),
    });
  }
  if (row.vegas) {
    sources.push({
      name: "WinWithOdds",
      detail: "Public season-long projection used as a second opinion and disagreement signal.",
      ...(row.vegas.updatedAt ? { updatedAt: String(row.vegas.updatedAt) } : {}),
    });
  }
  if (row.auctionValue !== null) {
    const auctionSourceNames = [
      ...new Set(
        (row.projection?.player.valueSources ?? [])
          .filter((source) => source.includedInConsensus !== false)
          .map((source) => source.source),
      ),
    ];
    sources.push({
      name: "GameHQ auction value model",
      detail: `${leagueName ? `${leagueName}: ` : ""}${teamCount}-team, $${budget}-budget consensus with ${rosterSize} drafted players per team${auctionSourceNames.length ? ` using ${auctionSourceNames.join(", ")}` : ""}. The full league pool is calibrated to spend exactly ${teamCount * budget} dollars.`,
      ...(row.projection?.player.valueUpdatedAt
        ? { updatedAt: String(row.projection.player.valueUpdatedAt) }
        : {}),
    });
  }
  if (!sources.length) {
    sources.push({ name: "GameHQ player pool", detail: "Local player identity and draft metadata." });
  }

  const weeks = buildPlayerGameLog(row.summary?.weeklyRows ?? []);

  return {
    id: row.id,
    name: row.name,
    position: row.position,
    team: row.team,
    ...(row.opponent ? { opponent: row.opponent } : {}),
    ...(row.injuryStatus || row.status ? { status: row.injuryStatus || row.status } : {}),
    summary: row.summary
      ? `${season} weekly results · ${scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase()}`
      : `${DRAFT_SEASON} draft outlook · free market and projection sources`,
    overviewMetrics: [
      metric("Fantasy PPG", formatNumber(row.summary ? row.fantasyPointsPerGame : row.projectedFantasyPointsPerGame)),
      metric("Last 3", row.summary ? formatNumber(row.last3FantasyPointsPerGame) : "—", undefined, deltaClass(recentDelta) === "is-positive" ? "positive" : deltaClass(recentDelta) === "is-negative" ? "negative" : "neutral"),
      metric("Projection", formatNumber(row.projectedFantasyPoints)),
      metric("ADP", row.adpFormatted || formatNumber(row.adp)),
      metric("Fair value", formatMoney(row.auctionValue)),
      metric("Market median", formatMoney(row.marketValue)),
      metric("Floor / ceiling", row.summary ? `${formatNumber(row.floorFantasyPoints)} / ${formatNumber(row.ceilingFantasyPoints)}` : "—"),
    ],
    usageMetrics: [
      metric("Opportunities/G", formatNumber(row.opportunitiesPerGame)),
      metric("Carries/G", formatNumber(row.carriesPerGame)),
      metric("Targets/G", formatNumber(row.targetsPerGame)),
      metric("Receptions/G", formatNumber(row.receptionsPerGame)),
      metric("Target share", formatPercent(row.targetShare)),
      metric("Air-yard share", formatPercent(row.airYardsShare)),
    ],
    weeks,
    sources,
    career: {
      ...(row.summary?.playerId
        ? { playerId: row.summary.playerId }
        : /^00-/.test(row.id)
          ? { playerId: row.id }
          : {}),
      playerName: row.name,
      position: row.position,
      scoring,
    },
  };
}

function parseView(value: string | null): StatsView {
  return ["leaders", "draft", "auction", "opportunity", "trends", "matchups", "teams"].includes(value ?? "")
    ? (value as StatsView)
    : "leaders";
}

function parseScoring(value: string | null): HubScoring {
  return value === "standard" || value === "halfPpr" || value === "ppr" ? value : "ppr";
}

function parseSeasonType(value: string | null): WeeklySeasonType {
  return value === "POST" || value === "ALL" || value === "REG" ? value : "REG";
}

function boundedNumber(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function listedNumber(value: string | null, fallback: number, options: readonly number[]) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && options.includes(parsed) ? parsed : fallback;
}

const ROSTER_SIZE_OPTIONS = [9, 10, 12, 14, 15, 16, 18, 20] as const;

function standardRosterSlots(rosterSize: number): AuctionValueRosterSlot[] {
  const starters: AuctionValueRosterSlot[] = [
    { slot: "QB", count: 1 },
    { slot: "RB", count: 2 },
    { slot: "WR", count: 2 },
    { slot: "TE", count: 1 },
    { slot: "FLEX", count: 1 },
    { slot: "K", count: 1 },
    { slot: "DEF", count: 1 },
  ];
  const bench = Math.max(0, rosterSize - 9);
  return bench ? [...starters, { slot: "BENCH", count: bench }] : starters;
}

export default function StatsExplorer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { connections, activeLeagueId, setActiveLeagueId } = useSleeperLeagueConnections();
  const view = parseView(searchParams.get("view"));
  const valueView = view === "draft" || view === "auction";
  const customScoring = parseScoring(searchParams.get("scoring"));
  const seasonType = parseSeasonType(searchParams.get("games"));
  const season = boundedNumber(
    searchParams.get("season"),
    ACTUAL_SEASONS[0],
    ACTUAL_SEASONS[ACTUAL_SEASONS.length - 1]!,
    ACTUAL_SEASONS[0],
  );
  const weeklySeason = view === "trends" ? TREND_BASELINE_SEASON : season;
  const weekStart = boundedNumber(searchParams.get("from"), 1, 1, 22);
  const weekEnd = boundedNumber(searchParams.get("to"), 18, 1, 22);
  const customTeamCount = listedNumber(searchParams.get("teams"), 12, TEAM_COUNT_OPTIONS);
  const customRosterSize = listedNumber(searchParams.get("roster"), 15, ROSTER_SIZE_OPTIONS);
  const customBudget = boundedNumber(searchParams.get("budget"), 200, 1, 1000);
  const requestedValueProfile = searchParams.get("league");
  const connectedValueProfiles = useMemo(
    () => connections.filter((connection) => connection.auctionSettings),
    [connections],
  );
  const activeValueConnection = useMemo(
    () => valueView
      ? connectedValueProfiles.find((connection) => connection.leagueId === requestedValueProfile)
        ?? (requestedValueProfile === null
          ? connectedValueProfiles.find((connection) => connection.leagueId === activeLeagueId)
            ?? connectedValueProfiles[0]
          : undefined)
      : undefined,
    [activeLeagueId, connectedValueProfiles, requestedValueProfile, valueView],
  );
  const activeValueSettings = activeValueConnection?.auctionSettings;
  const activeValueLeagueName = activeValueConnection?.leagueName ?? "";
  const scoring = activeValueSettings
    ? normalizeAuctionValueScoring(activeValueSettings.scoring)
    : customScoring;
  const teamCount = activeValueSettings
    ? Math.max(1, Math.round(Number(activeValueSettings.teamCount)))
    : customTeamCount;
  const rosterSize = activeValueSettings
    ? Math.max(1, Math.round(Number(activeValueSettings.rosterSize)))
    : customRosterSize;
  const budget = activeValueSettings
    ? Math.max(1, Math.round(Number(activeValueSettings.budget)))
    : customBudget;
  const rosterSlotsKey = activeValueSettings
    ? normalizeAuctionValueRosterSlots(activeValueSettings.rosterSlots)
        .map((slot) => `${slot.slot}:${slot.count}`)
        .join(",")
    : "";
  const rosterSlots = useMemo(
    () => rosterSlotsKey
      ? rosterSlotsKey.split(",").map((entry) => {
          const [slot, count] = entry.split(":");
          return { slot: slot ?? "BENCH", count: Number(count) || 0 };
        })
      : standardRosterSlots(rosterSize),
    [rosterSize, rosterSlotsKey],
  );
  const rowLimit = listedNumber(searchParams.get("rows"), 50, ROW_LIMIT_OPTIONS);
  const search = searchParams.get("q") ?? "";
  const requestedPosition = (searchParams.get("position") ?? "ALL").toUpperCase();
  const positionFilter: PositionFilter =
    POSITION_FILTERS.has(requestedPosition as PositionFilter)
      ? (requestedPosition as PositionFilter)
      : "ALL";
  const requestedTeamFilter = normalizeTeam(searchParams.get("team") ?? "ALL") || "ALL";

  const [weeklyData, setWeeklyData] = useState<WeeklyPlayerStatsResult | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [adpResult, setAdpResult] = useState<FfcAdpResult | null>(null);
  const [adpLoading, setAdpLoading] = useState(true);
  const [adpError, setAdpError] = useState<string | null>(null);
  const [sleeperSignals, setSleeperSignals] = useState<SleeperTrendingSignal[]>([]);
  const [sleeperLoading, setSleeperLoading] = useState(true);
  const [sleeperError, setSleeperError] = useState<string | null>(null);
  const [sleeperDraftId, setSleeperDraftId] = useState("");
  const [sleeperAuction, setSleeperAuction] = useState<SleeperAuctionDraftResult | null>(null);
  const [sleeperAuctionImportedAt, setSleeperAuctionImportedAt] = useState("");
  const [sleeperAuctionLoading, setSleeperAuctionLoading] = useState(false);
  const [sleeperAuctionError, setSleeperAuctionError] = useState<string | null>(null);
  const [sleeperDirectory, setSleeperDirectory] = useState<SleeperPlayerRow[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [sort, setSort] = useState<StatsSortState>(() => DEFAULT_SORTS[view]);

  const playerPool = useMemo(
    () => loadPlayerPool({ scoring, teamCount, rosterSize, rosterSlots, budget }),
    [budget, rosterSize, rosterSlots, scoring, teamCount],
  );
  const projectionRows = useMemo(
    () => buildPlayerStatRows(playerPool, [], sleeperDirectory),
    [playerPool, sleeperDirectory],
  );

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  function updateCustomValueSettings(updates: Record<string, string | null>) {
    updateQuery({
      league: "custom",
      scoring: scoring === "ppr" ? null : scoring,
      teams: teamCount === 12 ? null : String(teamCount),
      roster: rosterSize === 15 ? null : String(rosterSize),
      budget: budget === 200 ? null : String(budget),
      ...updates,
    });
  }

  async function importSleeperAuction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSleeperAuctionLoading(true);
    setSleeperAuctionError(null);
    try {
      const result = await loadSleeperAuctionDraft(sleeperDraftId);
      setSleeperAuction(result);
      setSleeperAuctionImportedAt(new Date().toISOString());
    } catch (error: unknown) {
      setSleeperAuctionError(error instanceof Error ? error.message : String(error));
    } finally {
      setSleeperAuctionLoading(false);
    }
  }

  function changeView(nextView: StatsView) {
    updateQuery({
      view: nextView === "leaders" ? null : nextView,
      position: searchParams.get("position"),
    });
    setSelectedPlayerId(null);
  }

  useEffect(() => {
    setSort(DEFAULT_SORTS[view]);
    setSelectedPlayerId(null);
  }, [view]);

  useEffect(() => {
    let active = true;
    loadSleeperPlayerDirectory()
      .then((rows) => {
        if (active) setSleeperDirectory(rows);
      })
      .catch(() => {
        if (active) setSleeperDirectory([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setWeeklyLoading(true);
    setWeeklyError(null);
    setWeeklyData(null);
    loadWeeklyPlayerStats({
      seasons: [weeklySeason],
      seasonType,
      scoring,
      weekStart,
      weekEnd,
      signal: controller.signal,
    })
      .then((result) => {
        setWeeklyData(result);
        if (result.unavailableSeasons.includes(weeklySeason)) {
          setWeeklyError(`Weekly stats for ${weeklySeason} are temporarily unavailable.`);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWeeklyData(null);
        setWeeklyError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeeklyLoading(false);
      });
    return () => controller.abort();
  }, [scoring, seasonType, weekEnd, weekStart, weeklySeason]);

  useEffect(() => {
    const controller = new AbortController();
    setAdpLoading(true);
    setAdpError(null);
    setAdpResult(null);
    loadFfcAdp({
      scoring: scoring === "halfPpr" ? "half" : scoring,
      year: DRAFT_SEASON,
      teams: teamCount,
      signal: controller.signal,
      baseUrl: FFC_ADP_BASE_URL,
    })
      .then(setAdpResult)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAdpResult(null);
        setAdpError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setAdpLoading(false);
      });
    return () => controller.abort();
  }, [scoring, teamCount]);

  useEffect(() => {
    const controller = new AbortController();
    setSleeperLoading(true);
    setSleeperError(null);
    Promise.all([
      loadSleeperTrending({ type: "add", lookbackHours: 24, limit: 100, signal: controller.signal }),
      loadSleeperTrending({ type: "drop", lookbackHours: 24, limit: 100, signal: controller.signal }),
    ])
      .then(([adds, drops]) => setSleeperSignals([...adds, ...drops]))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSleeperSignals([]);
        setSleeperError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSleeperLoading(false);
      });
    return () => controller.abort();
  }, []);

  const projectionMap = useMemo(
    () => new Map(projectionRows.map((row) => [playerKey(row.player.name, row.player.pos), row])),
    [projectionRows],
  );
  const summaryMap = useMemo(
    () => new Map((weeklyData?.summaries ?? []).map((summary) => [playerKey(summary.playerName, summary.position), summary])),
    [weeklyData],
  );
  const adpMap = useMemo(
    () => new Map((adpResult?.players ?? []).map((row) => [playerKey(row.name, row.position), row])),
    [adpResult],
  );
  const adpDefenseMap = useMemo(
    () =>
      new Map(
        (adpResult?.players ?? [])
          .filter((row) => row.position === "DEF")
          .map((row) => [normalizeTeam(row.team), row]),
      ),
    [adpResult],
  );
  const addsMap = useMemo(
    () => trendMap(sleeperSignals.filter((signal) => signal.type === "add")),
    [sleeperSignals],
  );
  const dropsMap = useMemo(
    () => trendMap(sleeperSignals.filter((signal) => signal.type === "drop")),
    [sleeperSignals],
  );
  const sleeperAuctionPriceMap = useMemo(() => {
    const prices = new Map<string, number>();
    if (!sleeperAuction) return prices;
    const budgetScale = 200 / (sleeperAuction.budget ?? 200);
    for (const price of sleeperAuction.prices) {
      const normalizedPrice = price.amount * budgetScale;
      prices.set(`sleeper:${price.playerId}`, normalizedPrice);
      prices.set(`player:${playerKey(price.name, price.position)}`, normalizedPrice);
    }
    return prices;
  }, [sleeperAuction]);

  const actualPlayerRows = useMemo(() => {
    const rows = (weeklyData?.summaries ?? []).flatMap((summary): HubPlayerRow[] => {
      const position = normalizePosition(summary.position, summary.positionGroup);
      if (!position || position === "DEF") return [];
      const projection = projectionMap.get(playerKey(summary.playerName, position)) ?? null;
      const adpRow = adpMap.get(playerKey(summary.playerName, position)) ?? null;
      const vegas = (projection?.winWithOdds as WinWithOddsProjection | undefined) ?? null;
      const projections = projectionMetrics(projection, vegas, scoring);
      const sleeperId = String(projection?.sleeper?.playerId ?? "");
      const games = summary.games;
      return [{
        id: summary.playerId,
        name: summary.playerName,
        position,
        team: normalizeTeam(summary.latestTeam),
        opponent: normalizeTeam(summary.latestOpponent),
        status: String(projection?.sleeper?.status ?? ""),
        injuryStatus: String(projection?.sleeper?.injuryStatus ?? ""),
        sleeperId,
        positionRank: null,
        overallRank: numberValue(projection?.player.rank),
        bye: numberValue(projection?.player.byeWeek ?? adpRow?.bye),
        games,
        fantasyPoints: summary.selectedFantasyPoints,
        fantasyPointsPerGame: summary.selectedFantasyPointsPerGame,
        last3FantasyPointsPerGame: summary.last3FantasyPointsPerGame,
        last5FantasyPointsPerGame: summary.last5FantasyPointsPerGame,
        medianFantasyPoints: summary.medianFantasyPoints,
        floorFantasyPoints: summary.floorFantasyPoints,
        ceilingFantasyPoints: summary.ceilingFantasyPoints,
        standardDeviation: summary.fantasyPointsStandardDeviation,
        carriesPerGame: perGame(summary.totals.carries, games),
        targetsPerGame: perGame(summary.totals.targets, games),
        receptionsPerGame: perGame(summary.totals.receptions, games),
        opportunitiesPerGame: perGame(summary.totals.carries + summary.totals.targets, games),
        totalYardsPerGame: perGame(
          summary.totals.passingYards + summary.totals.rushingYards + summary.totals.receivingYards,
          games,
        ),
        targetShare: summary.averageMetrics.targetShare,
        airYardsShare: summary.averageMetrics.airYardsShare,
        wopr: summary.averageMetrics.wopr,
        projectedFantasyPoints: projections.fantasyPoints,
        projectedFantasyPointsPerGame: projections.fantasyPointsPerGame,
        auctionValue: numberValue(projection?.player.auctionValue ?? projection?.player.projectedValue),
        marketValue: numberValue(projection?.player.marketValue),
        projectionSpread: projections.spread,
        adp: adpRow?.adp ?? null,
        adpFormatted: adpRow?.formatted ?? "",
        adpHigh: adpRow?.high ?? null,
        adpLow: adpRow?.low ?? null,
        adpStdDev: adpRow?.stdev ?? null,
        timesDrafted: adpRow?.times_drafted ?? null,
        trendingAdds: addsMap.get(sleeperId) ?? 0,
        trendingDrops: dropsMap.get(sleeperId) ?? 0,
        weeklyPoints: summary.weeklyRows.map((week) => week.selectedFantasyPoints),
        summary,
        projection,
        adpRow,
        vegas,
      }];
    });
    return withPositionRanks(rows, (row) => row.fantasyPoints);
  }, [addsMap, adpMap, dropsMap, projectionMap, scoring, weeklyData]);

  const draftPlayerRows = useMemo(() => {
    const rows = projectionRows.flatMap((projection): HubPlayerRow[] => {
      const position = normalizePosition(projection.player.pos);
      if (!position) return [];
      const adpRow = adpMap.get(playerKey(projection.player.name, position)) ?? null;
      const summary = summaryMap.get(playerKey(projection.player.name, position)) ?? null;
      const vegas = (projection.winWithOdds as WinWithOddsProjection | undefined) ?? null;
      const projections = projectionMetrics(projection, vegas, scoring);
      const sleeperId = String(projection.sleeper?.playerId ?? "");
      const games = summary?.games ?? 0;
      return [{
        id: projection.player.id,
        name: projection.player.name,
        position,
        team: normalizeTeam(projection.player.nflTeam),
        opponent: summary ? normalizeTeam(summary.latestOpponent) : "",
        status: String(projection.sleeper?.status ?? ""),
        injuryStatus: String(projection.sleeper?.injuryStatus ?? ""),
        sleeperId,
        positionRank: null,
        overallRank: numberValue(projection.player.rank),
        bye: numberValue(projection.player.byeWeek ?? adpRow?.bye),
        games,
        fantasyPoints: summary?.selectedFantasyPoints ?? 0,
        fantasyPointsPerGame: summary?.selectedFantasyPointsPerGame ?? 0,
        last3FantasyPointsPerGame: summary?.last3FantasyPointsPerGame ?? 0,
        last5FantasyPointsPerGame: summary?.last5FantasyPointsPerGame ?? 0,
        medianFantasyPoints: summary?.medianFantasyPoints ?? 0,
        floorFantasyPoints: summary?.floorFantasyPoints ?? 0,
        ceilingFantasyPoints: summary?.ceilingFantasyPoints ?? 0,
        standardDeviation: summary?.fantasyPointsStandardDeviation ?? 0,
        carriesPerGame: summary ? perGame(summary.totals.carries, games) : 0,
        targetsPerGame: summary ? perGame(summary.totals.targets, games) : 0,
        receptionsPerGame: summary ? perGame(summary.totals.receptions, games) : 0,
        opportunitiesPerGame: summary ? perGame(summary.totals.carries + summary.totals.targets, games) : 0,
        totalYardsPerGame: summary
          ? perGame(
              summary.totals.passingYards + summary.totals.rushingYards + summary.totals.receivingYards,
              games,
            )
          : 0,
        targetShare: summary?.averageMetrics.targetShare ?? null,
        airYardsShare: summary?.averageMetrics.airYardsShare ?? null,
        wopr: summary?.averageMetrics.wopr ?? null,
        projectedFantasyPoints: projections.fantasyPoints,
        projectedFantasyPointsPerGame: projections.fantasyPointsPerGame,
        auctionValue: numberValue(projection.player.auctionValue ?? projection.player.projectedValue),
        marketValue: numberValue(projection.player.marketValue),
        projectionSpread: projections.spread,
        adp: adpRow?.adp ?? null,
        adpFormatted: adpRow?.formatted ?? "",
        adpHigh: adpRow?.high ?? null,
        adpLow: adpRow?.low ?? null,
        adpStdDev: adpRow?.stdev ?? null,
        timesDrafted: adpRow?.times_drafted ?? null,
        trendingAdds: addsMap.get(sleeperId) ?? 0,
        trendingDrops: dropsMap.get(sleeperId) ?? 0,
        weeklyPoints: summary?.weeklyRows.map((week) => week.selectedFantasyPoints) ?? [],
        summary,
        projection,
        adpRow,
        vegas,
      }];
    });

    const existingDefenseTeams = new Set(rows.filter((row) => row.position === "DEF").map((row) => row.team));
    for (const vegas of WIN_WITH_ODDS_ROWS.filter((row) => String(row.pos).toUpperCase() === "DEF")) {
      const team = normalizeTeam(String(vegas.name ?? ""));
      if (!team || existingDefenseTeams.has(team)) continue;
      const adpRow = adpDefenseMap.get(team) ?? null;
      const projectedPoints = numberValue(vegas.projectedPoints);
      rows.push({
        id: String(vegas.id ?? `2026-DEF-${team}`),
        name: `${team} D/ST`,
        position: "DEF",
        team,
        opponent: "",
        status: "Active",
        injuryStatus: "",
        sleeperId: "",
        positionRank: null,
        overallRank: numberValue(vegas.rank),
        bye: adpRow?.bye ?? null,
        games: 0,
        fantasyPoints: 0,
        fantasyPointsPerGame: 0,
        last3FantasyPointsPerGame: 0,
        last5FantasyPointsPerGame: 0,
        medianFantasyPoints: 0,
        floorFantasyPoints: 0,
        ceilingFantasyPoints: 0,
        standardDeviation: 0,
        carriesPerGame: 0,
        targetsPerGame: 0,
        receptionsPerGame: 0,
        opportunitiesPerGame: 0,
        totalYardsPerGame: 0,
        targetShare: null,
        airYardsShare: null,
        wopr: null,
        projectedFantasyPoints: projectedPoints,
        projectedFantasyPointsPerGame: projectedPoints === null ? null : projectedPoints / 17,
        auctionValue: null,
        marketValue: null,
        projectionSpread: null,
        adp: adpRow?.adp ?? null,
        adpFormatted: adpRow?.formatted ?? "",
        adpHigh: adpRow?.high ?? null,
        adpLow: adpRow?.low ?? null,
        adpStdDev: adpRow?.stdev ?? null,
        timesDrafted: adpRow?.times_drafted ?? null,
        trendingAdds: 0,
        trendingDrops: 0,
        weeklyPoints: [],
        summary: null,
        projection: null,
        adpRow,
        vegas,
      });
    }
    return withPositionRanks(rows, (row) => row.projectedFantasyPoints);
  }, [addsMap, adpDefenseMap, adpMap, dropsMap, projectionRows, scoring, summaryMap]);

  const auctionPlayerRows = useMemo(() => {
    const rows = draftPlayerRows.map((row) => {
      const sleeperPaid =
        (row.sleeperId ? sleeperAuctionPriceMap.get(`sleeper:${row.sleeperId}`) : undefined) ??
        sleeperAuctionPriceMap.get(`player:${playerKey(row.name, row.position)}`) ??
        null;
      const valueSources = row.projection?.player.valueSources ?? [];
      return {
        ...row,
        ...auctionMetrics(
          valueSources,
          sleeperPaid,
          sleeperPaid !== null
            ? sleeperAuctionImportedAt
            : row.projection?.player.valueUpdatedAt,
        ),
      };
    });
    return withPositionRanks(rows, (row) => row.auctionValue);
  }, [draftPlayerRows, sleeperAuctionImportedAt, sleeperAuctionPriceMap]);

  const playerRows = view === "draft"
    ? draftPlayerRows
    : view === "auction"
      ? auctionPlayerRows
      : view === "trends"
        ? draftPlayerRows
        : actualPlayerRows;
  const teams = useMemo(
    () => ["ALL", ...new Set(playerRows.map((row) => row.team).filter(Boolean))].sort(),
    [playerRows],
  );
  const teamFilter = requestedTeamFilter === "ALL" || teams.includes(requestedTeamFilter)
    ? requestedTeamFilter
    : "ALL";
  const filteredPlayerRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return playerRows.filter((row) => {
      const positionMatches = matchesPositionFilter(row.position, positionFilter);
      const teamMatches = teamFilter === "ALL" || row.team === teamFilter;
      const searchMatches =
        !needle || `${row.name} ${row.position} ${row.team} ${row.status}`.toLowerCase().includes(needle);
      return positionMatches && teamMatches && searchMatches;
    });
  }, [playerRows, positionFilter, search, teamFilter]);

  const defenseRows = useMemo(() => buildDefenseMatchups(weeklyData?.rows ?? []), [weeklyData]);
  const filteredDefenseRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return defenseRows.filter((row) => !needle || row.team.toLowerCase().includes(needle));
  }, [defenseRows, search]);
  const teamRows = useMemo(
    () => buildTeamSummaries(weeklyData?.rows ?? [], defenseRows),
    [defenseRows, weeklyData],
  );
  const filteredTeamRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return teamRows.filter(
      (row) => !needle || `${row.team} ${row.topScorer}`.toLowerCase().includes(needle),
    );
  }, [search, teamRows]);

  const currentPlayerColumns = useMemo(() => playerColumns(view), [view]);
  const currentDefenseColumns = useMemo(() => defenseColumns(), []);
  const currentTeamColumns = useMemo(() => teamColumns(), []);
  const sortedPlayerRows = useMemo(
    () => sortRows(filteredPlayerRows, currentPlayerColumns, sort),
    [currentPlayerColumns, filteredPlayerRows, sort],
  );
  const sortedDefenseRows = useMemo(
    () => sortRows(filteredDefenseRows, currentDefenseColumns, sort),
    [currentDefenseColumns, filteredDefenseRows, sort],
  );
  const sortedTeamRows = useMemo(
    () => sortRows(filteredTeamRows, currentTeamColumns, sort),
    [currentTeamColumns, filteredTeamRows, sort],
  );

  const cards = useMemo<SummaryCard[]>(() => {
    if (view === "auction") {
      const topValue = [...filteredPlayerRows].sort(
        (left, right) => (right.auctionValue ?? 0) - (left.auctionValue ?? 0),
      )[0];
      const coveredSources = AUCTION_VALUE_SOURCE_COLUMNS.filter((source) =>
        filteredPlayerRows.some((row) => row.auctionSourceValues?.[source.id] !== null),
      ).length;
      const sleeperMatches = filteredPlayerRows.filter(
        (row) => row.auctionSourceValues?.["sleeper-paid"] !== null,
      ).length;
      return [
        {
          label: "Top GameHQ value",
          value: topValue ? formatMoney(topValue.auctionValue) : "—",
          helper: topValue?.name ?? "No value",
        },
        {
          label: "Available sources",
          value: `${coveredSources}/${AUCTION_VALUE_SOURCE_COLUMNS.length}`,
          helper: "Public, licensed, or user-imported",
        },
        {
          label: "Sleeper matches",
          value: sleeperAuction ? `${sleeperMatches}/${sleeperAuction.prices.length}` : "—",
          helper: sleeperAuction ? `Draft ${sleeperAuction.draftId}` : "Import a completed auction",
        },
        {
          label: "League model",
          value: `${teamCount} teams`,
          helper: `$200 · 15 players · ${scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase()}`,
        },
      ];
    }
    if (view === "trends") {
      const mostAdded = [...filteredPlayerRows].sort(
        (left, right) => right.trendingAdds - left.trendingAdds,
      )[0];
      const mostDropped = [...filteredPlayerRows].sort(
        (left, right) => right.trendingDrops - left.trendingDrops,
      )[0];
      const netRiser = [...filteredPlayerRows].sort(
        (left, right) =>
          (right.trendingAdds - right.trendingDrops) -
          (left.trendingAdds - left.trendingDrops),
      )[0];
      const netRiserValue = netRiser ? netRiser.trendingAdds - netRiser.trendingDrops : 0;
      return [
        {
          label: `${DRAFT_SEASON} players`,
          value: filteredPlayerRows.length.toLocaleString(),
          helper: "Current projection and roster pool",
        },
        {
          label: "Most added",
          value: mostAdded?.trendingAdds ? mostAdded.name : "—",
          helper: mostAdded?.trendingAdds ? `+${mostAdded.trendingAdds.toLocaleString()} in 24h` : "No live adds",
        },
        {
          label: "Most dropped",
          value: mostDropped?.trendingDrops ? mostDropped.name : "—",
          helper: mostDropped?.trendingDrops ? `-${mostDropped.trendingDrops.toLocaleString()} in 24h` : "No live drops",
        },
        {
          label: "Top net riser",
          value: netRiserValue > 0 ? netRiser?.name ?? "—" : "—",
          helper: netRiserValue > 0 ? `+${netRiserValue.toLocaleString()} net in 24h` : "No positive net movement",
        },
      ];
    }
    if (view === "draft") {
      const topProjection = [...filteredPlayerRows].sort(
        (left, right) => (right.projectedFantasyPoints ?? 0) - (left.projectedFantasyPoints ?? 0),
      )[0];
      const totalDrafts = numberValue(adpResult?.meta.total_drafts);
      return [
        { label: "ADP sample", value: formatInteger(totalDrafts), helper: `${teamCount}-team ${scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase()}` },
        { label: "Players", value: filteredPlayerRows.length.toLocaleString(), helper: "Projection and market pool" },
        { label: "Top projection", value: topProjection?.name ?? "—", helper: topProjection ? `${formatNumber(topProjection.projectedFantasyPoints)} points` : "No projection" },
        { label: "Fair-value coverage", value: filteredPlayerRows.filter((row) => row.auctionValue !== null).length.toLocaleString(), helper: `${teamCount}-team ${scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase()}` },
      ];
    }
    if (view === "matchups") {
      const toughest = [...filteredDefenseRows].sort((left, right) => left.overall - right.overall)[0];
      const easiest = [...filteredDefenseRows].sort((left, right) => right.overall - left.overall)[0];
      return [
        { label: "Defenses", value: filteredDefenseRows.length.toLocaleString(), helper: "With selected-range data" },
        { label: "Toughest", value: toughest?.team ?? "—", helper: toughest ? `${formatNumber(toughest.overall)} FPG allowed` : "No data" },
        { label: "Most favorable", value: easiest?.team ?? "—", helper: easiest ? `${formatNumber(easiest.overall)} FPG allowed` : "No data" },
        { label: "Scoring", value: scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase(), helper: `Weeks ${Math.min(weekStart, weekEnd)}–${Math.max(weekStart, weekEnd)}` },
      ];
    }
    if (view === "teams") {
      const topTeam = [...filteredTeamRows].sort(
        (left, right) => right.fantasyPointsPerGame - left.fantasyPointsPerGame,
      )[0];
      return [
        { label: "Teams", value: filteredTeamRows.length.toLocaleString(), helper: "Offensive production" },
        { label: "Top offense", value: topTeam?.team ?? "—", helper: topTeam ? `${formatNumber(topTeam.fantasyPointsPerGame)} FPG` : "No data" },
        { label: "Top scorer", value: topTeam?.topScorer ?? "—", helper: topTeam ? `${formatNumber(topTeam.topScorerPoints)} FPG` : "No data" },
        { label: "Range", value: `${Math.min(weekStart, weekEnd)}–${Math.max(weekStart, weekEnd)}`, helper: `${season} ${seasonType === "REG" ? "regular season" : seasonType === "POST" ? "postseason" : "all games"}` },
      ];
    }

    const top = [...filteredPlayerRows].sort(
      (left, right) => right.fantasyPointsPerGame - left.fantasyPointsPerGame,
    )[0];
    const riser = [...filteredPlayerRows].sort(
      (left, right) =>
        right.last3FantasyPointsPerGame - right.fantasyPointsPerGame -
        (left.last3FantasyPointsPerGame - left.fantasyPointsPerGame),
    )[0];
    const opportunityLeader = [...filteredPlayerRows].sort(
      (left, right) => right.opportunitiesPerGame - left.opportunitiesPerGame,
    )[0];
    return [
      { label: "Players", value: filteredPlayerRows.length.toLocaleString(), helper: `${season} selected range` },
      { label: "Scoring leader", value: top?.name ?? "—", helper: top ? `${formatNumber(top.fantasyPointsPerGame)} FPG` : "No data" },
      { label: "Rising form", value: riser?.name ?? "—", helper: riser ? `${riser.last3FantasyPointsPerGame - riser.fantasyPointsPerGame >= 0 ? "+" : ""}${formatNumber(riser.last3FantasyPointsPerGame - riser.fantasyPointsPerGame)} vs season` : "No data" },
      { label: "Usage leader", value: opportunityLeader?.name ?? "—", helper: opportunityLeader ? `${formatNumber(opportunityLeader.opportunitiesPerGame)} opportunities/G` : "No data" },
    ];
  }, [adpResult, filteredDefenseRows, filteredPlayerRows, filteredTeamRows, scoring, season, seasonType, sleeperAuction, teamCount, view, weekEnd, weekStart]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    const row = playerRows.find((candidate) => candidate.id === selectedPlayerId);
    return row
      ? playerDetail(
          row,
          scoring,
          weeklySeason,
          teamCount,
          rosterSize,
          budget,
          activeValueLeagueName,
        )
      : null;
  }, [activeValueLeagueName, budget, playerRows, rosterSize, scoring, selectedPlayerId, teamCount, weeklySeason]);
  const closePlayer = useCallback(() => setSelectedPlayerId(null), [setSelectedPlayerId]);

  const viewResultCount =
    view === "matchups"
      ? filteredDefenseRows.length
      : view === "teams"
        ? filteredTeamRows.length
        : filteredPlayerRows.length;
  const viewIsLoading = view === "draft"
    ? adpLoading
    : view === "auction"
      ? false
      : view === "trends"
        ? sleeperLoading
        : weeklyLoading;

  function exportCurrentView() {
    if (view === "matchups") {
      downloadCsv(
        `gamehq-${season}-defense-vs-position.csv`,
        ["Defense", "Games", "All FPG", "QB", "RB", "WR", "TE", "K", "Difficulty Rank"],
        filteredDefenseRows.map((row) => [row.team, row.games, row.overall, row.qb, row.rb, row.wr, row.te, row.k, row.difficultyRank]),
      );
      return;
    }
    if (view === "trends") {
      downloadCsv(
        `ffaa-${DRAFT_SEASON}-live-trends.csv`,
        [
          "Player",
          "Position",
          `${DRAFT_SEASON} Team`,
          "Adds 24h",
          "Drops 24h",
          "Net 24h",
          `${DRAFT_SEASON} Projected FPG`,
          `${TREND_BASELINE_SEASON} Games`,
          `${TREND_BASELINE_SEASON} FPG`,
          `${TREND_BASELINE_SEASON} Last 3 FPG`,
          `${TREND_BASELINE_SEASON} Form Delta`,
        ],
        filteredPlayerRows.map((row) => [
          row.name,
          row.position,
          row.team,
          row.trendingAdds,
          row.trendingDrops,
          row.trendingAdds - row.trendingDrops,
          row.projectedFantasyPointsPerGame ?? "",
          row.games,
          row.games > 0 ? row.fantasyPointsPerGame : "",
          row.games > 0 ? row.last3FantasyPointsPerGame : "",
          row.games > 0 ? row.last3FantasyPointsPerGame - row.fantasyPointsPerGame : "",
        ]),
      );
      return;
    }
    if (view === "auction") {
      downloadCsv(
        `gamehq-${DRAFT_SEASON}-auction-values-${teamCount}-team-${scoring}.csv`,
        [
          "Player",
          "Position",
          "Team",
          "GameHQ Fair Value",
          "Market Median",
          ...AUCTION_VALUE_SOURCE_COLUMNS.map((source) => source.label),
          "Source Average",
          "Source Low",
          "Source High",
          "Source Spread",
          "Source Count",
          "Updated",
        ],
        filteredPlayerRows.map((row) => [
          row.name,
          row.position,
          row.team,
          row.auctionValue ?? "",
          row.marketValue ?? "",
          ...AUCTION_VALUE_SOURCE_COLUMNS.map(
            (source) => row.auctionSourceValues?.[source.id] ?? "",
          ),
          row.auctionSourceAverage ?? "",
          row.auctionSourceLow ?? "",
          row.auctionSourceHigh ?? "",
          row.auctionSourceSpread ?? "",
          row.auctionSourceCount ?? 0,
          row.auctionUpdatedAt ?? "",
        ]),
      );
      return;
    }
    if (view === "teams") {
      downloadCsv(
        `gamehq-${season}-team-stats.csv`,
        ["Team", "Games", "Offensive FPG", "Pass Yards/G", "Rush Yards/G", "Receiving Yards/G", "TD/G", "Top Scorer", "Opponent FPG Allowed"],
        filteredTeamRows.map((row) => [row.team, row.games, row.fantasyPointsPerGame, row.passingYardsPerGame, row.rushingYardsPerGame, row.receivingYardsPerGame, row.touchdownsPerGame, row.topScorer, row.opponentFantasyPointsAllowed]),
      );
      return;
    }
    downloadCsv(
      `gamehq-${view}-${view === "draft" ? DRAFT_SEASON : season}.csv`,
      ["Player", "Position", "Team", "Games", "Fantasy Points", "FPG", "Last 3", "Last 5", "Floor", "Ceiling", "Opportunities/G", "Target Share", "ADP", "ADP High", "ADP Low", "Times Drafted", "Projected Points", "GameHQ Fair Value", "Market Median", "Bye"],
      filteredPlayerRows.map((row) => [row.name, row.position, row.team, row.games, row.fantasyPoints, row.fantasyPointsPerGame, row.last3FantasyPointsPerGame, row.last5FantasyPointsPerGame, row.floorFantasyPoints, row.ceilingFantasyPoints, row.opportunitiesPerGame, row.targetShare ?? "", row.adp ?? "", row.adpHigh ?? "", row.adpLow ?? "", row.timesDrafted ?? "", row.projectedFantasyPoints ?? "", row.auctionValue ?? "", row.marketValue ?? "", row.bye ?? ""]),
    );
  }

  const actualViews = ["leaders", "opportunity", "matchups", "teams"].includes(view);
  const playerView = !["matchups", "teams"].includes(view);
  const viewCopy = VIEW_COPY[view];

  return (
    <section className="stats-explorer stats-hub">
      <div className="stats-hero">
        <div className="stats-hub-hero-copy">
          <div className="stats-kicker">Free fantasy football research</div>
          <h1 className="stats-title ff-display">Stats Hub</h1>
          <p className="stats-hub-subtitle">
            Draft prep, weekly leaders, opportunity, trends, matchups, and team context in one public place—no subscription required.
          </p>
          <div className="stats-meta-line">
            <span>{view === "trends" ? `${DRAFT_SEASON} live trends` : actualViews ? `${season} actuals` : `${DRAFT_SEASON} draft data`}</span>
            <span>{scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase()}</span>
            <span>{viewResultCount} results</span>
          </div>
        </div>
        <div className="stats-hub-free-badge">
          <ShieldCheck size={28} aria-hidden="true" />
          <strong>Free for everyone</strong>
          <span>Public data · clear attribution</span>
        </div>
      </div>

      <StatsViewTabs value={view} onChange={changeView} />

      <div className="stats-hub-source-strip" aria-label="Active data sources">
        <div className="stats-hub-source">
          <Database size={18} aria-hidden="true" />
          <div>
            <strong>nflverse</strong>
            <span>
              {view === "trends"
                ? weeklyData
                  ? `${weeklyData.rows.length.toLocaleString()} ${TREND_BASELINE_SEASON} baseline rows`
                  : `${TREND_BASELINE_SEASON} form baseline`
                : weeklyData
                  ? `${weeklyData.rows.length.toLocaleString()} weekly rows`
                  : "Weekly actuals and usage"}
            </span>
          </div>
          <span className={`stats-hub-source-status ${weeklyLoading ? "is-loading" : weeklyError ? "is-warning" : ""}`}>
            {weeklyLoading ? "Loading" : weeklyError ? "Issue" : "Ready"}
          </span>
        </div>
        <div className="stats-hub-source">
          <Layers3 size={18} aria-hidden="true" />
          <div><strong>Fantasy Football Calculator</strong><span>{adpResult ? `${adpResult.players.length} current ADP players` : "Free daily ADP"}</span></div>
          <span className={`stats-hub-source-status ${adpLoading ? "is-loading" : adpError ? "is-warning" : ""}`}>
            {adpLoading ? "Loading" : adpError ? "Issue" : "Ready"}
          </span>
        </div>
        <div className="stats-hub-source">
          <TrendingUp size={18} aria-hidden="true" />
          <div><strong>Sleeper</strong><span>{sleeperSignals.length ? `${sleeperSignals.length} public trend signals` : "24-hour adds and drops"}</span></div>
          <span className={`stats-hub-source-status ${sleeperLoading ? "is-loading" : sleeperError ? "is-warning" : ""}`}>
            {sleeperLoading ? "Loading" : sleeperError ? "Issue" : "Ready"}
          </span>
        </div>
        <div className="stats-hub-source">
          <Radio size={18} aria-hidden="true" />
          <div><strong>Projection & value imports</strong><span>ESPN Clay + WinWithOdds + league-adjusted $200 value model</span></div>
          <span className="stats-hub-source-status">Ready</span>
        </div>
      </div>

      <div className="stats-hub-controls">
        <div className="stats-control-primary">
          <div className="stats-hub-search">
            <Search size={16} aria-hidden="true" />
            <Input
              aria-label={view === "matchups" ? "Search defenses" : view === "teams" ? "Search teams" : "Search players"}
              placeholder={view === "matchups" ? "Search defenses" : view === "teams" ? "Search teams or top scorers" : "Search players or teams"}
              value={search}
              onChange={(event) => updateQuery({ q: event.target.value || null })}
            />
          </div>

          {playerView ? (
            <div className="stats-position-toggle-shell">
              <span>Position</span>
              <PositionToggle
                ariaLabel="Filter stats by position"
                options={DEFAULT_POSITION_TOGGLE_OPTIONS}
                value={positionFilter}
                onChange={(value) => updateQuery({ position: value === "ALL" ? null : value })}
              />
            </div>
          ) : null}
        </div>

        {actualViews ? (
          <div className="stats-select-shell">
            <SelectWrapper label="Season" value={String(season)} onValueChange={(value) => updateQuery({ season: value === String(ACTUAL_SEASONS[0]) ? null : value })} className="stats-select-trigger">
              {ACTUAL_SEASONS.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
            </SelectWrapper>
          </div>
        ) : (
          <div className="stats-select-shell">
            <SelectWrapper label={view === "trends" ? "Trend year" : "Draft year"} value={String(DRAFT_SEASON)} onValueChange={() => undefined} className="stats-select-trigger" disabled>
              <SelectItem value={String(DRAFT_SEASON)}>{DRAFT_SEASON}</SelectItem>
            </SelectWrapper>
          </div>
        )}

        {valueView ? (
          <div className="stats-select-shell">
            <SelectWrapper
              label="Value profile"
              value={activeValueConnection?.leagueId ?? "custom"}
              onValueChange={(value) => {
                if (value === "custom") {
                  updateCustomValueSettings({});
                  return;
                }
                setActiveLeagueId(value);
                updateQuery({ league: value, scoring: null, teams: null, roster: null, budget: null });
              }}
              className="stats-select-trigger"
            >
              <SelectItem value="custom">Custom settings</SelectItem>
              {connectedValueProfiles.map((connection) => (
                <SelectItem key={connection.leagueId} value={connection.leagueId}>{connection.leagueName}</SelectItem>
              ))}
            </SelectWrapper>
          </div>
        ) : null}

        <div className="stats-select-shell">
          <SelectWrapper label="Scoring" value={scoring} onValueChange={(value) => valueView ? updateCustomValueSettings({ scoring: value === "ppr" ? null : value }) : updateQuery({ scoring: value === "ppr" ? null : value })} className="stats-select-trigger">
            <SelectItem value="ppr">PPR</SelectItem>
            <SelectItem value="halfPpr">Half PPR</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectWrapper>
        </div>

        {actualViews ? (
          <div className="stats-select-shell">
            <SelectWrapper label="Games" value={seasonType} onValueChange={(value) => updateQuery({ games: value === "REG" ? null : value })} className="stats-select-trigger">
              <SelectItem value="REG">Regular</SelectItem>
              <SelectItem value="POST">Postseason</SelectItem>
              <SelectItem value="ALL">All games</SelectItem>
            </SelectWrapper>
          </div>
        ) : view !== "trends" ? (
          <div className="stats-select-shell">
            <SelectWrapper label="League size" value={String(teamCount)} onValueChange={(value) => valueView ? updateCustomValueSettings({ teams: value === "12" ? null : value }) : updateQuery({ teams: value === "12" ? null : value })} className="stats-select-trigger">
              {TEAM_COUNT_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option} teams</SelectItem>)}
            </SelectWrapper>
          </div>
        ) : null}

        {valueView ? (
          <div className="stats-select-shell">
            <SelectWrapper label="Roster size" value={String(rosterSize)} onValueChange={(value) => updateCustomValueSettings({ roster: value === "15" ? null : value })} className="stats-select-trigger">
              {ROSTER_SIZE_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option} players</SelectItem>)}
            </SelectWrapper>
          </div>
        ) : null}

        {playerView ? (
          <div className="stats-select-shell">
            <SelectWrapper label="Team" value={teamFilter} onValueChange={(value) => updateQuery({ team: value === "ALL" ? null : value })} className="stats-select-trigger">
              {teams.map((team) => <SelectItem key={team} value={team}>{team === "ALL" ? "All teams" : team}</SelectItem>)}
            </SelectWrapper>
          </div>
        ) : null}

        {actualViews ? (
          <>
            <div className="stats-select-shell">
              <SelectWrapper label="From week" value={String(weekStart)} onValueChange={(value) => updateQuery({ from: value === "1" ? null : value })} className="stats-select-trigger">
                {WEEK_OPTIONS.map((week) => <SelectItem key={week} value={String(week)}>Week {week}</SelectItem>)}
              </SelectWrapper>
            </div>
            <div className="stats-select-shell">
              <SelectWrapper label="To week" value={String(weekEnd)} onValueChange={(value) => updateQuery({ to: value === "18" ? null : value })} className="stats-select-trigger">
                {WEEK_OPTIONS.map((week) => <SelectItem key={week} value={String(week)}>Week {week}</SelectItem>)}
              </SelectWrapper>
            </div>
          </>
        ) : null}

        <div className="stats-select-shell">
          <SelectWrapper label="Rows" value={String(rowLimit)} onValueChange={(value) => updateQuery({ rows: value === "50" ? null : value })} className="stats-select-trigger">
            {ROW_LIMIT_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option === 1000 ? "All" : option}</SelectItem>)}
          </SelectWrapper>
        </div>
      </div>

      <div className="stats-hub-view-intro">
        <div>
          <h2>{viewCopy.title}</h2>
          <p>{viewCopy.description}</p>
        </div>
        <div className="stats-hub-view-intro-actions">
          <span className="stats-hub-result-count">{viewResultCount.toLocaleString()} results</span>
          {actualViews ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const analyticsParams = new URLSearchParams({
                  season: String(season),
                  scoring,
                  position: positionFilter,
                  team: teamFilter,
                  from: String(weekStart),
                  to: String(weekEnd),
                });
                navigate(`/analytics?${analyticsParams.toString()}`);
              }}
            >
              <ChartNoAxesCombined size={14} aria-hidden="true" />
              Explore charts
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={exportCurrentView} disabled={!viewResultCount || viewIsLoading}>
            <Download size={14} aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="stats-hub-summary-grid">
        {cards.map((card) => (
          <div className="stats-hub-summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </div>
        ))}
      </div>

      {view === "auction" ? (
        <div className="stats-auction-import">
          <div className="stats-auction-import-copy">
            <strong>Add actual Sleeper auction prices</strong>
            <span>
              Paste the numeric ID from a completed Sleeper draft URL. GameHQ reads documented draft picks and their actual winning bids; it never uses Sleeper's undocumented suggested-price feed.
            </span>
          </div>
          <form className="stats-auction-import-form" onSubmit={importSleeperAuction}>
            <Input
              aria-label="Sleeper auction draft ID"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Sleeper draft ID"
              value={sleeperDraftId}
              onChange={(event) => setSleeperDraftId(event.target.value.replace(/\D/g, ""))}
            />
            <Button
              type="submit"
              size="sm"
              isLoading={sleeperAuctionLoading}
              disabled={!sleeperDraftId.trim()}
            >
              Import paid prices
            </Button>
          </form>
          {sleeperAuctionError ? (
            <div className="stats-auction-import-status is-error" role="alert">
              {sleeperAuctionError}
            </div>
          ) : sleeperAuction ? (
            <div className="stats-auction-import-status" role="status">
              Imported {sleeperAuction.prices.length.toLocaleString()} winning bids from draft {sleeperAuction.draftId}
              {sleeperAuction.budget && sleeperAuction.budget !== 200
                ? ` and normalized its $${sleeperAuction.budget} budget to $200`
                : ""}.
              {" "}
              <a href={sleeperAuction.sourceUrl} target="_blank" rel="noreferrer">
                View source <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {actualViews && weeklyError ? <div className="stats-hub-note is-error"><Info size={17} aria-hidden="true" /><span>{weeklyError}</span></div> : null}
      {view === "trends" ? (
        <div className="stats-hub-note">
          <TrendingUp size={17} aria-hidden="true" />
          <span>
            The player list, teams, projections, and default ranking are 2026. Net 24h equals Sleeper adds minus drops. Columns labeled {TREND_BASELINE_SEASON} are historical game-form context only; auction values are not part of the trend calculation.
          </span>
        </div>
      ) : null}
      {view === "trends" && sleeperError ? (
        <div className="stats-hub-note is-error" role="alert">
          <Info size={17} aria-hidden="true" />
          <span>Live Sleeper add/drop activity is temporarily unavailable. {sleeperError}</span>
        </div>
      ) : null}
      {view === "trends" && weeklyError ? (
        <div className="stats-hub-note">
          <Info size={17} aria-hidden="true" />
          <span>{TREND_BASELINE_SEASON} form context is unavailable; the 2026 player pool and live activity remain usable.</span>
        </div>
      ) : null}
      {view === "draft" && adpError ? <div className="stats-hub-note"><Info size={17} aria-hidden="true" /><span>Live ADP is temporarily unavailable. Projection and auction data remain usable. {adpError}</span></div> : null}
      {valueView ? <div className="stats-hub-note"><Info size={17} aria-hidden="true" /><span>{activeValueConnection && activeValueSettings ? `Using ${activeValueConnection.leagueName}: ${auctionSettingsSummary(activeValueSettings)}. ` : `Using custom settings: ${teamCount} teams · ${scoring === "ppr" ? "Full PPR" : scoring === "halfPpr" ? "Half PPR" : "Standard"} · $${budget} budget · ${rosterSize} drafted players per team. `}Fair Value recalculates from these settings and conserves the full ${
        (teamCount * budget).toLocaleString()
      } league budget. Market Median remains the compatible published-market reference. {!connectedValueProfiles.length ? <a href={appUrl("/league")}>Connect a Sleeper league</a> : null}</span></div> : null}
      {view === "auction" ? (
        <>
          <div className="stats-hub-note stats-auction-attribution">
            <Database size={17} aria-hidden="true" />
            <span>
              LeagueLogs is a market-index signal converted into GameHQ dollars, not a published auction price. <a href="https://developer.leaguelogs.com/" target="_blank" rel="noreferrer">Powered by LeagueLogs API <ExternalLink size={12} aria-hidden="true" /></a>
            </span>
          </div>
          <div className="stats-hub-note">
            <Info size={17} aria-hidden="true" />
            <span>
              Restricted publisher columns remain blank until GameHQ has a display license or you provide an authorized import. The source average, range, spread, and count use only visible numeric source columns; an imported Sleeper winning bid is included there but does not become a universal market recommendation.
            </span>
          </div>
        </>
      ) : null}
      {view === "matchups" ? <div className="stats-hub-note"><Info size={17} aria-hidden="true" /><span>Lower fantasy points allowed means a tougher defense. Values aggregate all opposing players at that position per team game.</span></div> : null}
      {view === "teams" ? <div className="stats-hub-note"><CheckCircle2 size={17} aria-hidden="true" /><span>Offensive totals include QB, RB, WR, TE, and K. “Opp FPG” is the same defense-vs-position model used in Matchups.</span></div> : null}

      <div id={`stats-panel-${view}`} className="stats-hub-panel" role="tabpanel" aria-labelledby={`stats-view-${view}`}>
        {view === "matchups" ? (
          <StatsDataTable
            rows={sortedDefenseRows.slice(0, rowLimit)}
            columns={currentDefenseColumns}
            sort={sort}
            onSortChange={setSort}
            emptyMessage={weeklyLoading ? "Loading defense-vs-position data…" : "No defenses match these filters."}
            caption={`${season} defense versus position fantasy points allowed`}
          />
        ) : view === "teams" ? (
          <StatsDataTable
            rows={sortedTeamRows.slice(0, rowLimit)}
            columns={currentTeamColumns}
            sort={sort}
            onSortChange={setSort}
            emptyMessage={weeklyLoading ? "Loading team stats…" : "No teams match these filters."}
            caption={`${season} team fantasy production`}
          />
        ) : (
          <StatsDataTable
            rows={sortedPlayerRows.slice(0, rowLimit)}
            columns={currentPlayerColumns}
            sort={sort}
            onSortChange={setSort}
            onRowSelect={(row) => setSelectedPlayerId(row.id)}
            emptyMessage={view === "trends" && sleeperLoading
              ? `Loading ${DRAFT_SEASON} player trends…`
              : weeklyLoading && view !== "draft" && view !== "auction" && view !== "trends"
                ? "Loading weekly player stats…"
                : "No players match these filters."}
            caption={view === "trends"
              ? `${DRAFT_SEASON} live Sleeper player trends with ${TREND_BASELINE_SEASON} form context`
              : `${viewCopy.title} player table`}
          />
        )}
      </div>

      <div className="stats-hub-note">
        <Info size={17} aria-hidden="true" />
        <span>
          Everything shown comes from active sources. Full NFL career seasons, definitions, source details, and complete selected-season game logs are available by opening a player row; empty placeholder categories are no longer exposed.
        </span>
      </div>

      <StatsPlayerDrawer player={selectedPlayer} onClose={closePlayer} />
    </section>
  );
}
