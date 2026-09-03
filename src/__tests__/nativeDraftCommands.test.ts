import { describe, expect, it } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import type { LeagueCommand, NativeDraftAction, NativeDraftFormat } from "../../shared/leagueCommandProtocol";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "commissioner-1";
const teamIds = [
  "31000000-0000-4000-8000-000000000001",
  "31000000-0000-4000-8000-000000000002",
  "31000000-0000-4000-8000-000000000003",
  "31000000-0000-4000-8000-000000000004",
];

function command<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) {
  return value;
}

function seedLeague(store: LeagueCommandMemoryStore, format: "snake" | "auction") {
  const settings = createRedraftLeagueSettings("Asia/Taipei");
  settings.teamCount = 4;
  settings.schedule.playoffTeams = 4;
  settings.draft.format = format;
  settings.rosterSlots = settings.rosterSlots.map((slot) => ({
    ...slot,
    count: slot.slot === "QB" || slot.slot === "RB" || slot.slot === "WR" || slot.slot === "TE" ? 1 : slot.slot === "BENCH" ? 4 : 0,
  }));
  store.seed(`leagues/${leagueId}`, {
    id: leagueId,
    authority_mode: "native",
    current_season_id: seasonId,
    status: "draft",
    revision: 1,
  });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, {
    id: seasonId,
    league_id: leagueId,
    phase: "setup",
    revision: 1,
    settings_version_id: "settings-1",
    draft_id: "",
  });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-1`, {
    id: "settings-1",
    league_id: leagueId,
    season_id: seasonId,
    status: "published",
    settings,
  });
  store.seed(`leagues/${leagueId}/memberships/${actorUserId}`, {
    league_id: leagueId,
    user_id: actorUserId,
    status: "active",
    role_grant_ids: [`${actorUserId}__commissioner`],
  });
  store.seed(`leagues/${leagueId}/roleGrants/${actorUserId}__commissioner`, {
    id: `${actorUserId}__commissioner`,
    league_id: leagueId,
    user_id: actorUserId,
    role: "commissioner",
    effective_at: "2026-01-01T00:00:00.000Z",
    expires_at: "",
    revoked_at: "",
  });
  teamIds.forEach((franchiseId, index) => {
    store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`, {
      id: franchiseId,
      league_id: leagueId,
      season_id: seasonId,
      franchise_id: franchiseId,
      name: `Team ${index + 1}`,
      draft_position: index + 1,
      roster_revision: 1,
      roster_player_ids: [],
      status: "active",
    });
  });
}

let commandSequence = 10;
function commandId() {
  commandSequence += 1;
  return `40000000-0000-4000-8000-${String(commandSequence).padStart(12, "0")}`;
}

async function execute(store: LeagueCommandMemoryStore, commandValue: LeagueCommand, processedAt: string) {
  return executeLeagueCommand({ commandValue, actorUserId, actorEmail: "commissioner@example.com", store, processedAt });
}

async function createDraft(store: LeagueCommandMemoryStore, format: NativeDraftFormat, mode: "live" | "slow" = "live") {
  const draftCommand = command({
    commandId: commandId(),
    commandType: "create_native_draft",
    actorUserId,
    leagueId,
    seasonId,
    expectedRevision: 1,
    payload: {
      format,
      mode,
      draftOrderFranchiseIds: teamIds,
      pickSeconds: mode === "slow" ? 86400 : 60,
      nominationSeconds: 30,
      bidSeconds: 10,
      antiSnipeSeconds: 5,
      spectatorEnabled: true,
    },
    reason: "Configure native draft",
    clientCreatedAt: "2026-09-03T01:00:00.000Z",
  });
  const created = await execute(store, draftCommand, "2026-09-03T01:00:01.000Z");
  const retry = await execute(store, draftCommand, "2026-09-03T01:00:02.000Z");
  expect(retry).toEqual(created);
  const draftId = String(created.result.draftId);
  const started = await execute(store, command({
    commandId: commandId(),
    commandType: "start_native_draft",
    actorUserId,
    leagueId,
    seasonId,
    expectedRevision: 2,
    payload: { draftId },
    reason: "Launch native draft",
    clientCreatedAt: "2026-09-03T01:01:00.000Z",
  }), "2026-09-03T01:01:01.000Z");
  return { draftId, leagueRevision: started.resultingRevision, draftRevision: Number(started.result.draftRevision) };
}

async function action(store: LeagueCommandMemoryStore, state: { draftId: string; leagueRevision: number; draftRevision: number }, draftAction: NativeDraftAction, at: string, reason = "Native draft action") {
  const receipt = await execute(store, command({
    commandId: commandId(),
    commandType: "apply_native_draft_action",
    actorUserId,
    leagueId,
    seasonId,
    expectedRevision: state.leagueRevision,
    payload: { draftId: state.draftId, expectedDraftRevision: state.draftRevision, action: draftAction },
    reason,
    clientCreatedAt: at,
  }), at);
  state.leagueRevision = receipt.resultingRevision;
  state.draftRevision = Number(receipt.result.draftRevision);
  return receipt;
}

describe("native draft commands", () => {
  it("persists a snake draft, atomically publishes every selection to the roster ledger, and completes without JSON handoff", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLeague(store, "snake");
    const state = await createDraft(store, "third_round_reversal", "slow");
    const draftPath = `leagues/${leagueId}/seasons/${seasonId}/drafts/${state.draftId}`;
    expect(store.read(draftPath)).toMatchObject({ format: "third_round_reversal", mode: "slow", status: "live", spectator_enabled: true });

    for (let index = 0; index < 32; index += 1) {
      const playerId = `player-${String(index + 1).padStart(2, "0")}`;
      const receipt = await action(store, state, { type: "pick", playerId }, new Date(Date.UTC(2026, 8, 3, 2, index, 0)).toISOString());
      expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/${receipt.result.transactionId}`)).toMatchObject({
        transaction_type: "draft_selection",
        draft_id: state.draftId,
      });
    }

    const completed = store.read(draftPath);
    expect(completed).toMatchObject({ status: "complete", overall_pick: 33 });
    expect((completed?.selections as Array<Record<string, unknown>>).slice(0, 12).map((selection) => selection.franchise_id)).toEqual([
      teamIds[0], teamIds[1], teamIds[2], teamIds[3],
      teamIds[3], teamIds[2], teamIds[1], teamIds[0],
      teamIds[3], teamIds[2], teamIds[1], teamIds[0],
    ]);
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}`)).toMatchObject({ phase: "regular_season", rosters_published_at: expect.any(String) });
    expect(store.read(`leagues/${leagueId}`)).toMatchObject({ status: "active" });
    expect(teamIds.map((id) => (store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${id}`)?.roster_player_ids as string[]).length)).toEqual([8, 8, 8, 8]);
    expect(store.paths().filter((path) => path.includes("/assetLocks/player__"))).toHaveLength(32);
  });

  it("uses a persisted queue for recovery and reverts the last selection through an inverse roster transaction", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLeague(store, "snake");
    const state = await createDraft(store, "snake");
    await action(store, state, { type: "set_queue", franchiseId: teamIds[0]!, playerIds: ["queued-player"] }, "2026-09-03T03:00:00.000Z");
    const share = store.paths().find((path) => path.startsWith("nativeDraftShares/"));
    expect(share).toBeTruthy();
    expect(store.read(share!)?.state).not.toHaveProperty("queues");
    expect(store.read(share!)?.state).not.toHaveProperty("created_by");
    const selected = await action(store, state, { type: "autopick" }, "2026-09-03T03:01:00.000Z");
    expect(selected.result).toMatchObject({ playerId: "queued-player", franchiseId: teamIds[0] });

    const reverted = await execute(store, command({
      commandId: commandId(),
      commandType: "revert_native_draft_action",
      actorUserId,
      leagueId,
      seasonId,
      expectedRevision: state.leagueRevision,
      payload: { draftId: state.draftId, expectedDraftRevision: state.draftRevision },
      reason: "The wrong queued player was selected",
      clientCreatedAt: "2026-09-03T03:02:00.000Z",
    }), "2026-09-03T03:02:01.000Z");
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/drafts/${state.draftId}`)).toMatchObject({ status: "paused", overall_pick: 1, selections: [] });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/assetLocks/player__queued-player`)).toBeNull();
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/${selected.result.transactionId}`)).toMatchObject({ approval_state: "reversed", reversed_by_transaction_id: reverted.result.transactionId });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/${reverted.result.transactionId}`)).toMatchObject({ transaction_type: "reversal", reversal_of_transaction_id: selected.result.transactionId });
  });

  it("enforces auction max bids, anti-snipe persistence, and an audited sale", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLeague(store, "auction");
    const state = await createDraft(store, "auction");
    await action(store, state, { type: "nominate", playerId: "auction-player", openingBid: 1 }, "2026-09-03T04:00:00.000Z");
    await expect(action(store, state, { type: "bid", franchiseId: teamIds[1]!, amount: 194 }, "2026-09-03T04:00:05.000Z")).rejects.toMatchObject({ code: "invalid_bid" });
    const bid = await action(store, state, { type: "bid", franchiseId: teamIds[1]!, amount: 20 }, "2026-09-03T04:00:06.000Z");
    const draftPath = `leagues/${leagueId}/seasons/${seasonId}/drafts/${state.draftId}`;
    expect(store.read(draftPath)?.auction_state).toMatchObject({ current_bid: 20, high_bidder_franchise_id: teamIds[1], ends_at: "2026-09-03T04:00:16.000Z" });
    expect(bid.result.action).toBe("auction_bid");
    const sale = await action(store, state, { type: "settle" }, "2026-09-03T04:00:17.000Z");
    expect(store.read(draftPath)).toMatchObject({ overall_pick: 2, auction_state: {} });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/${sale.result.transactionId}`)).toMatchObject({ transaction_type: "auction_win", draft_price: 20 });
    expect(store.read(draftPath)?.team_states).toContainEqual(expect.objectContaining({ franchise_id: teamIds[1], spent: 20, picks: 1 }));
  });

  it("rejects stale concurrent clients so only one current pick becomes authoritative", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLeague(store, "snake");
    const state = await createDraft(store, "linear");
    const firstRevision = { ...state };
    const attempts = await Promise.allSettled([
      action(store, { ...firstRevision }, { type: "pick", playerId: "client-a-player" }, "2026-09-03T05:00:00.000Z"),
      action(store, { ...firstRevision }, { type: "pick", playerId: "client-b-player" }, "2026-09-03T05:00:00.000Z"),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((attempt) => attempt.status === "rejected")).toMatchObject({ status: "rejected", reason: { code: "stale_revision" } });
    const draft = store.read(`leagues/${leagueId}/seasons/${seasonId}/drafts/${state.draftId}`);
    expect(draft?.selections).toHaveLength(1);
    expect(store.paths().filter((path) => path.includes("/rosterTransactions/"))).toHaveLength(1);
  });
});
