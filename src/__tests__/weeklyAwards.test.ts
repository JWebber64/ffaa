import { describe, expect, it } from "vitest";

import { optimizeLegalLineup, type LineupPlayer } from "../features/league-history/analytics/lineupOptimizer";
import { generateWeeklyAwards, type WeeklyAwardRosterInput } from "../features/league-history/analytics/weeklyAwards";

function player(id: string, position: string, fantasyPoints: number, isStarter: boolean, lineupSlot?: string): LineupPlayer {
  return { providerPlayerId: id, playerName: id === "9226" ? "De'Von Achane" : id, position, fantasyPoints, isStarter, ...(lineupSlot ? { lineupSlot } : {}) };
}

function roster(providerRosterId: number, score: number, pointsLeft: number, efficiency: number, players: LineupPlayer[], isComplete = true): WeeklyAwardRosterInput {
  const analytics = optimizeLegalLineup(players, ["QB"]);
  return {
    providerRosterId,
    score,
    isComplete,
    players,
    analytics: {
      ...analytics,
      status: "valid",
      optimalScore: score + pointsLeft,
      pointsLeftOnBench: pointsLeft,
      lineupEfficiency: efficiency,
      starterScore: score,
    },
  };
}

const rosters = [
  roster(1, 137.62, 47.3, 0.744, [player("qb-1", "QB", 20, true), player("9226", "RB", 51.3, false)]),
  roster(2, 120, 5, 0.96, [player("qb-2", "QB", 45.46, true), player("bench-2", "WR", 10, false)]),
  roster(3, 110, 0, 1, [player("qb-3", "QB", 25, true), player("bench-3", "WR", 9, false)]),
  roster(4, 100, 3, 0.97, [player("qb-4", "QB", 24, true), player("bench-4", "WR", 8, false)]),
  roster(5, 90, 2, 0.98, [player("qb-5", "QB", 23, true), player("bench-5", "WR", 7, false)]),
  roster(6, 73.16, 1, 0.99, [player("qb-6", "QB", 22, true), player("bench-6", "WR", 6, false)]),
];

const input = {
  leagueExternalId: "goat-2023",
  season: 2023,
  week: 3,
  rosters,
  matchups: [
    { providerMatchupId: "1", rosterAId: 1, rosterBId: 2, scoreA: 137.62, scoreB: 120, winnerRosterId: 1, margin: 17.62, isComplete: true },
    { providerMatchupId: "2", rosterAId: 3, rosterBId: 4, scoreA: 110, scoreB: 100, winnerRosterId: 3, margin: 10, isComplete: true },
    { providerMatchupId: "3", rosterAId: 5, rosterBId: 6, scoreA: 90, scoreB: 73.16, winnerRosterId: 5, margin: 16.84, isComplete: true },
  ],
};

describe("deterministic weekly awards", () => {
  it("generates all factual initial award types", () => {
    const awards = generateWeeklyAwards(input);
    expect(Object.fromEntries(awards.map((award) => [award.awardType, award]))).toMatchObject({
      weekly_high_score: { providerRosterId: 1, numericValue: 137.62 },
      weekly_low_score: { providerRosterId: 6, numericValue: 73.16 },
      narrow_escape: { providerRosterId: 3, numericValue: 10 },
      biggest_beatdown: { providerRosterId: 1, numericValue: 17.62 },
      bench_disaster: { providerRosterId: 1, numericValue: 47.3 },
      lineup_genius: { providerRosterId: 3, numericValue: 1 },
      top_starting_player: { providerRosterId: 2, numericValue: 45.46 },
      top_bench_player: { providerRosterId: 1, providerPlayerId: "9226", playerName: "De'Von Achane", numericValue: 51.3 },
    });
  });

  it("returns the same idempotent source keys on rerun", () => {
    const first = generateWeeklyAwards(input).map((award) => award.sourceKey);
    const second = generateWeeklyAwards(structuredClone(input)).map((award) => award.sourceKey);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it("uses the recorded starting slot for every natural-position honor", () => {
    const players = [
      player("qb-natural", "QB", 20, true, "QB"),
      player("rb-natural", "RB", 15, true, "RB"),
      player("rb-flex", "RB", 40, true, "FLEX"),
      player("wr-natural", "WR", 16, true, "WR"),
      player("wr-flex", "WR", 35, true, "FLEX"),
      player("te-natural", "TE", 18, true, "TE"),
      player("te-flex", "TE", 30, true, "FLEX"),
      player("k-natural", "K", 14, true, "K"),
      player("def-natural", "DEF", 13, true, "DEF"),
    ];
    const awards = generateWeeklyAwards({
      leagueExternalId: "slot-aware",
      season: 2026,
      week: 1,
      rosters: [roster(99, players.reduce((sum, entry) => sum + entry.fantasyPoints!, 0), 0, 1, players)],
      matchups: [],
      includePositionAwards: true,
    });
    const positional = awards.filter((award) => award.awardType === "top_position_player");
    expect(Object.fromEntries(positional.map((award) => [award.position, award.providerPlayerId]))).toEqual({
      QB: "qb-natural",
      RB: "rb-natural",
      WR: "wr-natural",
      TE: "te-natural",
      K: "k-natural",
      DST: "def-natural",
    });
    expect(awards.find((award) => award.awardType === "top_flex_player")).toMatchObject({ position: "FLEX", providerPlayerId: "rb-flex", numericValue: 40 });
  });

  it("withholds slot-based position honors when slot evidence is unavailable", () => {
    const awards = generateWeeklyAwards({ ...input, includePositionAwards: true });
    expect(awards.filter((award) => ["top_position_player", "top_flex_player"].includes(award.awardType))).toEqual([]);
    expect(awards.some((award) => award.awardType === "top_starting_player")).toBe(true);
  });

  it("excludes incomplete preseason data", () => {
    const awards = generateWeeklyAwards({
      leagueExternalId: "goat-2026",
      season: 2026,
      week: 1,
      rosters: [roster(1, 0, 0, 0, [player("0", "", 0, false)], false)],
      matchups: [],
    });
    expect(awards).toEqual([]);
  });
});
