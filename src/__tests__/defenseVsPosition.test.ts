import { describe, expect, it } from "vitest";

import { buildDefenseVsPosition } from "../data/defenseVsPosition";
import type { WeeklyPlayerStatRow } from "../data/weeklyPlayerStats";

function weeklyRow(overrides: Partial<WeeklyPlayerStatRow>): WeeklyPlayerStatRow {
  return {
    playerId: "player",
    playerName: "Test Player",
    shortName: "T.Player",
    position: "RB",
    positionGroup: "RB",
    headshotUrl: null,
    team: "BUF",
    opponent: "MIA",
    season: 2025,
    week: 1,
    seasonType: "REG",
    gameId: "2025_01_BUF_MIA",
    standardFantasyPoints: 10,
    halfPprFantasyPoints: 10,
    pprFantasyPoints: 10,
    selectedFantasyPoints: 10,
    stats: {},
    ...overrides,
  };
}

describe("buildDefenseVsPosition", () => {
  it("aggregates all players at a position per defense game and regresses small samples", () => {
    const ratings = buildDefenseVsPosition([
      weeklyRow({ playerId: "rb-1", selectedFantasyPoints: 12 }),
      weeklyRow({ playerId: "rb-2", selectedFantasyPoints: 8 }),
      weeklyRow({
        playerId: "rb-3",
        team: "NYJ",
        opponent: "NE",
        gameId: "2025_01_NYJ_NE",
        selectedFantasyPoints: 10,
      }),
    ], { regressionGames: 4 });

    const miami = ratings.find((rating) => rating.team === "MIA" && rating.position === "RB");
    const newEngland = ratings.find((rating) => rating.team === "NE" && rating.position === "RB");

    expect(miami).toMatchObject({ games: 1, pointsAllowed: 20, pointsAllowedPerGame: 20 });
    expect(newEngland).toMatchObject({ games: 1, pointsAllowed: 10, pointsAllowedPerGame: 10 });
    expect(miami!.regressedPointsAllowedPerGame).toBeLessThan(20);
    expect(miami!.regressedPointsAllowedPerGame).toBeGreaterThan(newEngland!.regressedPointsAllowedPerGame);
    expect(miami!.favorableRank).toBe(1);
  });

  it("normalizes common defense and position aliases", () => {
    const [rating] = buildDefenseVsPosition([
      weeklyRow({ position: "FB", positionGroup: "RB", opponent: "JAC" }),
    ]);
    expect(rating).toMatchObject({ team: "JAX", position: "RB" });
  });
});
