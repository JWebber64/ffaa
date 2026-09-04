import {
  normalizeToolPosition,
  normalizeToolTeam,
  type ToolPlayer,
  type ToolScoring,
} from "../../data/toolPlayerData";
import type { SleeperPlayerRow } from "../../data/playerStatCategories";
import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";
import {
  loadSleeperWeeklyProjections,
  type SleeperWeeklyProjection,
} from "./sleeperWeeklyProjections";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  owner_id?: string | null;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
};

type SleeperState = { week?: number; display_week?: number; season?: string; season_type?: string };
type SleeperUser = {
  user_id: string;
  display_name: string;
  avatar?: string | null;
  is_owner?: boolean;
  metadata?: { avatar?: string; team_name?: string } | null;
};
type SleeperRoster = {
  roster_id: number;
  owner_id?: string | null;
  co_owners?: string[] | null;
  players?: string[] | null;
  starters?: string[] | null;
  settings?: Record<string, number> | null;
};
type SleeperMatchup = { roster_id: number; matchup_id?: number | null; points?: number | null; custom_points?: number | null };
type SleeperTransaction = {
  transaction_id: string;
  type: string;
  status: string;
  roster_ids?: number[] | null;
  created?: number | null;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
};

export type MyHQDecision = {
  id: string;
  urgency: "now" | "watch" | "clear";
  title: string;
  detail: string;
  actionLabel: string;
  actionTo: string;
  evidence: string;
};

export type MyHQPlayerAlert = {
  id: string;
  name: string;
  position: string;
  team: string;
  reason: string;
  projectedPointsPerGame: number | null;
};

export type MyHQPlayerRecommendation = {
  id: string;
  player: ToolPlayer;
  dropPlayer: ToolPlayer | null;
  eligibleSlots: string[];
  baselineGain: number | null;
  confidence: "higher" | "moderate" | "limited";
  evidence: string;
};

export type MyHQLineupEntry = {
  slot: string;
  player: ToolPlayer | null;
};

export type MyHQData = {
  leagueId: string;
  leagueName: string;
  season: string;
  seasonPhase: string;
  week: number;
  teamName: string;
  record: string;
  standing: number;
  totalTeams: number;
  opponentName: string;
  opponentRecord: string;
  managerProviderUserId: string;
  managerAvatarUrl?: string;
  leagueOwnerProviderUserId: string;
  opponentProviderUserId: string;
  teamScore: number | null;
  opponentScore: number | null;
  teamProjectedPoints: number | null;
  opponentProjectedPoints: number | null;
  starterLineup: MyHQLineupEntry[];
  opponentStarterLineup: MyHQLineupEntry[];
  starters: ToolPlayer[];
  bench: ToolPlayer[];
  opponentBench: ToolPlayer[];
  starterSlots: string[];
  rosteredPlayerIds: string[];
  alerts: MyHQPlayerAlert[];
  decisions: MyHQDecision[];
  availableRecommendations: MyHQPlayerRecommendation[];
  closestMatchup: string;
  recentActivity: string[];
  projectionNote: string;
  loadedAt: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreValue(matchup?: SleeperMatchup) {
  if (!matchup) return null;
  if (Number.isFinite(Number(matchup.custom_points))) return Number(matchup.custom_points);
  return Number.isFinite(Number(matchup.points)) ? Number(matchup.points) : null;
}

function lineupWeeklyProjection(players: ToolPlayer[]) {
  const projected = players.flatMap((player) => player.weeklyProjectedPoints ?? []);
  return projected.length ? projected.reduce((sum, value) => sum + value, 0) : null;
}

function weeklyProjectionScoring(
  connection: SleeperLeagueConnectionSummary,
  league: SleeperLeague,
): { scoring: ToolScoring; label: string } {
  if (connection.auctionSettings) {
    return {
      scoring: connection.auctionSettings.scoring,
      label: connection.auctionSettings.scoringLabel,
    };
  }
  const receptionPoints = numberValue(league.scoring_settings?.rec);
  if (receptionPoints >= 0.75) return { scoring: "ppr", label: "Full PPR" };
  if (receptionPoints >= 0.25) return { scoring: "halfPpr", label: "Half PPR" };
  return { scoring: "standard", label: "Standard" };
}

function withWeeklyProjection(
  player: ToolPlayer,
  sleeperId: string,
  week: number,
  projections: Map<string, SleeperWeeklyProjection>,
): ToolPlayer {
  const projection = sleeperId ? projections.get(sleeperId) : undefined;
  return {
    ...player,
    weeklyProjectedPoints: projection?.week === week ? projection.points : null,
    weeklyProjectionWeek: week,
    ...(projection?.opponent ? { weeklyProjectionOpponent: projection.opponent } : {}),
  };
}

function rosterOwnerIds(roster: SleeperRoster) {
  return [roster.owner_id, ...(roster.co_owners ?? [])].filter((id): id is string => Boolean(id));
}

function teamNameForRoster(roster: SleeperRoster | undefined, users: SleeperUser[]) {
  if (!roster) return "Opponent not set";
  const user = users.find((candidate) => rosterOwnerIds(roster).includes(candidate.user_id));
  return user?.metadata?.team_name?.trim() || user?.display_name?.trim() || `Roster ${roster.roster_id}`;
}

function avatarUrlForUser(user: SleeperUser | undefined) {
  const custom = user?.metadata?.avatar?.trim();
  if (custom) return custom;
  const avatar = user?.avatar?.trim();
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : "";
}

async function sleeperJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${SLEEPER_API}${path}`, { signal });
  if (!response.ok) throw new Error(`Sleeper returned ${response.status} for ${path}.`);
  return response.json() as Promise<T>;
}

function playerLabel(playerId: string, playerById: Map<string, ToolPlayer>) {
  return playerById.get(playerId)?.name ?? "an updated roster player";
}

function sleeperFallbackPlayer(row: SleeperPlayerRow): ToolPlayer | null {
  const sleeperId = String(row.playerId ?? "").trim();
  const name = String(row.name ?? "").trim();
  const position = normalizeToolPosition(row.pos);
  if (!sleeperId || !name || !position) return null;
  return {
    id: `sleeper-${sleeperId}`,
    sleeperId,
    name,
    position,
    team: normalizeToolTeam(row.team),
    rank: numberValue(row.searchRank) || null,
    positionRank: null,
    byeWeek: null,
    adp: null,
    auctionValue: null,
    marketValue: null,
    projectedPoints: null,
    projectedPointsPerGame: null,
    valueConfidence: null,
    valueSources: [],
    status: String(row.status ?? ""),
    injuryStatus: String(row.injuryStatus ?? ""),
    historicalGames: 0,
    historicalPoints: null,
    historicalPointsPerGame: null,
    last3PointsPerGame: null,
    floorPoints: null,
    ceilingPoints: null,
    standardDeviation: null,
    opportunitiesPerGame: null,
    targetsPerGame: null,
    carriesPerGame: null,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
  };
}

function transactionLabel(transaction: SleeperTransaction, playerById: Map<string, ToolPlayer>) {
  const addId = Object.keys(transaction.adds ?? {})[0];
  const dropId = Object.keys(transaction.drops ?? {})[0];
  if (transaction.type === "trade") return "A trade was completed in the league.";
  if (addId && dropId) return `${playerLabel(addId, playerById)} added; ${playerLabel(dropId, playerById)} dropped.`;
  if (addId) return `${playerLabel(addId, playerById)} was added.`;
  if (dropId) return `${playerLabel(dropId, playerById)} was dropped.`;
  return `${transaction.type.replace(/_/g, " ")} transaction completed.`;
}

const SLOT_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ["RB", "WR", "TE"],
  RB_WR_TE: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  SUPERFLEX: ["QB", "RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
};

function normalizedSlot(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]+/g, "_");
}

function isStarterSlot(value: string) {
  return !["BN", "BENCH", "IR", "RESERVE", "TAXI"].includes(normalizedSlot(value));
}

export function isPlayerEligibleForSleeperSlot(position: string, slot: string) {
  const normalizedPosition = position.trim().toUpperCase() === "DST" ? "DEF" : position.trim().toUpperCase();
  const normalized = normalizedSlot(slot);
  if (normalized === "DST") return normalizedPosition === "DEF";
  return (SLOT_ELIGIBILITY[normalized] ?? [normalized]).includes(normalizedPosition);
}

function projectionConfidence(player: ToolPlayer): MyHQPlayerRecommendation["confidence"] {
  const sourceCount = player.projectionSourceCount ?? 0;
  if (sourceCount >= 3) return "higher";
  if (sourceCount >= 2) return "moderate";
  return "limited";
}

function projectionEvidence(player: ToolPlayer) {
  const sourceCount = player.projectionSourceCount ?? 0;
  const sourceLabel = sourceCount
    ? `${sourceCount} projection ${sourceCount === 1 ? "source" : "sources"}`
    : "limited projection coverage";
  if (!player.projectionUpdatedAt) return sourceLabel;
  const updated = Date.parse(player.projectionUpdatedAt);
  return Number.isFinite(updated)
    ? `${sourceLabel} · updated ${new Date(updated).toLocaleDateString()}`
    : sourceLabel;
}

function compatibleDropCandidate(player: ToolPlayer, bench: ToolPlayer[]) {
  const samePosition = bench.filter((candidate) => candidate.position === player.position);
  const pool = samePosition.length ? samePosition : bench;
  return [...pool]
    .filter((candidate) => candidate.projectedPointsPerGame !== null)
    .sort((left, right) => (left.projectedPointsPerGame ?? 0) - (right.projectedPointsPerGame ?? 0))[0]
    ?? null;
}

export function buildAvailableRecommendations(
  allPlayers: ToolPlayer[],
  allRosteredIds: Set<string>,
  bench: ToolPlayer[],
  starterSlots: string[],
) {
  return [...allPlayers]
    .filter((player) => (
      !allRosteredIds.has(player.sleeperId?.trim() || player.id)
      && player.projectedPointsPerGame !== null
      && !player.injuryStatus
    ))
    .sort((left, right) => (right.projectedPointsPerGame ?? 0) - (left.projectedPointsPerGame ?? 0))
    .flatMap((player): MyHQPlayerRecommendation[] => {
      const eligibleSlots = [...new Set(starterSlots.filter((slot) => isPlayerEligibleForSleeperSlot(player.position, slot))
        .map((slot) => normalizedSlot(slot)))] as string[];
      if (!eligibleSlots.length) return [];
      const dropPlayer = compatibleDropCandidate(player, bench);
      const baselineGain = dropPlayer?.projectedPointsPerGame === null || !dropPlayer
        ? null
        : (player.projectedPointsPerGame ?? 0) - dropPlayer.projectedPointsPerGame;
      return [{
        id: `available-${player.id}`,
        player,
        dropPlayer,
        eligibleSlots,
        baselineGain,
        confidence: projectionConfidence(player),
        evidence: projectionEvidence(player),
      }];
    })
    .sort((left, right) => (
      (right.baselineGain ?? -999) - (left.baselineGain ?? -999)
      || (right.player.projectedPointsPerGame ?? 0) - (left.player.projectedPointsPerGame ?? 0)
    ))
    .slice(0, 12);
}

export function buildMyHQDecisions(
  leagueId: string,
  week: number,
  starterIds: string[],
  starterSlots: string[],
  starters: ToolPlayer[],
  bench: ToolPlayer[],
  availableRecommendations: MyHQPlayerRecommendation[],
) {
  const decisions: MyHQDecision[] = [];
  const emptySlots = starterIds.filter((id) => !id || id === "0").length;
  if (emptySlots) {
    decisions.push({
      id: "empty-slots",
      urgency: "now",
      title: `${emptySlots} starter ${emptySlots === 1 ? "slot needs" : "slots need"} attention`,
      detail: "Sleeper reports an empty starter position. Set the legal lineup before lock.",
      actionLabel: "Open Sleeper lineup",
      actionTo: "https://sleeper.com/",
      evidence: "Sleeper public roster snapshot",
    });
  }

  for (const [starterIndex, starter] of starters.entries()) {
    const injury = starter.injuryStatus.trim().toUpperCase();
    const onBye = week > 0 && starter.byeWeek === week;
    if (!onBye && !["O", "OUT", "IR", "D", "DOUBTFUL", "Q", "QUESTIONABLE"].includes(injury)) continue;
    const slot = starterSlots[starterIndex] ?? starter.position;
    const alternative = bench
      .filter((candidate) => isPlayerEligibleForSleeperSlot(candidate.position, slot) && candidate.id !== starter.id)
      .sort((left, right) => (right.projectedPointsPerGame ?? -1) - (left.projectedPointsPerGame ?? -1))[0];
    decisions.push({
      id: `starter-${starter.id}`,
      urgency: onBye || ["O", "OUT", "IR", "D", "DOUBTFUL"].includes(injury) ? "now" : "watch",
      title: onBye ? `${starter.name} is on bye` : `${starter.name} is ${starter.injuryStatus || starter.status}`,
      detail: alternative
        ? `${alternative.name} is the highest season-baseline option on your bench that is eligible for ${normalizedSlot(slot).replace(/_/g, " ")}.`
        : `No eligible bench replacement is available for ${normalizedSlot(slot).replace(/_/g, " ")}.`,
      actionLabel: alternative ? "Compare players" : "Open player research",
      actionTo: alternative ? "/tools/player-compare" : `/league/${encodeURIComponent(leagueId)}/players?position=${starter.position}`,
      evidence: `Sleeper starter status · ${projectionEvidence(alternative ?? starter)}`,
    });
  }

  const availableUpgrade = availableRecommendations.find((recommendation) => (recommendation.baselineGain ?? 0) > 1.5);
  if (availableUpgrade) {
    const { player: freeAgent, dropPlayer, baselineGain } = availableUpgrade;
    decisions.push({
      id: `waiver-${freeAgent.id}`,
      urgency: "watch",
      title: `${freeAgent.name} is a verified free agent in this league`,
      detail: `${freeAgent.projectedPointsPerGame?.toFixed(1)} season-baseline PPG${dropPlayer ? ` versus ${dropPlayer.name} at ${dropPlayer.projectedPointsPerGame?.toFixed(1)}` : ""}${baselineGain === null ? "" : ` · +${baselineGain.toFixed(1)}`}. Review weekly context before making an add/drop.`,
      actionLabel: "Review verified options",
      actionTo: `/league/${encodeURIComponent(leagueId)}/players?position=${freeAgent.position}`,
      evidence: `Current Sleeper roster set · ${availableUpgrade.evidence}`,
    });
  }

  if (!decisions.length) {
    decisions.push({
      id: "lineup-clear",
      urgency: "clear",
      title: "No urgent lineup flags found",
      detail: "The connected lineup has no empty slots, current-week byes, or stored injury designations. Recheck official statuses before lock.",
      actionLabel: "Review player research",
      actionTo: `/league/${encodeURIComponent(leagueId)}/players`,
      evidence: "Sleeper roster status · GameHQ season projection consensus",
    });
  }
  return decisions.slice(0, 5);
}

export async function loadMyHQ(
  connection: SleeperLeagueConnectionSummary,
  allPlayers: ToolPlayer[],
  signal: AbortSignal,
  sleeperRows: SleeperPlayerRow[] = [],
): Promise<MyHQData> {
  if (!connection.managerProviderUserId) {
    throw new Error("Reconnect this league with your Sleeper username so GameHQ can identify your roster.");
  }

  const [league, state, users, rosters] = await Promise.all([
    sleeperJson<SleeperLeague>(`/league/${connection.leagueId}`, signal),
    sleeperJson<SleeperState>("/state/nfl", signal),
    sleeperJson<SleeperUser[]>(`/league/${connection.leagueId}/users`, signal),
    sleeperJson<SleeperRoster[]>(`/league/${connection.leagueId}/rosters`, signal),
  ]);
  const week = Math.max(0, numberValue(state.display_week ?? state.week));
  const matchupWeek = Math.max(1, week);
  const projectionScoring = weeklyProjectionScoring(connection, league);
  let projectionError = "";
  const [matchups, transactions, weeklyProjections] = await Promise.all([
    week > 0
      ? sleeperJson<SleeperMatchup[]>(`/league/${connection.leagueId}/matchups/${matchupWeek}`, signal)
      : Promise.resolve([]),
    sleeperJson<SleeperTransaction[]>(`/league/${connection.leagueId}/transactions/${matchupWeek}`, signal).catch(() => []),
    loadSleeperWeeklyProjections(
      league.season,
      matchupWeek,
      state.season_type || "regular",
      projectionScoring.scoring,
    ).catch((error: unknown) => {
      projectionError = error instanceof Error ? error.message : "Unknown projection error.";
      return new Map<string, SleeperWeeklyProjection>();
    }),
  ]);

  const userRoster = rosters.find((roster) => rosterOwnerIds(roster).includes(connection.managerProviderUserId!));
  if (!userRoster) throw new Error(`${connection.managerDisplayName ?? "Your Sleeper account"} does not own a roster in this league.`);
  const managerUser = users.find((user) => user.user_id === connection.managerProviderUserId);

  const playerById = new Map<string, ToolPlayer>();
  for (const player of allPlayers) {
    const sleeperId = player.sleeperId?.trim() || "";
    const enrichedPlayer = withWeeklyProjection(player, sleeperId, matchupWeek, weeklyProjections);
    playerById.set(player.id, enrichedPlayer);
    if (sleeperId) playerById.set(sleeperId, enrichedPlayer);
  }
  const sleeperById = new Map(sleeperRows.flatMap((row) => row.playerId ? [[String(row.playerId), row] as const] : []));
  const relevantPlayerIds = new Set([
    ...rosters.flatMap((roster) => roster.players ?? []),
    ...transactions.flatMap((transaction) => [...Object.keys(transaction.adds ?? {}), ...Object.keys(transaction.drops ?? {})]),
  ]);
  for (const playerId of relevantPlayerIds) {
    if (playerById.has(playerId)) continue;
    const sleeperRow = sleeperById.get(playerId);
    const fallback = sleeperRow ? sleeperFallbackPlayer(sleeperRow) : null;
    if (fallback) playerById.set(
      playerId,
      withWeeklyProjection(fallback, playerId, matchupWeek, weeklyProjections),
    );
  }
  const starterIds = userRoster.starters ?? [];
  const starterSlots = (league.roster_positions ?? []).filter(isStarterSlot);
  const rosterPlayerIds = userRoster.players ?? [];
  const starterIdSet = new Set(starterIds.filter((id) => id && id !== "0"));
  const starterLineup = starterIds.map((id, index): MyHQLineupEntry => {
    const player = playerById.get(id) ?? null;
    return { player, slot: starterSlots[index] ?? player?.position ?? "FLEX" };
  });
  const starterEntries = starterLineup.flatMap((entry) => entry.player ? [{ player: entry.player, slot: entry.slot }] : []);
  const starters = starterEntries.map((entry) => entry.player);
  const bench = rosterPlayerIds.flatMap((id) => starterIdSet.has(id) ? [] : playerById.get(id) ?? []);
  const allRosteredIds = new Set(rosters.flatMap((roster) => roster.players ?? []));
  const availableRecommendations = buildAvailableRecommendations(allPlayers, allRosteredIds, bench, starterSlots);
  const userMatchup = matchups.find((matchup) => matchup.roster_id === userRoster.roster_id);
  const opponentMatchup = userMatchup?.matchup_id == null
    ? undefined
    : matchups.find((matchup) => matchup.matchup_id === userMatchup.matchup_id && matchup.roster_id !== userRoster.roster_id);
  const opponentRoster = rosters.find((roster) => roster.roster_id === opponentMatchup?.roster_id);
  const opponentStarterIds = opponentRoster?.starters ?? [];
  const opponentStarterIdSet = new Set(opponentStarterIds.filter((id) => id && id !== "0"));
  const opponentStarterLineup = opponentStarterIds.map((id, index): MyHQLineupEntry => {
    const player = playerById.get(id) ?? null;
    return { player, slot: starterSlots[index] ?? player?.position ?? "FLEX" };
  });
  const opponentStarters = opponentStarterLineup.flatMap((entry) => entry.player ?? []);
  const opponentBench = (opponentRoster?.players ?? []).flatMap((id) => (
    opponentStarterIdSet.has(id) ? [] : playerById.get(id) ?? []
  ));
  const opponentProviderUserId = opponentRoster ? rosterOwnerIds(opponentRoster)[0] ?? "" : "";
  const sortedRosters = [...rosters].sort((left, right) =>
    numberValue(right.settings?.wins) - numberValue(left.settings?.wins)
    || numberValue(right.settings?.fpts) - numberValue(left.settings?.fpts),
  );
  const alerts = starters.flatMap((player): MyHQPlayerAlert[] => {
    const reasons = [
      week > 0 && player.byeWeek === week ? `Bye in Week ${week}` : "",
      player.injuryStatus ? `Injury status: ${player.injuryStatus}` : "",
      player.status && player.status !== "Active" ? `Roster status: ${player.status}` : "",
    ].filter(Boolean);
    return reasons.length ? [{
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      reason: reasons.join(" · "),
      projectedPointsPerGame: player.projectedPointsPerGame,
    }] : [];
  });
  const pairedMatchups = new Map<number, SleeperMatchup[]>();
  for (const matchup of matchups) {
    if (matchup.matchup_id == null) continue;
    pairedMatchups.set(matchup.matchup_id, [...(pairedMatchups.get(matchup.matchup_id) ?? []), matchup]);
  }
  const closest = [...pairedMatchups.values()]
    .filter((pair) => pair.length === 2)
    .map((pair) => ({ pair, margin: Math.abs((scoreValue(pair[0]) ?? 0) - (scoreValue(pair[1]) ?? 0)) }))
    .sort((left, right) => left.margin - right.margin)[0];
  const closestMatchup = closest
    ? `${teamNameForRoster(rosters.find((roster) => roster.roster_id === closest.pair[0]!.roster_id), users)} vs ${teamNameForRoster(rosters.find((roster) => roster.roster_id === closest.pair[1]!.roster_id), users)} · ${closest.margin.toFixed(2)}-point margin`
    : week > 0 ? "No paired matchup scores are available yet." : "Matchups begin when the Sleeper season opens.";

  return {
    leagueId: league.league_id,
    leagueName: league.name,
    season: league.season,
    seasonPhase: state.season_type || league.status,
    week,
    teamName: teamNameForRoster(userRoster, users),
    record: `${numberValue(userRoster.settings?.wins)}-${numberValue(userRoster.settings?.losses)}${numberValue(userRoster.settings?.ties) ? `-${numberValue(userRoster.settings?.ties)}` : ""}`,
    standing: sortedRosters.findIndex((roster) => roster.roster_id === userRoster.roster_id) + 1,
    totalTeams: rosters.length,
    opponentName: teamNameForRoster(opponentRoster, users),
    opponentRecord: opponentRoster
      ? `${numberValue(opponentRoster.settings?.wins)}-${numberValue(opponentRoster.settings?.losses)}${numberValue(opponentRoster.settings?.ties) ? `-${numberValue(opponentRoster.settings?.ties)}` : ""}`
      : "—",
    managerProviderUserId: connection.managerProviderUserId,
    managerAvatarUrl: avatarUrlForUser(managerUser),
    leagueOwnerProviderUserId: league.owner_id?.trim()
      || users.find((user) => user.is_owner)?.user_id
      || "",
    opponentProviderUserId,
    teamScore: scoreValue(userMatchup),
    opponentScore: scoreValue(opponentMatchup),
    teamProjectedPoints: lineupWeeklyProjection(starters),
    opponentProjectedPoints: lineupWeeklyProjection(opponentStarters),
    starterLineup,
    opponentStarterLineup,
    starters,
    bench,
    opponentBench,
    starterSlots,
    rosteredPlayerIds: [...allRosteredIds],
    alerts,
    decisions: buildMyHQDecisions(
      connection.leagueId,
      week,
      starterIds,
      starterEntries.map((entry) => entry.slot),
      starters,
      bench,
      availableRecommendations,
    ),
    availableRecommendations,
    closestMatchup,
    recentActivity: transactions
      .filter((transaction) => transaction.status === "complete")
      .sort((left, right) => numberValue(right.created) - numberValue(left.created))
      .slice(0, 4)
      .map((transaction) => transactionLabel(transaction, playerById)),
    projectionNote: projectionError
      ? `Week ${matchupWeek} projections are unavailable (${projectionError}) Season averages are not substituted.`
      : `Player values use Sleeper’s current Week ${matchupWeek} ${projectionScoring.label} projection feed. Players absent from that feed show a dash; season averages are not substituted.`,
    loadedAt: new Date().toISOString(),
  };
}
