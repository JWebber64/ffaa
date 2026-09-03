// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";
import { NativeLineupWorkspace } from "../features/native-lineup/NativeLineupWorkspace";

const settings = createRedraftLeagueSettings("America/New_York");
settings.teamCount = 4;
settings.schedule.playoffTeams = 4;
settings.rosterSlots = settings.rosterSlots.map((row) => ({ ...row, count: row.slot === "QB" || row.slot === "RB" ? 1 : row.slot === "BENCH" ? 6 : 0 }));

vi.mock("../features/native-lineup/useNativeLineup", () => ({
  useNativeLineup: (() => {
    let cached: ReturnType<typeof createState> | null = null;
    function createState() {
      return {
    status: "ready",
    message: "Current",
    settings,
    teams: [{ id: "team-1", leagueId: "league-1", seasonId: "season-1", franchiseId: "team-1", name: "Thursday Team", logoUrl: null, colors: { primary: "", secondary: "" }, divisionId: null, draftPosition: 1, budget: null, cap: null, rosterRevision: 3, rosterPlayerIds: ["qb-thu", "qb-late", "rb-sun", "rb-late", "bench-1", "bench-2", "bench-3", "bench-4"], status: "active" }],
    week: { id: "week-1", leagueId: "league-1", seasonId: "season-1", week: 1, settingsVersionId: "settings-1", timezone: "America/New_York", revision: 2, lockOverrides: {}, updatedAt: "2026-09-03T00:00:00.000Z", players: [
      { playerId: "qb-thu", position: "QB", nflTeam: "KC", gameId: "thu", originalScheduledStartAt: "2020-09-10T00:20:00.000Z", scheduledStartAt: "2020-09-10T00:20:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "active", projectedPoints: 20 },
      { playerId: "qb-late", position: "QB", nflTeam: "BUF", gameId: "sun", originalScheduledStartAt: "2099-09-13T17:00:00.000Z", scheduledStartAt: "2099-09-13T17:00:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "active", projectedPoints: 10 },
      { playerId: "rb-sun", position: "RB", nflTeam: "BUF", gameId: "sun", originalScheduledStartAt: "2099-09-13T17:00:00.000Z", scheduledStartAt: "2099-09-13T17:00:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "active", projectedPoints: 18 },
      { playerId: "rb-late", position: "RB", nflTeam: "MIA", gameId: "sun", originalScheduledStartAt: "2099-09-13T20:00:00.000Z", scheduledStartAt: "2099-09-13T20:00:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "active", projectedPoints: 12 },
    ] },
    lineups: [{ id: "team-1_week-1", leagueId: "league-1", seasonId: "season-1", franchiseId: "team-1", week: 1, settingsVersionId: "settings-1", seasonRevision: 4, rosterRevision: 3, lineupWeekRevision: 2, assignments: { "QB-1": "qb-thu", "RB-1": "rb-sun" }, orderedFallbackPlayerIds: [], selectionMode: "manual", automaticSubstitutions: [], revision: 1, updatedAt: "2026-09-03T00:00:00.000Z" }],
      };
    }
    return () => cached ??= createState();
  })(),
}));

vi.mock("../data/toolPlayerData", () => ({
  buildCurrentToolPlayers: () => [
    { id: "qb-thu", name: "Thursday QB", position: "QB", team: "KC", projectedPoints: 20, projectedPointsPerGame: 20, byeWeek: 6, status: "", injuryStatus: "" },
    { id: "qb-late", name: "Late QB", position: "QB", team: "BUF", projectedPoints: 10, projectedPointsPerGame: 10, byeWeek: 7, status: "", injuryStatus: "" },
    { id: "rb-sun", name: "Sunday RB", position: "RB", team: "BUF", projectedPoints: 18, projectedPointsPerGame: 18, byeWeek: 7, status: "", injuryStatus: "" },
    { id: "rb-late", name: "Late RB", position: "RB", team: "MIA", projectedPoints: 12, projectedPointsPerGame: 12, byeWeek: 8, status: "", injuryStatus: "" },
  ],
}));

vi.mock("../features/league-domain/leagueCommands", () => ({ configureLineupWeekCommand: vi.fn(), saveWeeklyLineupCommand: vi.fn(), setLineupLockOverrideCommand: vi.fn() }));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 4, settingsVersionId: "settings-1", draftSettingsVersionId: "settings-1", draftId: null, scheduleVersionId: null, startAt: null, endAt: null, legacySourceLeagueId: null },
  connection: null,
  membership: { leagueId: "league-1", userId: "manager", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["manager-team-1"], displayName: "Manager", email: "manager@example.com" },
  roleGrants: [{ id: "manager-team-1", leagueId: "league-1", userId: "manager", role: "team_owner", franchiseId: "team-1", permissions: ["lineup.write"], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }],
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: false, canSaveLineup: true, permissions: ["lineup.write"], roles: ["team_owner"], source: "gamehq" },
};

afterEach(cleanup);

describe("native lineup workspace", () => {
  it("shows the exact Thursday lock while leaving the Sunday starter editable", async () => {
    render(<NativeLineupWorkspace workspace={workspace} initialWeek={1} onWeekChange={vi.fn()} onWorkspaceChanged={vi.fn()} />);
    const thursday = await screen.findByLabelText("QB-1 starter");
    const sunday = screen.getByLabelText("RB-1 starter");
    expect((thursday as HTMLSelectElement).disabled).toBe(true);
    expect((sunday as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByText("Scheduled lock time has passed.")).toBeTruthy();
    expect(screen.getByText(/Unsaved changes|Saved revision 1/u)).toBeTruthy();
    expect(screen.queryByText("Emergency reopen player")).toBeNull();
  });
});
