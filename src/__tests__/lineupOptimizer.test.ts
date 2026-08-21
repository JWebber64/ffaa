import { describe, expect, it } from "vitest";

import { optimizeLegalLineup, type LineupPlayer } from "../features/league-history/analytics/lineupOptimizer";

const goatSlots = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN", "BN"];

function player(id: string, position: string, fantasyPoints: number | null, isStarter = false): LineupPlayer {
  return { providerPlayerId: id, playerName: id, position, fantasyPoints, isStarter };
}

const goatPlayers = [
  player("qb-1", "QB", 20, true),
  player("rb-1", "RB", 10, true),
  player("rb-2", "RB", 9, true),
  player("wr-1", "WR", 8, true),
  player("wr-2", "WR", 7, true),
  player("wr-3", "WR", 6, true),
  player("te-1", "TE", 5, true),
  player("rb-3", "RB", 4, true),
  player("9226", "RB", 51.3),
  player("wr-4", "WR", 3),
  player("te-2", "TE", 2),
  player("qb-2", "QB", 1),
];

describe("legal lineup optimizer", () => {
  it("supports repeated positions and FLEX without using one player twice", () => {
    const result = optimizeLegalLineup(goatPlayers, goatSlots);
    expect(result).toMatchObject({ status: "valid", starterScore: 69, benchScore: 57.3, optimalScore: 116.3, pointsLeftOnBench: 47.3 });
    expect(result.optimalStartingPlayerIds).toHaveLength(8);
    expect(new Set(result.optimalStartingPlayerIds).size).toBe(8);
    expect(result.optimalStartingPlayerIds).toContain("9226");
    expect(result.optimalStartersUsed).toBe(7);
    expect(result.bestMissedSubstitution).toMatchObject({ incomingPlayerId: "9226", outgoingPlayerId: "rb-3", gain: 47.3 });
  });

  it("supports SUPER_FLEX eligibility", () => {
    const result = optimizeLegalLineup([
      player("qb-a", "QB", 20, true),
      player("rb-a", "RB", 10, true),
      player("qb-b", "QB", 30),
    ], ["QB", "SUPER_FLEX", "BN"]);
    expect(result).toMatchObject({ status: "valid", starterScore: 30, optimalScore: 50, pointsLeftOnBench: 20 });
    expect(result.optimalStartingPlayerIds).toEqual(["qb-a", "qb-b"]);
  });

  it("handles one player matching multiple slots without duplicate assignment", () => {
    const result = optimizeLegalLineup([
      player("rb-a", "RB", 20),
      player("wr-a", "WR", 15),
      player("te-a", "TE", 10),
    ], ["RB", "FLEX"]);
    expect(result.status).toBe("valid");
    expect(result.optimalScore).toBe(35);
    expect(new Set(result.optimalStartingPlayerIds).size).toBe(2);
  });

  it("breaks equal-score ties deterministically by provider player ID", () => {
    const result = optimizeLegalLineup([
      player("rb-b", "RB", 10),
      player("rb-a", "RB", 10),
    ], ["RB"]);
    expect(result.optimalStartingPlayerIds).toEqual(["rb-a"]);
  });

  it("treats null fantasy points as zero", () => {
    const result = optimizeLegalLineup([player("qb-null", "QB", null, true)], ["QB"]);
    expect(result).toMatchObject({ status: "valid", starterScore: 0, benchScore: 0, optimalScore: 0, pointsLeftOnBench: 0, lineupEfficiency: null });
  });

  it("returns incomplete when an eligible player is missing", () => {
    const result = optimizeLegalLineup([player("qb", "QB", 10, true)], ["QB", "TE"]);
    expect(result).toMatchObject({ status: "incomplete" });
    expect(result.missingSlots).toContain("TE 1");
  });

  it("returns unsupported instead of guessing an unknown starting slot", () => {
    const result = optimizeLegalLineup([player("lb", "LB", 10, true)], ["IDP_FLEX"]);
    expect(result).toMatchObject({ status: "unsupported", unsupportedSlots: ["IDP_FLEX"], optimalScore: null });
  });

  it("keeps a complete zero-point week valid but does not invent efficiency", () => {
    const result = optimizeLegalLineup([player("qb", "QB", 0, true)], ["QB"]);
    expect(result).toMatchObject({ status: "valid", optimalScore: 0, pointsLeftOnBench: 0, lineupEfficiency: null });
  });

  it("does not calculate an incomplete week", () => {
    const result = optimizeLegalLineup(goatPlayers, goatSlots, { isComplete: false });
    expect(result).toMatchObject({ status: "incomplete", optimalScore: null, pointsLeftOnBench: null });
  });
});
