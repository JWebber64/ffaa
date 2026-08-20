import { describe, expect, it } from "vitest";

import {
  buildTeamRaterNavigationState,
  readTeamRaterNavigationState,
} from "../screens/tools/teamRaterNavigation";

describe("team rater navigation", () => {
  it("carries a built auction roster and lineup settings into the team rater", () => {
    const state = buildTeamRaterNavigationState({
      rosterIds: ["player-1", "player-2", "player-1"],
      teamCount: 10,
      scoring: "halfPpr",
      slots: {
        QB: 1,
        RB: 2,
        WR: 3,
        TE: 1,
        FLEX: 2,
        K: 0,
        DEF: 1,
        BENCH: 5,
      },
    });

    expect(state.rosterIds).toEqual(["player-1", "player-2"]);
    expect(state.teamCount).toBe(10);
    expect(state.scoring).toBe("halfPpr");
    expect(state.slots.find((slot) => slot.position === "WR")?.count).toBe(3);
    expect(state.slots.find((slot) => slot.position === "SUPERFLEX")?.count).toBe(0);
    expect(readTeamRaterNavigationState(state)).toEqual(state);
  });

  it("ignores unrelated route state", () => {
    expect(readTeamRaterNavigationState({ source: "other-tool" })).toBeNull();
  });
});
