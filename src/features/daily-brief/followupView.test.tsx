import { UniversalSelect } from "../../ui/UniversalSelect";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefView } from "./BriefView";
import type { BriefEdition, LeagueBriefContext, Observation } from "./model";
const row = (id: string, date: string, rec: number): Observation => ({ id, providerId: id, name: "Player " + id, position: "WR", team: "BUF", date, gameId: date, stats: { rec, targets: 8 }, sourceUrl: "https://example.com/stats" });
const edition: BriefEdition = { version: 1, sport: "football", date: "2026-10-05", generatedAt: "2026-10-06T12:00:00Z", revision: "r1", status: "complete", games: [], upcoming: [], sources: [], warnings: [], observations: [row("a", "2026-10-05", 10), row("a", "2026-09-28", 8), row("b", "2026-10-05", 4), row("b", "2026-09-28", 6)] };
const context: LeagueBriefContext = { scopeKey: "followup-test", name: "QA", snapshotAt: edition.generatedAt, complete: true, ownedIds: ["b"], myIds: ["b"], format: "points", weights: { rec: 1 }, categories: [], positions: ["WR"], availability: "rosters", note: "", roster: [{ id: "b", name: "Bench", team: "BUF", positions: ["WR"], slot: "BENCH", cost: null, protected: false }] };
function view(report = edition, league = context) {
  return <MemoryRouter><BriefView edition={report} archive={[report]} expectedDate={report.date} context={league} renderPlayer={player => <span>{player.name}</span>} renderWatch={() => <button>Watch player</button>} renderDatePicker={() => <UniversalSelect aria-label="Edition archive"><option value="2026-10-05">2026-10-05</option></UniversalSelect>} leagueTo="/players" connectTo="/leagues" /></MemoryRouter>;
}
beforeEach(() => { localStorage.clear(); vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-06T13:00:00Z")); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("brief follow-up controls", () => {
  it("starts alerts disabled, persists opt-in and isolates a different team", async () => {
    const rendered = render(view());
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true));
    rendered.unmount();
    render(view());
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    cleanup(); render(view(edition, { ...context, scopeKey: "other-team" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });
  it("tracks a recommendation, observes corrected subsequent results and preserves recorded scoring", async () => {
    const rendered = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Track results" }));
    expect(screen.getByText(/0 subsequent observed games/)).toBeTruthy();
    rendered.rerender(view({ ...edition, date: "2026-10-06", revision: "r2", observations: [...edition.observations, row("a", "2026-10-06", 12)] }, { ...context, weights: { rec: 2 } }));
    await waitFor(() => expect(screen.getByText(/1 subsequent observed games · 12.00 league points/)).toBeTruthy());
    rendered.rerender(view({ ...edition, date: "2026-10-06", revision: "r3", observations: [...edition.observations, row("a", "2026-10-06", 13)] }));
    await waitFor(() => expect(screen.getByText(/1 subsequent observed games · 13.00 league points/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Remove tracked result" }));
    expect(screen.getByText("No tracked recommendations yet.")).toBeTruthy();
  });
  it("reports failed browser storage instead of pretending a result was recorded", () => {
    render(view());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: "Track results" }));
    expect(screen.getByRole("alert").textContent).toContain("could not be saved");
    expect(screen.getByText("No tracked recommendations yet.")).toBeTruthy();
  });
});
