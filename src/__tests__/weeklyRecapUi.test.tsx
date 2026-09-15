/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ history: vi.fn(), workspace: vi.fn(), week: vi.fn() }));
vi.mock("../lib/firebase", () => ({ firestore: {} }));
vi.mock("../features/league-history/useLeagueHistory", () => ({ useLeagueHistory: mocks.history }));
vi.mock("../features/league-workspace/leagueWorkspaceState", () => ({ useOptionalLeagueWorkspace: mocks.workspace }));
vi.mock("../features/weekly-recap/useRecapWeek", () => ({ useRecapWeek: mocks.week }));
vi.mock("../features/weekly-recap/recapSource", () => ({ loadRecapSeasons: vi.fn().mockResolvedValue([2026, 2025]) }));

import LeagueHistoryApp from "../features/league-history/ui/LeagueHistoryApp";
import { RecapArticle } from "../features/weekly-recap/RecapArticle";
import { buildMatchupRecap } from "../features/weekly-recap/matchupRecap";
import { PersonalMatchupRecap } from "../features/weekly-recap/PersonalMatchupRecap";
import type { MyHQData } from "../features/my-hq/myHQ";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const recap = buildMatchupRecap({
  id: "1", leagueName: "Test League", season: 2026, week: 1, status: "final", rosterPositions: ["QB"],
  teams: [
    { id: "1", name: "Home team", managerIds: ["me"], score: 32, lineupComplete: true, players: [{ providerPlayerId: "p1", playerName: "Star QB", position: "QB", isStarter: true, fantasyPoints: 32 }] },
    { id: "2", name: "Away team", managerIds: ["them"], score: 20, lineupComplete: true, players: [{ providerPlayerId: "p2", playerName: "Other QB", position: "QB", isStarter: true, fantasyPoints: 20 }] },
  ], weekScores: [], leagueWeekComplete: false, sourceUrl: "https://sleeper.com", updatedAt: "2026-09-15T00:00:00Z",
})!;
const routeId = "487ce74f-0f9a-4fd8-893e-8284b7c54d52";
const providerId = "1385319428408774656";
const renderRoute = (path: string, element: React.ReactNode = <LeagueHistoryApp />) => render(<MemoryRouter initialEntries={[`/league/${routeId}/${path}`]}><Routes><Route path="/league/:leagueId/*" element={element} /></Routes></MemoryRouter>);

describe("weekly recap UI and canonical route identity", () => {
  it("keeps a readable lead visible while the full story is collapsed", () => {
    const { container } = render(<MemoryRouter><RecapArticle recap={recap} permalink="/recap" /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(recap.headline);
    expect(screen.getByText(recap.lead)).toBeVisible();
    expect(container.querySelector(".weekly-recap-disclosure")).not.toHaveAttribute("open");
    expect(container.querySelector('[data-position-color="qb"]')).toBeInTheDocument();
  });
  it("loads History with the mapped Sleeper ID, not the canonical URL UUID", () => {
    mocks.workspace.mockReturnValue({ dataLeagueId: providerId, routeState: { status: "ready" } });
    mocks.history.mockReturnValue({ status: "importing", data: null, error: "", refresh: vi.fn() });
    renderRoute("", <LeagueHistoryApp />);
    expect(mocks.history).toHaveBeenCalledWith(providerId);
    expect(mocks.history).not.toHaveBeenCalledWith(routeId);
  });
  it("opens a full recap by stable week/matchup URL without waiting for History import", async () => {
    mocks.workspace.mockReturnValue({ dataLeagueId: providerId, routeState: { status: "ready" } });
    mocks.week.mockReturnValue({ data: { league: { season: "2026", name: "Test League" }, week: 1, status: "final", recaps: [recap] }, error: "", refresh: vi.fn() });
    const { container } = renderRoute("recaps?season=2026&week=1&matchup=1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Recap season: 2026" })).toBeInTheDocument());
    expect(mocks.week).toHaveBeenCalledWith(providerId, 2026, 1);
    expect(mocks.history).not.toHaveBeenCalled();
    expect(container.querySelector(".weekly-recap-disclosure")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Open this recap" })).toHaveAttribute("href", `/league/${routeId}/history/recaps?season=2026&week=1&matchup=1`);
  });
  it("automatically replaces the pending personal message with the completed report", () => {
    const data = { leagueId: providerId, season: "2026", week: 1, managerProviderUserId: "me" } as MyHQData;
    mocks.week.mockReturnValue({ data: { status: "pending", recaps: [] }, error: "", refresh: vi.fn() });
    const view = renderRoute("matchup", <PersonalMatchupRecap data={data} />);
    expect(screen.getByText("The story isn’t over yet")).toBeVisible();
    mocks.week.mockReturnValue({ data: { status: "final", recaps: [recap] }, error: "", refresh: vi.fn() });
    view.rerender(<MemoryRouter><PersonalMatchupRecap data={data} /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(recap.headline);
    expect(screen.queryByText("The story isn’t over yet")).not.toBeInTheDocument();
  });
  it("keeps last week's story visible when the live board moves to the next matchup", () => {
    mocks.week.mockReturnValue({ data: { status: "final", recaps: [recap] }, error: "", refresh: vi.fn() });
    renderRoute("matchup", <PersonalMatchupRecap data={{ leagueId: providerId, season: "2026", week: 2, managerProviderUserId: "me" } as MyHQData} />);
    expect(mocks.week).toHaveBeenCalledWith(providerId, 2026);
    expect(screen.getByText("Last completed matchup · Week 1")).toBeVisible();
    expect(screen.getByText(recap.lead)).toBeVisible();
  });
});
