import { describe, expect, it } from "vitest";

import { runWithConcurrency } from "../features/my-hq/useMyTeamsPortfolio";

describe("My Teams portfolio loading", () => {
  it("keeps concurrent Sleeper refreshes within the requested limit", async () => {
    let active = 0;
    let maximum = 0;

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
    });

    expect(maximum).toBe(3);
  });
});
