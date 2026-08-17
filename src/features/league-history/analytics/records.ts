import type { HistoricalMatchup, LeagueHistorySnapshot, ManagerCareerStats, SeasonFranchise } from "../domain/types";
import { calculateAllManagerCareers } from "./career";

export interface LeagueRecordEntry {
  id: string;
  label: string;
  value: number;
  managerId: string | null;
  franchiseId: string | null;
  matchupId: string | null;
  leagueSeasonId: string | null;
  detail: string;
}

export interface LeagueRecordCategory {
  id: string;
  title: string;
  entries: LeagueRecordEntry[];
}

function matchupEntry(
  matchup: HistoricalMatchup,
  franchiseId: string,
  label: string,
  value: number,
  detail: string,
  managerIdByFranchise: Map<string, string | null>,
): LeagueRecordEntry {
  return {
    id: `${label}-${matchup.id}-${franchiseId}`,
    label,
    value,
    managerId: managerIdByFranchise.get(franchiseId) ?? null,
    franchiseId,
    matchupId: matchup.id,
    leagueSeasonId: matchup.leagueSeasonId,
    detail,
  };
}

function franchiseEntry(label: string, value: number, franchise: SeasonFranchise): LeagueRecordEntry {
  return {
    id: `${label}-${franchise.id}`,
    label,
    value,
    managerId: franchise.managerId,
    franchiseId: franchise.id,
    matchupId: null,
    leagueSeasonId: franchise.leagueSeasonId,
    detail: franchise.teamName,
  };
}

function careerEntry(label: string, value: number, career: ManagerCareerStats): LeagueRecordEntry {
  return {
    id: `${label}-${career.manager.id}`,
    label,
    value,
    managerId: career.manager.id,
    franchiseId: null,
    matchupId: null,
    leagueSeasonId: null,
    detail: career.manager.displayName,
  };
}

export function buildLeagueRecordBook(snapshot: LeagueHistorySnapshot): LeagueRecordCategory[] {
  const complete = snapshot.matchups.filter((matchup) => matchup.isComplete);
  const managerIdByFranchise = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise.managerId]));
  const weekly: LeagueRecordEntry[] = [];
  for (const matchup of complete) {
    const winnerId = matchup.scoreA === matchup.scoreB ? null : matchup.scoreA > matchup.scoreB ? matchup.franchiseAId : matchup.franchiseBId;
    const loserId = winnerId === matchup.franchiseAId ? matchup.franchiseBId : matchup.franchiseAId;
    weekly.push(matchupEntry(matchup, matchup.franchiseAId, "Weekly score", matchup.scoreA, `Week ${matchup.week}`, managerIdByFranchise));
    weekly.push(matchupEntry(matchup, matchup.franchiseBId, "Weekly score", matchup.scoreB, `Week ${matchup.week}`, managerIdByFranchise));
    if (winnerId && loserId) {
      const winnerScore = winnerId === matchup.franchiseAId ? matchup.scoreA : matchup.scoreB;
      const loserScore = loserId === matchup.franchiseAId ? matchup.scoreA : matchup.scoreB;
      weekly.push(matchupEntry(matchup, winnerId, "Winning score", winnerScore, `Won by ${matchup.margin.toFixed(2)}`, managerIdByFranchise));
      weekly.push(matchupEntry(matchup, loserId, "Losing score", loserScore, `Lost by ${matchup.margin.toFixed(2)}`, managerIdByFranchise));
      weekly.push(matchupEntry(matchup, winnerId, "Win margin", matchup.margin, `${winnerScore.toFixed(2)}-${loserScore.toFixed(2)}`, managerIdByFranchise));
    }
    weekly.push(matchupEntry(matchup, matchup.franchiseAId, "Combined score", matchup.scoreA + matchup.scoreB, `Week ${matchup.week}`, managerIdByFranchise));
  }
  const singleWeek = [
    ...weekly.filter((entry) => entry.label === "Weekly score").sort((a, b) => b.value - a.value).slice(0, 10),
    ...weekly.filter((entry) => entry.label === "Win margin").sort((a, b) => b.value - a.value).slice(0, 10),
    ...weekly.filter((entry) => entry.label === "Losing score").sort((a, b) => b.value - a.value).slice(0, 10),
  ];
  const seasonRows = [
    ...snapshot.franchises.map((row) => franchiseEntry("Season wins", row.wins, row)),
    ...snapshot.franchises.map((row) => franchiseEntry("Season points", row.pointsFor, row)),
    ...snapshot.franchises.map((row) => franchiseEntry("Point differential", row.pointsFor - row.pointsAgainst, row)),
  ].sort((left, right) => right.value - left.value);
  const careers = calculateAllManagerCareers(snapshot);
  const careerRows = [
    ...careers.map((row) => careerEntry("Career wins", row.wins, row)),
    ...careers.map((row) => careerEntry("Championships", row.championships, row)),
    ...careers.map((row) => careerEntry("Career points", row.pointsFor, row)),
    ...careers.map((row) => careerEntry("Playoff wins", row.playoffWins, row)),
  ].sort((left, right) => right.value - left.value);
  return [
    { id: "single-week", title: "Single week", entries: singleWeek },
    { id: "season", title: "Season", entries: seasonRows },
    { id: "career", title: "Career", entries: careerRows },
  ];
}
