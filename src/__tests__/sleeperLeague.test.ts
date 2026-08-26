import { describe, expect, it } from "vitest";
import {
  findSleeperLeagues,
  loadSleeperLeagueHQ,
  mergeSleeperLeagueHQ,
  normalizeSleeperLeagueLookup,
} from "../features/league-hq/sleeperLeague";

function createSleeperFetcher() {
  const payloads = new Map<string, unknown>([
    ["/state/nfl", { week: 18, display_week: 18, season: "2025" }],
    ["/league/1234567890", {
      league_id: "league-2025",
      name: "Test League",
      season: "2025",
      status: "complete",
      total_rosters: 2,
      previous_league_id: null,
      draft_id: "draft-2025",
      settings: { playoff_week_start: 1, reserve_slots: 1, waiver_budget: 100, trade_deadline: 11 },
      scoring_settings: { rec: 1, pass_td: 4, rush_td: 6 },
      roster_positions: ["QB", "RB", "WR", "FLEX", "BN"],
    }],
    ["/league/league-2025/users", [
      { user_id: "user-a", display_name: "Manager A", is_owner: true, metadata: { team_name: "Alpha" } },
      { user_id: "user-b", display_name: "Manager B", is_owner: false, metadata: { team_name: "Beta" } },
    ]],
    ["/league/league-2025/rosters", [
      { roster_id: 1, owner_id: "user-a", settings: { wins: 10, losses: 4, ties: 0, fpts: 1500, fpts_against: 1400, total_moves: 20, waiver_budget_used: 40 } },
      { roster_id: 2, owner_id: "user-b", settings: { wins: 8, losses: 6, ties: 0, fpts: 1450, fpts_against: 1460, total_moves: 15, waiver_budget_used: 60 } },
    ]],
    ["/league/league-2025/winners_bracket", [{ r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2, p: 1 }]],
    ["/league/league-2025/losers_bracket", [{ r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2, p: 1 }]],
    ["/league/league-2025/drafts", [{
      draft_id: "draft-2025",
      type: "auction",
      status: "complete",
      start_time: 1_750_000_000_000,
      settings: { budget: 200 },
      slot_to_roster_id: { "1": 1, "2": 2 },
    }]],
    ["/league/league-2025/matchups/1", [
      { roster_id: 1, matchup_id: 1, points: 110 },
      { roster_id: 2, matchup_id: 1, points: 100 },
    ]],
    ["/league/league-2025/matchups/2", [
      { roster_id: 1, matchup_id: 1, points: 90 },
      { roster_id: 2, matchup_id: 1, points: 120 },
    ]],
    ["/league/league-2025/matchups/3", []],
  ]);

  return (async (input: string | URL | Request) => {
    const path = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url).pathname.replace("/v1", "");
    if (!payloads.has(path)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(payloads.get(path)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("Sleeper League HQ import", () => {
  it("accepts usernames, numeric IDs, and pasted Sleeper league URLs", () => {
    expect(normalizeSleeperLeagueLookup("@manager-name")).toEqual({ kind: "user", value: "manager-name" });
    expect(normalizeSleeperLeagueLookup("123456789012345678")).toEqual({
      kind: "league",
      value: "123456789012345678",
    });
    expect(normalizeSleeperLeagueLookup("https://sleeper.com/leagues/987654321098765432/team"))
      .toEqual({ kind: "league", value: "987654321098765432" });
  });

  it("finds and alphabetizes a user's NFL leagues for the selected season", async () => {
    const fetcher = (async (input: string | URL | Request) => {
      const path = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url).pathname.replace("/v1", "");
      const payloads = new Map<string, unknown>([
        ["/user/test-manager", { user_id: "user-123", display_name: "Test Manager" }],
        ["/user/user-123/leagues/nfl/2026", [
          { league_id: "222222222222", name: "Zeta League", season: "2026", status: "pre_draft", total_rosters: 12 },
          {
            league_id: "111111111111",
            name: "Alpha League",
            season: "2026",
            status: "in_season",
            total_rosters: 10,
            settings: { reserve_slots: 2 },
            scoring_settings: { rec: 0.5 },
            roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN"],
          },
        ]],
      ]);
      if (!payloads.has(path)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(payloads.get(path)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await findSleeperLeagues("test-manager", 2026, { fetcher });

    expect(result.lookupType).toBe("user");
    expect(result.displayName).toBe("Test Manager");
    expect(result.leagues.map((league) => league.name)).toEqual(["Alpha League", "Zeta League"]);
    expect(result.leagues[0]).toMatchObject({ leagueId: "111111111111", totalRosters: 10 });
    expect(result.leagues[0]?.auctionSettings).toMatchObject({
      scoring: "halfPpr",
      teamCount: 10,
      budget: 200,
      budgetSource: "gamehq-default",
      rosterSize: 7,
    });
  });

  it("returns a direct league choice for a pasted URL", async () => {
    const fetcher = (async () => new Response(JSON.stringify({
      league_id: "333333333333",
      name: "Direct League",
      season: "2026",
      status: "pre_draft",
      total_rosters: 12,
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const result = await findSleeperLeagues("https://sleeper.com/leagues/333333333333", 2026, { fetcher });

    expect(result).toMatchObject({
      lookupType: "league",
      displayName: "Direct League",
      leagues: [{ leagueId: "333333333333", name: "Direct League" }],
    });
  });

  it("maps documented league data into stable managers, records, titles, and rivalries", async () => {
    const result = await loadSleeperLeagueHQ("1234567890", {
      fetcher: createSleeperFetcher(),
      now: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(result.leagueName).toBe("Test League");
    expect(result.data.identity.scoring).toBe("Full PPR");
    expect(result.data.managers).toHaveLength(2);
    expect(result.data.managers[0]?.id).toBe("sleeper-user-user-a");
    expect(result.data.managers[0]?.titles).toBe(1);
    expect(result.data.managers[0]?.topGame?.points).toBe(110);
    expect(result.data.managers[0]?.badges).toContain("Defending champion");
    expect(result.data.managers[0]?.seasonHistory?.[0]).toMatchObject({ year: 2025, rank: 1, status: "complete" });
    expect(result.data.standings[0]?.managerId).toBe("sleeper-user-user-a");
    expect(result.data.standings[0]?.powerScore).toBeGreaterThan(result.data.standings[1]?.powerScore ?? 0);
    expect(result.data.standings[0]?.powerReason).toContain("Current record");
    expect(result.data.seasons[0]?.championTeam).toBe("Alpha");
    expect(result.data.rivalries[0]).toMatchObject({ winsA: 1, winsB: 1, ties: 0 });
    expect(result.data.weekRecaps[1]).toMatchObject({
      highScore: 120,
      lowScore: 90,
      closestMargin: 30,
      blowoutMargin: 30,
      upsetManagerId: "sleeper-user-user-b",
      upsetAgainstManagerId: "sleeper-user-user-a",
    });
    expect(result.data.futures).toHaveLength(2);
    expect(result.data.futures.every((future) => future.source === "gamehq-model")).toBe(true);
    expect(result.data.futures.reduce((sum, future) => sum + (future.fairProbability ?? 0), 0)).toBeCloseTo(1, 2);
    expect(result.data.storylines?.map((story) => story.id)).toContain("power-favorite");
    expect(result.data.sleeper?.syncedAt).toBe("2026-08-10T00:00:00.000Z");
    expect(result.data.sleeper?.auctionSettings).toMatchObject({
      scoring: "ppr",
      scoringLabel: "Full PPR",
      teamCount: 2,
      budget: 200,
      budgetSource: "sleeper-draft",
      rosterSize: 5,
      rosterSlots: [
        { slot: "QB", count: 1 },
        { slot: "RB", count: 1 },
        { slot: "WR", count: 1 },
        { slot: "FLEX", count: 1 },
        { slot: "BENCH", count: 1 },
        { slot: "IR", count: 1 },
      ],
    });
  });

  it("preserves commissioner-written profile and rivalry copy during refresh", async () => {
    const imported = (await loadSleeperLeagueHQ("1234567890", { fetcher: createSleeperFetcher() })).data;
    const existing = structuredClone(imported);
    existing.managers[0]!.bio = "Custom manager story";
    existing.rivalries[0]!.name = "The Custom Cup";
    existing.rivalries[0]!.summary = "Commissioner-written history.";
    existing.futures[0] = {
      ...existing.futures[0]!,
      championshipOdds: 250,
      winTotal: 9.5,
      caseFor: "Commissioner sees a breakout.",
      source: "commissioner",
    };

    const merged = mergeSleeperLeagueHQ(existing, imported);

    expect(merged.managers[0]?.bio).toBe("Custom manager story");
    expect(merged.rivalries[0]?.name).toBe("The Custom Cup");
    expect(merged.rivalries[0]?.summary).toBe("Commissioner-written history.");
    expect(merged.futures[0]).toMatchObject({
      championshipOdds: 250,
      winTotal: 9.5,
      caseFor: "Commissioner sees a breakout.",
      source: "commissioner",
    });
  });
});
