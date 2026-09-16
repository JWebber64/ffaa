/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRecapWeek } from "../features/weekly-recap/recapSource";
import { buildLeagueRecap } from "../features/weekly-recap/leagueRecap";
import { buildMatchupRecap } from "../features/weekly-recap/matchupRecap";
import { playerReference, recapSlotLabel, resolveRecapText } from "../features/weekly-recap/recapPresentation";
import { RecapArticle } from "../features/weekly-recap/RecapArticle";
import { LeagueRecapArticle } from "../features/weekly-recap/LeagueRecapArticle";
import { PlayerProfileContext } from "../features/player-profile/playerProfileContext";
import { recapNextMatchups, recapRecordChanges } from "../features/weekly-recap/recapWeekContext";
import { RivalryLedger } from "../features/weekly-recap/RecapGraphics";

afterEach(cleanup);

function source(): Parameters<typeof buildRecapWeek>[0] {
  const scores = [[20, 15, 10, 30, 32], [20, 15, 10, 29, 12], [20, 15, 10, 20, 21], [20, 15, 10, 19, 10]];
  return {
    league: { league_id: "123", name: "Real scoring league", season: "2026", sport: "nfl", status: "in_season", total_rosters: 4, roster_positions: ["QB", "RB", "WR", "FLEX", "BN"], settings: { last_scored_leg: 1 }, scoring_settings: { rec: 1 } },
    state: { season: "2026", week: 2 }, week: 1, updatedAt: "2026-09-15T00:00:00Z", stats: new Map(),
    rows: scores.map((points, index) => ({ roster_id: index + 1, matchup_id: Math.floor(index / 2) + 1, players: points.map((_, slot) => `${index + 1}${slot}`), starters: points.slice(0, 4).map((_, slot) => `${index + 1}${slot}`), players_points: Object.fromEntries(points.map((value, slot) => [`${index + 1}${slot}`, value])), points: points.slice(0, 4).reduce((sum, value) => sum + value, 0) })),
    rosters: scores.map((_, index) => ({ roster_id: index + 1, owner_id: `owner${index + 1}`, settings: {} })),
    users: scores.map((_, index) => ({ user_id: `owner${index + 1}`, display_name: `Manager ${index + 1}`, avatar: `avatar${index + 1}`, metadata: { team_name: `Team ${index + 1}` } })),
    players: scores.flatMap((_, index) => ["QB", "RB", "WR", "WR", "WR"].map((pos, slot) => ({ playerId: `${index + 1}${slot}`, name: `Player ${index + 1}-${slot}`, pos, team: "BUF" }))),
  };
}

describe("recorded FLEX and stable player identity", () => {
  it("splits FLEX from WR without double-counting and preserves linked player references", () => {
    const week = buildRecapWeek(source());
    const recap = week.recaps[0]!;
    expect(recap.positions).toContainEqual({ position: "WR", left: 10, right: 10 });
    expect(recap.positions).toContainEqual({ position: "FLEX", left: 30, right: 29 });
    expect(recap.positions.reduce((sum, row) => sum + row.left, 0)).toBe(recap.teams[0].score);
    expect(recap.teams[0].players.find((player) => player.providerPlayerId === "13")).toMatchObject({ lineupSlot: "FLEX", position: "WR", nflTeam: "BUF", headshotUrl: "https://sleepercdn.com/content/nfl/players/13.jpg" });
    expect(recap.sections[0]!.paragraphs.join(" ")).toContain("gap came at FLEX");
    expect(recap.sections.flatMap((section) => section.richParagraphs ?? []).flat()).toContainEqual({ type: "player", playerId: "13", text: "Player 1-3" });
    expect(JSON.stringify(recap.sections.map((section) => section.paragraphs))).not.toContain("\uE000");
  });
  it("keeps indexes when the provider has an empty starting slot", () => {
    const input = source(); input.rows[0]!.starters![1] = "0";
    const recap = buildRecapWeek(input).recaps[0]!;
    expect(recap.teams[0].players.find((player) => player.providerPlayerId === "13")?.lineupSlot).toBe("FLEX");
    expect(recap.positions).toEqual([]);
    expect(recap.benches[0]!.analytics).toBeNull();
  });
  it("never infers FLEX if recorded slot metadata is absent", () => {
    const recap = buildRecapWeek(source()).recaps[0]!;
    recap.teams[0].players.forEach((player) => { delete player.lineupSlot; });
    const rebuilt = buildMatchupRecap({ ...recap, status: "final", rosterPositions: ["QB", "RB", "WR", "FLEX"], weekScores: [], leagueWeekComplete: false })!;
    expect(rebuilt.positions).toEqual([]);
    expect(rebuilt.caveats.join(" ")).toContain("never inferred");
  });
  it("keeps zero and negative FLEX scores, and excludes ambiguous duplicate roster rows", () => {
    const input = source(); input.rows[0]!.players_points!["13"] = -2; input.rows[0]!.points = 43;
    input.rows[1]!.players_points!["23"] = 0; input.rows[1]!.points = 45;
    expect(buildRecapWeek(input).recaps[0]!.positions).toContainEqual({ position: "FLEX", left: -2, right: 0 });
    input.rows.push({ ...input.rows[0]! });
    const week = buildRecapWeek(input);
    expect(week.leagueWeekComplete).toBe(false);
    expect(week.recaps).toHaveLength(1);
    expect(buildLeagueRecap(week)!.awards).toEqual([]);
  });
  it("keeps restricted flex and superflex distinct, with numbered slot normalization", () => {
    expect(["RB1", "WR3", "FLEX2", "SUPER_FLEX", "REC_FLEX", "WRRB_FLEX", "D/ST"].map(recapSlotLabel)).toEqual(["RB", "WR", "FLEX", "SFLEX", "REC FLEX", "WR/RB", "DST"]);
  });
  it("distinguishes identical names by ID, including punctuation and HTML-like text", () => {
    const name = "Same <Name> & O'Neil";
    const text = `${playerReference({ providerPlayerId: "1", playerName: name })} outscored ${playerReference({ providerPlayerId: "2", playerName: name })}.`;
    expect(resolveRecapText(text).filter((part) => part.type === "player")).toEqual([{ type: "player", playerId: "1", text: name }, { type: "player", playerId: "2", text: name }]);
  });
});

describe("league edition awards and weekly context", () => {
  it("reuses the shared awards engine, includes FLEX honors, and shares ties", () => {
    const week = buildRecapWeek(source());
    const edition = buildLeagueRecap(week)!;
    expect(edition.complete).toBe(true);
    expect(edition.awards.filter((award) => award.awardType === "top_position_player" && award.position === "QB")).toHaveLength(4);
    expect(edition.awards.filter((award) => award.awardType === "narrow_escape")).toHaveLength(2);
    expect(edition.awards.find((award) => award.awardType === "top_flex_player")).toMatchObject({ providerPlayerId: "13", numericValue: 30, position: "FLEX" });
    expect(edition.awards.find((award) => award.awardType === "bench_disaster")).toMatchObject({ providerRosterId: 1, numericValue: 22 });
    expect(edition.awards.every((award) => award.calculationVersion === "weekly-awards-v3")).toBe(true);
    expect(edition.paragraphs.length).toBeGreaterThanOrEqual(3);
  });
  it("withholds only affected award families for incomplete evidence and follows score corrections", () => {
    const input = source(); delete input.rows[1]!.players_points!["24"];
    let edition = buildLeagueRecap(buildRecapWeek(input))!;
    expect(edition.awards.some((award) => award.awardType === "bench_disaster")).toBe(false);
    expect(edition.awards.some((award) => award.awardType === "top_starting_player")).toBe(true);
    input.rows[0]!.custom_points = 0;
    edition = buildLeagueRecap(buildRecapWeek(input))!;
    expect(edition.awards.find((award) => award.awardType === "weekly_low_score")?.providerRosterId).toBe(1);
    expect(edition.awards.some((award) => award.awardType === "top_starting_player")).toBe(false);
    input.rows.pop();
    expect(buildLeagueRecap(buildRecapWeek(input))!.awards).toEqual([]);
  });
  it("does not generate pending editions or award a zero bench mistake", () => {
    const input = source(); input.state.week = 1;
    expect(buildLeagueRecap(buildRecapWeek(input))).toBeNull();
    input.state.week = 2;
    input.rows.forEach((row, index) => { row.players_points![`${index + 1}4`] = 0; });
    expect(buildLeagueRecap(buildRecapWeek(input))!.awards.some((award) => award.awardType === "bench_disaster")).toBe(false);
  });
  it("excludes explicit byes from ranks and awards without hiding completed games", () => {
    const input = source();
    input.rows[2]!.matchup_id = null; input.rows[3]!.matchup_id = null;
    input.rows[2]!.points = 0; delete input.rows[3]!.points;
    const week = buildRecapWeek(input);
    expect(week.leagueWeekComplete).toBe(true);
    const edition = buildLeagueRecap(week)!;
    expect(edition.complete).toBe(true);
    expect(edition.teams.map((team) => team.id)).toEqual(["1", "2"]);
    expect(edition.awards.find((award) => award.awardType === "weekly_low_score")?.providerRosterId).toBe(2);
    expect(week.recaps[0]!.leagueScores).toHaveLength(2);
    input.rows[2]!.matchup_id = 99;
    expect(buildLeagueRecap(buildRecapWeek(input))!.complete).toBe(false);
  });
  it("builds recorded H2H changes without future contamination or incomplete history", () => {
    const week = buildRecapWeek(source());
    expect(recapRecordChanges(week, []).find((row) => row.team.id === "1")).toMatchObject({ before: "0–0", after: "1–0" });
    week.week = 2;
    expect(recapRecordChanges(week, [])).toEqual([]);
    const previous = { week: 1, rows: source().rows };
    expect(recapRecordChanges(week, [previous, { week: 3, rows: [] }]).find((row) => row.team.id === "1")).toMatchObject({ before: "1–0", after: "2–0" });
    expect(recapRecordChanges(week, [previous, previous])).toEqual([]);
  });
  it("uses only paired scheduled teams, never future points", () => {
    const week = buildRecapWeek(source());
    const next = recapNextMatchups(week.teams!, [{ roster_id: 1, matchup_id: 3, points: 999 }, { roster_id: 3, matchup_id: 3 }, { roster_id: 2, matchup_id: null }]);
    expect(next).toHaveLength(1);
    expect(next[0]?.left.score).toBe(75);
    expect(next[0]?.right.id).toBe("3");
  });
});

describe("illustrated recap rendering", () => {
  it("keeps each weekly roundup result closing distinct", () => {
    const input = source();
    input.rows[0]!.points = 100;
    input.rows[1]!.points = 70;
    input.rows[2]!.points = 110;
    input.rows[3]!.points = 80;
    const recaps = buildRecapWeek(input).recaps;
    const closings = recaps.map((recap) => recap.leadClosing).filter((closing): closing is string => Boolean(closing));
    expect(closings).toHaveLength(recaps.length);
    expect(new Set(closings).size).toBe(closings.length);
    expect(closings.every((closing) => !closing.includes("The final score settles the result"))).toBe(true);
  });

  it("renders distinct FLEX graphics, pictured mentions, and the shared profile action", () => {
    const recap = buildRecapWeek(source()).recaps[0]!;
    const openPlayerProfile = vi.fn();
    const view = render(<MemoryRouter><PlayerProfileContext.Provider value={{ openPlayerProfile, closePlayerProfile: vi.fn() }}><RecapArticle recap={recap} expanded permalink="/recap" /></PlayerProfileContext.Provider></MemoryRouter>);
    const battle = screen.getByRole("figure", { name: "Starter points by recorded lineup slot" });
    expect(within(battle).getByText("FLEX")).toHaveAttribute("data-position-color", "flex");
    expect(view.container.querySelectorAll(".recap-portrait img").length).toBeGreaterThan(0);
    const button = screen.getAllByRole("button", { name: /Player 1-3/ })[0]!;
    fireEvent.click(button);
    expect(openPlayerProfile).toHaveBeenCalledWith(expect.objectContaining({ sleeperId: "13", weeklyActualPoints: 30, weeklyActualPointsWeek: 1 }), "ppr");
    const portrait = view.container.querySelector<HTMLImageElement>('.recap-portrait > img[src$="13.jpg"]')!;
    fireEvent.error(portrait);
    expect(portrait.isConnected).toBe(false);
    expect(button).toHaveTextContent("Player 1-3");
  });
  it("renders a 5–2 rivalry graphic with ties, dated receipts and the exact cutoff", () => {
    const recap = buildRecapWeek(source()).recaps[0]!;
    render(<RivalryLedger recap={recap} rivalry={{ winsA: 5, winsB: 2, ties: 1, seasons: [2024, 2025, 2026], streak: { teamId: "1", count: 3 }, meetings: [{ season: 2025, week: 10, scoreA: 100, scoreB: 100 }, { season: 2026, week: 1, scoreA: 75, scoreB: 74 }] }} />);
    expect(screen.getByRole("figure")).toHaveAccessibleName("Recorded rivalry: Team 1 5 wins, Team 2 2 wins, 1 ties");
    expect(screen.getByText("3 straight")).toBeVisible();
    expect(screen.getByText("2025 · W10")).toBeVisible();
    expect(screen.getByText(/Available archive through 2026 Week 1/)).toBeVisible();
  });
  it("renders one league article with positional honors and canonical matchup links", () => {
    const week = buildRecapWeek(source());
    render(<MemoryRouter><LeagueRecapArticle week={week} archive="/league/canonical/history/recaps" /></MemoryRouter>);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Team of the Week" })).toBeVisible();
    expect(screen.getByText("FLEX")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Full matchup edition" })[0]).toHaveAttribute("href", "/league/canonical/history/recaps?season=2026&week=1&matchup=1");
    expect(screen.getAllByText(/historical bench availability|position-legal optimal lineup/i)).toHaveLength(2);
  });
});
