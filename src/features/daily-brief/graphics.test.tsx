// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { hockeySchedule, performanceHistory, sparklineGeometry, usageComparison } from "./graphics";
import { FootballUsage, HockeyScheduleStrip, PerformanceHistory, PerformanceTrend } from "./BriefGraphics";
import { TeamLogo } from "./TeamLogo";
import { teamLogoUrl } from "./teamLogos";
import { DiscoveryView } from "./DiscoveryView";
import { recentPlayers } from "./ranking";
import type { BriefEdition, BriefStartPlan, LeagueBriefContext, Observation } from "./model";

afterEach(() => { cleanup(); localStorage.clear(); });
const player: Observation = { id: "1", providerId: "p1", name: "Candidate", position: "WR", team: "BUF", gameId: "g5", date: "2026-10-05", sourceUrl: "https://example.com/stats", stats: { rec: 8, targets: 10 } };
const rows = [8, 6, 4, 2, 0].map((value, i) => ({ ...player, gameId: `g${5 - i}`, date: `2026-10-0${5 - i}`, stats: { rec: value, targets: value + 2, carries: value + 2, pass_att: value + 2 } }));
const context: LeagueBriefContext = { name: "QA", snapshotAt: "2026-10-06T12:00:00Z", complete: true, format: "points", weights: { rec: 1 }, categories: [], positions: ["WR"], ownedIds: [], myIds: [], availability: "snapshot", note: "" };
const edition: BriefEdition = { version: 1, sport: "hockey", date: player.date, generatedAt: context.snapshotAt, revision: "r", status: "complete", observations: rows, games: [], warnings: [],
  sources: [{ name: "NHL upcoming schedule", status: "ready", url: player.sourceUrl, fetchedAt: context.snapshotAt, dataUpdatedAt: null }],
  upcoming: ["2026-10-06", "2026-10-07", "2026-10-13"].map(date => ({ id: date, date, home: "BUF", away: "BOS", homeScore: null, awayScore: null, final: false, sourceUrl: player.sourceUrl, week: null })) };
const plan: BriefStartPlan = { scheduled: 1, usable: 1, lost: 0, start: "2026-10-07", drop: null, days: [{ date: "2026-10-06", gain: 1 }, { date: "2026-10-07", gain: 1 }] };

describe("evidence-backed brief graphics", () => {
  it("shows chronological actual scores, includes measured zero and excludes later games", () => {
    expect(performanceHistory(player, rows, context, "football").map(row => row.points)).toEqual([0, 2, 4, 6, 8]);
    expect(performanceHistory({ ...player, date: "2026-10-04" }, rows, context, "football").map(row => row.points)).toEqual([0, 2, 4, 6]);
    const corrected = recentPlayers({ ...edition, observations: [...rows, { ...rows[0]!, stats: { rec: 11 } }] }).get(player.id)!;
    expect(performanceHistory(player, corrected, context, "football").at(-1)?.points).toBe(11);
  });
  it("withholds sparse, category-only and incomplete-scoring plots without filling missing games", () => {
    expect(performanceHistory(player, rows.slice(0, 2), context, "football")).toEqual([]);
    expect(performanceHistory(player, rows, { ...context, format: "categories" }, "football")).toEqual([]);
    expect(performanceHistory(player, [rows[0]!, { ...rows[1]!, stats: {} }, ...rows.slice(2)], context, "football")).toEqual([]);
    expect(performanceHistory(player, rows, { ...context, weights: { unsupported: 1 } }, "football")).toEqual([]);
  });
  it("keeps negative and flat scores finite and positions negative points below zero", () => {
    const points = rows.slice(0, 3).map((row, i) => ({ date: row.date, gameId: row.gameId, points: [-4, 0, 4][i]! }));
    const geometry = sparklineGeometry(points);
    expect(geometry.points[0]!.y).toBeGreaterThan(geometry.zero);
    expect(geometry.points[2]!.y).toBeLessThan(geometry.zero);
    expect(sparklineGeometry(points.map(row => ({ ...row, points: 0 }))).points.every(row => Number.isFinite(row.y))).toBe(true);
  });
  it("uses disjoint, explicitly sized usage samples and never divides by a zero baseline", () => {
    expect(usageComparison(player, rows)).toMatchObject({ current: 8, preceding: 3, currentDates: ["2026-10-03", "2026-10-04", "2026-10-05"], precedingDates: ["2026-10-01", "2026-10-02"] });
    expect(usageComparison(player, rows.slice(0, 4))).toMatchObject({ current: 9, preceding: 5, currentDates: ["2026-10-04", "2026-10-05"] });
    expect(usageComparison(player, rows.slice(0, 3))).toBeNull();
    expect(usageComparison(player, rows.map(row => ({ ...row, stats: { targets: 0 } })))).toMatchObject({ percent: null, difference: 0 });
    expect(usageComparison(player, rows.map((row, i) => i === 3 ? { ...row, stats: {} } : row))).toBeNull();
    expect(usageComparison({ ...player, position: "RB" }, rows)?.label).toBe("Carries");
    expect(usageComparison({ ...player, position: "QB" }, rows)?.label).toBe("Passing attempts");
  });
  it("bounds schedules to seven days, deduplicates games and honors acquisition dates", () => {
    const days = hockeySchedule(player, { ...edition, upcoming: [...edition.upcoming, edition.upcoming[0]!] }, plan)!;
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ opponents: ["vs BOS"], offNight: true, slateSize: 1, fits: false });
    expect(days[1]?.fits).toBe(true);
    expect(days.at(-1)?.date).toBe("2026-10-12");
    expect(hockeySchedule(player, { ...edition, sources: [] }, plan)).toBeNull();
    expect(hockeySchedule({ ...player, position: "G" }, edition, plan)?.some(day => day.fits)).toBe(false);
    const busy = { ...edition, upcoming: [edition.upcoming[0]!, ...Array.from({ length: 8 }, (_, i) => ({ ...edition.upcoming[0]!, id: `other${i}`, home: "NYR", away: "NYI" }))] };
    expect(hockeySchedule(player, busy, null)?.[0]?.offNight).toBe(false);
  });
  it("keeps logos decorative, preserves team names and handles provider aliases and failures", () => {
    expect(teamLogoUrl("WAS", "football")).toContain("wsh.png");
    expect(teamLogoUrl("JAC", "football")).toContain("jax.png");
    expect(teamLogoUrl("UNKNOWN", "football")).toBeNull();
    const { container } = render(<TeamLogo team="BUF" sport="hockey" />);
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
  });
  it("makes exact trend dates and values accessible and retains zero-baseline numeric usage labels", () => {
    const series = performanceHistory(player, rows, context, "football");
    render(<><PerformanceTrend series={series} label="PPR" /><PerformanceHistory series={series} label="PPR" /><FootballUsage player={player} rows={rows} /></>);
    expect(screen.getByRole("img", { name: /2026-10-01: 0.00 points/ })).toBeTruthy();
    expect(screen.getByText("0.00")).toBeTruthy();
    expect(screen.getByText("Prior 2")).toBeTruthy();
    expect(screen.getByText("Last 3")).toBeTruthy();
    expect(screen.getByText(/Both bars start at zero/)).toBeTruthy();
  });
  it("does not label an unconnected schedule as usable starts or predict goalie starts", () => {
    const { rerender } = render(<HockeyScheduleStrip player={player} edition={edition} />);
    expect(screen.queryByText("Fits lineup")).toBeNull();
    expect(screen.getByText(/Usable starts require/)).toBeTruthy();
    rerender(<HockeyScheduleStrip player={{ ...player, position: "G" }} edition={edition} />);
    expect(screen.getByText(/goalie starts are unconfirmed/)).toBeTruthy();
  });
  it("withholds public lineup-fit calculations for incomplete or stale connected rosters", () => {
    const start = vi.fn(() => plan), hockeyPlayer = { ...player, position: "C", stats: { goals: 1, assists: 1, shots: 1, hits: 1, blocks: 1 } };
    const report = { ...edition, observations: [hockeyPlayer], rostership: [{ platform: "espn" as const, season: "2027", status: "ready" as const, fetchedAt: context.snapshotAt, sourceUrl: player.sourceUrl, note: "QA", entries: [{ id: player.id, providerId: "espn1", percent: 1, match: "provider-id" as const }] }] };
    const league = { ...context, lineupCadence: "daily" as const, roster: [{ id: "2", name: "Roster", team: "BUF", positions: ["C"], slot: "BN", protected: false, cost: null }] };
    const props = { edition: report, now: Date.parse(context.snapshotAt), connectTo: "/connect", renderPlayer: (row: Observation) => row.name, renderWatch: () => <button>Watch player</button>, planStarts: start };
    const { rerender } = render(<MemoryRouter><DiscoveryView {...props} context={{ ...league, complete: false }} /></MemoryRouter>);
    expect(start).not.toHaveBeenCalled();
    rerender(<MemoryRouter><DiscoveryView {...props} context={{ ...league, snapshotAt: "2026-10-01T12:00:00Z" }} /></MemoryRouter>);
    expect(start).not.toHaveBeenCalled();
    rerender(<MemoryRouter><DiscoveryView {...props} context={league} /></MemoryRouter>);
    expect(start).toHaveBeenCalled();
    expect(within(screen.getByRole("region", { name: "Low-Rostered Standouts" })).getByText("Fits lineup · Off-night")).toBeTruthy();
  });
});
