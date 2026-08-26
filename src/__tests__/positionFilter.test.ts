import { describe, expect, it } from "vitest";

import { matchesPositionFilter } from "@/utils/positionFilter";

describe("matchesPositionFilter", () => {
  it("treats FLEX as RB, WR, and TE only", () => {
    expect(matchesPositionFilter("RB", "FLEX")).toBe(true);
    expect(matchesPositionFilter("WR", "FLEX")).toBe(true);
    expect(matchesPositionFilter("TE", "FLEX")).toBe(true);
    expect(matchesPositionFilter("QB", "FLEX")).toBe(false);
    expect(matchesPositionFilter("K", "FLEX")).toBe(false);
    expect(matchesPositionFilter("DEF", "FLEX")).toBe(false);
  });

  it("keeps All and DEF aliases working", () => {
    expect(matchesPositionFilter("QB", "ALL")).toBe(true);
    expect(matchesPositionFilter("DST", "DEF")).toBe(true);
  });
});
