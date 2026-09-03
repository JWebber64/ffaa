import { describe, expect, it } from "vitest";

import type { LeagueCommand, SubmitWaiverClaimGroupPayload } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { nextWaiverProcessingAt } from "../../server/league-commands/nativeWaiverCommands";
import { runDueNativeWaivers } from "../../server/league-commands/nativeWaiverScheduler";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "b1111111-1111-4111-8111-111111111111";
const seasonId = "b2222222-2222-4222-8222-222222222222";
const teamOne = "b3333333-3333-4333-8333-333333333333";
const teamTwo = "b4444444-4444-4444-8444-444444444444";
const commissionerId = "waiver-commissioner";
const managerOne = "waiver-manager-one";
const managerTwo = "waiver-manager-two";
let sequence = 0;
function id() { sequence += 1; return `b5000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`; }

function seed(commissionerReview = false) {
  const store = new LeagueCommandMemoryStore(); const settings = createRedraftLeagueSettings("America/New_York");
  settings.teamCount = 4; settings.schedule.playoffTeams = 4; settings.transactions.processingDays = [4]; settings.transactions.processingTime = "09:00"; settings.transactions.revealNextHighestBid = true;
  settings.transactions.commissionerWaiverReview = commissionerReview;
  store.seed(`leagues/${leagueId}`, { id: leagueId, timezone: settings.timezone, authority_mode: "native", current_season_id: seasonId, status: "active", revision: 1 });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, revision: 1, settings_version_id: "settings-live" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-live`, { id: "settings-live", status: "published", settings });
  for (const [userId, role, franchiseId, grantId] of [[commissionerId, "commissioner", "", `${commissionerId}__commissioner`], [managerOne, "team_owner", teamOne, `${managerOne}__team_owner__${teamOne}`], [managerTwo, "team_owner", teamTwo, `${managerTwo}__team_owner__${teamTwo}`]] as const) {
    store.seed(`leagues/${leagueId}/memberships/${userId}`, { user_id: userId, status: "active", role_grant_ids: [grantId] });
    store.seed(`leagues/${leagueId}/roleGrants/${grantId}`, { user_id: userId, role, franchise_id: franchiseId, effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" });
  }
  for (const [franchiseId, playerId, priority] of [[teamOne, "rostered-one", 1], [teamTwo, "rostered-two", 2]] as const) {
    store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`, { id: franchiseId, franchise_id: franchiseId, name: franchiseId === teamOne ? "First Team" : "Second Team", roster_player_ids: [playerId], roster_revision: 1, draft_position: priority, status: "active" });
    store.seed(`leagues/${leagueId}/seasons/${seasonId}/assetLocks/player__${playerId}`, { asset_type: "player", asset_id: playerId, franchise_id: franchiseId });
  }
  return { store, settings };
}

async function execute<T extends LeagueCommand["commandType"]>(store: LeagueCommandMemoryStore, command: LeagueCommand<T>, actorUserId: string, processedAt: string) {
  return executeLeagueCommand({ commandValue: command, actorUserId, store, processedAt });
}

async function initialize(store: LeagueCommandMemoryStore) {
  return execute(store, { commandId: id(), commandType: "initialize_waiver_player_pool", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: { expectedWaiverStateRevision: 0, players: [{ playerId: "rostered-one", position: "RB" }, { playerId: "rostered-two", position: "WR" }, { playerId: "target-alpha", position: "RB" }, { playerId: "target-beta", position: "WR" }] }, reason: "Initialize test player market", clientCreatedAt: "2026-09-09T13:00:00.000Z" }, commissionerId, "2026-09-09T13:00:01.000Z");
}

async function submit(store: LeagueCommandMemoryStore, actorUserId: string, franchiseId: string, alternatives: SubmitWaiverClaimGroupPayload["alternatives"]) {
  return execute(store, { commandId: id(), commandType: "submit_waiver_claim_group", actorUserId, leagueId, seasonId, expectedRevision: 1, payload: { franchiseId, week: 1, expectedRosterRevision: 1, settingsVersionId: "settings-live", alternatives }, reason: "Ordered Week 1 claim", clientCreatedAt: "2026-09-09T14:00:00.000Z" }, actorUserId, "2026-09-09T14:00:01.000Z");
}

describe("native waiver commands", () => {
  it("calculates the next configured processing time in the league timezone", () => {
    const { settings } = seed();
    expect(nextWaiverProcessingAt("2026-09-09T14:00:00.000Z", settings)).toBe("2026-09-10T13:00:00.000Z");
  });

  it("awards one contested player once, advances the loser to its fallback, and persists reproducible receipts", async () => {
    const { store } = seed(); await initialize(store);
    await submit(store, managerOne, teamOne, [{ addPlayerId: "target-alpha", dropPlayerId: "", bid: 8 }, { addPlayerId: "target-beta", dropPlayerId: "", bid: 4 }]);
    await submit(store, managerTwo, teamTwo, [{ addPlayerId: "target-alpha", dropPlayerId: "", bid: 10 }]);
    const command: LeagueCommand<"process_waiver_run"> = { commandId: id(), commandType: "process_waiver_run", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: { week: 1, expectedWaiverStateRevision: 1, processThrough: "2026-09-11T14:00:00.000Z" }, reason: "Process due claims", clientCreatedAt: "2026-09-11T14:00:00.000Z" };
    const first = await execute(store, command, commissionerId, "2026-09-11T14:00:01.000Z");
    const replay = await execute(store, command, commissionerId, "2026-09-11T14:05:00.000Z");
    expect(replay).toEqual(first);
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/playerStates/target-alpha`)).toMatchObject({ state: "owned", owner_franchise_id: teamTwo });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/playerStates/target-beta`)).toMatchObject({ state: "owned", owner_franchise_id: teamOne });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teamOne}`)).toMatchObject({ roster_player_ids: ["rostered-one", "target-beta"], roster_revision: 2 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teamTwo}`)).toMatchObject({ roster_player_ids: ["rostered-two", "target-alpha"], roster_revision: 2 });
    const receipts = store.paths().filter((path) => path.includes("/waiverReceipts/")).map((path) => store.read(path));
    expect(receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ franchise_id: teamOne, status: "won", add_player_id: "target-beta", winning_bid: 4, remaining_faab: 96, failures: [expect.stringContaining("outbid")] }),
      expect.objectContaining({ franchise_id: teamTwo, status: "won", add_player_id: "target-alpha", winning_bid: 10, next_highest_bid: 8, remaining_faab: 90 }),
    ]));
  });

  it("records an illegal first alternative and still awards a later legal fallback", async () => {
    const { store } = seed(); await initialize(store);
    await submit(store, managerOne, teamOne, [{ addPlayerId: "target-alpha", dropPlayerId: "not-rostered", bid: 5 }, { addPlayerId: "target-beta", dropPlayerId: "", bid: 3 }]);
    await execute(store, { commandId: id(), commandType: "process_waiver_run", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: { week: 1, expectedWaiverStateRevision: 1, processThrough: "2026-09-11T14:00:00.000Z" }, reason: "Process invalid fallback group", clientCreatedAt: "2026-09-11T14:00:00.000Z" }, commissionerId, "2026-09-11T14:00:01.000Z");
    const receiptPath = store.paths().find((path) => path.includes("/waiverReceipts/"))!;
    expect(store.read(receiptPath)).toMatchObject({ status: "won", add_player_id: "target-beta", winning_bid: 3, failures: [expect.stringContaining("conditional drop is not eligible")] });
  });

  it("runs due ordinary claims from the protected scheduler but leaves commissioner-review claims pending", async () => {
    const automatic = seed(); await initialize(automatic.store); await submit(automatic.store, managerOne, teamOne, [{ addPlayerId: "target-alpha", dropPlayerId: "", bid: 5 }]);
    const first = await runDueNativeWaivers(automatic.store, "2026-09-11T14:00:01.000Z");
    expect(first).toEqual([expect.objectContaining({ leagueId, seasonId, week: 1, status: "processed" })]);
    expect(await runDueNativeWaivers(automatic.store, "2026-09-11T14:05:01.000Z")).toEqual([]);
    expect(automatic.store.read(`leagues/${leagueId}/seasons/${seasonId}/playerStates/target-alpha`)).toMatchObject({ owner_franchise_id: teamOne });

    const reviewed = seed(true); await initialize(reviewed.store); await submit(reviewed.store, managerOne, teamOne, [{ addPlayerId: "target-alpha", dropPlayerId: "", bid: 5 }]);
    expect(await runDueNativeWaivers(reviewed.store, "2026-09-11T14:00:01.000Z")).toEqual([]);
    expect(reviewed.store.paths().filter((path) => path.includes("/waiverClaims/")).map((path) => reviewed.store.read(path))).toEqual([expect.objectContaining({ status: "pending_review" })]);
  });
});
