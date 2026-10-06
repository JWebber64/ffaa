// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiscoveryView } from "./DiscoveryView";
import { defaultDiscoveryPreferences, discoverPlayers, discoveryScoring, staleSnapshot } from "./discovery";
import type { BriefEdition, LeagueBriefContext } from "./model";
const report: BriefEdition = { version: 1, sport: "hockey", date: "2026-10-05", generatedAt: "2026-10-06T12:00:00Z", revision: "r", status: "complete", games: [], upcoming: [], sources: [], warnings: [],
  observations: ["Star", "Sleeper", "Unknown"].map((name, i) => ({ id: String(i), providerId: String(i), name, position: "C", team: "BUF", gameId: "g", date: "2026-10-05", sourceUrl: "https://example.com", stats: { goals: 3 - i, assists: 1, shots: 4, hits: 0, blocks: 0, iceTimeMinutes: 18 } })),
  rostership: [{ platform: "espn", season: "2027", status: "ready", fetchedAt: "2026-10-06T12:00:00Z", sourceUrl: "https://example.com", note: "test data", entries: [{ id: "0", providerId: "10", percent: 99, match: "provider-id" }, { id: "1", providerId: "11", percent: 20, match: "provider-id" }] }] };
const now = Date.parse(report.generatedAt);
function view(edition = report, context: LeagueBriefContext | null = null) {
  return render(<MemoryRouter><DiscoveryView edition={edition} context={context} now={now} connectTo="/connect" renderPlayer={row => row.name} renderWatch={() => <button>Watch player</button>} /></MemoryRouter>);
}
beforeEach(() => localStorage.clear()); afterEach(cleanup);
describe("public fantasy discovery", () => {
  it("shows all hot performers and only verified low-rostered candidates without a connected league", () => {
    view();
    const hot = screen.getByRole("region", { name: "Who’s Hot" }), low = screen.getByRole("region", { name: "Low-Rostered Standouts" });
    expect(within(hot).getByText("Star")).toBeTruthy();
    expect(within(hot).getByText("Unknown")).toBeTruthy();
    expect(within(low).getByText("Sleeper")).toBeTruthy();
    expect(within(low).queryByText("Unknown")).toBeNull();
    expect(within(low).queryByText("Star")).toBeNull();
  });
  it("applies threshold and platform choices, saves preferences and never borrows percentages", () => {
    const rendered = view();
    fireEvent.change(screen.getByLabelText("Roster percentage ceiling"), { target: { value: "10" } });
    expect(within(screen.getByRole("region", { name: "Low-Rostered Standouts" })).queryByText("Sleeper")).toBeNull();
    fireEvent.change(screen.getByLabelText("Roster percentage platform"), { target: { value: "yahoo" } });
    expect(screen.getByText(/Yahoo roster percentages are unavailable\./)).toBeTruthy();
    expect(screen.queryByText("Yahoo: 20.0% rostered")).toBeNull();
    rendered.unmount(); view();
    expect((screen.getByLabelText("Roster percentage platform") as HTMLSelectElement).value).toBe("yahoo");
    expect((screen.getByLabelText("Roster percentage ceiling") as HTMLSelectElement).value).toBe("10");
  });
  it("preserves public discovery with incomplete league coverage and treats unknown percentages differently from measured zero", () => {
    const result = discoverPlayers({ ...report, rostership: [{ ...report.rostership![0]!, entries: [{ id: "1", providerId: "11", percent: 0, match: "provider-id" }] }] }, defaultDiscoveryPreferences("hockey"), { name: "Broken", snapshotAt: "", complete: false, ownedIds: ["1"], myIds: [], format: "points", weights: {}, categories: [], positions: [], availability: "snapshot", note: "" });
    expect(result.lowRostered.map(row => row.player.name)).toEqual(["Sleeper"]);
    expect(staleSnapshot({ ...report.rostership![0]!, status: "stale" }, now)).toBe(true);
    expect(staleSnapshot(report.rostership![0], now + 49 * 60 * 60 * 1000)).toBe(true);
  });
  it("labels the last NFL slate on an off-day and never substitutes it when today's games have pending stats", () => {
    const preferences = defaultDiscoveryPreferences("football"), edition = { ...report, sport: "football" as const, date: "2026-10-06" };
    expect(discoverPlayers(edition, preferences, null)).toMatchObject({ fallback: true, hotDate: "2026-10-05" });
    expect(discoverPlayers({ ...edition, games: [{ id: "pending", date: edition.date, home: "BUF", away: "NYJ", final: false, homeScore: null, awayScore: null, sourceUrl: "https://example.com", week: 5 }] }, preferences, null).fallback).toBe(false);
  });
  it("prioritizes today's low-rostered NFL performers, supports unlinked canonical players, and applies PPR independently", () => {
    const preferences = defaultDiscoveryPreferences("football"), draft = { ...report, sport: "football" as const };
    const weights = discoveryScoring(draft, preferences, null).context.weights;
    const zeros = Object.fromEntries(Object.keys(weights).map(key => [key, 0]));
    const edition = { ...draft, observations: report.observations.slice(0, 2).map((row, i) => ({ ...row, position: "WR", providerId: null, date: i ? report.date : "2026-10-04", stats: { ...zeros, rec: i ? 5 : 10, rec_yd: i ? 50 : 200, targets: 8 } })),
      rostership: [{ ...report.rostership![0]!, entries: ["0", "1"].map(id => ({ id, providerId: "espn-" + id, percent: 5, match: "provider-id" as const })) }] };
    const result = discoverPlayers(edition, preferences, null);
    expect(result.lowRostered.map(row => row.player.id)).toEqual(["1", "0"]);
    expect(result.lowRostered[0]?.fantasyPoints).toBe(10);
    expect(result.lowRostered[0]?.evidence).toContain("observed WR comparison");
    expect(discoverPlayers(edition, { ...preferences, scoring: "standard" }, null).lowRostered[0]?.fantasyPoints).toBe(5);
  });
});
