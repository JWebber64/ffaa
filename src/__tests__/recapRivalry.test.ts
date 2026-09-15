import { describe, expect, it } from "vitest";
import { buildMatchupRecap } from "../features/weekly-recap/matchupRecap";
import { buildRecapRivalry, unavailableRivalry, withRivalrySection, type RecapRivalryWeek } from "../features/weekly-recap/recapRivalry";
import type { LeagueHistorySnapshot } from "../features/league-history/domain/types";

function report(season = 2026, week = 1, scoreA = 120, scoreB = 100) {
  return buildMatchupRecap({
    id: "5", season, week, leagueName: "Test league", status: "final", rosterPositions: [], weekScores: [], leagueWeekComplete: false,
    sourceUrl: "https://sleeper.com", updatedAt: "2026-09-15",
    teams: [
      { id: "3", name: "Renamed Alpha", managerIds: ["owner-a"], primaryManagerId: "owner-a", score: scoreA, players: [], lineupComplete: false },
      { id: "10", name: "Renamed Beta", managerIds: ["owner-b"], primaryManagerId: "owner-b", score: scoreB, players: [], lineupComplete: false },
    ],
  })!;
}
type Result = [season: number, week: number, a: number, b: number];
function history(results: Result[] = []): LeagueHistorySnapshot {
  const seasons = [...new Set(results.map(([season]) => season))];
  return {
    league: { id: "league", provider: "sleeper", currentExternalLeagueId: "l2026", name: "Test", sport: "nfl", format: "2-team", settings: {}, createdAt: "", updatedAt: "" },
    seasons: seasons.map((season) => ({ id: `s${season}`, season, leagueId: "league", provider: "sleeper", providerLeagueId: `l${season}`, previousProviderLeagueId: null, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: null, importedAt: "" })),
    managers: ["a", "b"].map((id) => ({ id, provider: "sleeper", providerUserId: `owner-${id}`, currentUsername: id, displayName: id, avatarUrl: "", createdAt: "", updatedAt: "" })),
    franchises: seasons.flatMap((season) => ["a", "b"].map((id, index) => ({ id: `${id}${season}`, leagueSeasonId: `s${season}`, managerId: id, providerRosterId: season + index, historicalUsername: `old-${id}`, teamName: `Old ${id}`, avatarUrl: "", finalRank: null, regularSeasonRank: null, playoffSeed: null, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, playoffFinish: "" }))),
    matchups: results.map(([season, week, scoreA, scoreB], index) => ({ id: `m${index}`, leagueSeasonId: `s${season}`, week, providerMatchupId: "5", franchiseAId: `a${season}`, franchiseBId: `b${season}`, scoreA, scoreB, isPlayoff: week >= 15, playoffRound: null, isChampionship: false, winnerFranchiseId: scoreA === scoreB ? null : `${scoreA > scoreB ? "a" : "b"}${season}`, margin: Math.abs(scoreA - scoreB), isComplete: true, importedAt: "2026-09-01" })),
    weeklyResults: [], weeklyPlayerResults: [], playoffMatches: [], drafts: [], draftPicks: [], transactions: [], transactionAssets: [],
  };
}
function priorWeek(week: number, scoreA = 120, scoreB = 100): RecapRivalryWeek {
  return { week, rows: [{ roster_id: 3, matchup_id: 5, points: scoreA }, { roster_id: 10, matchup_id: 5, points: scoreB }] };
}
const text = (section: ReturnType<typeof buildRecapRivalry>) => section.paragraphs.join(" ");

describe("the recap rivalry ledger", () => {
  it("writes 5–2 across three seasons, following managers despite renamed teams and changed roster IDs", () => {
    const snapshot = history([[2024, 1, 120, 100], [2024, 8, 100, 110], [2024, 17, 130, 100], [2025, 1, 90, 110], [2025, 8, 130, 110], [2025, 17, 140, 110]]);
    const story = text(buildRecapRivalry(report(), snapshot, []));
    expect(story).toContain("Renamed Alpha's recorded head-to-head record against Renamed Beta to 5–2 across 3 seasons (2024–2026)");
    expect(story).toContain("2025 Week 17: Renamed Alpha beat Renamed Beta 140.00–110.00");
    expect(story).toContain("3 straight recorded meetings");
    expect(story).toContain("regular-season and playoff weekly meetings through 2026 Week 1");
  });
  it("orients reversed historical pairings and winner-led copy correctly", () => {
    const snapshot = history([[2025, 8, 100, 120]]);
    const matchup = snapshot.matchups[0]!;
    [matchup.franchiseAId, matchup.franchiseBId] = [matchup.franchiseBId, matchup.franchiseAId];
    [matchup.scoreA, matchup.scoreB] = [matchup.scoreB, matchup.scoreA];
    expect(text(buildRecapRivalry(report(2026, 1, 90, 100), snapshot, []))).toContain("Renamed Beta's recorded head-to-head record against Renamed Alpha to 2–0");
  });
  it("cuts older recaps off at that week and uses live weekly corrections instead of current-season snapshot rows", () => {
    const snapshot = history([[2024, 1, 120, 100], [2025, 1, 900, 0], [2025, 2, 900, 0], [2025, 3, 900, 0], [2026, 1, 900, 0]]);
    const earlier = priorWeek(1, 80, 100);
    const story = text(buildRecapRivalry(report(2025, 2), snapshot, [earlier, earlier, priorWeek(2), priorWeek(3)]));
    expect(story).toContain("to 2–1 across 2 seasons (2024–2025)");
    expect(story).toContain("2025 Week 1: Renamed Beta beat Renamed Alpha 100.00–80.00");
    expect(story).not.toContain("900.00");
    expect(story).not.toContain("2026");
  });
  it("deduplicates repeated archive imports and chooses the latest corrected result", () => {
    const snapshot = history([[2025, 1, 120, 100], [2025, 1, 90, 100]]);
    snapshot.matchups[1]!.importedAt = "2026-09-02";
    expect(text(buildRecapRivalry(report(), snapshot, []))).toContain("to 1–1");
    expect(text(buildRecapRivalry(report(), snapshot, []))).toContain("win levels the rivalry");
  });
  it("preserves custom zero scores and negative scores", () => {
    const earlier = priorWeek(1, 120, -1);
    earlier.rows[0]!.custom_points = 0;
    const story = text(buildRecapRivalry(report(2026, 2), history(), [earlier]));
    expect(story).toContain("to 2–0 in 2026");
    expect(story).toContain("0.00–-1.00");
  });
  it("includes ties in W–L–T and a tie breaks a winning streak", () => {
    const snapshot = history([[2025, 1, 120, 100], [2025, 8, 100, 100]]);
    const win = text(buildRecapRivalry(report(), snapshot, []));
    expect(win).toContain("to 2–0–1");
    expect(win).not.toContain("straight recorded meetings");
    const tie = text(buildRecapRivalry(report(2026, 1, 100, 100), snapshot, []));
    expect(tie).toContain("This tie brings");
    expect(tie).toContain("to 1–0–2");
    expect(tie).toContain("wins–losses–ties");
  });
  it("describes a first recorded meeting without claiming it is the first ever", () => {
    const snapshot = history(); snapshot.managers = [];
    const story = text(buildRecapRivalry(report(), snapshot, []));
    expect(story).toContain("to 1–0 in 2026");
    expect(story).toContain("first meeting in the available league archive");
    expect(story).not.toContain("first ever");
  });
  it("excludes unfinished and invalid historical scores", () => {
    const snapshot = history([[2025, 1, 120, 100], [2025, 2, NaN, 100]]);
    snapshot.matchups[0]!.isComplete = false;
    expect(text(buildRecapRivalry(report(), snapshot, []))).toContain("to 1–0 in 2026");
  });
  it("withholds totals when primary ownership is missing, shared, or conflicting", () => {
    const recap = report(); recap.teams[0].primaryManagerId = null;
    expect(text(buildRecapRivalry(recap, history(), []))).toContain("verified manager identities");
    recap.teams[0].primaryManagerId = "owner-b";
    expect(text(buildRecapRivalry(recap, history(), []))).toContain("verified manager identities");
    const snapshot = history(); snapshot.managers.push({ ...snapshot.managers[0]!, id: "duplicate" });
    expect(text(buildRecapRivalry(report(), snapshot, []))).toContain("conflicting manager identities");
  });
  it("withholds an unreliable earlier week instead of silently undercounting it", () => {
    const missing = priorWeek(1); delete missing.rows[0]!.points;
    expect(text(buildRecapRivalry(report(2026, 2), history(), [missing]))).toContain("missing a final score");
    missing.rows.pop();
    expect(text(buildRecapRivalry(report(2026, 2), history(), [missing]))).toContain("box scores are incomplete");
    const ambiguous = priorWeek(1); ambiguous.rows.push({ roster_id: 7, matchup_id: 5, points: 20 });
    expect(text(buildRecapRivalry(report(2026, 2), history(), [ambiguous]))).toContain("ambiguous pairing");
  });
  it("does not turn byes or other opponents into head-to-head meetings", () => {
    const bye = priorWeek(1); bye.rows.forEach((row) => { row.matchup_id = null; });
    const other = priorWeek(2); other.rows[0]!.matchup_id = 2;
    expect(text(buildRecapRivalry(report(2026, 3), history(), [bye, other]))).toContain("to 1–0 in 2026");
  });
  it("places history near the start, updates reading time, and replaces rather than duplicates a refreshed section", () => {
    const original = report();
    expect(withRivalrySection(original, unavailableRivalry()).sections[0]!.id).toBe("rivalry");
    original.sections.unshift({ id: "separation", title: "The difference", paragraphs: ["The verified positional edge."] });
    const before = JSON.stringify(original);
    const section = buildRecapRivalry(original, history(), []);
    const enriched = withRivalrySection(original, section);
    expect(enriched.sections[1]!.id).toBe("rivalry");
    expect(enriched.wordCount).toBeGreaterThan(original.wordCount);
    const fallback = withRivalrySection(enriched, unavailableRivalry());
    expect(fallback.sections.filter((row) => row.id === "rivalry")).toHaveLength(1);
    expect(text(fallback.sections[1]!)).toContain("final result above still stands");
    expect(JSON.stringify(original)).toBe(before);
  });
});
