// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BriefView } from "./BriefView";
import type { BriefEdition, LeagueBriefContext } from "./model";
afterEach(cleanup);
const context: LeagueBriefContext = { name: "QA league", snapshotAt: "2026-10-06T04:00:00Z", complete: true, ownedIds: ["100"], myIds: ["100"], format: "points", weights: { rec: 1 }, categories: [], positions: ["WR"], availability: "rosters", note: "QA fixture" };
const report: BriefEdition = { version: 1, sport: "football", date: "2026-10-05", generatedAt: "2026-10-06T12:00:00Z", revision: "test", status: "complete",
 games: [{ id: "g1", date: "2026-10-05", home: "BUF", away: "NYJ", homeScore: 21, awayScore: 10, final: true, sourceUrl: "https://example.com/game", week: 5 }], upcoming: [], sources: [], warnings: [],
 observations: ["1", "2"].map((id, i) => ({ id, providerId: String(100 + i), name: i ? "Available player" : "Owned player", position: "WR", team: "BUF", gameId: "g1", date: "2026-10-05", stats: { rec: 5, targets: 8 }, sourceUrl: "https://example.com/stats" })) };
function view(edition = report, league: LeagueBriefContext | null = context, latest = report.date) {
 return render(<MemoryRouter><BriefView edition={edition} archive={[{ date: latest, generatedAt: report.generatedAt, revision: "test", status: "complete" }]} expectedDate="2026-10-05" context={league}
 renderPlayer={player => <span>{player.name}</span>} renderWatch={() => <button>Watch player</button>} renderDatePicker={() => <select aria-label="Edition archive" />} leagueTo="/players" connectTo="/leagues" /></MemoryRouter>);
}
describe("daily brief presentation", () => {
 it("keeps owned players in your roster section and out of pickup options", () => {
   view();
   expect(within(screen.getByRole("region", { name: "Your players" })).getByText("Owned player")).toBeTruthy();
   expect(within(screen.getByRole("region", { name: "Watch before claiming" })).queryByText("Owned player")).toBeNull();
   expect(within(screen.getByRole("region", { name: "Watch before claiming" })).getByText("Available player")).toBeTruthy();
   expect(screen.getByText("1 final game")).toBeTruthy();
 });
 it("does not mistake an archived selection for a missing latest edition", () => {
   view({ ...report, date: "2026-10-03", observations: [] });
   expect(screen.queryByText(/has not been published yet/)).toBeNull();
 });
 it("discloses unsupported custom scoring and withholds incomplete league coverage", () => {
   view(report, { ...context, weights: { bonus_rec: 5 } });
   expect(screen.getByText(/Some league scoring rules are missing/)).toBeTruthy();
   expect(screen.queryByRole("region", { name: "Watch before claiming" })).toBeNull();
   cleanup();
   view(report, { ...context, complete: false });
   expect(screen.getByText(/League coverage is incomplete/)).toBeTruthy();
   expect(screen.queryByRole("region", { name: "Watch before claiming" })).toBeNull();
 });
});
