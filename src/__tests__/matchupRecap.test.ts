import { describe, expect, it } from "vitest";
import { buildMatchupRecap, type RecapMatchup, type RecapPlayer } from "../features/weekly-recap/matchupRecap";
import { buildRecapWeek, completedRecapWeek, officialRecapScore } from "../features/weekly-recap/recapSource";
import type { SleeperLeague } from "../features/league-history/provider/sleeperTypes";

const player = (id: string, position: string, points: number | null, isStarter = true, lineupSlot = position): RecapPlayer => ({ providerPlayerId: id, playerName: id, position, fantasyPoints: points, isStarter, ...(isStarter ? { lineupSlot } : {}) });
function matchup(): RecapMatchup {
  return {
    id: "4", leagueName: "The GOAT League", season: 2026, week: 1, status: "final", rosterPositions: ["QB", "RB", "FLEX", "BN"],
    teams: [
      { id: "1", name: "The Home Team", managerIds: ["u1"], score: 44, lineupComplete: true, benchEligibilityKnown: true, players: [player("Quarterback A", "QB", 20), player("Running Back A", "RB", 20), player("Receiver A", "WR", 4, true, "FLEX"), player("Bench Hero", "RB", 15, false)] },
      { id: "2", name: "The Away Team", managerIds: ["u2"], score: 51, lineupComplete: true, benchEligibilityKnown: true, players: [player("Quarterback B", "QB", 15), player("Running Back B", "RB", 31), player("Tight End B", "TE", 5, true, "FLEX"), player("Bench B", "WR", 2, false)] },
    ], weekScores: [{ id: "1", score: 44 }, { id: "2", score: 51 }, { id: "3", score: 20 }, { id: "4", score: 10 }], leagueWeekComplete: true, sourceUrl: "https://sleeper.com", updatedAt: "2026-09-15T00:00:00Z",
  };
}
const story = (input: RecapMatchup) => buildMatchupRecap(input)!.sections.flatMap((section) => section.paragraphs).join(" ");
const league: SleeperLeague = { league_id: "123", season: "2026", sport: "nfl", name: "Test league", status: "in_season", total_rosters: 2, roster_positions: ["QB", "RB", "FLEX", "BN"], settings: { last_scored_leg: 1 }, scoring_settings: {} };

describe("detailed weekly matchup narratives", () => {
  it("writes a substantial, deterministic story with both teams and verified position edges", () => {
    const input = matchup();
    const before = JSON.stringify(input);
    const report = buildMatchupRecap(input)!;
    expect(report.wordCount).toBeGreaterThan(400);
    expect(report.headline).toContain("Running Back B");
    expect(report.lead).toContain("51.00–44.00");
    expect(report.margin).toBe(7);
    expect(report.positions.find((row) => row.position === "RB")).toEqual({ position: "RB", left: 20, right: 31 });
    expect(report.sections.map((section) => section.id)).toEqual(["separation", "performances", "bench", "league"]);
    expect(story(input)).toContain("ranked #2 of 4");
    expect(story(input)).toContain("3–0");
    expect(report).toEqual(buildMatchupRecap(input));
    expect(JSON.stringify(input)).toBe(before);
  });
  it("only claims a one-player reversal after checking legal flex reassignment", () => {
    expect(story(matchup())).toContain("Bench Hero (15.00) for Receiver A (4.00)");
    expect(story(matchup())).toContain("flipped the score to 55.00–51.00");
    const input = matchup();
    input.teams[0].players[3] = player("Wrong position", "QB", 25, false);
    expect(story(input)).toContain("still have finished 2.00 points behind");
  });
  it("distinguishes a hypothetical tie from a win", () => {
    const input = matchup(); input.teams[0].players[3]!.fantasyPoints = 11;
    expect(story(input)).toContain("would have tied the score at 51.00");
    expect(story(input)).not.toContain("single change would have flipped");
  });
  it("handles official ties without naming a winner or saying a win was secured", () => {
    const input = matchup(); input.teams[1].score = 44; input.teams[1].players[1]!.fantasyPoints = 24;
    const report = buildMatchupRecap(input)!;
    expect(report.winnerId).toBeNull(); expect(report.label).toBe("Dead even");
    expect(story(input)).toContain("could have broken the tie");
    expect(story(input)).not.toContain("result already secured");
  });
  it("preserves real zero and negative scores, but does not turn missing points into zero", () => {
    const input = matchup(); input.teams[0].players[2]!.fantasyPoints = 0;
    expect(story(input)).toContain("Receiver A finished on zero");
    input.teams[0].players[2]!.fantasyPoints = null;
    expect(story(input)).not.toContain("Receiver A finished on zero");
    expect(story(input)).toContain("Missing points are not treated as zero");
    expect(buildMatchupRecap(input)!.positions).toEqual([]);
    input.teams[0].players[2]!.fantasyPoints = -2;
    expect(story(input)).toContain("-2.00");
  });
  it("withholds bench verdicts for scoring overrides and unsupported or incomplete lineups", () => {
    const input = matchup(); input.teams[0].score = 100;
    expect(story(input)).toContain("official 100.00 differs from the 44.00");
    input.rosterPositions = ["IDP_FLEX"];
    expect(story(input)).toContain("cannot be fully evaluated");
    input.teams[0].lineupComplete = false;
    expect(story(input)).toContain("bench verdict is on hold");
  });
  it("makes historical IR/taxi uncertainty explicit and omits incomplete league ranks", () => {
    const input = matchup(); input.teams[0].benchEligibilityKnown = false; input.leagueWeekComplete = false;
    expect(story(input)).toContain("If all recorded bench players were available to start");
    expect(story(input)).toContain("Historical IR/taxi availability is not supplied");
    expect(story(input)).not.toContain("ranked #");
  });
  it("refuses pending or invalid results", () => {
    const input = matchup(); input.status = "pending"; expect(buildMatchupRecap(input)).toBeNull();
    input.status = "final"; input.teams[0].score = NaN; expect(buildMatchupRecap(input)).toBeNull();
  });
});

describe("weekly recap source contract", () => {
  it("requires both a scored league week and NFL rollover, not points or display_week", () => {
    expect(completedRecapWeek(league, { season: "2026", week: 1, display_week: 1 })).toBe(0);
    expect(completedRecapWeek(league, { season: "2026", week: 2, display_week: 1 })).toBe(1);
    expect(completedRecapWeek(league, {})).toBe(0);
    expect(completedRecapWeek({ ...league, settings: {} }, { season: "2026", week: 2 })).toBe(0);
    expect(completedRecapWeek({ ...league, season: "2025", status: "complete", settings: {} }, { season: "2026", week: 1 })).toBe(18);
  });
  it("honors commissioner overrides including zero and never coerces a missing score", () => {
    expect(officialRecapScore({ roster_id: 1, matchup_id: 1, points: 20, custom_points: 0 })).toBe(0);
    expect(officialRecapScore({ roster_id: 1, matchup_id: 1, points: 20, custom_points: null })).toBe(20);
    expect(officialRecapScore({ roster_id: 1, matchup_id: 1 })).toBeNull();
  });
  it("uses the historical weekly roster, matches co-owners, excludes byes and refreshes score corrections", () => {
    const input: Parameters<typeof buildRecapWeek>[0] = {
      league, state: { season: "2026", week: 2 }, week: 1, updatedAt: "2026-09-15T00:00:00Z", stats: new Map(),
      rows: [
        { roster_id: 1, matchup_id: 4, points: 10, players: ["old-player"], starters: ["old-player"], players_points: { "old-player": 10 } },
        { roster_id: 2, matchup_id: 4, points: 12, players: ["opponent"], starters: ["opponent"], players_points: { opponent: 12 } },
        { roster_id: 3, matchup_id: null, points: 50 },
      ],
      rosters: [{ roster_id: 1, owner_id: "owner", co_owners: ["co-owner"], players: ["new-player"], starters: ["new-player"], settings: {} }],
      users: [{ user_id: "owner", metadata: { team_name: "My actual team" } }],
      players: [{ playerId: "old-player", name: "Last week starter", pos: "QB" }, { playerId: "new-player", name: "Today starter", pos: "QB" }],
    };
    const result = buildRecapWeek(input);
    expect(result.recaps).toHaveLength(1);
    expect(result.recaps[0]!.teams[0].managerIds).toContain("co-owner");
    expect(result.recaps[0]!.teams[0].name).toBe("My actual team");
    expect(result.recaps[0]!.teams[0].players[0]!.playerName).toBe("Last week starter");
    expect(JSON.stringify(result)).not.toContain("Today starter");
    expect(result.recaps[0]!.winnerId).toBe("2");
    input.rows[0]!.custom_points = 15;
    expect(buildRecapWeek(input).recaps[0]!.winnerId).toBe("1");
    input.rows[0]!.matchup_id = null;
    expect(buildRecapWeek(input).recaps).toEqual([]);
  });
});
