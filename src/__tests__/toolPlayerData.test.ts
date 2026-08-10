import { describe, expect, it } from "vitest";

import type { PlayerStatRow } from "../data/playerStatCategories";
import { normalizeToolPosition, projectedPointsForScoring } from "../data/toolPlayerData";

function projectionRow(): PlayerStatRow {
  return {
    player: {
      id: "wr-1",
      name: "Example Receiver",
      pos: "WR",
      nflTeam: "BUF",
      rank: 1,
    },
    derived: {
      projectedFantasyPoints: 250,
      projectedFantasyPointsPerGame: 14.7,
      totalProjectedTouchdowns: 10,
      totalProjectedYards: 1_200,
      projectedTouches: 90,
      projectedYardsPerTouch: 13.3,
      valueSourceCount: 0,
      directValueSourceCount: 0,
      projectionSourceCount: 0,
    },
    espnClay: {
      passYards: 0,
      passTds: 0,
      interceptions: 0,
      rushYards: 100,
      rushTds: 1,
      receptions: 90,
      recYards: 1_100,
      recTds: 9,
    },
  };
}

describe("tool player projection scoring", () => {
  it("re-scores the same stat line for standard, half-PPR, and PPR", () => {
    const row = projectionRow();
    const standard = projectedPointsForScoring(row, "standard")!;
    const halfPpr = projectedPointsForScoring(row, "halfPpr")!;
    const ppr = projectedPointsForScoring(row, "ppr")!;

    expect(halfPpr - standard).toBe(45);
    expect(ppr - standard).toBe(90);
  });

  it("normalizes common fantasy position aliases", () => {
    expect(normalizeToolPosition("D/ST")).toBe("DEF");
    expect(normalizeToolPosition("PK")).toBe("K");
    expect(normalizeToolPosition("FB")).toBe("RB");
    expect(normalizeToolPosition("DL")).toBeNull();
  });
});
