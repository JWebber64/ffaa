import { describe, expect, it } from "vitest";

import type { LeagueCommand, LineupWeekPlayerInput } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "81111111-1111-4111-8111-111111111111";
const seasonId = "82222222-2222-4222-8222-222222222222";
const franchiseId = "83333333-3333-4333-8333-333333333333";
const commissionerId = "commissioner-1";
const managerId = "manager-1";
const roster = ["qb-thu", "qb-sun", "rb-one", "rb-two", "wr-one", "wr-two", "te-one", "te-two"];

function typed<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) {
  return value;
}

function seed(store: LeagueCommandMemoryStore) {
  const settings = createRedraftLeagueSettings("America/New_York");
  settings.teamCount = 4;
  settings.schedule.playoffTeams = 4;
  settings.rosterSlots = settings.rosterSlots.map((row) => ({
    ...row,
    count: ["QB", "RB", "WR", "TE"].includes(row.slot) ? 1 : row.slot === "BENCH" ? 4 : 0,
  }));
  store.seed(`leagues/${leagueId}`, { id: leagueId, name: "Lock Lab", timezone: settings.timezone, authority_mode: "native", current_season_id: seasonId, status: "active", revision: 1 });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, league_id: leagueId, phase: "regular_season", revision: 1, settings_version_id: "settings-1" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-1`, { id: "settings-1", league_id: leagueId, season_id: seasonId, status: "published", settings });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`, { id: franchiseId, league_id: leagueId, season_id: seasonId, franchise_id: franchiseId, name: "Thursday Split", roster_revision: 1, roster_player_ids: roster, ir_player_ids: [], status: "active" });
  for (const [userId, role, grantId] of [[commissionerId, "commissioner", `${commissionerId}__commissioner`], [managerId, "team_owner", `${managerId}__team_owner__${franchiseId}`]] as const) {
    store.seed(`leagues/${leagueId}/memberships/${userId}`, { league_id: leagueId, user_id: userId, status: "active", role_grant_ids: [grantId] });
    store.seed(`leagues/${leagueId}/roleGrants/${grantId}`, { id: grantId, league_id: leagueId, user_id: userId, role, franchise_id: role === "team_owner" ? franchiseId : "", effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" });
  }
  return settings;
}

function weekPlayers(overrides: Partial<Record<string, Partial<LineupWeekPlayerInput>>> = {}): LineupWeekPlayerInput[] {
  const positions: Record<string, LineupWeekPlayerInput["position"]> = { "qb-thu": "QB", "qb-sun": "QB", "rb-one": "RB", "rb-two": "RB", "wr-one": "WR", "wr-two": "WR", "te-one": "TE", "te-two": "TE" };
  return roster.map((playerId, index) => {
    const thursday = playerId === "qb-thu";
    const base: LineupWeekPlayerInput = {
      playerId,
      position: positions[playerId]!,
      nflTeam: thursday ? "KC" : "BUF",
      gameId: thursday ? "week1-thursday" : "week1-sunday",
      originalScheduledStartAt: thursday ? "2026-09-10T00:20:00.000Z" : "2026-09-13T17:00:00.000Z",
      scheduledStartAt: thursday ? "2026-09-10T00:20:00.000Z" : "2026-09-13T17:00:00.000Z",
      actualStartedAt: "",
      gameStatus: "scheduled",
      availability: "active",
      projectedPoints: 20 - index,
    };
    return { ...base, ...overrides[playerId] };
  });
}

let sequence = 0;
function id() {
  sequence += 1;
  return `90000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

async function execute(store: LeagueCommandMemoryStore, commandValue: LeagueCommand, actorUserId: string, at: string) {
  return executeLeagueCommand({ commandValue, actorUserId, actorEmail: `${actorUserId}@example.com`, store, processedAt: at });
}

async function configure(store: LeagueCommandMemoryStore, players = weekPlayers(), seasonRevision = 1, weekRevision = 0) {
  return execute(store, typed({
    commandId: id(), commandType: "configure_lineup_week", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: seasonRevision,
    payload: { week: 1, expectedWeekRevision: weekRevision, players }, reason: "Publish exact Week 1 kickoff states", clientCreatedAt: "2026-09-01T00:00:00.000Z",
  }), commissionerId, "2026-09-01T00:00:01.000Z");
}

function saveCommand(input: { expectedRevision: number; expectedSeasonRevision: number; assignments: Record<string, string>; fallback?: string[]; reason?: string }) {
  return typed({
    commandId: id(), commandType: "save_weekly_lineup", actorUserId: managerId, leagueId, seasonId, expectedRevision: input.expectedRevision,
    payload: { legacyLeagueId: "", franchiseId, week: 1, assignments: input.assignments, overrideReason: input.reason ?? "", expectedSeasonRevision: input.expectedSeasonRevision, expectedRosterRevision: 1, settingsVersionId: "settings-1", orderedFallbackPlayerIds: input.fallback ?? [] },
    reason: input.reason ?? "", clientCreatedAt: "2026-09-01T00:01:00.000Z",
  });
}

const opening = { "QB-1": "qb-thu", "RB-1": "rb-one", "WR-1": "wr-one", "TE-1": "te-one" };

describe("native weekly lineup commands", () => {
  it("locks one started Thursday player while a Sunday roster move remains legal and cross-device revisions stay exact", async () => {
    const store = new LeagueCommandMemoryStore();
    seed(store);
    await configure(store);
    await execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: opening }), managerId, "2026-09-09T12:00:00.000Z");
    const sundaySwap = await execute(store, saveCommand({ expectedRevision: 1, expectedSeasonRevision: 2, assignments: { ...opening, "RB-1": "rb-two" } }), managerId, "2026-09-10T01:00:00.000Z");
    expect(sundaySwap.resultingRevision).toBe(2);
    await expect(execute(store, saveCommand({ expectedRevision: 2, expectedSeasonRevision: 2, assignments: { ...opening, "QB-1": "qb-sun", "RB-1": "rb-two" } }), managerId, "2026-09-10T01:01:00.000Z")).rejects.toMatchObject({ code: "player_locked", message: expect.stringContaining("qb-thu") });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/lineups/${franchiseId}_week-1`)).toMatchObject({ revision: 2, roster_revision: 1, settings_version_id: "settings-1", assignments: { ...opening, "RB-1": "rb-two" } });
  });

  it("follows a rescheduled postponed-game lock time instead of the original kickoff", async () => {
    const store = new LeagueCommandMemoryStore();
    seed(store);
    await configure(store, weekPlayers({ "qb-thu": { gameStatus: "postponed", scheduledStartAt: "2026-09-14T00:20:00.000Z" } }));
    const receipt = await execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: { ...opening, "QB-1": "qb-sun" } }), managerId, "2026-09-10T01:00:00.000Z");
    expect(receipt.status).toBe("accepted");
  });

  it("records a reasoned emergency reopening and then lets the team manager move the locked player", async () => {
    const store = new LeagueCommandMemoryStore();
    seed(store);
    await configure(store);
    await execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: opening }), managerId, "2026-09-09T12:00:00.000Z");
    const reopened = await execute(store, typed({
      commandId: id(), commandType: "set_lineup_lock_override", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 2,
      payload: { week: 1, expectedWeekRevision: 1, playerIds: ["qb-thu"], reopenedUntil: "2026-09-10T02:00:00.000Z" }, reason: "Official stat feed marked a false start", clientCreatedAt: "2026-09-10T01:00:00.000Z",
    }), commissionerId, "2026-09-10T01:00:01.000Z");
    expect(store.read(`leagues/${leagueId}/auditEvents/${reopened.auditEventId}`)).toMatchObject({ action: "lineup_players_reopened", reason: "Official stat feed marked a false start" });
    const changed = await execute(store, saveCommand({ expectedRevision: 1, expectedSeasonRevision: 3, assignments: { ...opening, "QB-1": "qb-sun" } }), managerId, "2026-09-10T01:05:00.000Z");
    expect(changed.status).toBe("accepted");
  });

  it("applies an ordered eligible fallback for an inactive starter and preserves the substitution trace", async () => {
    const store = new LeagueCommandMemoryStore();
    seed(store);
    await configure(store, weekPlayers({ "wr-one": { availability: "inactive" } }));
    const saved = await execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: opening, fallback: ["rb-two", "wr-two"] }), managerId, "2026-09-09T12:00:00.000Z");
    expect(saved.result.automaticSubstitutions).toEqual([{ slot: "WR-1", from: "wr-one", to: "wr-two" }]);
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/lineups/${franchiseId}_week-1`)).toMatchObject({ assignments: { ...opening, "WR-1": "wr-two" }, automatic_substitutions: [{ slot: "WR-1", from: "wr-one", to: "wr-two" }] });
  });

  it("rejects an illegal position and records a reasoned commissioner override for a locked player", async () => {
    const store = new LeagueCommandMemoryStore();
    seed(store);
    await configure(store);
    await expect(execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: { ...opening, "QB-1": "rb-two" } }), managerId, "2026-09-09T12:00:00.000Z")).rejects.toMatchObject({ code: "position_ineligible" });
    await execute(store, saveCommand({ expectedRevision: 0, expectedSeasonRevision: 2, assignments: opening }), managerId, "2026-09-09T12:01:00.000Z");
    const override = await execute(store, typed({
      commandId: id(), commandType: "save_weekly_lineup", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1,
      payload: { legacyLeagueId: "", franchiseId, week: 1, assignments: { ...opening, "QB-1": "qb-sun" }, overrideReason: "Official kickoff record was incorrect", expectedSeasonRevision: 2, expectedRosterRevision: 1, settingsVersionId: "settings-1", orderedFallbackPlayerIds: [] },
      reason: "Official kickoff record was incorrect", clientCreatedAt: "2026-09-10T01:00:00.000Z",
    }), commissionerId, "2026-09-10T01:00:01.000Z");
    expect(override.status).toBe("accepted");
    expect(store.read(`leagues/${leagueId}/auditEvents/${override.auditEventId}`)).toMatchObject({ material_differences: { locked_overrides: [expect.objectContaining({ playerId: "qb-thu" })] } });
  });
});
