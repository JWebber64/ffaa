import { describe, expect, it } from "vitest";

import { buildDraftIntelligence } from "../features/league-history/analytics/draftIntelligence";
import { buildLeagueHistoryCoverage } from "../features/league-history/coverage/historyCoverage";
import type { LeagueHistorySnapshot, WeeklyRosterResult } from "../features/league-history/domain/types";

function weekly(id: string, franchiseId: string, week: number): WeeklyRosterResult {
  return {
    id,
    leagueSeasonId: "season",
    franchiseId,
    week,
    score: 100,
    starterScore: 100,
    benchScore: 0,
    optimalScore: 100,
    lineupEfficiency: 1,
    pointsLeftOnBench: 0,
    actualStartingPlayerIds: [],
    optimalStartingPlayerIds: [],
    bestMissedSubstitution: null,
    optimalStartersUsed: 1,
    analyticsStatus: "valid",
    analyticsReason: "",
    unsupportedSlots: [],
    missingSlots: [],
    calculationVersion: "test",
  };
}

function fixture(expectedPicks = 4): LeagueHistorySnapshot {
  const snapshot: LeagueHistorySnapshot = {
    league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test", sport: "nfl", format: "auction", settings: {}, createdAt: "", updatedAt: "2026-09-01T00:00:00.000Z" },
    seasons: [{ id: "season", leagueId: "league", provider: "sleeper", providerLeagueId: "league", previousProviderLeagueId: null, season: 2025, status: "complete", totalRosters: 3, scoringSettings: {}, settings: {}, rosterPositions: ["QB"], playoffWeekStart: 15, providerDraftId: "draft", importedAt: "2026-09-01T00:00:00.000Z" }],
    managers: ["a", "b", "c"].map((id) => ({ id, provider: "sleeper", providerUserId: id, currentUsername: id, displayName: id.toUpperCase(), avatarUrl: "", createdAt: "", updatedAt: "" })),
    franchises: ["a", "b", "c"].map((id, index) => ({ id: `f${id}`, leagueSeasonId: "season", managerId: id, providerRosterId: index + 1, historicalUsername: id, teamName: `Team ${id.toUpperCase()}`, avatarUrl: "", finalRank: index + 1, regularSeasonRank: index + 1, playoffSeed: index + 1, wins: 1, losses: 0, ties: 0, pointsFor: 100, pointsAgainst: 90, playoffFinish: "" })),
    matchups: [{ id: "matchup", leagueSeasonId: "season", week: 1, providerMatchupId: "1", franchiseAId: "fa", franchiseBId: "fb", scoreA: 100, scoreB: 90, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "fa", margin: 10, isComplete: true, importedAt: "" }],
    weeklyResults: [
      weekly("fa-1", "fa", 1),
      weekly("fa-2", "fa", 2),
      weekly("fb-3", "fb", 3),
      weekly("fa-4", "fa", 4),
      weekly("fb-1", "fb", 1),
      weekly("fc-1", "fc", 1),
    ],
    weeklyPlayerResults: [
      { id: "p1-1", weeklyRosterResultId: "fa-1", providerPlayerId: "p1", playerName: "Player One", position: "QB", isStarter: true, fantasyPoints: 10 },
      { id: "p1-2", weeklyRosterResultId: "fa-2", providerPlayerId: "p1", playerName: "Player One", position: "QB", isStarter: true, fantasyPoints: 20 },
      { id: "p1-3", weeklyRosterResultId: "fb-3", providerPlayerId: "p1", playerName: "Player One", position: "QB", isStarter: true, fantasyPoints: 30 },
      { id: "p1-4", weeklyRosterResultId: "fa-4", providerPlayerId: "p1", playerName: "Player One", position: "QB", isStarter: true, fantasyPoints: 5 },
      { id: "p2-1", weeklyRosterResultId: "fb-1", providerPlayerId: "p2", playerName: "Player Two", position: "QB", isStarter: true, fantasyPoints: 10 },
      { id: "p3-1", weeklyRosterResultId: "fc-1", providerPlayerId: "p3", playerName: "Player Three", position: "QB", isStarter: true, fantasyPoints: 5 },
    ],
    playoffMatches: [],
    drafts: [{ id: "draft", leagueSeasonId: "season", providerDraftId: "draft", draftType: "auction", status: "complete", budget: 200, rounds: null, startedAt: null, completedAt: null, settings: { auctionLedger: { recordedSales: 4, expectedRosterSpots: expectedPicks, recordedSpend: 20, expectedBudget: 20, orderKnown: false } } }],
    draftPicks: [
      { id: "pick-1", draftId: "draft", franchiseId: "fa", providerPickId: "pick-1", providerPlayerId: "p1", playerName: "Player One", position: "QB", nflTeam: "BUF", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
      { id: "pick-2", draftId: "draft", franchiseId: "fb", providerPickId: "pick-2", providerPlayerId: "p2", playerName: "Player Two", position: "QB", nflTeam: "KC", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
      { id: "pick-3", draftId: "draft", franchiseId: "fc", providerPickId: "pick-3", providerPlayerId: "p3", playerName: "Player Three", position: "QB", nflTeam: "DET", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: false, metadata: {} },
      { id: "keeper", draftId: "draft", franchiseId: "fa", providerPickId: "keeper", providerPlayerId: "p4", playerName: "Keeper", position: "QB", nflTeam: "PHI", pickNumber: null, round: null, draftSlot: null, auctionPrice: 5, isKeeper: true, metadata: {} },
    ],
    transactions: [],
    transactionAssets: [],
  };
  snapshot.coverage = buildLeagueHistoryCoverage(snapshot);
  return snapshot;
}

describe("draft intelligence", () => {
  it("counts only observed weeks on the drafting franchise", () => {
    const result = buildDraftIntelligence(fixture());
    const receipt = result.receipts.find((row) => row.providerPlayerId === "p1");

    expect(receipt).toMatchObject({
      observedWeeks: [1, 2, 4],
      observedRosterWeeks: 3,
      starterWeeks: 3,
      startedPoints: 35,
      rosteredPoints: 35,
      pointsPerDollar: 7,
      comparablePercentile: 100,
      comparableCount: 3,
    });
  });

  it("separates keepers and produces transparent manager DNA", () => {
    const result = buildDraftIntelligence(fixture(), { managerId: "a" });
    expect(result.receipts).toHaveLength(1);
    expect(result.keepers).toHaveLength(1);
    expect(result.managers[0]).toMatchObject({
      managerId: "a",
      purchases: 1,
      keepers: 1,
      totalSpend: 5,
      startedPoints: 35,
      pointsPerDollar: 7,
      provisional: false,
    });
  });

  it("labels intelligence provisional when the source ledger is partial", () => {
    const result = buildDraftIntelligence(fixture(5));
    expect(result.provisional).toBe(true);
    expect(result.receipts.every((receipt) => receipt.ledgerStatus === "partial")).toBe(true);
  });

  it("never converts missing observations into zero efficiency", () => {
    const snapshot = fixture();
    snapshot.weeklyPlayerResults = snapshot.weeklyPlayerResults.filter((row) => row.providerPlayerId !== "p3");
    snapshot.coverage = buildLeagueHistoryCoverage(snapshot);
    const result = buildDraftIntelligence(snapshot);
    const receipt = result.receipts.find((row) => row.providerPlayerId === "p3");
    expect(receipt?.pointsPerDollar).toBeNull();
    expect(receipt?.exclusions).toContain("no-observed-weekly-results");
  });
});


