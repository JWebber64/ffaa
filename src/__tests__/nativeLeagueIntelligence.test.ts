import { describe, expect, it } from "vitest";

import { buildMirrorParityReport, buildNativeDecisionRecommendations, buildNativeHistoryProjection } from "../../shared/nativeLeagueIntelligence";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";

describe("native league intelligence", () => {
  it("rebuilds careers, head-to-head, records, bench history, and milestones from native facts", () => {
    const projection = buildNativeHistoryProjection({ franchiseIds: ["alpha", "beta"], audits: [{ action: "trade_completed", franchiseIds: ["alpha", "beta"] }], results: [{ gameId: "g1", week: 1, homeFranchiseId: "alpha", awayFranchiseId: "beta", homeScore: 150, awayScore: 90, homePotentialPoints: 160, awayPotentialPoints: 120 }, { gameId: "g2", week: 2, homeFranchiseId: "beta", awayFranchiseId: "alpha", homeScore: 110, awayScore: 100, homePotentialPoints: 125, awayPotentialPoints: 130 }], lineups: [{ franchiseId: "alpha", week: 1, currentScore: 150, benchPoints: 22, optimalScore: 160 }, { franchiseId: "beta", week: 1, currentScore: 90, benchPoints: 35, optimalScore: 120 }], waiverWinningFranchiseIds: ["alpha", "alpha"], draftFranchiseIds: ["alpha", "beta", "alpha"] });
    expect(projection.franchiseRows.find((row) => row.franchiseId === "alpha")).toMatchObject({ wins: 1, losses: 1, pointsFor: 250, waiverWins: 2, draftPicks: 2, benchPoints: 22 });
    expect(projection.headToHead[0]).toMatchObject({ winsA: 1, winsB: 1, ties: 0, pointsA: 250, pointsB: 200 });
    expect(projection.records).toEqual(expect.arrayContaining([expect.objectContaining({ id: "single-week-score", franchiseId: "alpha", value: 150 }), expect.objectContaining({ id: "bench-points", franchiseId: "beta", value: 35 })]));
  });

  it("uses exact league state for read-only recommendations and discloses uncertainty", () => {
    const settings = createRedraftLeagueSettings("America/New_York"); settings.transactions.waiverMode = "faab";
    const recommendations = buildNativeDecisionRecommendations({ settings, franchiseId: "alpha", week: 6, rosterPlayerIds: ["rb-low", "wr-bye"], starterPlayerIds: ["wr-bye"], faabRemaining: 63, opponentProjectedFinal: 121.4, riskPreference: "balanced", candidates: [{ playerId: "rb-low", position: "RB", projectedPoints: 8, projectionLow: 6, projectionHigh: 10, byeWeek: 9, ownerFranchiseId: "alpha", state: "owned" }, { playerId: "wr-bye", position: "WR", projectedPoints: 14, projectionLow: 10, projectionHigh: 17, byeWeek: 6, ownerFranchiseId: "alpha", state: "owned" }, { playerId: "rb-free", position: "RB", projectedPoints: 13, projectionLow: null, projectionHigh: null, byeWeek: 11, ownerFranchiseId: "", state: "on_waivers" }] });
    expect(recommendations).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: "wr-bye", kind: "bye", mutation: null }), expect.objectContaining({ playerId: "rb-free", kind: "waiver", confidence: "low", mutation: null, evidence: expect.arrayContaining([expect.stringContaining("63 FAAB")]), uncertainty: expect.arrayContaining([expect.stringContaining("No low/high")]) })]));
  });

  it("keeps authority explicit and never treats missing parity evidence as a match", () => {
    const report = buildMirrorParityReport({ authorityMode: "mirror", external: { identity: 12, rosters: 180, history: 100 }, native: { identity: 12, rosters: 179, history: 100, scoring: 300 } });
    expect(report.find((row) => row.dimension === "identity")).toMatchObject({ status: "match", authority: "parallel" });
    expect(report.find((row) => row.dimension === "rosters")).toMatchObject({ status: "mismatch" });
    expect(report.find((row) => row.dimension === "scoring")).toMatchObject({ status: "unavailable" });
  });
});
