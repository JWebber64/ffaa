import { describe, expect, it } from "vitest";

import {
  buildLeagueHistoryCoverage,
  coverageStatusLabel,
  isHistoryMetricEligible,
} from "../features/league-history/coverage/historyCoverage";
import type { LeagueHistorySnapshot } from "../features/league-history/domain/types";

function snapshotWithDraft(options: {
  picks: number;
  expected?: number;
  spend?: number;
  expectedSpend?: number;
  weekly?: boolean;
}): LeagueHistorySnapshot {
  const weekly = options.weekly === true;
  const settings = options.expected == null ? {} : {
    auctionLedger: {
      recordedSales: options.picks,
      expectedRosterSpots: options.expected,
      recordedSpend: options.spend ?? options.picks,
      expectedBudget: options.expectedSpend ?? options.expected,
      orderKnown: false,
      label: "Test workbook",
      url: "https://example.com/source",
    },
  };
  return {
    league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test", sport: "nfl", format: "auction", settings: {}, createdAt: "", updatedAt: "2026-09-01T00:00:00.000Z" },
    seasons: [{ id: "season", leagueId: "league", provider: "sleeper", providerLeagueId: "league", previousProviderLeagueId: null, season: 2025, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: ["QB"], playoffWeekStart: 15, providerDraftId: "draft", importedAt: "2026-09-01T00:00:00.000Z" }],
    managers: [
      { id: "a", provider: "sleeper", providerUserId: "a", currentUsername: "a", displayName: "A", avatarUrl: "", createdAt: "", updatedAt: "" },
      { id: "b", provider: "sleeper", providerUserId: "b", currentUsername: "b", displayName: "B", avatarUrl: "", createdAt: "", updatedAt: "" },
    ],
    franchises: [
      { id: "fa", leagueSeasonId: "season", managerId: "a", providerRosterId: 1, historicalUsername: "a", teamName: "A", avatarUrl: "", finalRank: 1, regularSeasonRank: 1, playoffSeed: 1, wins: 1, losses: 0, ties: 0, pointsFor: 100, pointsAgainst: 90, playoffFinish: "Champion" },
      { id: "fb", leagueSeasonId: "season", managerId: "b", providerRosterId: 2, historicalUsername: "b", teamName: "B", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 0, losses: 1, ties: 0, pointsFor: 90, pointsAgainst: 100, playoffFinish: "Runner-up" },
    ],
    matchups: [{ id: "m", leagueSeasonId: "season", week: 1, providerMatchupId: "1", franchiseAId: "fa", franchiseBId: "fb", scoreA: 100, scoreB: 90, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "fa", margin: 10, isComplete: true, importedAt: "" }],
    weeklyResults: weekly ? [
      { id: "wa", leagueSeasonId: "season", franchiseId: "fa", week: 1, score: 100, starterScore: 100, benchScore: 0, optimalScore: 100, lineupEfficiency: 1, pointsLeftOnBench: 0, actualStartingPlayerIds: ["pa"], optimalStartingPlayerIds: ["pa"], bestMissedSubstitution: null, optimalStartersUsed: 1, analyticsStatus: "valid", analyticsReason: "", unsupportedSlots: [], missingSlots: [], calculationVersion: "test" },
      { id: "wb", leagueSeasonId: "season", franchiseId: "fb", week: 1, score: 90, starterScore: 90, benchScore: 0, optimalScore: 90, lineupEfficiency: 1, pointsLeftOnBench: 0, actualStartingPlayerIds: ["pb"], optimalStartingPlayerIds: ["pb"], bestMissedSubstitution: null, optimalStartersUsed: 1, analyticsStatus: "valid", analyticsReason: "", unsupportedSlots: [], missingSlots: [], calculationVersion: "test" },
    ] : [],
    weeklyPlayerResults: weekly ? [
      { id: "pa", weeklyRosterResultId: "wa", providerPlayerId: "pa", playerName: "A Player", position: "QB", isStarter: true, fantasyPoints: 20 },
      { id: "pb", weeklyRosterResultId: "wb", providerPlayerId: "pb", playerName: "B Player", position: "QB", isStarter: true, fantasyPoints: 18 },
    ] : [],
    playoffMatches: [],
    drafts: [{ id: "draft", leagueSeasonId: "season", providerDraftId: "draft", draftType: "auction", status: "complete", budget: 200, rounds: null, startedAt: null, completedAt: null, settings }],
    draftPicks: Array.from({ length: options.picks }, (_, index) => ({ id: `pick-${index}`, draftId: "draft", franchiseId: index % 2 ? "fb" : "fa", providerPickId: `pick-${index}`, providerPlayerId: index % 2 ? "pb" : "pa", playerName: `Player ${index}`, position: "QB", nflTeam: "BUF", pickNumber: null, round: null, draftSlot: null, auctionPrice: 1, isKeeper: false, metadata: {} })),
    transactions: [],
    transactionAssets: [],
  };
}

describe("League History coverage", () => {
  it("does not trust a provider-complete draft with zero picks", () => {
    const coverage = buildLeagueHistoryCoverage(snapshotWithDraft({ picks: 0, expected: 144 }));
    expect(coverage.seasons[0]?.domains.drafts).toMatchObject({ status: "missing", observed: 0, expected: 144 });
  });

  it.each([
    [136, 144],
    [135, 144],
  ])("reports %i of %i picks as partial", (picks, expected) => {
    const coverage = buildLeagueHistoryCoverage(snapshotWithDraft({ picks, expected, spend: 2_367, expectedSpend: 2_400 }));
    expect(coverage.seasons[0]?.domains.drafts).toMatchObject({ status: "partial", observed: picks, expected });
  });

  it("keeps unknown denominators honest and exposes plain-language labels", () => {
    const coverage = buildLeagueHistoryCoverage(snapshotWithDraft({ picks: 2 }));
    expect(coverage.seasons[0]?.domains.drafts.status).toBe("unknown");
    expect(coverage.seasons[0]?.domains.transactions).toMatchObject({ status: "unknown", expected: null });
    expect(coverageStatusLabel("unknown")).toBe("Available; completeness unknown");
  });

  it("gates observed returns on weekly roster and player payloads", () => {
    const withoutWeeks = buildLeagueHistoryCoverage(snapshotWithDraft({ picks: 2, expected: 2 }));
    expect(isHistoryMetricEligible("draft-receipt-observed-return", withoutWeeks.seasons[0] ?? null).eligible).toBe(false);

    const withWeeks = buildLeagueHistoryCoverage(snapshotWithDraft({ picks: 2, expected: 2, weekly: true }));
    expect(isHistoryMetricEligible("draft-receipt-observed-return", withWeeks.seasons[0] ?? null)).toMatchObject({ eligible: true, provisional: false });
  });
});
