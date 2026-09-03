// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { CommissionerSettingsWorkspace } from "../features/league-settings/CommissionerSettingsWorkspace";
import { listSettingsVersions } from "../features/league-domain/firebaseLeagueRepository";
import { publishSettingsCommand } from "../features/league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, SettingsVersion } from "../features/league-domain/types";

vi.mock("../features/league-domain/firebaseLeagueRepository", () => ({ listSettingsVersions: vi.fn() }));
vi.mock("../features/league-domain/leagueCommands", () => ({
  createLeagueInvitationCommand: vi.fn(),
  publishSettingsCommand: vi.fn(),
  provisionSeasonTeamsCommand: vi.fn(),
  removeLeagueMemberCommand: vi.fn(),
  revokeLeagueInvitationCommand: vi.fn(),
  restoreSettingsVersionCommand: vi.fn(),
  saveSettingsDraftCommand: vi.fn(),
}));

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";
const draftVersionId = "settings-initial";
const draft: SettingsVersion = {
  id: draftVersionId,
  leagueId,
  seasonId,
  revision: 1,
  status: "draft",
  effectiveAt: "2026-09-03T00:00:00.000Z",
  settings: createRedraftLeagueSettings("Asia/Taipei") as unknown as Record<string, unknown>,
  publishedBy: null,
  publishedAt: null,
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};
const workspace: CanonicalLeagueWorkspace = {
  league: {
    id: leagueId,
    name: "Native Test League",
    abbreviation: "NTL",
    logoUrl: null,
    colors: { primary: "", secondary: "" },
    timezone: "Asia/Taipei",
    status: "draft",
    currentSeasonId: seasonId,
    createdBy: "commissioner-1",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    revision: 1,
    authorityMode: "native",
    migrationState: "canonical_active",
  },
  season: {
    id: seasonId,
    leagueId,
    year: 2026,
    phase: "setup",
    revision: 1,
    settingsVersionId: "",
    draftSettingsVersionId: draftVersionId,
    draftId: null,
    scheduleVersionId: null,
    startAt: null,
    endAt: null,
    legacySourceLeagueId: null,
  },
  connection: null,
  membership: { leagueId, userId: "commissioner-1", status: "active", joinedAt: "2026-09-03T00:00:00.000Z", revision: 1, roleGrantIds: ["commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: [], roles: ["commissioner"], source: "gamehq" },
};

describe("CommissionerSettingsWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSettingsVersions).mockResolvedValue([draft]);
    vi.mocked(publishSettingsCommand).mockResolvedValue({
      commandId: "33333333-3333-4333-8333-333333333333",
      commandType: "publish_settings",
      actorUserId: "commissioner-1",
      leagueId,
      seasonId,
      status: "accepted",
      previousRevision: 1,
      resultingRevision: 2,
      auditEventId: "audit-1",
      serverProcessedAt: "2026-09-03T00:01:00.000Z",
      requestHash: "hash",
      result: { settingsVersionId: "settings-published" },
      error: null,
    });
  });

  it("shows a publishable saved draft and blocks publish when a local edit is invalid", async () => {
    render(<MemoryRouter><CommissionerSettingsWorkspace workspace={workspace} section="settings" onWorkspaceChanged={vi.fn()} /></MemoryRouter>);
    const publish = await screen.findByRole("button", { name: "Publish settings" });
    await waitFor(() => expect(publish).toBeEnabled(), { timeout: 10_000 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Teams" }), { target: { value: "4" } });
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(publish).toBeDisabled();
    expect(screen.getByText("Playoff teams cannot exceed the league team count.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText("Playoff teams cannot exceed the league team count.")).not.toBeInTheDocument();
    expect(publish).toBeEnabled();
  }, 15_000);

  it("publishes the exact saved draft revision", async () => {
    const onWorkspaceChanged = vi.fn();
    render(<MemoryRouter><CommissionerSettingsWorkspace workspace={workspace} section="settings" onWorkspaceChanged={onWorkspaceChanged} /></MemoryRouter>);
    const publish = await screen.findByRole("button", { name: "Publish settings" });
    await waitFor(() => expect(publish).toBeEnabled(), { timeout: 10_000 });
    fireEvent.click(publish);
    await waitFor(() => expect(publishSettingsCommand).toHaveBeenCalledWith(expect.objectContaining({
      leagueId,
      seasonId,
      expectedRevision: 1,
      draftVersionId,
    })));
    await waitFor(() => expect(onWorkspaceChanged).toHaveBeenCalled());
  }, 15_000);
});
