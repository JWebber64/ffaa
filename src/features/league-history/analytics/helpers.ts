import type {
  HistoricalMatchup,
  LeagueHistorySnapshot,
  Manager,
  SeasonFranchise,
} from "../domain/types";

export function createHistoryIndexes(snapshot: LeagueHistorySnapshot) {
  return {
    managerById: new Map(snapshot.managers.map((manager) => [manager.id, manager])),
    seasonById: new Map(snapshot.seasons.map((season) => [season.id, season])),
    franchiseById: new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise])),
  };
}

export function managerForFranchise(
  franchise: SeasonFranchise | undefined,
  managerById: Map<string, Manager>,
) {
  return franchise?.managerId ? managerById.get(franchise.managerId) ?? null : null;
}

export function completedMatchups(snapshot: LeagueHistorySnapshot) {
  return snapshot.matchups.filter((matchup) => matchup.isComplete);
}

export function chronologicalMatchups(snapshot: LeagueHistorySnapshot, rows: HistoricalMatchup[]) {
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season.season]));
  return [...rows].sort((left, right) =>
    (seasonById.get(left.leagueSeasonId) ?? 0) - (seasonById.get(right.leagueSeasonId) ?? 0)
    || left.week - right.week
    || left.id.localeCompare(right.id));
}

export function franchiseScore(matchup: HistoricalMatchup, franchiseId: string) {
  if (matchup.franchiseAId === franchiseId) return matchup.scoreA;
  if (matchup.franchiseBId === franchiseId) return matchup.scoreB;
  return null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
