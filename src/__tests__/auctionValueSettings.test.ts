import { describe, expect, it } from "vitest";
import {
  auctionValueOptionsFromSettings,
  draftedRosterSize,
  normalizeAuctionValueScoring,
} from "../data/auctionValueSettings";

describe("auction value league settings", () => {
  it("excludes IR from drafted roster demand", () => {
    expect(draftedRosterSize([
      { slot: "QB", count: 1 },
      { slot: "RB", count: 2 },
      { slot: "BENCH", count: 6 },
      { slot: "IR", count: 2 },
    ])).toBe(9);
  });

  it("normalizes draft settings into value-engine options", () => {
    expect(auctionValueOptionsFromSettings({
      scoring: "half_ppr",
      teamCount: 14,
      rosterSlots: [
        { slot: "QB", count: 1 },
        { slot: "RB", count: 3 },
        { slot: "WR", count: 3 },
        { slot: "BENCH", count: 7 },
        { slot: "IR", count: 1 },
      ],
      auctionSettings: { defaultBudget: 250 },
    })).toEqual({
      scoring: "halfPpr",
      teamCount: 14,
      rosterSize: 14,
      budget: 250,
    });
  });

  it("accepts runtime half-PPR spellings", () => {
    expect(normalizeAuctionValueScoring("half-ppr")).toBe("halfPpr");
    expect(normalizeAuctionValueScoring("standard")).toBe("standard");
  });
});
