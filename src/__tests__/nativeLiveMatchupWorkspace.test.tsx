// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NativeLiveMatchupWorkspace } from "../features/native-scoring/NativeLiveMatchupWorkspace";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";

vi.mock("../features/native-scoring/useNativeScoring", () => ({
  useNativeScoring: () => ({
    status: "ready", message: "Live scoring is synchronized.",
    teams: [
      { id: "away", leagueId: "league-1", seasonId: "season-1", franchiseId: "away", name: "Road Team", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: ["2026-WR-justin-jefferson"], status: "active" },
      { id: "home", leagueId: "league-1", seasonId: "season-1", franchiseId: "home", name: "Home Team", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 2, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: ["2026-QB-josh-allen"], status: "active" },
    ],
    scoringWeek: {
      id: "week-1", leagueId: "league-1", seasonId: "season-1", week: 1, settingsVersionId: "settings-7", scoringRuleVersionId: "settings-7", lineupWeekRevision: 2, revision: 4, ingestionVersion: "v1", providerKey: "fixture", fallbackProviderKey: "fallback", providerState: "delayed",
      freshness: { state: "stale", ageSeconds: 600, message: "Score data is stale by 600 seconds; cached totals remain visible." }, lastProviderTimestamp: "2026-09-13T17:00:00.000Z", eventCount: 1, duplicateEventCount: 1, correctionCount: 1, statCorrectionState: "corrected",
      playerTotals: { "2026-WR-justin-jefferson": 2.8 }, lineupTotals: [
        { franchiseId: "away", assignments: { "WR-1": "2026-WR-justin-jefferson" }, currentScore: 2.8, projectedFinal: 17, pointsRemaining: 14.2, playersRemaining: 1, benchPoints: 3, optimalScore: 4, optimalDelta: 1.2 },
        { franchiseId: "home", assignments: { "QB-1": "2026-QB-josh-allen" }, currentScore: 1, projectedFinal: 16, pointsRemaining: 15, playersRemaining: 1, benchPoints: 2, optimalScore: 2, optimalDelta: 1 },
      ], matchups: [{ matchupId: "m-1", awayFranchiseId: "away", homeFranchiseId: "home", awayScore: 2.8, homeScore: 1, awayProjectedFinal: 17, homeProjectedFinal: 16, awayWinProbability: .52, homeWinProbability: .48, playersRemaining: 2, pointsRemaining: 29.2 }],
      standingsProjection: [{ franchiseId: "away", projectedOutcome: "win" }, { franchiseId: "home", projectedOutcome: "loss" }], gameStatuses: { "game-1": "in_progress" }, activeNflGameIds: ["game-1"],
      scoringFeed: [{ eventKey: "evt", providerEventId: "evt-1", occurredAt: "2026-09-13T17:00:00.000Z", playerId: "2026-WR-justin-jefferson", nflGameId: "game-1", description: "18-yard reception", fantasyPointDelta: 2.8, resultingPlayerTotal: 2.8, scoringRuleIds: ["receiving-yards", "receptions"], explanations: ["+1.80 receiving yards", "+1.00 reception"], corrected: true }],
      leadChanges: [{ matchupId: "m-1", eventKey: "evt", occurredAt: "2026-09-13T17:00:00.000Z", leaderFranchiseId: "away", homeScore: 1, awayScore: 2.8 }], topActivePerformer: { playerId: "2026-WR-justin-jefferson", points: 2.8 }, cachedLastKnownScore: true, updatedAt: "2026-09-13T17:00:00.000Z",
    },
  }),
}));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 8, settingsVersionId: "settings-7", draftSettingsVersionId: "settings-7", draftId: null, scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  membership: { leagueId: "league-1", userId: "manager", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["manager-away"], displayName: "Manager", email: "manager@example.com" },
  roleGrants: [{ id: "manager-away", leagueId: "league-1", userId: "manager", role: "team_owner", franchiseId: "away", permissions: ["score.read"], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }],
  connection: null,
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: false, canSaveLineup: true, permissions: ["score.read"], roles: ["team_owner"], source: "gamehq" },
};

describe("native live matchup workspace", () => {
  it("shows current weekly scoring, calculations, correction and stale-data state without calling season PPG live points", () => {
    render(<MemoryRouter initialEntries={["/league/league-1/matchup?week=1"]}><NativeLiveMatchupWorkspace workspace={workspace} personalOnly /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Week 1 live scoring" })).toBeTruthy();
    expect(screen.getAllByText("2.80").length).toBeGreaterThan(0);
    expect(screen.getByText("52% win probability · 17.00 projected")).toBeTruthy();
    expect(screen.getByText("Cached last-known score")).toBeTruthy();
    expect(screen.getByText("18-yard reception")).toBeTruthy();
    expect(screen.getByText(/\+1\.80 receiving yards · \+1\.00 reception/iu)).toBeTruthy();
    expect(screen.getByText(/audited stat correction/iu)).toBeTruthy();
    expect(screen.queryByText(/PPG/iu)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Provider-neutral event ingress" })).toBeNull();
  });
});
