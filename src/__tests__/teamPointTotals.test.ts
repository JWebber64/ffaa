import { describe, expect, it } from "vitest";

import type { PlayerCareerSeason } from "../data/playerCareerStats";
import { careerFantasyPoints, sumAvailablePlayerPoints } from "../data/teamPointTotals";
import type { ToolPlayer, ToolPosition } from "../data/toolPlayerData";

function player(id: string, position: ToolPosition, projectedPoints: number | null): ToolPlayer {
  return {
    id,
    name: id,
    position,
    team: "BUF",
    rank: 1,
    positionRank: 1,
    byeWeek: 7,
    adp: 1,
    auctionValue: 10,
    marketValue: 10,
    projectedPoints,
    projectedPointsPerGame: projectedPoints === null ? null : projectedPoints / 17,
    valueConfidence: 0.8,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 17,
    historicalPoints: projectedPoints,
    historicalPointsPerGame: projectedPoints === null ? null : projectedPoints / 17,
    last3PointsPerGame: 10,
    floorPoints: 5,
    ceilingPoints: 15,
    standardDeviation: 3,
    opportunitiesPerGame: 12,
    targetsPerGame: 5,
    carriesPerGame: 7,
    targetShare: 0.2,
    airYardsShare: 0.2,
    weeklyPoints: [],
    summary: null,
  };
}

function careerSeason(overrides: Partial<PlayerCareerSeason> = {}): PlayerCareerSeason {
  return {
    playerId: "00-1",
    playerName: "Player",
    position: "RB",
    team: "BUF",
    season: 2025,
    games: 17,
    fantasyPoints: 200,
    fantasyPointsPerGame: 200 / 17,
    completions: 0,
    passingAttempts: 0,
    passingYards: 0,
    passingTouchdowns: 0,
    interceptions: 0,
    carries: 100,
    rushingYards: 500,
    rushingTouchdowns: 5,
    receptions: 30,
    targets: 40,
    receivingYards: 250,
    receivingTouchdowns: 2,
    fumblesLost: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    fieldGoalPercentage: null,
    extraPointsMade: 0,
    extraPointsAttempted: 0,
    ...overrides,
  };
}

describe("team point totals", () => {
  it("sums available roster points and reports coverage", () => {
    const players = [player("one", "QB", 320.5), player("two", "RB", null), player("three", "WR", 210)];

    expect(sumAvailablePlayerPoints(players, (entry) => entry.projectedPoints)).toEqual({
      total: 530.5,
      coveredPlayers: 2,
    });
  });

  it("sums full career fantasy points using the selected scoring result", () => {
    expect(careerFantasyPoints([
      careerSeason({ fantasyPoints: 200 }),
      careerSeason({ season: 2024, fantasyPoints: 175 }),
    ], "RB")).toBe(375);
  });

  it("uses a transparent three-point field-goal baseline for kicker career totals", () => {
    expect(careerFantasyPoints([
      careerSeason({ position: "K", fantasyPoints: 0, fieldGoalsMade: 30, extraPointsMade: 42 }),
    ], "K")).toBe(132);
  });
});
