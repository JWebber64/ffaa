// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { NativeWaiverWorkspace } from "../features/native-waivers/NativeWaiverWorkspace";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";

vi.mock("../features/native-waivers/useNativeWaivers", () => ({
  useNativeWaivers: () => ({
    status: "ready", message: "ready", settings: createRedraftLeagueSettings("America/New_York"),
    waiverState: { revision: 3, playerCount: 301, settingsVersionId: "settings-7", nextProcessingAt: "2026-09-10T13:00:00.000Z", lastRunId: "run-1", updatedAt: "" },
    teams: [{ id: "team-one", leagueId: "league-1", seasonId: "season-1", franchiseId: "team-one", name: "Sunday Best", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 2, rosterPlayerIds: ["2026-RB-jahmyr-gibbs"], status: "active" }],
    teamStates: [{ franchiseId: "team-one", faabRemaining: 84, priority: 3, standingsRank: 4, priorityWeek: 1, weeklyAcquisitions: { "1": 1 }, revision: 2 }],
    players: [{ playerId: "2026-RB-jahmyr-gibbs", position: "RB", state: "owned", ownerFranchiseId: "team-one", droppedUntil: "", revision: 2 }, { playerId: "2026-WR-justin-jefferson", position: "WR", state: "free_agent", ownerFranchiseId: "", droppedUntil: "", revision: 1 }],
    claims: [{ id: "claim-1", franchiseId: "team-one", week: 1, status: "pending", processAt: "2026-09-10T13:00:00.000Z", alternatives: [{ addPlayerId: "2026-WR-justin-jefferson", dropPlayerId: "", bid: 8, order: 1, submissionIssue: "" }], failures: [], createdAt: "2026-09-09T13:00:00.000Z" }],
    receipts: [{ id: "receipt-1", runId: "run-1", claimId: "old-claim", franchiseId: "team-one", status: "won", claimsEvaluated: 2, winningBid: 16, nextHighestBid: 12, priorityBefore: 2, priorityAfter: 3, tiebreakerUsed: "priority", failures: ["Alternative 1: outbid."], addPlayerId: "2026-WR-justin-jefferson", dropPlayerId: "", remainingFaab: 84, processedAt: "2026-09-03T13:00:00.000Z" }],
  }),
}));
vi.mock("../features/native-lineup/useNativeLineup", () => ({ useNativeLineup: () => ({ status: "ready", message: "ready", teams: [], settings: null, week: null, lineups: [{ franchiseId: "team-one", week: 1, assignments: { "RB-1": "2026-RB-jahmyr-gibbs" } }] }) }));
vi.mock("../features/native-scoring/useNativeScoring", () => ({ useNativeScoring: () => ({ status: "ready", message: "ready", scoringWeek: { matchups: [{ homeFranchiseId: "team-one", awayFranchiseId: "team-two", homeProjectedFinal: 112, awayProjectedFinal: 119 }] } }) }));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 8, settingsVersionId: "settings-7", draftSettingsVersionId: "settings-7", draftId: null, scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  membership: { leagueId: "league-1", userId: "commissioner", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["commissioner__commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [{ id: "commissioner__commissioner", leagueId: "league-1", userId: "commissioner", role: "commissioner", franchiseId: null, permissions: ["waiver.manage"], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }], connection: null,
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: ["waiver.manage"], roles: ["commissioner"], source: "gamehq" },
};

describe("native waiver workspace", () => {
  it("shows claim rules, ordered alternatives, canonical availability, and explainable receipts", () => {
    render(<NativeWaiverWorkspace workspace={workspace} />);
    expect(screen.getByRole("heading", { name: "Free agents & waivers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Order conditional alternatives" })).toBeTruthy();
    expect(screen.getByText("$84 FAAB")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add fallback" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Process due claims/iu })).toBeTruthy();
    expect(screen.getAllByText(/Justin Jefferson/iu).length).toBeGreaterThan(1);
    expect(screen.getByText(/\$16 winning bid · \$84 remaining · priority 2 → 3/iu)).toBeTruthy();
    expect(screen.getByText(/server rechecks ownership, FAAB, roster size, position limits/iu)).toBeTruthy();
  });
});
