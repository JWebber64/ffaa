/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { LeagueHistorySnapshot, WeeklyRosterResult } from "../features/league-history/domain/types";
import { DraftHistoryPage } from "../features/league-history/ui/pages/ActivityPage";
import { ManagerDraftDNASummary } from "../features/league-history/ui/draft/ManagerDraftDNASummary";

afterEach(cleanup);

function weekly(id: string, franchiseId: string): WeeklyRosterResult {
  return { id, leagueSeasonId: "season", franchiseId, week: 1, score: 100, starterScore: 100, benchScore: 0, optimalScore: 100, lineupEfficiency: 1, pointsLeftOnBench: 0, actualStartingPlayerIds: [], optimalStartingPlayerIds: [], bestMissedSubstitution: null, optimalStartersUsed: 1, analyticsStatus: "valid", analyticsReason: "", unsupportedSlots: [], missingSlots: [], calculationVersion: "test" };
}

function historyFixture(): LeagueHistorySnapshot {
  return {
    league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test League", sport: "nfl", format: "auction", settings: {}, createdAt: "", updatedAt: "2026-09-01T00:00:00.000Z" },
    seasons: [{ id: "season", leagueId: "league", provider: "sleeper", providerLeagueId: "league", previousProviderLeagueId: null, season: 2025, status: "complete", totalRosters: 3, scoringSettings: {}, settings: {}, rosterPositions: ["QB"], playoffWeekStart: 15, providerDraftId: "draft", importedAt: "2026-09-01T00:00:00.000Z" }],
    managers: ["a", "b", "c"].map((id) => ({ id, provider: "sleeper", providerUserId: id, currentUsername: id, displayName: id.toUpperCase(), avatarUrl: "", createdAt: "", updatedAt: "" })),
    franchises: ["a", "b", "c"].map((id, index) => ({ id: `f${id}`, leagueSeasonId: "season", managerId: id, providerRosterId: index + 1, historicalUsername: id, teamName: `Team ${id.toUpperCase()}`, avatarUrl: "", finalRank: index + 1, regularSeasonRank: index + 1, playoffSeed: index + 1, wins: 1, losses: 0, ties: 0, pointsFor: 100, pointsAgainst: 90, playoffFinish: "" })),
    matchups: [{ id: "matchup", leagueSeasonId: "season", week: 1, providerMatchupId: "1", franchiseAId: "fa", franchiseBId: "fb", scoreA: 100, scoreB: 90, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "fa", margin: 10, isComplete: true, importedAt: "" }],
    weeklyResults: [weekly("wa", "fa"), weekly("wb", "fb"), weekly("wc", "fc")],
    weeklyPlayerResults: [
      { id: "pa", weeklyRosterResultId: "wa", providerPlayerId: "pa", playerName: "Alpha QB", position: "QB", isStarter: true, fantasyPoints: 30 },
      { id: "pb", weeklyRosterResultId: "wb", providerPlayerId: "pb", playerName: "Beta QB", position: "QB", isStarter: true, fantasyPoints: 20 },
      { id: "pc", weeklyRosterResultId: "wc", providerPlayerId: "pc", playerName: "Gamma QB", position: "QB", isStarter: true, fantasyPoints: 10 },
    ],
    playoffMatches: [],
    drafts: [{ id: "draft", leagueSeasonId: "season", providerDraftId: "draft", draftType: "auction", status: "complete", budget: 200, rounds: null, startedAt: null, completedAt: null, settings: { auctionLedger: { recordedSales: 3, expectedRosterSpots: 4, recordedSpend: 15, expectedBudget: 20, orderKnown: false } } }],
    draftPicks: [
      { id: "pick-a", draftId: "draft", franchiseId: "fa", providerPickId: "pick-a", providerPlayerId: "pa", playerName: "Alpha QB", position: "QB", nflTeam: "BUF", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
      { id: "pick-b", draftId: "draft", franchiseId: "fb", providerPickId: "pick-b", providerPlayerId: "pb", playerName: "Beta QB", position: "QB", nflTeam: "KC", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
      { id: "pick-c", draftId: "draft", franchiseId: "fc", providerPickId: "pick-c", providerPlayerId: "pc", playerName: "Gamma QB", position: "QB", nflTeam: "DET", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
    ],
    transactions: [],
    transactionAssets: [],
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderDraftHistory(snapshot: LeagueHistorySnapshot, entry = "/league/league/history/drafts") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<><Outlet context={snapshot} /><LocationProbe /></>}>
          <Route path="/league/:leagueId/history/drafts" element={<DraftHistoryPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Draft History Intelligence", () => {
  it("restores shareable filters and switches to the factual ledger with keyboard navigation", () => {
    renderDraftHistory(historyFixture(), "/league/league/history/drafts?season=2025&manager=a");

    expect(screen.getByRole("tab", { name: "Intelligence" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Draft Receipts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
    const receipts = screen.getByRole("table", { name: "" });
    expect(within(receipts).getByText("Alpha QB")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Intelligence" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Ledger" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("season=2025");
    expect(screen.getByTestId("location")).toHaveTextContent("manager=a");
    expect(screen.getByTestId("location")).toHaveTextContent("view=ledger");
    expect(screen.getByText("Partial source")).toBeInTheDocument();
  });

  it("never describes a provider-complete zero-pick draft as complete", () => {
    const snapshot = historyFixture();
    snapshot.draftPicks = [];
    snapshot.drafts[0] = { ...snapshot.drafts[0]!, settings: { auctionLedger: { recordedSales: 0, expectedRosterSpots: 144, recordedSpend: 0, expectedBudget: 2400 } } };
    renderDraftHistory(snapshot);
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("renders the same manager DNA in the compact profile summary", () => {
    const snapshot = historyFixture();
    render(
      <MemoryRouter>
        <ManagerDraftDNASummary leagueId="league" managerId="a" snapshot={snapshot} />
      </MemoryRouter>,
    );
    expect(within(screen.getByText("Recorded spend").closest("div")!).getByText("$5")).toBeInTheDocument();
    expect(within(screen.getByText("Starter pts / $").closest("div")!).getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open filtered Draft Intelligence" })).toHaveAttribute("href", expect.stringContaining("manager=a"));
  });
});
