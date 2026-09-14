import { describe, expect, it } from "vitest";

import {
  indexSleeperMatchupPlayerPoints,
  sleeperMatchupScore,
} from "../features/my-hq/myHQ";

describe("Sleeper live matchup scoring", () => {
  it("uses the normal Sleeper score when no commissioner override exists", () => {
    expect(sleeperMatchupScore({ roster_id: 3, points: 122.2, custom_points: null })).toBe(122.2);
  });

  it("preserves an explicit zero score and honors a numeric commissioner override", () => {
    expect(sleeperMatchupScore({ roster_id: 3, points: 0, custom_points: null })).toBe(0);
    expect(sleeperMatchupScore({ roster_id: 3, points: 122.2, custom_points: 124.2 })).toBe(124.2);
  });

  it("indexes Sleeper player points without losing a real zero", () => {
    const points = indexSleeperMatchupPlayerPoints({
      roster_id: 3,
      players_points: { "7523": 26.1, "8121": 0, unavailable: null },
    });

    expect(points.get("7523")).toBe(26.1);
    expect(points.get("8121")).toBe(0);
    expect(points.has("unavailable")).toBe(false);
  });
});
