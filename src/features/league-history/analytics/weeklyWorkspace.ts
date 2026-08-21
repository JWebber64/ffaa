import type {
  HistoricalMatchup,
  LeagueHistorySnapshot,
  LeagueSeason,
  Manager,
  SeasonFranchise,
} from "../domain/types";

export interface CompletedWeekOption {
  season: number;
  week: number;
  leagueSeasonId: string;
}

export interface WeeklyMatchupView {
  matchup: HistoricalMatchup;
  franchiseA: SeasonFranchise;
  franchiseB: SeasonFranchise;
  managerA: Manager | null;
  managerB: Manager | null;
  h2h: { winsA: number; winsB: number; ties: number };
}

export interface WeekStanding {
  franchise: SeasonFranchise;
  manager: Manager | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  previousRank: number | null;
  rankMovement: number | null;
}

function matchupOrder(
  left: HistoricalMatchup,
  right: HistoricalMatchup,
  seasons: ReadonlyMap<string, LeagueSeason>,
) {
  const seasonDifference = (seasons.get(left.leagueSeasonId)?.season ?? 0) - (seasons.get(right.leagueSeasonId)?.season ?? 0);
  return seasonDifference || left.week - right.week || left.providerMatchupId.localeCompare(right.providerMatchupId);
}

export function getCompletedWeekOptions(snapshot: LeagueHistorySnapshot): CompletedWeekOption[] {
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const unique = new Map<string, CompletedWeekOption>();
  for (const matchup of snapshot.matchups.filter((row) => row.isComplete)) {
    const season = seasonById.get(matchup.leagueSeasonId);
    if (!season) continue;
    const key = `${season.season}:${matchup.week}`;
    unique.set(key, { season: season.season, week: matchup.week, leagueSeasonId: season.id });
  }
  return [...unique.values()].sort((left, right) => left.season - right.season || left.week - right.week);
}

export function getDefaultCompletedWeek(snapshot: LeagueHistorySnapshot) {
  return getCompletedWeekOptions(snapshot).at(-1) ?? null;
}

export function getWeekNeighbors(snapshot: LeagueHistorySnapshot, season: number, week: number) {
  const options = getCompletedWeekOptions(snapshot);
  const index = options.findIndex((option) => option.season === season && option.week === week);
  return {
    previous: index > 0 ? options[index - 1]! : null,
    next: index >= 0 && index < options.length - 1 ? options[index + 1]! : null,
  };
}

function managerForFranchise(snapshot: LeagueHistorySnapshot, franchise: SeasonFranchise) {
  return snapshot.managers.find((manager) => manager.id === franchise.managerId) ?? null;
}

export function buildWeeklyMatchups(snapshot: LeagueHistorySnapshot, season: LeagueSeason, week: number): WeeklyMatchupView[] {
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const seasonById = new Map(snapshot.seasons.map((row) => [row.id, row]));
  const allMatchups = snapshot.matchups.filter((matchup) => matchup.isComplete).sort((left, right) => matchupOrder(left, right, seasonById));
  return allMatchups.filter((matchup) => matchup.leagueSeasonId === season.id && matchup.week === week).flatMap((matchup): WeeklyMatchupView[] => {
    const franchiseA = franchiseById.get(matchup.franchiseAId);
    const franchiseB = franchiseById.get(matchup.franchiseBId);
    if (!franchiseA || !franchiseB) return [];
    const managerA = managerForFranchise(snapshot, franchiseA);
    const managerB = managerForFranchise(snapshot, franchiseB);
    const h2h = { winsA: 0, winsB: 0, ties: 0 };
    if (managerA && managerB) {
      for (const historical of allMatchups) {
        if (matchupOrder(historical, matchup, seasonById) > 0) break;
        const left = franchiseById.get(historical.franchiseAId);
        const right = franchiseById.get(historical.franchiseBId);
        if (!left?.managerId || !right?.managerId) continue;
        const pair = new Set([left.managerId, right.managerId]);
        if (!pair.has(managerA.id) || !pair.has(managerB.id)) continue;
        if (!historical.winnerFranchiseId) h2h.ties += 1;
        else {
          const winner = franchiseById.get(historical.winnerFranchiseId)?.managerId;
          if (winner === managerA.id) h2h.winsA += 1;
          if (winner === managerB.id) h2h.winsB += 1;
        }
      }
    }
    return [{ matchup, franchiseA, franchiseB, managerA, managerB, h2h }];
  });
}

interface StandingAccumulator {
  franchise: SeasonFranchise;
  manager: Manager | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

function standingsThrough(snapshot: LeagueHistorySnapshot, season: LeagueSeason, week: number) {
  const entries = snapshot.franchises.filter((franchise) => franchise.leagueSeasonId === season.id);
  const state = new Map(entries.map((franchise): [string, StandingAccumulator] => [franchise.id, {
    franchise,
    manager: managerForFranchise(snapshot, franchise),
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }]));
  for (const matchup of snapshot.matchups.filter((row) => row.leagueSeasonId === season.id && row.isComplete && row.week <= week)) {
    const left = state.get(matchup.franchiseAId);
    const right = state.get(matchup.franchiseBId);
    if (!left || !right) continue;
    left.pointsFor += matchup.scoreA;
    left.pointsAgainst += matchup.scoreB;
    right.pointsFor += matchup.scoreB;
    right.pointsAgainst += matchup.scoreA;
    if (!matchup.winnerFranchiseId) {
      left.ties += 1;
      right.ties += 1;
    } else if (matchup.winnerFranchiseId === left.franchise.id) {
      left.wins += 1;
      right.losses += 1;
    } else {
      right.wins += 1;
      left.losses += 1;
    }
  }
  return [...state.values()].sort((left, right) => {
    const leftGames = left.wins + left.losses + left.ties;
    const rightGames = right.wins + right.losses + right.ties;
    const leftPercentage = leftGames ? (left.wins + left.ties / 2) / leftGames : 0;
    const rightPercentage = rightGames ? (right.wins + right.ties / 2) / rightGames : 0;
    return rightPercentage - leftPercentage
      || right.pointsFor - left.pointsFor
      || (right.pointsFor - right.pointsAgainst) - (left.pointsFor - left.pointsAgainst)
      || left.franchise.providerRosterId - right.franchise.providerRosterId;
  });
}

export function buildStandingsThroughWeek(snapshot: LeagueHistorySnapshot, season: LeagueSeason, week: number): WeekStanding[] {
  const current = standingsThrough(snapshot, season, week);
  const previous = week > 1 ? standingsThrough(snapshot, season, week - 1) : [];
  const previousRanks = new Map(previous.map((row, index) => [row.franchise.id, index + 1]));
  return current.map((row, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(row.franchise.id) ?? null;
    return {
      ...row,
      pointsFor: Math.round(row.pointsFor * 100) / 100,
      pointsAgainst: Math.round(row.pointsAgainst * 100) / 100,
      rank,
      previousRank,
      rankMovement: previousRank == null ? null : previousRank - rank,
    };
  });
}
