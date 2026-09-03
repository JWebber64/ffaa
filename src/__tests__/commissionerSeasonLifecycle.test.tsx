// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommissionerSeasonLifecycle, type CommissionerSeasonLifecycleService } from "../features/league-settings/CommissionerSeasonLifecycle";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";

const competition = vi.hoisted(() => ({
  state: {
    status: "ready",
    message: "ready",
    settings: null,
    teams: [
      { franchiseId: "team-one", name: "Team One", status: "active", rosterPlayerIds: [] },
      { franchiseId: "team-two", name: "Team Two", status: "active", rosterPlayerIds: [] },
    ],
    schedule: null,
    standings: { revision: 7 },
    playoffs: { revision: 3 },
    results: [],
  },
}));

vi.mock("../features/native-competition/useNativeCompetition", () => ({ useNativeCompetition: () => competition.state }));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "11111111-1111-4111-8111-111111111111", name: "Lifecycle League", abbreviation: "LL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "UTC", status: "active", currentSeasonId: "22222222-2222-4222-8222-222222222222", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "22222222-2222-4222-8222-222222222222", leagueId: "11111111-1111-4111-8111-111111111111", year: 2026, phase: "playoffs", revision: 12, settingsVersionId: "settings-live", draftSettingsVersionId: "", draftId: "draft-1", scheduleVersionId: "schedule-1", startAt: null, endAt: null, legacySourceLeagueId: null },
  connection: null,
  membership: { leagueId: "11111111-1111-4111-8111-111111111111", userId: "commissioner", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: [], roles: ["commissioner"], source: "gamehq" },
};

function service() {
  return {
    award: vi.fn(async () => ({ resultingRevision: 13, result: {} })),
    archive: vi.fn(),
    renew: vi.fn(),
    exportLeague: vi.fn(async () => ({ resultingRevision: 12, result: { exportId: "export-1", byteLength: 42 } })),
    loadExport: vi.fn(async () => "{}"),
    downloadExport: vi.fn(),
  } as unknown as CommissionerSeasonLifecycleService;
}

afterEach(cleanup);

describe("CommissionerSeasonLifecycle", () => {
  it("requires a reason and publishes exact standings and bracket revisions before awarding the champion", async () => {
    const actions = service();
    render(<CommissionerSeasonLifecycle workspace={workspace} onWorkspaceChanged={vi.fn()} service={actions} />);
    const award = screen.getByRole("button", { name: "Award champion" });
    expect(award).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Audit reason"), { target: { value: "Confirm championship final" } });
    await waitFor(() => expect(award).toBeEnabled());
    fireEvent.click(award);
    await waitFor(() => expect(actions.award).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 12,
      payload: { championFranchiseId: "team-one", runnerUpFranchiseId: "team-two", expectedStandingsRevision: 7, expectedBracketRevision: 3 },
      reason: "Confirm championship final",
    })));
    expect(await screen.findByText(/season is complete and ready to archive/iu)).toBeVisible();
  });

  it("generates and downloads the private JSON export", async () => {
    const actions = service();
    render(<CommissionerSeasonLifecycle workspace={workspace} onWorkspaceChanged={vi.fn()} service={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() => expect(actions.loadExport).toHaveBeenCalledWith(workspace.league.id, "export-1"));
    expect(actions.downloadExport).toHaveBeenCalledWith("lifecycle-league-2026.json", "{}");
  });
});
