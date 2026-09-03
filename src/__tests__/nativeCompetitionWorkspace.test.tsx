// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { NativeScheduleWorkspace } from "../features/native-competition/NativeScheduleWorkspace";
import { NativeStandingsWorkspace } from "../features/native-competition/NativeStandingsWorkspace";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";

vi.mock("../features/native-competition/useNativeCompetition", () => ({
  useNativeCompetition: (() => {
    let cached: ReturnType<() => Record<string, unknown>> | null = null;
    return () => {
    if (cached) return cached;
    const settings = createRedraftLeagueSettings("America/New_York");
    settings.schedule.medianOpponent = true; settings.schedule.allPlay = true; settings.schedule.playoffTeams = 7;
    const teams = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((id, index) => ({ id, leagueId: "league-1", seasonId: "season-1", franchiseId: id, name: `Team ${id}`, logoUrl: null, colors: { primary: index ? "#345" : "#d55", secondary: "#fff" }, divisionId: index < 4 ? "east" : "west", draftPosition: index + 1, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: [], status: "active" as const }));
    cached = {
      status: "ready", message: "ready", settings, teams,
      schedule: { revision: 2, versionId: "schedule-version-2", settingsVersionId: "settings-7", seed: "stable-seed", source: "generated", games: [{ id: "game-1", week: 1, slot: 1, homeFranchiseId: "one", awayFranchiseId: "two", kind: "rivalry", twoWeekSeriesId: "", divisionGame: true, conferenceGame: false }, { id: "game-2", week: 1, slot: 1, homeFranchiseId: "three", awayFranchiseId: "four", kind: "regular", twoWeekSeriesId: "", divisionGame: true, conferenceGame: false }], validationIssues: [{ code: "uneven_division_games", severity: "warning", message: "Division game counts differ by more than one game." }], generatedAt: "", editedAt: "", updatedAt: "" },
      results: [{ gameId: "game-1", week: 1, homeFranchiseId: "one", awayFranchiseId: "two", homeScore: 121.4, awayScore: 117.2, homePotentialPoints: 128, awayPotentialPoints: 122, status: "final", correctionReason: "", revision: 1, updatedAt: "" }],
      standings: { revision: 3, scheduleVersionId: "schedule-version-2", settingsVersionId: "settings-7", completedResultCount: 1, updatedAt: "", rows: teams.map((team, index) => ({ franchiseId: team.franchiseId, seed: index + 1, wins: index ? 0 : 1, losses: index === 1 ? 1 : 0, ties: 0, winningPercentage: index ? 0 : 1, divisionWins: index ? 0 : 1, divisionLosses: index === 1 ? 1 : 0, divisionTies: 0, divisionPercentage: index ? 0 : 1, medianWins: index ? 0 : 1, medianLosses: index ? 1 : 0, medianTies: 0, allPlayWins: Math.max(0, 7 - index), allPlayLosses: index, allPlayTies: 0, allPlayPercentage: Math.max(0, 1 - index / 7), pointsFor: index ? 117.2 - index : 121.4, pointsAgainst: index ? 121.4 : 117.2, potentialPoints: index ? 122 : 128, lineupEfficiency: .95, streak: index ? "L1" : "W1", remainingScheduleStrength: .5, playoffProbability: index < 7 ? .8 : .1, state: "alive" as const, explanation: [`Seed ${index + 1}: winning percentage separates this team.`] })) },
      playoffs: { revision: 1, standingsRevision: 3, settingsVersionId: "settings-7", qualifiers: teams.slice(0, 7).map((team) => team.franchiseId), byeSeeds: [1], reseeding: true, roundWeeks: 1, correctionReason: "", updatedAt: "", games: [{ id: "championship-r1-g1", bracket: "championship", round: 1, startWeek: 15, endWeek: 15, highSeed: 1, lowSeed: 8, homeFranchiseId: "one", awayFranchiseId: null, advancesTo: "championship-r2-g1", loserAdvances: false }, { id: "toilet-r1-g1", bracket: "toilet", round: 1, startWeek: 15, endWeek: 15, highSeed: 8, lowSeed: null, homeFranchiseId: "eight", awayFranchiseId: null, advancesTo: null, loserAdvances: true }] },
    };
    return cached;
    };
  })(),
}));

const workspace: CanonicalLeagueWorkspace = {
  league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "commissioner", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" },
  season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 8, settingsVersionId: "settings-7", draftSettingsVersionId: "settings-7", draftId: null, scheduleVersionId: "schedule-version-2", startAt: null, endAt: null, legacySourceLeagueId: null },
  membership: { leagueId: "league-1", userId: "commissioner", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["commissioner__commissioner"], displayName: "Commissioner", email: "commissioner@example.com" },
  roleGrants: [{ id: "commissioner__commissioner", leagueId: "league-1", userId: "commissioner", role: "commissioner", franchiseId: null, permissions: ["schedule.manage"], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }], connection: null,
  authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: true, canSaveLineup: true, permissions: ["schedule.manage"], roles: ["commissioner"], source: "gamehq" },
};

describe("native competition workspaces", () => {
  it("renders a versioned commissioner schedule, validation, score controls, and corrections", () => {
    render(<NativeScheduleWorkspace workspace={workspace} onWorkspaceChanged={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Schedule & results" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regenerate schedule" })).toBeTruthy();
    expect(screen.getByText("Validation notes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish Week 1 results" })).toBeTruthy();
    expect(screen.getByText(/immutable version and audit event/iu)).toBeTruthy();
    expect((screen.getByLabelText("Team one score") as HTMLInputElement).value).toBe("121.4");
  });

  it("renders the exact standings dimensions, seed explanation, and seven-team bracket", () => {
    render(<NativeStandingsWorkspace workspace={workspace} onWorkspaceChanged={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Native League standings" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Median" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "All-play" })).toBeTruthy();
    expect(screen.getAllByText("Explain seed")).toHaveLength(8);
    expect(screen.getByText("7 qualifiers")).toBeTruthy();
    expect(screen.getByText("Byes: seeds 1")).toBeTruthy();
    expect(screen.getByText("Loser advances")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish bracket revision" })).toBeTruthy();
  });
});
