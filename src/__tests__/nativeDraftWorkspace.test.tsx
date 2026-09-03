// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CanonicalLeagueWorkspace, NativeDraft, SeasonTeam } from "../features/league-domain/types";
import { normalizeNativeDraft } from "../features/native-draft/nativeDraft";

const { applyNativeDraftActionCommand, revertNativeDraftActionCommand } = vi.hoisted(() => ({
  applyNativeDraftActionCommand: vi.fn(async () => ({ resultingRevision: 8, result: { draftRevision: 4 } })),
  revertNativeDraftActionCommand: vi.fn(async () => ({ resultingRevision: 8, result: { draftRevision: 4 } })),
}));

vi.mock("../features/league-domain/leagueCommands", () => ({
  applyNativeDraftActionCommand,
  revertNativeDraftActionCommand,
}));

import { NativeDraftBoard } from "../features/native-draft/NativeDraftBoard";

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";
const franchiseId = "33333333-3333-4333-8333-333333333333";

const workspace: CanonicalLeagueWorkspace = {
  league: { id: leagueId, name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "Asia/Taipei", status: "draft", currentSeasonId: seasonId, createdBy: "commissioner-1", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: seasonId, leagueId, year: 2026, phase: "draft", revision: 7, settingsVersionId: "settings-1", draftSettingsVersionId: "", draftId: "draft-1", scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  connection: null,
  membership: { leagueId, userId: "commissioner-1", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["commissioner-1__commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [{ id: "commissioner-1__commissioner", leagueId, userId: "commissioner-1", role: "commissioner", franchiseId: null, permissions: [], effectiveAt: "", expiresAt: null, grantedBy: "commissioner-1", revokedAt: null, revision: 1 }],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: [], roles: ["commissioner"], source: "gamehq" },
};

const teams: SeasonTeam[] = [{ id: franchiseId, leagueId, seasonId, franchiseId, name: "Claybags", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: [], status: "active" }];

const draft: NativeDraft = {
  id: "draft-1", leagueId, seasonId, settingsVersionId: "settings-1", format: "snake", mode: "live", status: "live", revision: 3, seasonRevision: 7, orderFranchiseIds: [franchiseId], rosterSize: 8, pickSeconds: 60, nominationSeconds: 30, bidSeconds: 10, antiSnipeSeconds: 5, minimumBid: 1, auctionBudget: 0, spectatorEnabled: true, spectatorCode: "spectator-code", teamStates: [{ franchiseId, budget: 0, spent: 0, picks: 0 }], selections: [], queues: {}, overallPick: 1, currentFranchiseId: franchiseId, currentDeadlineAt: "2026-09-03T10:00:00.000Z", auctionState: null, createdAt: "", startedAt: "", completedAt: null, updatedAt: "",
};

describe("native draft workspace", () => {
  it("normalizes the canonical persisted draft contract", () => {
    expect(normalizeNativeDraft({
      id: "draft-1", league_id: leagueId, season_id: seasonId, settings_version_id: "settings-1", format: "auction", mode: "slow", status: "paused", revision: 4, season_revision: 9, order_franchise_ids: [franchiseId], roster_size: 8, pick_seconds: 86400, nomination_seconds: 30, bid_seconds: 10, anti_snipe_seconds: 5, minimum_bid: 1, auction_budget: 200, spectator_enabled: true, spectator_code: "watch", team_states: [{ franchise_id: franchiseId, budget: 200, spent: 17, picks: 1 }], selections: [{ id: "pick-1", player_id: "2026-RB-player", franchise_id: franchiseId, overall_pick: 1, round: 1, price: 17, roster_transaction_id: "tx-1", selected_at: "now", source: "auction" }], queues: { [franchiseId]: ["next-player"] }, overall_pick: 2, current_franchise_id: franchiseId, current_deadline_at: "later", auction_state: {}, created_at: "now", started_at: "now", completed_at: "", updated_at: "now",
    }, leagueId, seasonId, "draft-1")).toMatchObject({ format: "auction", mode: "slow", status: "paused", seasonRevision: 9, teamStates: [{ spent: 17 }], selections: [{ rosterTransactionId: "tx-1" }], queues: { [franchiseId]: ["next-player"] } });
  });

  it("sends a commissioner pick with exact draft and season revisions", async () => {
    render(<NativeDraftBoard workspace={workspace} draft={draft} teams={teams} commissionerControls />);
    expect(screen.getByRole("heading", { name: "Claybags is on the clock" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("2026-RB-player-name"), { target: { value: "2026-RB-jahmyr-gibbs" } });
    fireEvent.click(screen.getByRole("button", { name: "Make pick" }));
    await waitFor(() => expect(applyNativeDraftActionCommand).toHaveBeenCalledWith(expect.objectContaining({
      leagueId,
      seasonId,
      expectedRevision: 7,
      payload: { draftId: "draft-1", expectedDraftRevision: 3, action: { type: "pick", playerId: "2026-RB-jahmyr-gibbs" } },
    })));
    expect(await screen.findByText("Selection published to the team roster.")).toBeTruthy();
  });

  it("requires a reason before the commissioner can revert a result", async () => {
    render(<NativeDraftBoard workspace={workspace} draft={{ ...draft, selections: [{ id: "pick-1", playerId: "player-1", franchiseId, overallPick: 1, round: 1, price: 0, rosterTransactionId: "tx-1", selectedAt: "", source: "pick" }] }} teams={teams} commissionerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Revert last result" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enter a clear audit reason");
    expect(revertNativeDraftActionCommand).not.toHaveBeenCalled();
  });
});
