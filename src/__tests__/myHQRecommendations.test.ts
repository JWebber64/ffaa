import { describe, expect, it } from "vitest";

import type { ToolPlayer } from "../data/toolPlayerData";
import {
  buildAvailableRecommendations,
  buildMyHQDecisions,
  isPlayerEligibleForSleeperSlot,
} from "../features/my-hq/myHQ";

function player(overrides: Partial<ToolPlayer>): ToolPlayer {
  return {
    id: "player-1",
    name: "Player",
    position: "WR",
    team: "BUF",
    rank: 1,
    positionRank: 1,
    byeWeek: 7,
    adp: 1,
    auctionValue: 50,
    marketValue: 50,
    projectedPoints: 255,
    projectedPointsPerGame: 15,
    valueConfidence: 0.8,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 0,
    historicalPoints: null,
    historicalPointsPerGame: null,
    last3PointsPerGame: null,
    floorPoints: null,
    ceilingPoints: null,
    standardDeviation: null,
    opportunitiesPerGame: null,
    targetsPerGame: null,
    carriesPerGame: null,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
    ...overrides,
  };
}

describe("My HQ league-aware recommendations", () => {
  it("uses Sleeper-compatible starter eligibility for flex and superflex slots", () => {
    expect(isPlayerEligibleForSleeperSlot("TE", "FLEX")).toBe(true);
    expect(isPlayerEligibleForSleeperSlot("QB", "FLEX")).toBe(false);
    expect(isPlayerEligibleForSleeperSlot("QB", "SUPER_FLEX")).toBe(true);
    expect(isPlayerEligibleForSleeperSlot("DST", "DEF")).toBe(true);
  });

  it("only recommends verified free agents and pairs them with a comparable bench drop", () => {
    const bench = [
      player({ id: "bench-wr", name: "Bench WR", projectedPointsPerGame: 9 }),
      player({ id: "bench-te", name: "Bench TE", position: "TE", projectedPointsPerGame: 8 }),
    ];
    const rosteredElsewhere = player({ id: "owned-wr", name: "Owned WR", projectedPointsPerGame: 20 });
    const freeAgent = player({
      id: "free-wr",
      name: "Free WR",
      projectedPointsPerGame: 14,
      projectionSourceCount: 4,
      projectionUpdatedAt: "2026-08-27",
    });

    const recommendations = buildAvailableRecommendations(
      [rosteredElsewhere, freeAgent, ...bench],
      new Set(["owned-wr", "bench-wr", "bench-te"]),
      bench,
      ["QB", "RB", "WR", "TE", "FLEX"],
    );

    expect(recommendations.map((recommendation) => recommendation.player.id)).toEqual(["free-wr"]);
    expect(recommendations[0]).toMatchObject({
      eligibleSlots: ["WR", "FLEX"],
      baselineGain: 5,
      confidence: "higher",
      dropPlayer: { id: "bench-wr" },
    });
    expect(recommendations[0]?.evidence).toContain("4 projection sources");
  });

  it("uses Sleeper player ids when excluding players rostered elsewhere", () => {
    const rosteredElsewhere = player({
      id: "2026-WR-rostered-star",
      sleeperId: "9999",
      name: "Rostered Star",
      projectedPointsPerGame: 20,
    });
    const freeAgent = player({
      id: "2026-WR-free-agent",
      sleeperId: "8888",
      name: "Free Agent",
      projectedPointsPerGame: 14,
    });

    const recommendations = buildAvailableRecommendations(
      [rosteredElsewhere, freeAgent],
      new Set(["9999"]),
      [],
      ["WR", "FLEX"],
    );

    expect(recommendations.map((recommendation) => recommendation.player.sleeperId)).toEqual(["8888"]);
  });

  it("finds a legal flex replacement and labels roster-set evidence for waiver advice", () => {
    const injuredStarter = player({
      id: "starter-wr",
      name: "Injured WR",
      injuryStatus: "Out",
      projectedPointsPerGame: 16,
    });
    const benchTightEnd = player({
      id: "bench-te",
      name: "Bench TE",
      position: "TE",
      projectedPointsPerGame: 11,
      projectionSourceCount: 3,
    });
    const freeAgent = player({ id: "free-wr", name: "Free WR", projectedPointsPerGame: 14 });
    const decisions = buildMyHQDecisions(
      "111111111111",
      4,
      ["starter-wr"],
      ["FLEX"],
      [injuredStarter],
      [benchTightEnd],
      [{
        id: "available-free-wr",
        player: freeAgent,
        dropPlayer: benchTightEnd,
        eligibleSlots: ["WR", "FLEX"],
        baselineGain: 3,
        confidence: "moderate",
        evidence: "2 projection sources · updated 8/27/2026",
      }],
    );

    expect(decisions[0]).toMatchObject({ urgency: "now" });
    expect(decisions[0]?.detail).toContain("Bench TE");
    expect(decisions.find((decision) => decision.id === "waiver-free-wr")).toMatchObject({
      urgency: "watch",
      actionTo: "/league/111111111111/players?position=WR",
    });
    expect(decisions.find((decision) => decision.id === "waiver-free-wr")?.evidence)
      .toContain("Current Sleeper roster set");
  });
});
