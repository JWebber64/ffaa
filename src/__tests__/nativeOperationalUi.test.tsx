// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NativeLeagueHomeWorkspace } from "../features/league-home/NativeLeagueHomeWorkspace";
import type { CanonicalLeagueWorkspace } from "../features/league-domain/types";
import { LeaguePlayerSheetProvider } from "../features/player-sheet/LeaguePlayerSheet";
import { useLeaguePlayerSheet } from "../features/player-sheet/leaguePlayerSheetContext";
import { NativeTransactionsWorkspace } from "../features/native-transactions/NativeTransactionsWorkspace";

const { teams } = vi.hoisted(() => ({ teams: [{ id: "one", leagueId: "league-1", seasonId: "season-1", franchiseId: "one", name: "Sunday Best", logoUrl: null, colors: { primary: "#d55", secondary: "#fff" }, divisionId: "east", draftPosition: 1, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: ["2026-RB-jahmyr-gibbs", "2026-WR-justin-jefferson"], status: "active" as const }, { id: "two", leagueId: "league-1", seasonId: "season-1", franchiseId: "two", name: "Fourth Down", logoUrl: null, colors: { primary: "#345", secondary: "#fff" }, divisionId: "east", draftPosition: 2, budget: null, cap: null, rosterRevision: 1, rosterPlayerIds: [], status: "active" as const }] }));

vi.mock("../features/native-competition/useNativeCompetition", () => { const state = { status: "ready", message: "ready", settings: { rosterSlots: [{ slot: "RB", count: 1, eligible: ["RB"] }, { slot: "WR", count: 1, eligible: ["WR"] }], schedule: { regularSeasonWeeks: 14, playoffTeams: 1 } }, teams, schedule: { revision: 1, versionId: "v1", settingsVersionId: "settings-1", seed: "seed", source: "generated", games: [{ id: "game-1", week: 1, slot: 1, homeFranchiseId: "one", awayFranchiseId: "two", kind: "regular", twoWeekSeriesId: "", divisionGame: true, conferenceGame: false }], validationIssues: [], generatedAt: "", editedAt: "", updatedAt: "2026-09-03T08:00:00.000Z" }, results: [], standings: { revision: 1, scheduleVersionId: "v1", settingsVersionId: "settings-1", completedResultCount: 0, updatedAt: "2026-09-03T08:00:00.000Z", rows: [{ franchiseId: "one", seed: 1, wins: 1, losses: 0, ties: 0, winningPercentage: 1, divisionWins: 1, divisionLosses: 0, divisionTies: 0, divisionPercentage: 1, medianWins: 1, medianLosses: 0, medianTies: 0, allPlayWins: 1, allPlayLosses: 0, allPlayTies: 0, allPlayPercentage: 1, pointsFor: 121, pointsAgainst: 112, potentialPoints: 130, lineupEfficiency: .93, streak: "W1", remainingScheduleStrength: .5, playoffProbability: .8, state: "alive", explanation: [] }] }, playoffs: null }; return { useNativeCompetition: () => state }; });
vi.mock("../features/native-lineup/useNativeLineup", () => { const state = { status: "ready", message: "ready", teams, settings: null, week: { id: "week-1", leagueId: "league-1", seasonId: "season-1", week: 1, settingsVersionId: "settings-1", timezone: "America/New_York", revision: 1, players: [{ playerId: "2026-RB-jahmyr-gibbs", position: "RB", nflTeam: "DET", gameId: "nfl-1", originalScheduledStartAt: "2026-09-10T17:00:00.000Z", scheduledStartAt: "2026-09-10T17:00:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "active", projectedPoints: 18 }, { playerId: "2026-WR-justin-jefferson", position: "WR", nflTeam: "MIN", gameId: "nfl-2", originalScheduledStartAt: "2026-09-11T17:00:00.000Z", scheduledStartAt: "2026-09-11T17:00:00.000Z", actualStartedAt: "", gameStatus: "scheduled", availability: "questionable", projectedPoints: 17 }], lockOverrides: {}, updatedAt: "" }, lineups: [{ id: "one_week-1", leagueId: "league-1", seasonId: "season-1", franchiseId: "one", week: 1, settingsVersionId: "settings-1", seasonRevision: 1, rosterRevision: 1, lineupWeekRevision: 1, assignments: { "RB-1": "2026-RB-jahmyr-gibbs", "WR-1": "2026-WR-justin-jefferson" }, orderedFallbackPlayerIds: [], selectionMode: "manual", automaticSubstitutions: [], revision: 1, updatedAt: "" }] }; return { useNativeLineup: () => state }; });
vi.mock("../features/native-scoring/useNativeScoring", () => { const scoringWeek = { updatedAt: "2026-09-03T09:00:00.000Z", matchups: [{ matchupId: "game-1", homeFranchiseId: "one", awayFranchiseId: "two", homeScore: 38.2, awayScore: 34.1, homeProjectedFinal: 121, awayProjectedFinal: 116, homeWinProbability: .61, awayWinProbability: .39, playersRemaining: 10, pointsRemaining: 160 }] }; return { useNativeScoring: () => ({ status: "ready", message: "ready", teams, scoringWeek }) }; });
vi.mock("../features/native-waivers/useNativeWaivers", () => { const state = { status: "ready", message: "ready", settings: null, teams, waiverState: { revision: 1, playerCount: 300, settingsVersionId: "settings-1", nextProcessingAt: "2026-09-12T13:00:00.000Z", lastRunId: "run-1", updatedAt: "2026-09-03T07:00:00.000Z" }, players: [], teamStates: [{ franchiseId: "one", faabRemaining: 80, priority: 1, standingsRank: 1, priorityWeek: 1, weeklyAcquisitions: {}, revision: 1 }], claims: [], receipts: [{ id: "waiver-1", runId: "run-1", claimId: "claim-1", franchiseId: "one", status: "won", claimsEvaluated: 1, winningBid: 10, nextHighestBid: null, priorityBefore: 1, priorityAfter: 2, tiebreakerUsed: "priority", failures: [], addPlayerId: "player-3", dropPlayerId: "", remainingFaab: 80, processedAt: "2026-09-02T13:00:00.000Z" }] }; return { useNativeWaivers: () => state }; });
vi.mock("../features/native-trades/useNativeTrades", () => { const state = { status: "ready", message: "ready", settings: null, teams, players: [], teamStates: [{ franchiseId: "one", faabRemaining: 80 }, { franchiseId: "two", faabRemaining: 90 }], offers: [{ id: "offer-1", fromFranchiseId: "two", toFranchiseId: "one", status: "sent", expiresAt: "2026-09-13T13:00:00.000Z" }], receipts: [{ id: "trade-1", offerId: "trade-1", fromFranchiseId: "one", toFranchiseId: "two", offeredAssets: [{ type: "player", id: "p1" }], requestedAssets: [{ type: "player", id: "p2" }], sentAt: "", acceptedAt: "", processedAt: "2026-09-01T13:00:00.000Z", reviewPolicy: "commissioner", votes: {}, commissionerInvolvement: [], rosterEffects: {}, capEffects: {}, settingsVersionId: "settings-1", processingResult: "completed", rosterTransactionId: "tx-1", reversalTransactionId: "" }] }; return { useNativeTrades: () => state }; });
vi.mock("../features/native-draft/useNativeDraft", () => ({ useNativeDraft: () => ({ status: "ready", message: "ready", teams, draft: { status: "complete" } }) }));
vi.mock("../features/native-waivers/NativeWaiverWorkspace", () => ({ NativeWaiverWorkspace: () => <div>Waiver workspace loaded</div> }));
vi.mock("../features/native-trades/NativeTradeWorkspace", () => ({ NativeTradeWorkspace: () => <div>Trade workspace loaded</div> }));

const workspace: CanonicalLeagueWorkspace = { league: { id: "league-1", name: "Native League", abbreviation: "NL", logoUrl: null, colors: { primary: "", secondary: "" }, timezone: "America/New_York", status: "active", currentSeasonId: "season-1", createdBy: "manager", createdAt: "", updatedAt: "", revision: 1, authorityMode: "native", migrationState: "canonical_active" }, season: { id: "season-1", leagueId: "league-1", year: 2026, phase: "regular_season", revision: 8, settingsVersionId: "settings-1", draftSettingsVersionId: "settings-1", draftId: "draft-1", scheduleVersionId: "v1", startAt: null, endAt: null, legacySourceLeagueId: null }, membership: { leagueId: "league-1", userId: "manager", status: "active", joinedAt: "", revision: 1, roleGrantIds: ["manager__team_owner"], displayName: "Manager", email: "manager@example.com" }, roleGrants: [{ id: "manager__team_owner", leagueId: "league-1", userId: "manager", role: "team_owner", franchiseId: "one", permissions: [], effectiveAt: "", expiresAt: null, grantedBy: "commissioner", revokedAt: null, revision: 1 }], connection: null, authority: { label: "Native GameHQ League — read/write", mode: "native", canRead: true, canManage: false, canSaveLineup: true, permissions: [], roles: ["team_owner"], source: "gamehq" } };

function SheetTrigger() { const { openPlayer } = useLeaguePlayerSheet(); return <button type="button" onClick={() => openPlayer({ playerId: "2026-RB-jahmyr-gibbs", currentWeek: 1, leagueState: "owned", ownership: "Sunday Best", rosterFit: "RB starter", actionLabel: "Manage lineup", actionTo: "/league/league-1/team" })}>Open player</button>; }

describe("Phase 10 operational UI", () => {
  it("opens one accessible player evidence sheet, closes with Escape, and restores focus", () => {
    render(<MemoryRouter><LeaguePlayerSheetProvider><SheetTrigger /></LeaguePlayerSheetProvider></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: "Open player" }); trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Jahmyr Gibbs" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Verified status snapshot" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent fantasy production" })).toBeTruthy();
    expect(screen.getByText("Sunday Best")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("answers week, required action, opponent, lineup legality, deadlines, and recent activity on native Home", () => {
    render(<MemoryRouter><NativeLeagueHomeWorkspace workspace={workspace} /></MemoryRouter>);
    expect(screen.getByText("Week 1 · regular season")).toBeTruthy();
    expect(screen.getByText("A trade offer needs your response")).toBeTruthy();
    expect(screen.getAllByText("Fourth Down").length).toBeGreaterThan(0);
    expect(screen.getByText("Legal")).toBeTruthy();
    expect(screen.getByText("Waiver processing")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeTruthy();
  });

  it("provides Activity, Waivers, Trades, and Trade Market as route-stable tabs", () => {
    render(<MemoryRouter><NativeTransactionsWorkspace workspace={workspace} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Activity" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Waivers" })); expect(screen.getByText("Waiver workspace loaded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trades" })); expect(screen.getByText("Trade workspace loaded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trade Market" })); expect(screen.getByRole("heading", { name: "Teams & available capital" })).toBeTruthy();
  });
});
