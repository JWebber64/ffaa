import type {
  StatsPlayerDetail,
  StatsPlayerMetric,
  StatsPlayerSource,
} from "@/components/stats/StatsPlayerDrawer";
import { buildPlayerGameLog } from "@/data/playerGameLog";
import {
  buildCurrentToolPlayers,
  normalizeToolName,
  normalizeToolPosition,
  normalizeToolTeam,
  type ToolPlayer,
  type ToolScoring,
} from "@/data/toolPlayerData";

export type PlayerProfileCandidate = {
  id?: string | number | null | undefined;
  playerId?: string | number | null | undefined;
  sleeperId?: string | number | null | undefined;
  name?: string | null | undefined;
  playerName?: string | null | undefined;
  position?: string | null | undefined;
  pos?: string | null | undefined;
  team?: string | null | undefined;
  nflTeam?: string | null | undefined;
  status?: string | null | undefined;
  injuryStatus?: string | null | undefined;
  byeWeek?: number | null | undefined;
  rank?: number | null | undefined;
  positionRank?: number | null | undefined;
  adp?: number | null | undefined;
  auctionValue?: number | null | undefined;
  marketValue?: number | null | undefined;
  projectedPoints?: number | null | undefined;
  projectedPointsPerGame?: number | null | undefined;
  weeklyProjectedPoints?: number | null | undefined;
  historicalPointsPerGame?: number | null | undefined;
  last3PointsPerGame?: number | null | undefined;
  floorPoints?: number | null | undefined;
  ceilingPoints?: number | null | undefined;
  opportunitiesPerGame?: number | null | undefined;
  carriesPerGame?: number | null | undefined;
  targetsPerGame?: number | null | undefined;
  targetShare?: number | null | undefined;
  airYardsShare?: number | null | undefined;
  summary?: ToolPlayer["summary"] | undefined;
  valueSources?: ToolPlayer["valueSources"] | undefined;
};

const toolPlayerCache = new Map<ToolScoring, ToolPlayer[]>();

function currentPlayers(scoring: ToolScoring) {
  const cached = toolPlayerCache.get(scoring);
  if (cached) return cached;
  const players = buildCurrentToolPlayers(scoring);
  toolPlayerCache.set(scoring, players);
  return players;
}
function candidateName(candidate: PlayerProfileCandidate) {
  return String(candidate.name ?? candidate.playerName ?? "").trim();
}

function candidatePosition(candidate: PlayerProfileCandidate) {
  return normalizeToolPosition(candidate.position ?? candidate.pos) ?? String(candidate.position ?? candidate.pos ?? "UNK").toUpperCase();
}

function candidateId(candidate: PlayerProfileCandidate) {
  return String(candidate.id ?? candidate.playerId ?? candidate.sleeperId ?? "").trim();
}

function candidateSleeperId(candidate: PlayerProfileCandidate) {
  return String(candidate.sleeperId ?? "").trim();
}

function resolveToolPlayer(candidate: PlayerProfileCandidate, scoring: ToolScoring) {
  const players = currentPlayers(scoring);
  const id = candidateId(candidate);
  const sleeperId = candidateSleeperId(candidate);
  const name = normalizeToolName(candidateName(candidate));
  const position = candidatePosition(candidate);
  return players.find((player) =>
    (id && (player.id === id || player.sleeperId === id))
    || (sleeperId && player.sleeperId === sleeperId)
    || (name && normalizeToolName(player.name) === name && player.position === position),
  ) ?? null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = finite(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function numberText(value: number | null, decimals = 1) {
  return value === null ? "—" : value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function moneyText(value: number | null) {
  return value === null ? "—" : `$${Math.round(value).toLocaleString()}`;
}

function percentText(value: number | null) {
  if (value === null) return "—";
  return `${(Math.abs(value) <= 1 ? value * 100 : value).toFixed(1)}%`;
}

function metric(label: string, value: string, helper?: string): StatsPlayerMetric {
  return { label, value, ...(helper ? { helper } : {}) };
}

function scoringLabel(scoring: ToolScoring) {
  if (scoring === "halfPpr") return "Half PPR";
  if (scoring === "ppr") return "PPR";
  return "Standard";
}

export function buildPlayerProfileDetail(
  candidate: PlayerProfileCandidate,
  scoring: ToolScoring = "halfPpr",
): StatsPlayerDetail {
  const matched = resolveToolPlayer(candidate, scoring);
  const name = candidateName(candidate) || matched?.name || "Unknown player";
  const position = candidatePosition(candidate) === "UNK" ? matched?.position ?? "UNK" : candidatePosition(candidate);
  const team = normalizeToolTeam(candidate.team ?? candidate.nflTeam ?? matched?.team ?? "");
  const id = candidateId(candidate) || matched?.id || `${normalizeToolName(name)}-${position.toLowerCase()}`;
  const sleeperId = candidateSleeperId(candidate) || matched?.sleeperId || (/^\d+$/.test(id) ? id : "");
  const injuryStatus = String(candidate.injuryStatus ?? matched?.injuryStatus ?? "").trim();
  const status = injuryStatus || String(candidate.status ?? matched?.status ?? "").trim();
  const summary = candidate.summary ?? matched?.summary ?? null;
  const projectedPoints = firstNumber(candidate.projectedPoints, matched?.projectedPoints);
  const projectedPointsPerGame = firstNumber(candidate.projectedPointsPerGame, matched?.projectedPointsPerGame);
  const weeklyProjectedPoints = firstNumber(candidate.weeklyProjectedPoints, matched?.weeklyProjectedPoints);
  const historicalPointsPerGame = firstNumber(candidate.historicalPointsPerGame, matched?.historicalPointsPerGame, summary?.selectedFantasyPointsPerGame);
  const last3PointsPerGame = firstNumber(candidate.last3PointsPerGame, matched?.last3PointsPerGame, summary?.last3FantasyPointsPerGame);
  const floorPoints = firstNumber(candidate.floorPoints, matched?.floorPoints, summary?.floorFantasyPoints);
  const ceilingPoints = firstNumber(candidate.ceilingPoints, matched?.ceilingPoints, summary?.ceilingFantasyPoints);
  const opportunitiesPerGame = firstNumber(candidate.opportunitiesPerGame, matched?.opportunitiesPerGame);
  const carriesPerGame = firstNumber(candidate.carriesPerGame, matched?.carriesPerGame);
  const targetsPerGame = firstNumber(candidate.targetsPerGame, matched?.targetsPerGame);
  const targetShare = firstNumber(candidate.targetShare, matched?.targetShare);
  const airYardsShare = firstNumber(candidate.airYardsShare, matched?.airYardsShare);
  const byeWeek = firstNumber(candidate.byeWeek, matched?.byeWeek);
  const rank = firstNumber(candidate.rank, matched?.rank);
  const positionRank = firstNumber(candidate.positionRank, matched?.positionRank);
  const adp = firstNumber(candidate.adp, matched?.adp);
  const auctionValue = firstNumber(candidate.auctionValue, matched?.auctionValue);
  const marketValue = firstNumber(candidate.marketValue, matched?.marketValue);
  const valueSources = candidate.valueSources ?? matched?.valueSources ?? [];
  const sources: StatsPlayerSource[] = [
    {
      name: "nflverse",
      detail: "Regular-season game logs and career-by-season totals. Missing source rows remain unavailable rather than being estimated.",
      updatedAt: "Career coverage through 2025",
    },
  ];

  if (sleeperId) {
    sources.push({
      name: "Sleeper",
      detail: "Current player identity, NFL team, availability status, roster context, and connected-league projection context.",
      updatedAt: "Read from the current player and league snapshots",
    });
  }
  if (projectedPoints !== null) {
    sources.push({
      name: "GameHQ projection consensus",
      detail: `Season projection normalized for ${scoringLabel(scoring)} scoring. Source counts and ranges are shown only when present in the player pool.`,
      ...(matched?.projectionUpdatedAt ? { updatedAt: matched.projectionUpdatedAt } : {}),
    });
  }
  if (auctionValue !== null || valueSources.length) {
    sources.push({
      name: "GameHQ value model",
      detail: valueSources.length
        ? `Auction context matched from ${[...new Set(valueSources.map((source) => source.source))].join(", ")}.`
        : "League-adjustable auction context from the current player pool.",
    });
  }
  sources.push({
    name: "ESPN NFL headlines",
    detail: "The News tab filters ESPN's public NFL headline feed to articles that explicitly mention this player and links to the original story.",
    updatedAt: "Loaded when News opens",
  });

  return {
    id,
    name,
    position,
    team,
    ...(sleeperId ? { sleeperId } : {}),
    ...(summary?.headshotUrl
      ? { headshotUrl: summary.headshotUrl }
      : sleeperId
        ? { headshotUrl: `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(sleeperId)}.jpg` }
        : {}),
    ...(status ? { status } : {}),
    summary: `${scoringLabel(scoring)} player profile · verified source data only`,
    overviewMetrics: [
      metric("Week projection", numberText(weeklyProjectedPoints), weeklyProjectedPoints === null ? "No current-week projection" : "Connected league context"),
      metric("Season projection", numberText(projectedPoints), scoringLabel(scoring)),
      metric("Projected PPG", numberText(projectedPointsPerGame)),
      metric("Season PPG", numberText(historicalPointsPerGame), summary?.latestSeason ? String(summary.latestSeason) : "Latest available season"),
      metric("Last 3", numberText(last3PointsPerGame)),
      metric("Floor / ceiling", floorPoints === null && ceilingPoints === null ? "—" : `${numberText(floorPoints)} / ${numberText(ceilingPoints)}`),
      metric("Overall rank", rank === null ? "—" : `#${Math.round(rank)}`),
      metric("Position rank", positionRank === null ? "—" : `${position}${Math.round(positionRank)}`),
      metric("ADP", numberText(adp)),
      metric("GameHQ fair", moneyText(auctionValue)),
      metric("Market median", moneyText(marketValue)),
      metric("Bye week", byeWeek === null ? "—" : String(Math.round(byeWeek))),
    ],
    usageMetrics: [
      metric("Opportunities/G", numberText(opportunitiesPerGame)),
      metric("Carries/G", numberText(carriesPerGame)),
      metric("Targets/G", numberText(targetsPerGame)),
      metric("Target share", percentText(targetShare)),
      metric("Air-yard share", percentText(airYardsShare)),
      metric("Games sampled", summary?.games ? String(summary.games) : "—"),
    ],
    weeks: buildPlayerGameLog(summary?.weeklyRows ?? []),
    sources,
    career: {
      ...(summary?.playerId
        ? { playerId: summary.playerId }
        : /^00-/.test(matched?.id ?? id)
          ? { playerId: matched?.id ?? id }
          : {}),
      playerName: name,
      position,
      scoring,
    },
  };
}
