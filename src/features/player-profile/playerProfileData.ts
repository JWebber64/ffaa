import type {
  StatsPlayerDetail,
  StatsPlayerMetric,
  StatsPlayerSource,
} from "@/components/stats/StatsPlayerDrawer";
import { buildPlayerGameLog } from "@/data/playerGameLog";
import { NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import { summarizeWeeklyPlayerStats, type WeeklyPlayerSummary } from "@/data/weeklyPlayerStats";
import sleeperProjectionRows from "@/data/players-2026-sleeper-projections.json";
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
  posRank?: number | null | undefined;
  adp?: number | null | undefined;
  auctionValue?: number | null | undefined;
  marketValue?: number | null | undefined;
  projectedPoints?: number | null | undefined;
  projectedPointsPerGame?: number | null | undefined;
  weeklyProjectedPoints?: number | null | undefined;
  weeklyActualPoints?: number | null | undefined;
  weeklyActualPointsWeek?: number | null | undefined;
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
  loadedSummary?: WeeklyPlayerSummary | null,
): StatsPlayerDetail {
  const matched = resolveToolPlayer(candidate, scoring);
  const name = candidateName(candidate) || matched?.name || "Unknown player";
  const position = candidatePosition(candidate) === "UNK" ? matched?.position ?? "UNK" : candidatePosition(candidate);
  const team = normalizeToolTeam(candidate.team ?? candidate.nflTeam ?? matched?.team ?? "");
  const id = candidateId(candidate) || matched?.id || `${normalizeToolName(name)}-${position.toLowerCase()}`;
  const sleeperId = candidateSleeperId(candidate) || matched?.sleeperId || (/^\d+$/.test(id) ? id : "");
  const injuryStatus = String(candidate.injuryStatus ?? matched?.injuryStatus ?? "").trim();
  const status = injuryStatus || String(candidate.status ?? matched?.status ?? "").trim();
  const suppliedSummary = loadedSummary === undefined ? candidate.summary ?? matched?.summary : loadedSummary;
  // Season metrics must never combine several seasons or retain a caller's
  // old averages after fresh weekly rows arrive.
  const summary = suppliedSummary?.weeklyRows.length
    ? summarizeWeeklyPlayerStats(suppliedSummary.weeklyRows.filter((row) => row.season === suppliedSummary.latestSeason))[0] ?? null
    : suppliedSummary ?? null;
  const projectedPoints = firstNumber(candidate.projectedPoints, matched?.projectedPoints);
  const projectedPointsPerGame = firstNumber(candidate.projectedPointsPerGame, matched?.projectedPointsPerGame);
  const weeklyProjectedPoints = firstNumber(candidate.weeklyProjectedPoints, matched?.weeklyProjectedPoints);
  const weeklyActualPoints = firstNumber(candidate.weeklyActualPoints, matched?.weeklyActualPoints);
  const weeklyActualPointsWeek = firstNumber(candidate.weeklyActualPointsWeek, matched?.weeklyActualPointsWeek);
  const useSummary = summary !== null || loadedSummary !== undefined;
  const historicalPointsPerGame = useSummary ? summary?.selectedFantasyPointsPerGame ?? null : firstNumber(candidate.historicalPointsPerGame, matched?.historicalPointsPerGame);
  const last3PointsPerGame = useSummary ? summary?.last3FantasyPointsPerGame ?? null : firstNumber(candidate.last3PointsPerGame, matched?.last3PointsPerGame);
  const floorPoints = useSummary ? summary?.floorFantasyPoints ?? null : firstNumber(candidate.floorPoints, matched?.floorPoints);
  const ceilingPoints = useSummary ? summary?.ceilingFantasyPoints ?? null : firstNumber(candidate.ceilingPoints, matched?.ceilingPoints);
  const games = summary?.games ?? 0;
  const perGame = (total: number | undefined) => games > 0 && total !== undefined ? total / games : null;
  const opportunitiesPerGame = useSummary ? perGame(summary ? summary.totals.carries + summary.totals.targets : undefined) : firstNumber(candidate.opportunitiesPerGame, matched?.opportunitiesPerGame);
  const carriesPerGame = useSummary ? perGame(summary?.totals.carries) : firstNumber(candidate.carriesPerGame, matched?.carriesPerGame);
  const targetsPerGame = useSummary ? perGame(summary?.totals.targets) : firstNumber(candidate.targetsPerGame, matched?.targetsPerGame);
  const targetShare = useSummary ? summary?.averageMetrics.targetShare ?? null : firstNumber(candidate.targetShare, matched?.targetShare);
  const airYardsShare = useSummary ? summary?.averageMetrics.airYardsShare ?? null : firstNumber(candidate.airYardsShare, matched?.airYardsShare);
  const byeWeek = firstNumber(candidate.byeWeek, matched?.byeWeek);
  const rank = firstNumber(candidate.rank, matched?.rank);
  const importedAdp = sleeperProjectionRows.find((row) => normalizeToolName(row.name) === normalizeToolName(name) && normalizeToolPosition(row.pos) === position);
  const suppliedPositionRank = firstNumber(candidate.positionRank, candidate.posRank, matched?.positionRank);
  const peerRanks = currentPlayers(scoring).flatMap((player) => player.position === position && player.rank !== null ? [player.rank] : []);
  const matchedRank = matched?.rank ?? null;
  const derivedPositionRank = matchedRank !== null && rank === matchedRank
    ? 1 + peerRanks.filter((peerRank) => peerRank < matchedRank).length : null;
  const positionRank = suppliedPositionRank ?? derivedPositionRank;
  const suppliedAdp = firstNumber(candidate.adp, matched?.adp);
  const adp = suppliedAdp ?? firstNumber(importedAdp?.adp);
  const adpHelper = suppliedAdp !== null ? "Imported draft ADP" : adp !== null
    ? `Sleeper PPR · ${importedAdp!.season} · ${importedAdp!.updatedAt}` : "No sourced draft ADP available";
  const seasonHelper = summary ? `${summary.latestSeason} · ${games} games · through Week ${summary.latestWeek}` : `No ${NFLVERSE_CAREER_LATEST_SEASON} regular-season sample`;
  const missingUsage = position === "DEF" ? "Not available for team D/ST" : "Not supplied by this season's source";
  const auctionValue = firstNumber(candidate.auctionValue, matched?.auctionValue);
  const marketValue = firstNumber(candidate.marketValue, matched?.marketValue);
  const valueSources = candidate.valueSources ?? matched?.valueSources ?? [];
  const sources: StatsPlayerSource[] = [
    {
      name: "nflverse",
      detail: "Regular-season game logs and career-by-season totals. Missing source rows remain unavailable rather than being estimated.",
      updatedAt: `Career coverage through ${NFLVERSE_CAREER_LATEST_SEASON}`,
    },
  ];
  if (suppliedAdp === null && adp !== null && importedAdp) {
    sources.push({ name: "Sleeper draft ADP", detail: `${importedAdp.season} PPR draft ADP from the imported Sleeper snapshot. This is draft-market context, not an in-season rest-of-season rank.`, updatedAt: importedAdp.updatedAt });
  }

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
      metric(
        weeklyActualPoints === null ? "Week projection" : "Week score",
        numberText(weeklyActualPoints ?? weeklyProjectedPoints, weeklyActualPoints === null ? 1 : 2),
        weeklyActualPoints === null
          ? weeklyProjectedPoints === null ? "No current-week projection" : "Connected league context"
          : `Sleeper Week ${weeklyActualPointsWeek ?? "current"} scoring`,
      ),
      metric("Season projection", numberText(projectedPoints), scoringLabel(scoring)),
      metric("Projected PPG", numberText(projectedPointsPerGame)),
      metric("Season PPG", numberText(historicalPointsPerGame), seasonHelper),
      metric("Last 3", numberText(last3PointsPerGame), summary ? `${summary.latestSeason} · last ${Math.min(3, games)} games` : seasonHelper),
      metric("Floor / ceiling", floorPoints === null && ceilingPoints === null ? "—" : `${numberText(floorPoints)} / ${numberText(ceilingPoints)}`, summary ? `${summary.latestSeason} · 25th / 75th percentile` : seasonHelper),
      metric("Overall rank", rank === null ? "—" : `#${Math.round(rank)}`),
      metric("Position rank", positionRank === null ? "—" : `${position}${Math.round(positionRank)}`, suppliedPositionRank !== null ? "Imported position rank" : positionRank !== null ? "Within current overall rankings" : "No sourced ranking available"),
      metric("ADP", numberText(adp), adpHelper),
      metric("GameHQ fair", moneyText(auctionValue)),
      metric("Market median", moneyText(marketValue)),
      metric("Bye week", byeWeek === null ? "—" : String(Math.round(byeWeek))),
    ],
    usageMetrics: [
      metric("Opportunities/G", numberText(opportunitiesPerGame), opportunitiesPerGame === null ? missingUsage : seasonHelper),
      metric("Carries/G", numberText(carriesPerGame), carriesPerGame === null ? missingUsage : seasonHelper),
      metric("Targets/G", numberText(targetsPerGame), targetsPerGame === null ? missingUsage : seasonHelper),
      metric("Target share", percentText(targetShare), targetShare === null ? missingUsage : seasonHelper),
      metric("Air-yard share", percentText(airYardsShare), airYardsShare === null ? missingUsage : seasonHelper),
      metric("Games sampled", summary?.games ? String(summary.games) : "—", summary ? `${summary.latestSeason} regular season` : missingUsage),
    ],
    weeks: buildPlayerGameLog(summary?.weeklyRows ?? []),
    weeksCoverFullSeason: loadedSummary !== undefined,
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
