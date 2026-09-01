import { describe, expect, it } from "vitest";

import type { ToolPlayer } from "../data/toolPlayerData";
import { getLeagueProjectionFreshness, projectionFreshnessSummary } from "../features/league-season/leagueProjectionFreshness";

function player(overrides: Partial<ToolPlayer>): ToolPlayer {
  return {
    id: "player-1",
    name: "Player",
    position: "QB",
    team: "BUF",
    rank: 1,
    positionRank: 1,
    byeWeek: 7,
    adp: 1,
    auctionValue: 50,
    marketValue: 50,
    projectedPoints: 340,
    projectedPointsPerGame: 20,
    valueConfidence: 0.8,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 0,
    historicalPoints: null,
    historicalPointsPerGame: null,
    last3PointsPerGame: null,
    floorPoints: null,
    ceilingPoints: null,
    standardDeviation: null,
    opportunitiesPerGame: null,
    targetsPerGame: null,
    carriesPerGame: null,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
    ...overrides,
  };
}

describe("league projection freshness", () => {
  it("reports the newest refresh and largest independent source set", () => {
    const freshness = getLeagueProjectionFreshness([
      player({ projectionSourceCount: 3, projectionUpdatedAt: "2026-08-22" }),
      player({ id: "player-2", projectionSourceCount: 5, projectionUpdatedAt: "2026-08-27" }),
    ]);

    expect(freshness).toMatchObject({ matchedPlayers: 2, sourceCount: 5, updatedAt: "2026-08-27" });
    expect(projectionFreshnessSummary(freshness)).toContain("5 independent public sources");
  });
});
