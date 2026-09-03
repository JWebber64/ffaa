import { describe, expect, it, vi } from "vitest";

import type { ToolPlayer, ToolPosition } from "../data/toolPlayerData";
import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import {
  loadCurrentTeamForRater,
  teamRaterSettingsFromConnection,
  teamRaterSlotsFromSleeper,
} from "../screens/tools/currentTeamRater";

function player(id: string, sleeperId: string, position: ToolPosition): ToolPlayer {
  return {
    id,
    sleeperId,
    name: id,
    position,
    team: "BUF",
    rank: 1,
    positionRank: 1,
    byeWeek: 7,
    adp: 1,
    auctionValue: 20,
    marketValue: 20,
    projectedPoints: 200,
    projectedPointsPerGame: 12,
    valueConfidence: 1,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 17,
    historicalPoints: 190,
    historicalPointsPerGame: 11,
    last3PointsPerGame: 12,
    floorPoints: 8,
    ceilingPoints: 18,
    standardDeviation: 3,
    opportunitiesPerGame: 10,
    targetsPerGame: 5,
    carriesPerGame: 5,
    targetShare: .2,
    airYardsShare: .2,
    weeklyPoints: [],
    summary: null,
  };
}

const connection: SleeperLeagueConnectionSummary = {
  leagueId: "123456789012345678",
  leagueName: "Sunday League",
  season: "2026",
  status: "in_season",
  totalRosters: 10,
  sourceUrl: "https://sleeper.com/leagues/123456789012345678",
  lastUsedAt: "2026-09-03T00:00:00.000Z",
  managerProviderUserId: "manager-1",
  managerDisplayName: "Jamie",
  managerTeamName: "Fourth and Long",
  auctionSettings: {
    scoring: "ppr",
    scoringLabel: "Full PPR",
    teamCount: 10,
    budget: 200,
    budgetSource: "gamehq-default",
    rosterSize: 3,
    rosterSlots: [
      { slot: "QB", count: 1 },
      { slot: "FLEX", count: 1 },
      { slot: "BENCH", count: 1 },
    ],
  },
};

describe("current team rater", () => {
  it("normalizes Sleeper lineup slots and counts extra roster players as bench depth", () => {
    const slots = teamRaterSlotsFromSleeper([
      { slot: "QB", count: 1 },
      { slot: "RB_WR_TE", count: 1 },
      { slot: "SUPER_FLEX", count: 1 },
      { slot: "DST", count: 1 },
      { slot: "BN", count: 2 },
      { slot: "IR", count: 2 },
    ], 8);

    expect(Object.fromEntries(slots.map((slot) => [slot.position, slot.count]))).toMatchObject({
      QB: 1,
      FLEX: 1,
      SUPERFLEX: 1,
      DEF: 1,
      BENCH: 4,
    });
  });

  it("uses a connected league as a settings fallback before live data arrives", () => {
    const settings = teamRaterSettingsFromConnection(connection);

    expect(settings.scoring).toBe("ppr");
    expect(settings.teamCount).toBe(10);
    expect(settings.slots.find((slot) => slot.position === "FLEX")?.count).toBe(1);
  });

  it("loads the active manager roster and maps Sleeper ids to rating players", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/league/${connection.leagueId}`)) {
        return new Response(JSON.stringify({
          league_id: connection.leagueId,
          name: "Live Sunday League",
          total_rosters: 12,
          roster_positions: ["QB", "RB", "BN"],
          scoring_settings: { rec: .5 },
        }));
      }
      return new Response(JSON.stringify([{
        owner_id: "manager-1",
        players: ["101", "202", "303"],
        reserve: ["202"],
      }]));
    }) as unknown as typeof fetch;

    const result = await loadCurrentTeamForRater(
      connection,
      [player("internal-qb", "101", "QB"), player("internal-rb", "202", "RB")],
      new AbortController().signal,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.teamName).toBe("Fourth and Long");
    expect(result.leagueName).toBe("Live Sunday League");
    expect(result.players.map((item) => item.id)).toEqual(["internal-qb", "internal-rb"]);
    expect(result.providerRosterSize).toBe(3);
    expect(result.unmatchedPlayerCount).toBe(1);
    expect(result.reservePlayerCount).toBe(1);
    expect(result.settings.scoring).toBe("halfPpr");
    expect(result.settings.teamCount).toBe(12);
  });
});
