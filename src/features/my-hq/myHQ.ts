import type { ToolPlayer } from "../../data/toolPlayerData";
import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  roster_positions?: string[];
};

type SleeperState = { week?: number; display_week?: number; season?: string; season_type?: string };
type SleeperUser = { user_id: string; display_name: string; metadata?: { team_name?: string } | null };
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
};

export type MyHQPlayerAlert = {
  id: string;
  name: string;
  position: string;
  team: string;
  reason: string;
  projectedPointsPerGame: number | null;
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
  managerProviderUserId: string;
  opponentProviderUserId: string;
  teamScore: number | null;
  opponentScore: number | null;
  starters: ToolPlayer[];
  bench: ToolPlayer[];
  alerts: MyHQPlayerAlert[];
  decisions: MyHQDecision[];
  closestMatchup: string;
  recentActivity: string[];
  projectionNote: string;
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

function rosterOwnerIds(roster: SleeperRoster) {
  return [roster.owner_id, ...(roster.co_owners ?? [])].filter((id): id is string => Boolean(id));
}

function teamNameForRoster(roster: SleeperRoster | undefined, users: SleeperUser[]) {
  if (!roster) return "Opponent not set";
  const user = users.find((candidate) => rosterOwnerIds(roster).includes(candidate.user_id));
  return user?.metadata?.team_name?.trim() || user?.display_name?.trim() || `Roster ${roster.roster_id}`;
}

async function sleeperJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${SLEEPER_API}${path}`, { signal });
  if (!response.ok) throw new Error(`Sleeper returned ${response.status} for ${path}.`);
  return response.json() as Promise<T>;
}

function playerLabel(playerId: string, playerById: Map<string, ToolPlayer>) {
  return playerById.get(playerId)?.name ?? "an updated roster player";
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

function buildDecisions(
  week: number,
  starterIds: string[],
  starters: ToolPlayer[],
  bench: ToolPlayer[],
  allRosteredIds: Set<string>,
  allPlayers: ToolPlayer[],
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
    });
  }

  for (const starter of starters) {
    const injury = starter.injuryStatus.trim().toUpperCase();
    const onBye = week > 0 && starter.byeWeek === week;
    if (!onBye && !["O", "OUT", "IR", "D", "DOUBTFUL", "Q", "QUESTIONABLE"].includes(injury)) continue;
    const alternative = bench
      .filter((candidate) => candidate.position === starter.position && candidate.id !== starter.id)
      .sort((left, right) => (right.projectedPointsPerGame ?? -1) - (left.projectedPointsPerGame ?? -1))[0];
    decisions.push({
      id: `starter-${starter.id}`,
      urgency: onBye || ["O", "OUT", "IR", "D", "DOUBTFUL"].includes(injury) ? "now" : "watch",
      title: onBye ? `${starter.name} is on bye` : `${starter.name} is ${starter.injuryStatus || starter.status}`,
      detail: alternative
        ? `${alternative.name} is the highest season-baseline ${starter.position} option currently on your bench.`
        : `No same-position bench replacement is available in the connected roster data.`,
      actionLabel: alternative ? "Compare players" : "Open player research",
      actionTo: alternative ? "/tools/player-compare" : `/stats?position=${starter.position}`,
    });
  }

  const weakestStarter = starters
    .filter((player) => player.projectedPointsPerGame !== null)
    .sort((left, right) => (left.projectedPointsPerGame ?? 0) - (right.projectedPointsPerGame ?? 0))[0];
  if (weakestStarter) {
    const freeAgent = allPlayers.find((candidate) =>
      candidate.position === weakestStarter.position
      && !allRosteredIds.has(candidate.id)
      && (candidate.projectedPointsPerGame ?? 0) > (weakestStarter.projectedPointsPerGame ?? 0) + 1.5
      && !candidate.injuryStatus,
    );
    if (freeAgent) {
      decisions.push({
        id: `waiver-${freeAgent.id}`,
        urgency: "watch",
        title: `${freeAgent.name} clears your weakest ${weakestStarter.position} baseline`,
        detail: `${freeAgent.projectedPointsPerGame?.toFixed(1)} versus ${weakestStarter.projectedPointsPerGame?.toFixed(1)} projected points per game over the season. Confirm availability and weekly context in your league before adding.`,
        actionLabel: "Research the matchup",
        actionTo: `/stats?position=${freeAgent.position}`,
      });
    }
  }

  if (!decisions.length) {
    decisions.push({
      id: "lineup-clear",
      urgency: "clear",
      title: "No urgent lineup flags found",
      detail: "The connected lineup has no empty slots, current-week byes, or stored injury designations. Recheck official statuses before lock.",
      actionLabel: "Review player research",
      actionTo: "/stats",
    });
  }
  return decisions.slice(0, 5);
}

export async function loadMyHQ(
  connection: SleeperLeagueConnectionSummary,
  allPlayers: ToolPlayer[],
  signal: AbortSignal,
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
  const [matchups, transactions] = await Promise.all([
    week > 0
      ? sleeperJson<SleeperMatchup[]>(`/league/${connection.leagueId}/matchups/${matchupWeek}`, signal)
      : Promise.resolve([]),
    sleeperJson<SleeperTransaction[]>(`/league/${connection.leagueId}/transactions/${matchupWeek}`, signal).catch(() => []),
  ]);

  const userRoster = rosters.find((roster) => rosterOwnerIds(roster).includes(connection.managerProviderUserId!));
  if (!userRoster) throw new Error(`${connection.managerDisplayName ?? "Your Sleeper account"} does not own a roster in this league.`);

  const playerById = new Map(allPlayers.map((player) => [player.id, player]));
  const starterIds = userRoster.starters ?? [];
  const rosterPlayerIds = userRoster.players ?? [];
  const starterIdSet = new Set(starterIds.filter((id) => id && id !== "0"));
  const starters = starterIds.flatMap((id) => playerById.get(id) ?? []);
  const bench = rosterPlayerIds.flatMap((id) => starterIdSet.has(id) ? [] : playerById.get(id) ?? []);
  const allRosteredIds = new Set(rosters.flatMap((roster) => roster.players ?? []));
  const userMatchup = matchups.find((matchup) => matchup.roster_id === userRoster.roster_id);
  const opponentMatchup = userMatchup?.matchup_id == null
    ? undefined
    : matchups.find((matchup) => matchup.matchup_id === userMatchup.matchup_id && matchup.roster_id !== userRoster.roster_id);
  const opponentRoster = rosters.find((roster) => roster.roster_id === opponentMatchup?.roster_id);
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
    managerProviderUserId: connection.managerProviderUserId,
    opponentProviderUserId,
    teamScore: scoreValue(userMatchup),
    opponentScore: scoreValue(opponentMatchup),
    starters,
    bench,
    alerts,
    decisions: buildDecisions(week, starterIds, starters, bench, allRosteredIds, allPlayers),
    closestMatchup,
    recentActivity: transactions
      .filter((transaction) => transaction.status === "complete")
      .sort((left, right) => numberValue(right.created) - numberValue(left.created))
      .slice(0, 4)
      .map((transaction) => transactionLabel(transaction, playerById)),
    projectionNote: "Player comparisons use GameHQ’s current full-season baseline. Sleeper does not expose a public live matchup projection here, so no weekly projection is invented.",
  };
}
