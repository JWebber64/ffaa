import type {
  HistoricalMatchup,
  LeagueHistorySnapshot,
  ManagerCareerStats,
  SeasonFranchise,
} from "../domain/types";
import { chronologicalMatchups, createHistoryIndexes, franchiseScore, median } from "./helpers";

function finish(franchise: SeasonFranchise) {
  return franchise.finalRank ?? franchise.regularSeasonRank;
}

function streaks(results: Array<-1 | 0 | 1>) {
  let currentWins = 0;
  let currentLosses = 0;
  let longestWins = 0;
  let longestLosses = 0;
  for (const result of results) {
    if (result === 1) {
      currentWins += 1;
      currentLosses = 0;
      longestWins = Math.max(longestWins, currentWins);
    } else if (result === -1) {
      currentLosses += 1;
      currentWins = 0;
      longestLosses = Math.max(longestLosses, currentLosses);
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
  }
  return { longestWins, longestLosses };
}

function resultForManager(matchup: HistoricalMatchup, franchiseIds: Set<string>): -1 | 0 | 1 {
  const isA = franchiseIds.has(matchup.franchiseAId);
  const score = isA ? matchup.scoreA : matchup.scoreB;
  const opponentScore = isA ? matchup.scoreB : matchup.scoreA;
  if (score > opponentScore) return 1;
  if (score < opponentScore) return -1;
  return 0;
}

export function calculateManagerCareer(
  snapshot: LeagueHistorySnapshot,
  managerId: string,
): ManagerCareerStats | null {
  const manager = snapshot.managers.find((row) => row.id === managerId);
  if (!manager) return null;
  const franchises = snapshot.franchises
    .filter((franchise) => franchise.managerId === managerId)
    .sort((left, right) => {
      const seasons = new Map(snapshot.seasons.map((season) => [season.id, season.season]));
      return (seasons.get(right.leagueSeasonId) ?? 0) - (seasons.get(left.leagueSeasonId) ?? 0);
    });
  const completeSeasonIds = new Set(snapshot.seasons
    .filter((season) => season.status === "complete")
    .map((season) => season.id));
  const completedFranchises = franchises.filter((franchise) => completeSeasonIds.has(franchise.leagueSeasonId));
  const franchiseIds = new Set(franchises.map((franchise) => franchise.id));
  const matchups = chronologicalMatchups(
    snapshot,
    snapshot.matchups.filter((matchup) => matchup.isComplete
      && (franchiseIds.has(matchup.franchiseAId) || franchiseIds.has(matchup.franchiseBId))),
  );
  const playoffMatchups = matchups.filter((matchup) => matchup.isPlayoff);
  const playoffWins = playoffMatchups.filter((matchup) => matchup.winnerFranchiseId
    && franchiseIds.has(matchup.winnerFranchiseId)).length;
  const playoffLosses = playoffMatchups.length - playoffWins
    - playoffMatchups.filter((matchup) => matchup.scoreA === matchup.scoreB).length;
  const titleGames = snapshot.playoffMatches.filter((match) => match.bracketType === "winners"
    && match.placement === 1
    && [match.franchiseAId, match.franchiseBId].some((id) => id && franchiseIds.has(id)));
  const championships = titleGames.filter((match) => match.winnerFranchiseId
    && franchiseIds.has(match.winnerFranchiseId)).length;
  const playoffSeasonIds = new Set(
    snapshot.playoffMatches
      .filter((match) => [match.franchiseAId, match.franchiseBId].some((id) => id && franchiseIds.has(id)))
      .map((match) => match.leagueSeasonId),
  );
  const scores = matchups.flatMap((matchup) => {
    const franchiseId = franchiseIds.has(matchup.franchiseAId) ? matchup.franchiseAId : matchup.franchiseBId;
    const score = franchiseScore(matchup, franchiseId);
    return score == null ? [] : [score];
  });
  const finishes = completedFranchises.map(finish).filter((value): value is number => value != null);
  const wins = franchises.reduce((sum, franchise) => sum + franchise.wins, 0);
  const losses = franchises.reduce((sum, franchise) => sum + franchise.losses, 0);
  const ties = franchises.reduce((sum, franchise) => sum + franchise.ties, 0);
  const games = wins + losses + ties;
  const pointsFor = franchises.reduce((sum, franchise) => sum + franchise.pointsFor, 0);
  const pointsAgainst = franchises.reduce((sum, franchise) => sum + franchise.pointsAgainst, 0);
  const streak = streaks(matchups.map((matchup) => resultForManager(matchup, franchiseIds)));
  const bestSeason = [...completedFranchises].sort((left, right) =>
    (finish(left) ?? Number.MAX_SAFE_INTEGER) - (finish(right) ?? Number.MAX_SAFE_INTEGER)
    || right.wins - left.wins
    || right.pointsFor - left.pointsFor)[0] ?? null;
  const highestScoringSeason = [...franchises].sort((left, right) => right.pointsFor - left.pointsFor)[0] ?? null;

  return {
    manager,
    franchises,
    seasonsPlayed: franchises.length,
    wins,
    losses,
    ties,
    games,
    winPercentage: games ? (wins + ties * 0.5) / games : 0,
    pointsFor,
    pointsAgainst,
    pointDifferential: pointsFor - pointsAgainst,
    championships,
    championshipAppearances: titleGames.length,
    playoffAppearances: playoffSeasonIds.size,
    playoffWins,
    playoffLosses,
    playoffWinPercentage: playoffWins + playoffLosses ? playoffWins / (playoffWins + playoffLosses) : 0,
    regularSeasonTitles: completedFranchises.filter((franchise) => franchise.regularSeasonRank === 1).length,
    averageFinish: finishes.length ? finishes.reduce((sum, value) => sum + value, 0) / finishes.length : null,
    medianFinish: median(finishes),
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    worstFinish: finishes.length ? Math.max(...finishes) : null,
    highestScoringSeason,
    bestSeason,
    longestWinningStreak: streak.longestWins,
    longestLosingStreak: streak.longestLosses,
    highestWeeklyScore: scores.length ? Math.max(...scores) : null,
    lowestWeeklyScore: scores.length ? Math.min(...scores) : null,
    winningSeasons: franchises.filter((franchise) => franchise.wins > franchise.losses).length,
    losingSeasons: franchises.filter((franchise) => franchise.losses > franchise.wins).length,
  };
}

export function calculateAllManagerCareers(snapshot: LeagueHistorySnapshot) {
  const { managerById } = createHistoryIndexes(snapshot);
  return [...managerById.keys()]
    .map((managerId) => calculateManagerCareer(snapshot, managerId))
    .filter((career): career is ManagerCareerStats => career != null);
}
