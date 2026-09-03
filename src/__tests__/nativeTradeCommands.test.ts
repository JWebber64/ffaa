import { describe, expect, it } from "vitest";

import type { CreateTradeOfferPayload, LeagueCommand } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "c1111111-1111-4111-8111-111111111111";
const seasonId = "c2222222-2222-4222-8222-222222222222";
const teams = ["c3333333-3333-4333-8333-333333333331", "c3333333-3333-4333-8333-333333333332", "c3333333-3333-4333-8333-333333333333", "c3333333-3333-4333-8333-333333333334"];
const managers = ["trade-manager-one", "trade-manager-two", "trade-manager-three", "trade-manager-four"];
const commissionerId = "trade-commissioner"; const coCommissionerId = "trade-co-commissioner";
let sequence = 0; function id() { sequence += 1; return `c5000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`; }

function seed(review: "immediate" | "commissioner" | "league_vote" = "immediate", commissionerControlsTeam = false) {
  const store = new LeagueCommandMemoryStore(); const settings = createRedraftLeagueSettings("America/New_York"); settings.teamCount = 4; settings.schedule.playoffTeams = 4; settings.transactions.tradeReview = review;
  store.seed(`leagues/${leagueId}`, { id: leagueId, authority_mode: "native", current_season_id: seasonId, revision: 1 });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, revision: 1, settings_version_id: "settings-live" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-live`, { id: "settings-live", status: "published", settings });
  const addGrant = (userId: string, role: string, franchiseId = "") => { const grantId = franchiseId ? `${userId}__${role}__${franchiseId}` : `${userId}__${role}`; const membershipPath = `leagues/${leagueId}/memberships/${userId}`; const membership = store.read(membershipPath) ?? { user_id: userId, status: "active", role_grant_ids: [] }; store.seed(membershipPath, { ...membership, role_grant_ids: [...(membership.role_grant_ids as string[]), grantId] }); store.seed(`leagues/${leagueId}/roleGrants/${grantId}`, { user_id: userId, role, franchise_id: franchiseId, effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" }); };
  addGrant(commissionerId, "commissioner"); addGrant(coCommissionerId, "co_commissioner"); teams.forEach((teamId, index) => addGrant(managers[index]!, "team_owner", teamId)); if (commissionerControlsTeam) addGrant(commissionerId, "team_owner", teams[0]);
  teams.forEach((teamId, index) => { const playerId = `player-${index + 1}`; store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teamId}`, { id: teamId, franchise_id: teamId, name: `Team ${index + 1}`, roster_player_ids: [playerId], roster_revision: 1, status: "active" }); store.seed(`leagues/${leagueId}/seasons/${seasonId}/assetLocks/player__${playerId}`, { asset_type: "player", asset_id: playerId, franchise_id: teamId, revision: 1 }); store.seed(`leagues/${leagueId}/seasons/${seasonId}/playerStates/${playerId}`, { player_id: playerId, position: index % 2 ? "WR" : "RB", state: "owned", owner_franchise_id: teamId, revision: 1 }); store.seed(`leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/${teamId}`, { franchise_id: teamId, faab_remaining: 100, revision: 1 }); });
  return { store, settings };
}

async function execute<T extends LeagueCommand["commandType"]>(store: LeagueCommandMemoryStore, command: LeagueCommand<T>, actorUserId: string, processedAt: string) { return executeLeagueCommand({ commandValue: command, actorUserId, store, processedAt }); }
function offerCommand(from = 0, to = 1, overrides: Partial<CreateTradeOfferPayload> = {}): LeagueCommand<"create_trade_offer"> { return { commandId: id(), commandType: "create_trade_offer", actorUserId: managers[from]!, leagueId, seasonId, expectedRevision: 1, payload: { fromFranchiseId: teams[from]!, toFranchiseId: teams[to]!, week: 1, expiresAt: "2026-09-10T18:00:00.000Z", settingsVersionId: "settings-live", offeredAssets: [{ type: "player", id: `player-${from + 1}` }, { type: "faab", id: `faab:${teams[from]}`, amount: 10 }], requestedAssets: [{ type: "player", id: `player-${to + 1}` }, { type: "faab", id: `faab:${teams[to]}`, amount: 4 }], message: "Balanced roster exchange", ...overrides }, reason: "Balanced roster exchange", clientCreatedAt: "2026-09-10T12:00:00.000Z" }; }

describe("native trade commands", () => {
  it("atomically swaps players and FAAB and writes the canonical receipt and activity ledger", async () => {
    const { store } = seed(); const created = await execute(store, offerCommand(), managers[0]!, "2026-09-10T12:00:01.000Z"); const offerId = String(created.result.offerId);
    const accepted = await execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[1]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept trade offer", clientCreatedAt: "2026-09-10T12:05:00.000Z" }, managers[1]!, "2026-09-10T12:05:01.000Z");
    expect(accepted.result).toMatchObject({ status: "completed" });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teams[0]}`)).toMatchObject({ roster_player_ids: ["player-2"], roster_revision: 2 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teams[1]}`)).toMatchObject({ roster_player_ids: ["player-1"], roster_revision: 2 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/${teams[0]}`)).toMatchObject({ faab_remaining: 94 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/${teams[1]}`)).toMatchObject({ faab_remaining: 106 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/tradeReceipts/${offerId}`)).toMatchObject({ processing_result: "completed", settings_version_id: "settings-live", roster_transaction_id: `tx-${offerId}` });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/tx-${offerId}`)).toMatchObject({ transaction_type: "trade", review_state: "immediate" });
  });

  it("cannot accept an expired offer", async () => {
    const { store } = seed(); const created = await execute(store, offerCommand(), managers[0]!, "2026-09-10T12:00:01.000Z");
    await expect(execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[1]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId: String(created.result.offerId), expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept expired trade", clientCreatedAt: "2026-09-11T12:00:00.000Z" }, managers[1]!, "2026-09-11T12:00:01.000Z")).rejects.toMatchObject({ code: "trade_offer_expired" });
  });

  it("reserves accepted-review assets so the same player cannot enter two trades", async () => {
    const { store } = seed("commissioner"); const first = await execute(store, offerCommand(0, 1), managers[0]!, "2026-09-10T12:00:01.000Z"); const second = await execute(store, offerCommand(0, 2, { requestedAssets: [{ type: "player", id: "player-3" }] }), managers[0]!, "2026-09-10T12:01:01.000Z");
    await execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[1]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId: String(first.result.offerId), expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept first trade", clientCreatedAt: "2026-09-10T12:02:00.000Z" }, managers[1]!, "2026-09-10T12:02:01.000Z");
    await expect(execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[2]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId: String(second.result.offerId), expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept second trade", clientCreatedAt: "2026-09-10T12:03:00.000Z" }, managers[2]!, "2026-09-10T12:03:01.000Z")).rejects.toMatchObject({ code: "trade_asset_reserved" });
  });

  it("requires an uninvolved reviewer when a commissioner-controlled team trades", async () => {
    const { store } = seed("immediate", true); const created = await execute(store, offerCommand(), managers[0]!, "2026-09-10T12:00:01.000Z"); const offerId = String(created.result.offerId);
    const accepted = await execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[1]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept commissioner trade", clientCreatedAt: "2026-09-10T12:01:00.000Z" }, managers[1]!, "2026-09-10T12:01:01.000Z");
    expect(accepted.result).toMatchObject({ status: "accepted_pending_review", reviewPolicy: "secondary_approval" });
    await expect(execute(store, { commandId: id(), commandType: "review_trade_offer", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: 2, decision: "approve", reason: "Commissioner approval" }, reason: "Commissioner approval", clientCreatedAt: "2026-09-10T12:02:00.000Z" }, commissionerId, "2026-09-10T12:02:01.000Z")).rejects.toMatchObject({ code: "trade_review_conflict" });
    const approved = await execute(store, { commandId: id(), commandType: "review_trade_offer", actorUserId: coCommissionerId, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: 2, decision: "approve", reason: "Independent approval" }, reason: "Independent approval", clientCreatedAt: "2026-09-10T12:03:00.000Z" }, coCommissionerId, "2026-09-10T12:03:01.000Z");
    expect(approved.result).toMatchObject({ status: "completed" });
  });

  it("records league votes and processes only after a majority", async () => {
    const { store } = seed("league_vote"); const created = await execute(store, offerCommand(), managers[0]!, "2026-09-10T12:00:01.000Z"); const offerId = String(created.result.offerId);
    await execute(store, { commandId: id(), commandType: "respond_trade_offer", actorUserId: managers[1]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: 1, response: "accept", week: 1, immediateCutPlayerIds: [] }, reason: "accept for vote", clientCreatedAt: "2026-09-10T12:01:00.000Z" }, managers[1]!, "2026-09-10T12:01:01.000Z");
    for (const [index, expectedRevision] of [[0, 2], [2, 3], [3, 4]] as const) {
      const result = await execute(store, { commandId: id(), commandType: "review_trade_offer", actorUserId: managers[index]!, leagueId, seasonId, expectedRevision: 1, payload: { offerId, expectedOfferRevision: expectedRevision, decision: "approve", reason: "Approve fair exchange" }, reason: "Approve fair exchange", clientCreatedAt: "2026-09-10T12:05:00.000Z" }, managers[index]!, `2026-09-10T12:0${5 + index}:01.000Z`);
      expect(result.result.status).toBe(index === 3 ? "completed" : "accepted_pending_review");
    }
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/tradeReceipts/${offerId}`)).toMatchObject({ votes: { [managers[0]!]: "approve", [managers[2]!]: "approve", [managers[3]!]: "approve" } });
  });
});
