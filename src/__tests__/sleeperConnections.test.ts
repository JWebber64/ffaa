import { describe, expect, it } from "vitest";
import {
  mergeSleeperLeagueConnection,
  parseSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../features/league-hq/sleeperConnections";

function connection(
  leagueId: string,
  leagueName: string,
  lastUsedAt: string,
): SleeperLeagueConnectionSummary {
  return {
    leagueId,
    leagueName,
    season: "2026",
    status: "pre_draft",
    totalRosters: 12,
    sourceUrl: `https://sleeper.com/leagues/${leagueId}`,
    lastUsedAt,
    auctionSettings: {
      scoring: "ppr",
      scoringLabel: "Full PPR",
      teamCount: 12,
      budget: 200,
      budgetSource: "sleeper-draft",
      rosterSize: 12,
      rosterSlots: [
        { slot: "QB", count: 1 },
        { slot: "RB", count: 2 },
        { slot: "WR", count: 3 },
        { slot: "TE", count: 1 },
        { slot: "FLEX", count: 1 },
        { slot: "BENCH", count: 4 },
      ],
    },
  };
}

describe("Sleeper league connections", () => {
  it("rejects corrupt storage rows and normalizes safe defaults", () => {
    const parsed = parseSleeperLeagueConnections(JSON.stringify([
      connection("111111111111", "Alpha", "2026-08-10T00:00:00.000Z"),
      { leagueId: "not-an-id", leagueName: "Bad" },
      null,
      { leagueId: "222222222222" },
    ]));

    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({
      leagueId: "222222222222",
      leagueName: "League 222222222222",
      totalRosters: 0,
    });
    expect(parsed[0]?.auctionSettings).toMatchObject({ rosterSize: 12, scoring: "ppr" });
    expect(parseSleeperLeagueConnections("not-json")).toEqual([]);
  });

  it("deduplicates a reconnected league and orders the most recent first", () => {
    const oldAlpha = connection("111111111111", "Old Alpha", "2026-08-08T00:00:00.000Z");
    const beta = connection("222222222222", "Beta", "2026-08-09T00:00:00.000Z");
    const newAlpha = connection("111111111111", "New Alpha", "2026-08-10T00:00:00.000Z");

    const merged = mergeSleeperLeagueConnection([oldAlpha, beta], newAlpha);

    expect(merged.map((item) => item.leagueName)).toEqual(["New Alpha", "Beta"]);
  });
});
