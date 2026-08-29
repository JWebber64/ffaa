import { describe, expect, it } from "vitest";
import { getOfflineDraftTurn } from "../screens_v2/offlineDraftTurn";

describe("offline draft turn order", () => {
  it("reverses snake order every round", () => {
    expect(Array.from({ length: 8 }, (_, pick) => getOfflineDraftTurn("snake", pick, 4, 2).teamIndex)).toEqual([
      0, 1, 2, 3,
      3, 2, 1, 0,
    ]);
  });

  it("rotates auction nominations forward", () => {
    expect(Array.from({ length: 6 }, (_, pick) => getOfflineDraftTurn("auction", pick, 4, 2).teamIndex)).toEqual([
      0, 1, 2, 3, 0, 1,
    ]);
  });

  it("marks the draft complete at total roster capacity", () => {
    expect(getOfflineDraftTurn("snake", 8, 4, 2)).toMatchObject({ complete: true, teamIndex: null });
  });
});
