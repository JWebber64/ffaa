/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { LeagueHistorySnapshot } from "../features/league-history/domain/types";
import { SeasonArchivePage } from "../features/league-history/ui/pages/SeasonsPage";

const draftPicks: LeagueHistorySnapshot["draftPicks"] = Array.from({ length: 65 }, (_, index) => ({
  id: `pick-${index + 1}`,
  draftId: "draft-2025",
  franchiseId: index % 2 ? "franchise-b" : "franchise-a",
  providerPickId: `provider-pick-${index + 1}`,
  providerPlayerId: `player-${index + 1}`,
  playerName: `Player ${index + 1}`,
  position: index % 2 ? "RB" : "WR",
  nflTeam: index % 2 ? "BUF" : "DET",
  pickNumber: null,
  round: null,
  draftSlot: null,
  auctionPrice: index + 1,
  isKeeper: false,
  metadata: {},
}));

const snapshot: LeagueHistorySnapshot = {
  league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test League", sport: "nfl", format: "2-team auction", settings: {}, createdAt: "", updatedAt: "" },
  seasons: [{ id: "season-2025", leagueId: "league", provider: "sleeper", providerLeagueId: "league", previousProviderLeagueId: null, season: 2025, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: "draft-2025", importedAt: "" }],
  managers: [
    { id: "manager-a", provider: "sleeper", providerUserId: "user-a", currentUsername: "alpha", displayName: "Alpha", avatarUrl: "", createdAt: "", updatedAt: "" },
    { id: "manager-b", provider: "sleeper", providerUserId: "user-b", currentUsername: "beta", displayName: "Beta", avatarUrl: "", createdAt: "", updatedAt: "" },
  ],
  franchises: [
    { id: "franchise-a", leagueSeasonId: "season-2025", managerId: "manager-a", providerRosterId: 1, historicalUsername: "alpha", teamName: "Alpha Team", avatarUrl: "", finalRank: 1, regularSeasonRank: 1, playoffSeed: 1, wins: 10, losses: 4, ties: 0, pointsFor: 1500, pointsAgainst: 1300, playoffFinish: "Champion" },
    { id: "franchise-b", leagueSeasonId: "season-2025", managerId: "manager-b", providerRosterId: 2, historicalUsername: "beta", teamName: "Beta Team", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 8, losses: 6, ties: 0, pointsFor: 1400, pointsAgainst: 1450, playoffFinish: "Runner-up" },
  ],
  matchups: [
    { id: "week-1", leagueSeasonId: "season-2025", week: 1, providerMatchupId: "1", franchiseAId: "franchise-a", franchiseBId: "franchise-b", scoreA: 100, scoreB: 90, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "franchise-a", margin: 10, isComplete: true, importedAt: "" },
    { id: "week-2", leagueSeasonId: "season-2025", week: 2, providerMatchupId: "1", franchiseAId: "franchise-a", franchiseBId: "franchise-b", scoreA: 95, scoreB: 105, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "franchise-b", margin: 10, isComplete: true, importedAt: "" },
    { id: "week-15", leagueSeasonId: "season-2025", week: 15, providerMatchupId: "1", franchiseAId: "franchise-a", franchiseBId: "franchise-b", scoreA: 120, scoreB: 110, isPlayoff: true, playoffRound: 1, isChampionship: true, winnerFranchiseId: "franchise-a", margin: 10, isComplete: true, importedAt: "" },
  ],
  weeklyResults: [],
  weeklyPlayerResults: [],
  playoffMatches: [{ id: "title", leagueSeasonId: "season-2025", bracketType: "winners", providerMatchId: "1", round: 1, placement: 1, franchiseAId: "franchise-a", franchiseBId: "franchise-b", winnerFranchiseId: "franchise-a", loserFranchiseId: "franchise-b" }],
  drafts: [{ id: "draft-2025", leagueSeasonId: "season-2025", providerDraftId: "draft-2025", draftType: "auction", status: "complete", budget: 200, rounds: null, startedAt: null, completedAt: null, settings: { auctionLedger: { expectedRosterSpots: 65, isComplete: true } } }],
  draftPicks,
  transactions: [
    { id: "trade", leagueSeasonId: "season-2025", providerTransactionId: "trade", transactionType: "trade", status: "complete", week: 3, creatorProviderUserId: "user-a", faabBid: null, occurredAt: "2025-09-20T00:00:00Z", metadata: {} },
    { id: "waiver", leagueSeasonId: "season-2025", providerTransactionId: "waiver", transactionType: "waiver", status: "complete", week: 4, creatorProviderUserId: "user-b", faabBid: 12, occurredAt: "2025-09-27T00:00:00Z", metadata: {} },
  ],
  transactionAssets: [],
};

function renderSeasonArchive(entry = "/league/league/seasons/2025") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={snapshot} />}>
          <Route path="/league/:leagueId/seasons/:season" element={<SeasonArchivePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SeasonArchivePage", () => {
  it("groups regular-season games by week and separates the playoffs", () => {
    renderSeasonArchive();

    fireEvent.click(screen.getByRole("button", { name: "games" }));
    expect(screen.getByRole("heading", { name: "Week 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Week 2" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Alpha Team 100, Beta Team 90" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Week 15" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Playoffs" }));
    expect(screen.getByRole("heading", { name: "Week 15" })).toBeInTheDocument();
    expect(screen.getByText("Championship")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Week 1" })).not.toBeInTheDocument();
  });

  it("renders every recorded auction player and defaults to price descending", async () => {
    const { container } = renderSeasonArchive("/league/league/seasons/2025?section=auction");

    expect(screen.getByText("65 recorded players")).toBeInTheDocument();
    expect(container.querySelectorAll(".history-season-draft-table-wrap tbody tr")).toHaveLength(65);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Player 65");
    expect(screen.queryByRole("columnheader", { name: "Order" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search player, team, or franchise"), { target: { value: "Player 65" } });
    await waitFor(() => expect(screen.getByText("1 of 65 players")).toBeInTheDocument());
    expect(container.querySelectorAll(".history-season-draft-table-wrap tbody tr")).toHaveLength(1);
  });
});
