import { describe, expect, it } from "vitest";
import { valueSourceTitle } from "../components/player/valueSourceSummaryUtils";
import type { PlayerValueSource } from "../types/draft";

describe("value source summary", () => {
  it("formats source diagnostics with confidence, points, and updates", () => {
    const sources: PlayerValueSource[] = [
      {
        source: "WinWithOdds Vegas projections",
        kind: "projection",
        value: 306.05,
        normalizedValue: 55,
        projectedPoints: 306.05,
        weight: 0.65,
        updatedAt: "2026-07-05",
      },
      {
        source: "ESPN salary-cap values",
        kind: "auction",
        value: 46,
        normalizedValue: 46,
        weight: 1,
      },
    ];

    const title = valueSourceTitle(sources, 0.78, 304.2);

    expect(title).toContain("78% auction-source confidence");
    expect(title).toContain("Consensus projection: 304.2 pts");
    expect(title).toContain("WinWithOdds Vegas projections: 306.1 pts -> $55");
    expect(title).toContain("updated 2026-07-05");
    expect(title).toContain("ESPN salary-cap values: $46");
  });
});
