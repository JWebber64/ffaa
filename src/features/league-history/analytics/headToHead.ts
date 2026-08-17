import type {
  HeadToHeadStats,
  LeagueHistorySnapshot,
  RivalryMeeting,
} from "../domain/types";
import { chronologicalMatchups, createHistoryIndexes } from "./helpers";

function streaks(winners: Array<string | null>, managerId: string) {
  let longest = 0;
  let current = 0;
  for (const winner of winners) {
    if (winner === managerId) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function currentStreak(winners: Array<string | null>) {
  const managerId = winners.at(-1) ?? null;
  if (!managerId) return { managerId: null, games: 0 };
  let games = 0;
  for (let index = winners.length - 1; index >= 0; index -= 1) {
    if (winners[index] !== managerId) break;
    games += 1;
  }
  return { managerId, games };
}

export function calculateHeadToHead(
  snapshot: LeagueHistorySnapshot,
  managerAId: string,
  managerBId: string,
): HeadToHeadStats | null {
  if (managerAId === managerBId) return null;
  const { managerById, seasonById, franchiseById } = createHistoryIndexes(snapshot);
  const managerA = managerById.get(managerAId);
  const managerB = managerById.get(managerBId);
  if (!managerA || !managerB) return null;
  const franchiseIdsA = new Set(snapshot.franchises.filter((row) => row.managerId === managerAId).map((row) => row.id));
  const franchiseIdsB = new Set(snapshot.franchises.filter((row) => row.managerId === managerBId).map((row) => row.id));
  const rows = chronologicalMatchups(snapshot, snapshot.matchups.filter((matchup) => matchup.isComplete && (
    (franchiseIdsA.has(matchup.franchiseAId) && franchiseIdsB.has(matchup.franchiseBId))
    || (franchiseIdsA.has(matchup.franchiseBId) && franchiseIdsB.has(matchup.franchiseAId))
  )));
  const meetings: RivalryMeeting[] = rows.flatMap((matchup) => {
    const aIsLeft = franchiseIdsA.has(matchup.franchiseAId);
    const managerAFranchise = franchiseById.get(aIsLeft ? matchup.franchiseAId : matchup.franchiseBId);
    const managerBFranchise = franchiseById.get(aIsLeft ? matchup.franchiseBId : matchup.franchiseAId);
    const season = seasonById.get(matchup.leagueSeasonId);
    if (!managerAFranchise || !managerBFranchise || !season) return [];
    const managerAScore = aIsLeft ? matchup.scoreA : matchup.scoreB;
    const managerBScore = aIsLeft ? matchup.scoreB : matchup.scoreA;
    return [{
      matchup,
      season: season.season,
      managerAFranchise,
      managerBFranchise,
      managerAScore,
      managerBScore,
      winnerManagerId: managerAScore === managerBScore ? null : managerAScore > managerBScore ? managerAId : managerBId,
    }];
  });
  const winsA = meetings.filter((meeting) => meeting.winnerManagerId === managerAId).length;
  const winsB = meetings.filter((meeting) => meeting.winnerManagerId === managerBId).length;
  const totalPointsA = meetings.reduce((sum, meeting) => sum + meeting.managerAScore, 0);
  const totalPointsB = meetings.reduce((sum, meeting) => sum + meeting.managerBScore, 0);
  const margins = meetings.map((meeting) => Math.abs(meeting.managerAScore - meeting.managerBScore));
  const byMarginDesc = [...meetings].sort((left, right) =>
    Math.abs(right.managerAScore - right.managerBScore) - Math.abs(left.managerAScore - left.managerBScore));
  const byMarginAsc = [...byMarginDesc].reverse();
  const byCombinedDesc = [...meetings].sort((left, right) =>
    right.managerAScore + right.managerBScore - left.managerAScore - left.managerBScore);
  const winners = meetings.map((meeting) => meeting.winnerManagerId);
  const seasonGroups = new Map<number, RivalryMeeting[]>();
  for (const meeting of meetings) seasonGroups.set(meeting.season, [...(seasonGroups.get(meeting.season) ?? []), meeting]);
  let seasonSweepsA = 0;
  let seasonSweepsB = 0;
  for (const seasonMeetings of seasonGroups.values()) {
    if (seasonMeetings.length && seasonMeetings.every((meeting) => meeting.winnerManagerId === managerAId)) seasonSweepsA += 1;
    if (seasonMeetings.length && seasonMeetings.every((meeting) => meeting.winnerManagerId === managerBId)) seasonSweepsB += 1;
  }
  const playoffMeetings = meetings.filter((meeting) => meeting.matchup.isPlayoff);
  const championshipMeetings = meetings.filter((meeting) => meeting.matchup.isChampionship);

  return {
    managerA,
    managerB,
    meetings,
    winsA,
    winsB,
    ties: meetings.length - winsA - winsB,
    regularSeasonWinsA: meetings.filter((meeting) => !meeting.matchup.isPlayoff && meeting.winnerManagerId === managerAId).length,
    regularSeasonWinsB: meetings.filter((meeting) => !meeting.matchup.isPlayoff && meeting.winnerManagerId === managerBId).length,
    playoffWinsA: playoffMeetings.filter((meeting) => meeting.winnerManagerId === managerAId).length,
    playoffWinsB: playoffMeetings.filter((meeting) => meeting.winnerManagerId === managerBId).length,
    championshipWinsA: championshipMeetings.filter((meeting) => meeting.winnerManagerId === managerAId).length,
    championshipWinsB: championshipMeetings.filter((meeting) => meeting.winnerManagerId === managerBId).length,
    totalPointsA,
    totalPointsB,
    averagePointsA: meetings.length ? totalPointsA / meetings.length : 0,
    averagePointsB: meetings.length ? totalPointsB / meetings.length : 0,
    pointDifferential: totalPointsA - totalPointsB,
    averageMargin: margins.length ? margins.reduce((sum, margin) => sum + margin, 0) / margins.length : 0,
    biggestVictory: byMarginDesc[0] ?? null,
    closestGame: byMarginAsc[0] ?? null,
    highestScoringGame: byCombinedDesc[0] ?? null,
    lowestScoringGame: byCombinedDesc.at(-1) ?? null,
    currentStreak: currentStreak(winners),
    longestStreakA: streaks(winners, managerAId),
    longestStreakB: streaks(winners, managerBId),
    playoffMeetings: playoffMeetings.length,
    championshipMeetings: championshipMeetings.length,
    seasonSweepsA,
    seasonSweepsB,
    bestScoreA: meetings.length ? Math.max(...meetings.map((meeting) => meeting.managerAScore)) : null,
    bestScoreB: meetings.length ? Math.max(...meetings.map((meeting) => meeting.managerBScore)) : null,
    worstScoreA: meetings.length ? Math.min(...meetings.map((meeting) => meeting.managerAScore)) : null,
    worstScoreB: meetings.length ? Math.min(...meetings.map((meeting) => meeting.managerBScore)) : null,
  };
}
