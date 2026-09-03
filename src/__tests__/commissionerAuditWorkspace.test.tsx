// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommissionerAuditWorkspace, type CommissionerAuditService } from "../features/league-membership/CommissionerAuditWorkspace";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";
const transactionId = "tx-33333333-3333-4333-8333-333333333333";

const workspace: CanonicalLeagueWorkspace = {
  league: { id: leagueId, name: "Native Test League", abbreviation: "NTL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "Asia/Taipei", status: "active", currentSeasonId: seasonId, createdBy: "commissioner-1", createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z", revision: 2, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: seasonId, leagueId, year: 2026, phase: "draft", revision: 3, settingsVersionId: "settings-1", draftSettingsVersionId: "", draftId: null, scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  connection: null,
  membership: { leagueId, userId: "commissioner-1", status: "active", joinedAt: "2026-09-03T00:00:00.000Z", revision: 1, roleGrantIds: ["commissioner-1__commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: [], roles: ["commissioner"], source: "gamehq" },
};

function auditService(): CommissionerAuditService {
  return {
    load: vi.fn().mockResolvedValue({
      events: [{ id: "audit-1", leagueId, seasonId, actorUserId: "commissioner-1", action: "apply_roster_transaction", target: { type: "roster_transaction", id: transactionId }, timestamp: "2026-09-03T01:00:00.000Z", previousRevision: 2, resultingRevision: 3, before: {}, after: {}, materialDifferences: {}, reason: "Correct imported roster", settingsVersionId: "settings-1", commandId: "33333333-3333-4333-8333-333333333333", transactionId, publicSummary: "A commissioner applied one audited roster move.", privateMetadata: { source: "commissioner_roster_command" }, reversalOfAuditEventId: null }],
      transactions: [{ id: transactionId, leagueId, seasonId, transactionType: "roster_correction", assetsLeaving: [], assetsEntering: [], effectiveAt: "2026-09-03T01:00:00.000Z", sourceCommandId: "33333333-3333-4333-8333-333333333333", settingsVersionId: "settings-1", actorUserId: "commissioner-1", approvalState: "accepted", reviewState: "not_required", beforeRosterRevisions: {}, afterRosterRevisions: {}, auditEventId: "audit-1", reversalOfTransactionId: null, reversedByTransactionId: null }],
    }),
    reverse: vi.fn().mockResolvedValue({ commandId: "44444444-4444-4444-8444-444444444444", commandType: "reverse_roster_transaction", actorUserId: "commissioner-1", leagueId, seasonId, status: "accepted", previousRevision: 3, resultingRevision: 4, auditEventId: "audit-2", serverProcessedAt: "2026-09-03T02:00:00.000Z", requestHash: "hash", result: { transactionId: "tx-reversal" }, error: null }),
  };
}

describe("commissioner audit workspace", () => {
  afterEach(cleanup);

  it("shows immutable receipt context and requires a reason for reversal", async () => {
    const service = auditService();
    render(<CommissionerAuditWorkspace workspace={workspace} onWorkspaceChanged={vi.fn()} service={service} />);
    expect(await screen.findByText("A commissioner applied one audited roster move.")).toBeInTheDocument();
    expect(screen.getByText("Correct imported roster")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    const submit = screen.getByRole("button", { name: "Reverse transaction" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Audit reason" }), { target: { value: "Correction entered for wrong team" } });
    fireEvent.click(submit);

    await waitFor(() => expect(service.reverse).toHaveBeenCalledWith({
      leagueId,
      seasonId,
      expectedRevision: 3,
      payload: { transactionId },
      reason: "Correction entered for wrong team",
    }));
  });
});
