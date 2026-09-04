import { describe, expect, it } from "vitest";
import {
  MAX_SLEEPER_LEAGUE_CONNECTIONS,
  mergeSleeperLeagueConnection,
  mergeSleeperLeagueConnections,
  mergeSyncedSleeperLeagueConnections,
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

  it("preserves the permanent Sleeper manager identity used by This Week", () => {
    const saved = {
      ...connection("111111111111", "Alpha", "2026-08-10T00:00:00.000Z"),
      managerProviderUserId: "user-123",
      managerDisplayName: "Test Manager",
      managerAvatarUrl: "https://sleepercdn.com/avatars/thumbs/manager-avatar",
      leagueOwnerProviderUserId: "commissioner-456",
    };
    const parsed = parseSleeperLeagueConnections(JSON.stringify([saved]));

    expect(parsed[0]).toMatchObject({
      leagueId: "111111111111",
      managerProviderUserId: "user-123",
      managerDisplayName: "Test Manager",
      managerAvatarUrl: "https://sleepercdn.com/avatars/thumbs/manager-avatar",
      leagueOwnerProviderUserId: "commissioner-456",
    });
  });

  it("merges cloud and local leagues while preserving fields from the newest connection", () => {
    const local = {
      ...connection("111111111111", "Local Alpha", "2026-08-10T00:00:00.000Z"),
      managerProviderUserId: "manager-local",
      managerTeamName: "Local Team",
    };
    const remoteNewer = {
      ...connection("111111111111", "Cloud Alpha", "2026-08-11T00:00:00.000Z"),
      managerRecord: "8-3",
      leagueOwnerProviderUserId: "commissioner-456",
    };
    const remoteOnly = connection("222222222222", "Cloud Beta", "2026-08-09T00:00:00.000Z");

    const merged = mergeSyncedSleeperLeagueConnections([local], [remoteNewer, remoteOnly]);

    expect(merged.map((item) => item.leagueName)).toEqual(["Cloud Alpha", "Cloud Beta"]);
    expect(merged[0]).toMatchObject({
      managerProviderUserId: "manager-local",
      managerTeamName: "Local Team",
      managerRecord: "8-3",
      leagueOwnerProviderUserId: "commissioner-456",
    });
  });

  it("adds several leagues atomically and keeps the most recent twelve", () => {
    const additions = Array.from({ length: MAX_SLEEPER_LEAGUE_CONNECTIONS + 2 }, (_, index) => (
      connection(
        String(100000000000 + index),
        `League ${index}`,
        new Date(Date.UTC(2026, 7, 10, 0, 0, index)).toISOString(),
      )
    ));

    const merged = mergeSleeperLeagueConnections([], additions);

    expect(merged).toHaveLength(MAX_SLEEPER_LEAGUE_CONNECTIONS);
    expect(merged[0]?.leagueName).toBe(`League ${MAX_SLEEPER_LEAGUE_CONNECTIONS + 1}`);
    expect(merged.at(-1)?.leagueName).toBe("League 2");
  });
});
