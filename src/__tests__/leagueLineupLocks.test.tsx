// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseLeagueSeasonDraft } from "../features/league-season/leagueSeasonModel";
import { useLeagueSeasonManagement } from "../features/league-season/useLeagueSeasonManagement";
import { useLeagueWeekLineups } from "../features/league-season/useLeagueWeekLineups";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { setLeagueWeekLocked } from "../features/league-season/leagueSeasonPersistence";
import LeagueLineup from "../screens/LeagueLineup";

vi.mock("../features/league-season/useLeagueSeasonManagement", () => ({ useLeagueSeasonManagement: vi.fn() }));
vi.mock("../features/league-season/useLeagueWeekLineups", () => ({ useLeagueWeekLineups: vi.fn() }));
vi.mock("../features/league-workspace/leagueWorkspaceState", () => ({ useLeagueWorkspace: vi.fn() }));
vi.mock("../features/league-season/LeagueAccountPanel", () => ({ LeagueAccountPanel: () => null }));
vi.mock("../features/league-season/leagueSeasonPersistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/league-season/leagueSeasonPersistence")>();
  return {
    ...actual,
    setLeagueWeekLocked: vi.fn(),
  };
});

const leagueId = "1385319428408774656";
const season = parseLeagueSeasonDraft({
  config: {
    defaultBudget: 200,
    scoring: "ppr",
    rosterSlots: [{ slot: "QB", count: 1 }, { slot: "BENCH", count: 1 }],
    isOpen: false,
  },
  teams: [{
    teamId: "team-1",
    teamNumber: 1,
    name: "Clay",
    budget: 200,
    roster: [{ playerId: "qb-1", name: "Josh Allen", pos: "QB", team: "BUF", price: 40 }],
  }],
}, { leagueId, source: "published", revision: 7 })!;

function management(currentUserId: string, commissionerUserId = "commissioner-1") {
  return {
    status: "ready" as const,
    currentUserId,
    record: {
      leagueId,
      commissionerUserId,
      season,
      schedule: [],
      revision: 3,
      sourceDraftRevision: 7,
      createdAt: "2026-08-31T00:00:00.000Z",
      publishedAt: "2026-08-31T00:01:00.000Z",
      updatedAt: "2026-08-31T00:01:00.000Z",
    },
    claims: currentUserId === commissionerUserId ? [] : [{
      leagueId,
      franchiseId: "team-1",
      franchiseName: "Clay",
      requestedByUserId: currentUserId,
      requestedDisplayName: "Clay Manager",
      status: "approved" as const,
      approvedUserId: currentUserId,
      requestedAt: "2026-08-31T00:02:00.000Z",
      approvedAt: "2026-08-31T00:03:00.000Z",
      updatedAt: "2026-08-31T00:03:00.000Z",
    }],
    membership: null,
    message: "Published league season is live.",
  };
}

function lockedWeek() {
  return {
    status: "ready" as const,
    lineups: [],
    settings: {
      leagueId,
      week: 1,
      weekKey: "week-1",
      locked: true,
      updatedByUserId: "commissioner-1",
      createdAt: "2026-08-31T00:04:00.000Z",
      updatedAt: "2026-08-31T00:04:00.000Z",
    },
    message: "No current manager lineups have been saved for this week.",
  };
}

function renderLineup() {
  render(
    <MemoryRouter initialEntries={["/league/lineup?team=team-1&week=1"]}>
      <Routes><Route path="/league/lineup" element={<LeagueLineup />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLeagueWorkspace).mockReturnValue({
    leagueId,
    routeLeagueId: leagueId,
    dataLeagueId: leagueId,
    connections: [{
      leagueId,
      leagueName: "G.O.A.T. League",
      season: "2026",
      status: "pre_draft",
      totalRosters: 12,
      sourceUrl: "https://sleeper.com",
      lastUsedAt: "2026-08-31T00:00:00.000Z",
    }],
    connection: {
      leagueId,
      leagueName: "G.O.A.T. League",
      season: "2026",
      status: "pre_draft",
      totalRosters: 12,
      sourceUrl: "https://sleeper.com",
      lastUsedAt: "2026-08-31T00:00:00.000Z",
    },
    canonicalWorkspace: null,
    authority: null,
    routeState: { status: "ready", message: "Compatibility route loaded." },
    teamState: { status: "idle", data: null, error: "" },
    capabilities: { canManage: false, canSaveLineup: false, source: null, status: "ready" },
    switchLeague: vi.fn(),
  });
  vi.mocked(useLeagueWeekLineups).mockReturnValue(lockedWeek());
});

describe("weekly lineup locks", () => {
  it("renders a locked manager lineup as read-only", () => {
    vi.mocked(useLeagueSeasonManagement).mockReturnValue(management("manager-1"));
    renderLineup();

    expect(screen.getByText("Week 1 is locked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save lineup" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^QB starter:/ })).toBeDisabled();
  });

  it("lets the commissioner reopen the week and exposes the override reason", async () => {
    vi.mocked(useLeagueSeasonManagement).mockReturnValue(management("commissioner-1"));
    vi.mocked(useLeagueWorkspace).mockReturnValue({
      ...vi.mocked(useLeagueWorkspace)(),
      capabilities: { canManage: true, canSaveLineup: true, source: "gamehq", status: "ready" },
    });
    renderLineup();

    expect(screen.getByLabelText("Override reason")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reopen week" }));
    await waitFor(() => expect(setLeagueWeekLocked).toHaveBeenCalledWith(leagueId, 1, false));
  });
});
