// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import type { CanonicalLeagueWorkspace, SeasonTeam } from "../features/league-domain/types";
import { LeagueWorkspaceChrome } from "../layouts/LeagueWorkspaceLayout";

vi.mock("../features/league-workspace/leagueWorkspaceState", () => ({ useLeagueWorkspace: vi.fn() }));

const leagueId = "11111111-1111-4111-8111-111111111111";
const managedTeam: SeasonTeam = {
  id: "team-1",
  leagueId,
  seasonId: "season-1",
  franchiseId: "team-1",
  name: "Team 1",
  logoUrl: null,
  colors: { primary: "", secondary: "" },
  divisionId: null,
  draftPosition: 1,
  budget: null,
  cap: null,
  rosterRevision: 1,
  rosterPlayerIds: [],
  status: "active",
};

const workspace = {
  league: {
    id: leagueId,
    name: "Native Pilot",
    abbreviation: "NP",
    logoUrl: null,
    colors: { primary: "", secondary: "" },
    timezone: "Asia/Taipei",
    status: "active",
    currentSeasonId: "season-1",
    createdBy: "commissioner",
    createdAt: "",
    updatedAt: "",
    revision: 1,
    authorityMode: "native",
    migrationState: "canonical_active",
  },
  season: {
    id: "season-1",
    leagueId,
    year: 2026,
    phase: "setup",
    revision: 4,
    settingsVersionId: "settings-1",
    draftSettingsVersionId: "settings-1",
    draftId: null,
    scheduleVersionId: null,
    startAt: null,
    endAt: null,
    legacySourceLeagueId: null,
  },
  connection: null,
  membership: {
    leagueId,
    userId: "manager",
    status: "active",
    joinedAt: "",
    revision: 1,
    roleGrantIds: ["manager__team_owner__team-1"],
    displayName: "Pilot Manager",
    email: "manager@example.com",
  },
  roleGrants: [{
    id: "manager__team_owner__team-1",
    leagueId,
    userId: "manager",
    role: "team_owner",
    franchiseId: "team-1",
    permissions: [],
    effectiveAt: "",
    expiresAt: null,
    grantedBy: "commissioner",
    revokedAt: null,
    revision: 1,
  }],
  authority: {
    label: "Native GameHQ League — read/write",
    mode: "native",
    canRead: true,
    canManage: false,
    canSaveLineup: true,
    permissions: [],
    roles: ["team_owner"],
    source: "gamehq",
  },
  managedTeam,
} satisfies CanonicalLeagueWorkspace;

describe("native league workspace identity", () => {
  beforeEach(() => {
    vi.mocked(useLeagueWorkspace).mockReturnValue({
      leagueId,
      routeLeagueId: leagueId,
      dataLeagueId: "",
      connection: null,
      connections: [],
      canonicalWorkspace: workspace,
      authority: workspace.authority,
      routeState: { status: "ready", message: "ready" },
      teamState: { status: "idle", data: null, error: "" },
      capabilities: { canManage: false, canSaveLineup: true, source: "gamehq", status: "ready" },
      switchLeague: vi.fn(),
      refreshWorkspace: vi.fn(),
    });
  });

  it("shows the assigned native team instead of reporting no assignment", () => {
    render(<MemoryRouter initialEntries={[`/league/${leagueId}/team`]}><LeagueWorkspaceChrome /></MemoryRouter>);

    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.queryByText("No team assigned")).not.toBeInTheDocument();
  });
});
