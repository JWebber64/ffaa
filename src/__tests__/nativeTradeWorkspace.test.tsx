// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";
import { NativeTradeWorkspace } from "../features/native-trades/NativeTradeWorkspace";

vi.mock("../features/native-trades/useNativeTrades", () => ({
  useNativeTrades: () => {
    const settings = createRedraftLeagueSettings("America/New_York"); settings.transactions.tradeReview = "league_vote";
    return {
      status: "ready", message: "ready", settings,
      teams: [
        { id: "team-one", leagueId: "league-1", seasonId: "season-1", franchiseId: "team-one", name: "Sunday Best", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 2, rosterPlayerIds: ["2026-RB-jahmyr-gibbs"], status: "active" },
        { id: "team-two", leagueId: "league-1", seasonId: "season-1", franchiseId: "team-two", name: "Fourth Down", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 2, budget: null, cap: null, rosterRevision: 2, rosterPlayerIds: ["2026-WR-justin-jefferson"], status: "active" },
      ],
      players: [{ playerId: "2026-RB-jahmyr-gibbs", position: "RB", state: "owned", ownerFranchiseId: "team-one", droppedUntil: "", revision: 1 }, { playerId: "2026-WR-justin-jefferson", position: "WR", state: "owned", ownerFranchiseId: "team-two", droppedUntil: "", revision: 1 }],
      teamStates: [{ franchiseId: "team-one", faabRemaining: 88, priority: 1, standingsRank: 1, priorityWeek: 1, weeklyAcquisitions: {}, revision: 1 }, { franchiseId: "team-two", faabRemaining: 72, priority: 2, standingsRank: 2, priorityWeek: 1, weeklyAcquisitions: {}, revision: 1 }],
      offers: [{ id: "trade-1", fromFranchiseId: "team-one", toFranchiseId: "team-two", actorUserId: "commissioner", week: 1, settingsVersionId: "settings-7", offeredAssets: [{ type: "player", id: "2026-RB-jahmyr-gibbs", amount: null, metadata: {} }], requestedAssets: [{ type: "player", id: "2026-WR-justin-jefferson", amount: null, metadata: {} }, { type: "faab", id: "faab:team-two", amount: 8, metadata: {} }], message: "Swap roster anchors", status: "accepted_pending_review", reviewPolicy: "league_vote", reviewEndsAt: "", votes: { "manager-three": "approve" }, rosterEffects: {}, counterOfOfferId: "", counteredByOfferId: "", acceptedAt: "2026-09-10T13:00:00.000Z", acceptedBy: "manager-two", reviewedAt: "", reviewedBy: "", commissionerInvolvement: [], rosterTransactionId: "", reversalTransactionId: "", expiresAt: "2026-09-11T13:00:00.000Z", sentAt: "2026-09-10T12:00:00.000Z", revision: 3 }],
      receipts: [{ id: "trade-old", offerId: "trade-old", fromFranchiseId: "team-one", toFranchiseId: "team-two", offeredAssets: [{ type: "player", id: "2026-RB-jahmyr-gibbs", amount: null, metadata: {} }], requestedAssets: [{ type: "player", id: "2026-WR-justin-jefferson", amount: null, metadata: {} }], sentAt: "", acceptedAt: "", processedAt: "2026-09-03T13:00:00.000Z", reviewPolicy: "commissioner", votes: {}, commissionerInvolvement: ["Commissioner reviewer approved at 2026-09-03"], rosterEffects: {}, capEffects: {}, settingsVersionId: "settings-7", processingResult: "completed", rosterTransactionId: "tx-trade-old", reversalTransactionId: "" }],
    };
  },
}));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 8, settingsVersionId: "settings-7", draftSettingsVersionId: "settings-7", draftId: null, scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  membership: { leagueId: "league-1", userId: "commissioner", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["commissioner__commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [{ id: "commissioner__commissioner", leagueId: "league-1", userId: "commissioner", role: "commissioner", franchiseId: null, permissions: ["trade.manage"], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }], connection: null,
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: ["trade.manage"], roles: ["commissioner"], source: "gamehq" },
};

describe("native trade workspace", () => {
  it("shows a compact two-team builder, league-vote review, and completed ledger receipts", () => {
    render(<NativeTradeWorkspace workspace={workspace} />);
    expect(screen.getByRole("heading", { name: "Trade center" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Two-team trade builder" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send offer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vote approve" })).toBeTruthy();
    expect(screen.getByText(/1 approve · 0 reject · 2 required/iu)).toBeTruthy();
    expect(screen.getAllByText(/Jahmyr Gibbs/iu).length).toBeGreaterThan(1);
    expect(screen.getByText(/tx-trade-old/iu)).toBeTruthy();
    expect(screen.getByText(/Ownership, active-game locks, deadline, FAAB/iu)).toBeTruthy();
  });
});
