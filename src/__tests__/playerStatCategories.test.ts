import { describe, expect, it } from "vitest";

import { buildPlayerStatRows } from "@/data/playerStatCategories";
import type { Player } from "@/types/draft";

describe("buildPlayerStatRows player identity aliases", () => {
  it("merges ESPN's Ken Walker projection into the canonical Kenneth Walker player", () => {
    const player: Player = {
      id: "2026-RB-Kenneth-Walker-III",
      name: "Kenneth Walker III",
      pos: "RB",
      nflTeam: "KC",
      projectedPoints: 236.5,
      projectionSourceCount: 4,
      projectionLow: 216.2,
      projectionHigh: 257.9,
    };

    const walkerRows = buildPlayerStatRows([player]).filter((row) =>
      /^(ken|kenneth) walker iii$/i.test(row.player.name),
    );

    expect(walkerRows).toHaveLength(1);
    expect(walkerRows[0]?.player.name).toBe("Kenneth Walker III");
    expect(walkerRows[0]?.espnClay?.name).toBe("Ken Walker III");
    expect(walkerRows[0]?.player.projectedPoints).toBe(236.5);
  });
});
