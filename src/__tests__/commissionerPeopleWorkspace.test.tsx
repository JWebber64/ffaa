// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import {
  CommissionerOperationsOverview,
  CommissionerTeamsWorkspace,
} from "../features/league-membership/CommissionerPeopleWorkspace";
import type { CommissionerPeopleService } from "../features/league-membership/commissionerPeopleService";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";
import type { LeaguePeopleSnapshot } from "../features/league-membership/leaguePeople";

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";

const workspace: CanonicalLeagueWorkspace = {
  league: {
    id: leagueId,
    name: "Native Test League",
    abbreviation: "NTL",
    logoUrl: null,
    colors: { primary: "", secondary: "" },
    timezone: "Asia/Taipei",
    status: "active",
    currentSeasonId: seasonId,
    createdBy: "commissioner-1",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    revision: 2,
    authorityMode: "native",
    migrationState: "canonical_active",
  },
  season: {
    id: seasonId,
    leagueId,
    year: 2026,
    phase: "draft",
    revision: 3,
    settingsVersionId: "settings-published",
    draftSettingsVersionId: "",
    draftId: null,
    scheduleVersionId: null,
    startAt: null,
    endAt: null,
    legacySourceLeagueId: null,
  },
  connection: null,
  membership: {
    leagueId,
    userId: "commissioner-1",
    status: "active",
    joinedAt: "2026-09-03T00:00:00.000Z",
    revision: 1,
    roleGrantIds: ["commissioner-1__commissioner"],
    displayName: "Commissioner",
    email: "commissioner@example.com",
  },
  roleGrants: [],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: [], roles: ["commissioner"], source: "gamehq" },
};

const snapshot: LeaguePeopleSnapshot = {
  teams: [
    { id: "team-1", leagueId, seasonId, franchiseId: "team-1", name: "Team 1", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: [], status: "active" },
    { id: "team-2", leagueId, seasonId, franchiseId: "team-2", name: "Team 2", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 2, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: [], status: "active" },
  ],
  memberships: [
    workspace.membership!,
    { leagueId, userId: "owner-1", status: "active", joinedAt: "2026-09-03T01:00:00.000Z", revision: 1, roleGrantIds: ["owner-1__team_owner__team-1"], displayName: "Owner One", email: "owner@example.com" },
  ],
  roleGrants: [
    { id: "commissioner-1__commissioner", leagueId, userId: "commissioner-1", role: "commissioner", franchiseId: null, permissions: [], effectiveAt: "2026-09-03T00:00:00.000Z", expiresAt: null, grantedBy: "commissioner-1", revokedAt: null, revision: 1 },
    { id: "owner-1__team_owner__team-1", leagueId, userId: "owner-1", role: "team_owner", franchiseId: "team-1", permissions: [], effectiveAt: "2026-09-03T01:00:00.000Z", expiresAt: null, grantedBy: "commissioner-1", revokedAt: null, revision: 1 },
  ],
  invitations: [
    { id: "invite-pending", leagueId, seasonId, email: "pending@example.com", displayName: "Pending Manager", role: "team_owner", franchiseId: "team-2", status: "pending", createdBy: "commissioner-1", createdAt: "2026-09-03T02:00:00.000Z", expiresAt: "2026-09-10T02:00:00.000Z", acceptedBy: null, acceptedAt: null, revokedBy: null, revokedAt: null, revision: 1 },
  ],
  recentAuditEvents: [
    { id: "audit-1", leagueId, seasonId, actorUserId: "commissioner-1", action: "league_invitation_created", target: { type: "invitation", id: "invite-pending" }, timestamp: "2026-09-03T02:00:00.000Z", previousRevision: 2, resultingRevision: 3, before: {}, after: {}, materialDifferences: {}, reason: "Invite pending manager", settingsVersionId: "settings-published", commandId: "command-1", transactionId: null, publicSummary: "Pending Manager was invited as team owner.", privateMetadata: null, reversalOfAuditEventId: null },
  ],
};

function receipt(result: Record<string, unknown>): LeagueCommandReceipt {
  return {
    commandId: "33333333-3333-4333-8333-333333333333",
    commandType: "create_league_invitation",
    actorUserId: "commissioner-1",
    leagueId,
    seasonId,
    status: "accepted",
    previousRevision: 3,
    resultingRevision: 4,
    auditEventId: "audit-1",
    serverProcessedAt: "2026-09-03T03:00:00.000Z",
    requestHash: "hash",
    result,
    error: null,
  };
}

function service(): CommissionerPeopleService {
  return {
    load: vi.fn().mockResolvedValue(snapshot),
    provisionTeams: vi.fn().mockResolvedValue(receipt({ activeCount: 2 })),
    createInvitation: vi.fn().mockResolvedValue(receipt({ invitationId: "invite-created", token: "abcdefghijklmnopqrstuvwxyz123456", role: "team_owner", franchiseId: "team-1" })),
    revokeInvitation: vi.fn().mockResolvedValue(receipt({ status: "revoked" })),
    removeMember: vi.fn().mockResolvedValue(receipt({ status: "removed" })),
  };
}

describe("commissioner people workspace", () => {
  afterEach(cleanup);

  it("turns real ownership and invitation state into setup health", async () => {
    render(<MemoryRouter><CommissionerOperationsOverview workspace={workspace} service={service()} /></MemoryRouter>);
    expect(await screen.findByText("2 of 4 gates clear")).toBeInTheDocument();
    expect(screen.getByText("1 teams need an owner")).toBeInTheDocument();
    expect(screen.getByText("1 awaiting acceptance")).toBeInTheDocument();
    expect(screen.getByText("Pending Manager was invited as team owner.")).toBeInTheDocument();
  });

  it("creates an email-bound team invitation and exposes its secure link", async () => {
    const peopleService = service();
    render(<MemoryRouter><CommissionerTeamsWorkspace workspace={workspace} service={peopleService} onWorkspaceChanged={vi.fn()} /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Fill every seat safely" });
    fireEvent.change(screen.getByRole("textbox", { name: "Manager name" }), { target: { value: "New Manager" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sign-in email" }), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));

    await waitFor(() => expect(peopleService.createInvitation).toHaveBeenCalledWith(expect.objectContaining({
      leagueId,
      seasonId,
      expectedRevision: 3,
      payload: expect.objectContaining({ email: "new@example.com", displayName: "New Manager", role: "team_owner", franchiseId: "team-1" }),
    })));
    const shareLink = await screen.findByRole("textbox", { name: "Secure invitation link" });
    expect((shareLink as HTMLInputElement).value).toContain("/ff/league/11111111-1111-4111-8111-111111111111/join?invitation=invite-created");
  });

  it("keeps the one-time invitation link visible across the workspace refresh boundary", async () => {
    const peopleService = service();

    function RemountingWorkspace() {
      const [workspaceKey, setWorkspaceKey] = useState(0);
      return (
        <CommissionerTeamsWorkspace
          key={workspaceKey}
          workspace={workspace}
          service={peopleService}
          onWorkspaceChanged={() => setWorkspaceKey((current) => current + 1)}
        />
      );
    }

    render(<MemoryRouter><RemountingWorkspace /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Fill every seat safely" });
    fireEvent.change(screen.getByRole("textbox", { name: "Manager name" }), { target: { value: "New Manager" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sign-in email" }), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));

    const shareLink = await screen.findByRole("textbox", { name: "Secure invitation link" });
    expect((shareLink as HTMLInputElement).value).toContain("invitation=invite-created");
  });

  it("requires an audit reason before removing a team manager", async () => {
    const peopleService = service();
    render(<MemoryRouter><CommissionerTeamsWorkspace workspace={workspace} service={peopleService} onWorkspaceChanged={vi.fn()} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Remove Owner One access" }));
    const confirm = screen.getByRole("button", { name: "Remove access" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Audit reason" }), { target: { value: "Replacing inactive manager" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(peopleService.removeMember).toHaveBeenCalledWith({
      leagueId,
      seasonId,
      expectedRevision: 3,
      userId: "owner-1",
      reason: "Replacing inactive manager",
    }));
  });
});
