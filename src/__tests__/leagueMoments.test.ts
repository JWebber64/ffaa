import { describe, expect, it } from "vitest";

import {
  generateLeagueMoments,
  type MomentSeasonInput,
} from "../features/league-history/analytics/leagueMoments";

function seasonWithResults(winners: Array<1 | 2 | null>): MomentSeasonInput {
  return {
    externalLeagueId: "goat-test",
    season: 2025,
    franchises: [
      { providerRosterId: 1, teamName: "Alpha", manager: { providerUserId: "manager-a", displayName: "A" } },
      { providerRosterId: 2, teamName: "Bravo", manager: { providerUserId: "manager-b", displayName: "B" } },
    ],
    weeklyResults: [],
    matchups: winners.map((winnerRosterId, index) => ({
      week: index + 1,
      providerMatchupId: String(index + 1),
      rosterAId: 1,
      rosterBId: 2,
      scoreA: winnerRosterId === 1 ? 100 : 90,
      scoreB: winnerRosterId === 2 ? 100 : 90,
      winnerRosterId,
      margin: winnerRosterId == null ? 0 : 10,
      isComplete: true,
      isChampionship: false,
    })),
  };
}

describe("permanent league moments", () => {
  it("only emits a winning-streak record when the consecutive streak grows", () => {
    const moments = generateLeagueMoments([seasonWithResults([1, 1, 1, 2, 1, 1])]);
    const streakRecords = moments.filter((moment) => moment.momentType === "longest_winning_streak_record");

    expect(streakRecords.map((moment) => moment.newValue)).toEqual([2, 3]);
    expect(streakRecords.map((moment) => moment.previousValue)).toEqual([1, 2]);
  });

  it("uses deterministic, unique source keys", () => {
    const input = seasonWithResults([1, 1, 2, 2, 2]);
    const first = generateLeagueMoments([input]).map((moment) => moment.sourceKey);
    const second = generateLeagueMoments([structuredClone(input)]).map((moment) => moment.sourceKey);

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});
