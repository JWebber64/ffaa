import { describe, expect, it } from "vitest";

import { buildRosterLegacy } from "../features/league-history/analytics/rosterLegacy";
import type {
  HistoryDomainCoverage,
  LeagueHistorySnapshot,
  WeeklyPlayerResult,
  WeeklyRosterResult,
} from "../features/league-history/domain/types";

const completeDomain: HistoryDomainCoverage = {
  status: "complete",
  observed: 2,
  expected: 2,
  source: "Sleeper weekly player payloads",
  sourceUrl: "",
  importedAt: "2026-09-01T00:00:00.000Z",
  reasons: ["expected-count-matched"],
};

function weeklyResult(id: string, seasonId: string, franchiseId: string): WeeklyRosterResult {
  return {
    id,
    leagueSeasonId: seasonId,
    franchiseId,
    week: 1,
    score: 100,
    starterScore: 90,
    benchScore: 10,
    optimalScore: 95,
    lineupEfficiency: 90 / 95,
    pointsLeftOnBench: 5,
    actualStartingPlayerIds: [],
    optimalStartingPlayerIds: [],
    bestMissedSubstitution: null,
    optimalStartersUsed: 1,
    analyticsStatus: "valid",
    analyticsReason: "complete",
    unsupportedSlots: [],
    missingSlots: [],
    calculationVersion: "test",
  };
}

function player(id: string, weeklyRosterResultId: string, name: string, position: string, points: number | null, isStarter = true): WeeklyPlayerResult {
  return { id, weeklyRosterResultId, providerPlayerId: id.split("-")[0]!, playerName: name, position, isStarter, fantasyPoints: points };
}

const snapshot: LeagueHistorySnapshot = {
  league: { id: "league", provider: "sleeper", currentExternalLeagueId: "league", name: "Test", sport: "nfl", format: "auction", settings: {}, createdAt: "", updatedAt: "" },
  seasons: [
    { id: "s25", leagueId: "league", provider: "sleeper", providerLeagueId: "l25", previousProviderLeagueId: "l24", season: 2025, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: null, importedAt: "" },
    { id: "s24", leagueId: "league", provider: "sleeper", providerLeagueId: "l24", previousProviderLeagueId: null, season: 2024, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: null, importedAt: "" },
  ],
  managers: [
    { id: "a", provider: "sleeper", providerUserId: "a", currentUsername: "alpha", displayName: "Alpha", avatarUrl: "", createdAt: "", updatedAt: "" },
    { id: "b", provider: "sleeper", providerUserId: "b", currentUsername: "beta", displayName: "Beta", avatarUrl: "", createdAt: "", updatedAt: "" },
  ],
  franchises: [
    { id: "a25", leagueSeasonId: "s25", managerId: "a", providerRosterId: 1, historicalUsername: "alpha", teamName: "Alpha", avatarUrl: "", finalRank: 1, regularSeasonRank: 1, playoffSeed: 1, wins: 10, losses: 4, ties: 0, pointsFor: 1500, pointsAgainst: 1300, playoffFinish: "Champion" },
    { id: "a24", leagueSeasonId: "s24", managerId: "a", providerRosterId: 1, historicalUsername: "alpha", teamName: "Old Alpha", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 8, losses: 6, ties: 0, pointsFor: 1400, pointsAgainst: 1350, playoffFinish: "Runner-up" },
    { id: "b25", leagueSeasonId: "s25", managerId: "b", providerRosterId: 2, historicalUsername: "beta", teamName: "Beta", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 8, losses: 6, ties: 0, pointsFor: 1400, pointsAgainst: 1450, playoffFinish: "Runner-up" },
  ],
  matchups: [],
  weeklyResults: [weeklyResult("wa25", "s25", "a25"), weeklyResult("wa24", "s24", "a24"), weeklyResult("wb25", "s25", "b25")],
  weeklyPlayerResults: [
    player("qb1-a25", "wa25", "Quarterback One", "QB", 20),
    player("qb1-a24", "wa24", "Quarterback One", "QB", 25),
    player("qb2-a25", "wa25", "Quarterback Two", "QB", 35),
    player("rb1-a25", "wa25", "Running Back One", "RB", 12),
    player("rb1-a24", "wa24", "Running Back One", "RB", null),
    player("rb2-a25", "wa25", "Running Back Two", "RB", 18),
    player("def1-a25", "wa25", "Defense One", "D/ST", null),
    player("bench-a25", "wa25", "Bench Player", "WR", 40, false),
    player("qb1-b25", "wb25", "Quarterback One", "QB", 22),
  ],
  playoffMatches: [],
  drafts: [],
  draftPicks: [],
  transactions: [],
  transactionAssets: [],
  coverage: {
    version: 1,
    generatedAt: "2026-09-01T00:00:00.000Z",
    seasons: ["s25", "s24"].map((seasonId, index) => ({
      seasonId,
      season: index ? 2024 : 2025,
      importedAt: "2026-09-01T00:00:00.000Z",
      domains: {
        franchises: completeDomain,
        managerIdentity: completeDomain,
        matchups: completeDomain,
        weeklyResults: completeDomain,
        weeklyPlayerResults: completeDomain,
        drafts: completeDomain,
        transactions: completeDomain,
      },
    })),
  },
};

describe("Roster Legacy", () => {
  it("selects the most-started player at each position for one permanent manager", () => {
    const legacy = buildRosterLegacy(snapshot, "a");
    expect(legacy).toMatchObject({ recordedStarts: 7, recordedSeasons: 2, evidenceStatus: "complete" });
    expect(legacy.rows.map((row) => [row.position, row.playerName, row.starts, row.seasons])).toEqual([
      ["QB", "Quarterback One", 2, 2],
      ["RB", "Running Back One", 2, 2],
      ["DEF", "Defense One", 1, 1],
    ]);
    expect(legacy.rows.find((row) => row.position === "RB")).toMatchObject({ starterPoints: 12, pointSamples: 1 });
    expect(legacy.rows.find((row) => row.position === "DEF")).toMatchObject({ starterPoints: null, pointSamples: 0 });
  });

  it("aggregates the same player across every franchise for the all-league roster", () => {
    const legacy = buildRosterLegacy(snapshot);
    expect(legacy.recordedStarts).toBe(8);
    expect(legacy.rows[0]).toMatchObject({ position: "QB", playerName: "Quarterback One", starts: 3, seasons: 2, starterPoints: 67 });
  });

  it("labels results provisional when completeness is not proven", () => {
    const { coverage: _coverage, ...withoutCoverage } = snapshot;
    expect(buildRosterLegacy(withoutCoverage, "a").evidenceStatus).toBe("provisional");
  });
});
