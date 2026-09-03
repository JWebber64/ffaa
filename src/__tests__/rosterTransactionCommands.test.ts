import { describe, expect, it } from "vitest";

import type { LeagueCommand, RosterAssetMove } from "../../shared/leagueCommandProtocol";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const actorUserId = "commissioner-1";
const actorEmail = "commissioner@example.com";
const createdAt = "2026-09-03T00:00:00.000Z";

function command<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) {
  return value;
}

async function publishedLeague(store: LeagueCommandMemoryStore, suffix: string) {
  const created = await executeLeagueCommand({
    commandValue: command({
      commandId: `10000000-0000-4000-8000-0000000000${suffix}`,
      commandType: "create_native_league",
      actorUserId,
      leagueId: "",
      seasonId: "",
      expectedRevision: 0,
      payload: { name: "Roster Ledger League", timezone: "Asia/Taipei", year: 2026 },
      reason: "Create native league",
      clientCreatedAt: createdAt,
    }),
    actorUserId,
    actorEmail,
    store,
    processedAt: createdAt,
  });
  await executeLeagueCommand({
    commandValue: command({
      commandId: `20000000-0000-4000-8000-0000000000${suffix}`,
      commandType: "publish_settings",
      actorUserId,
      leagueId: created.leagueId,
      seasonId: created.seasonId,
      expectedRevision: 1,
      payload: { draftVersionId: `settings-10000000-0000-4000-8000-0000000000${suffix}` },
      reason: "Publish roster rules",
      clientCreatedAt: "2026-09-03T00:01:00.000Z",
    }),
    actorUserId,
    actorEmail,
    store,
    processedAt: "2026-09-03T00:01:01.000Z",
  });
  const teams = store.paths()
    .filter((path) => path.includes(`/seasons/${created.seasonId}/seasonTeams/`))
    .sort((left, right) => Number(store.read(left)?.draft_position) - Number(store.read(right)?.draft_position));
  return {
    leagueId: created.leagueId,
    seasonId: created.seasonId,
    teamPaths: teams,
    teamIds: teams.map((path) => String(store.read(path)?.franchise_id)),
  };
}

function rosterCommand(input: {
  commandId: string;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  moves: RosterAssetMove[];
  reason?: string;
}) {
  return command({
    commandId: input.commandId,
    commandType: "apply_roster_transaction",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { transactionType: "commissioner_add_drop", moves: input.moves },
    reason: input.reason ?? "Commissioner roster correction",
    clientCreatedAt: "2026-09-03T00:02:00.000Z",
  });
}

describe("universal roster transaction commands", () => {
  it("atomically writes ownership, roster revisions, ledger, hooks, audit, and one retryable receipt", async () => {
    const store = new LeagueCommandMemoryStore();
    const league = await publishedLeague(store, "31");
    const add = rosterCommand({
      commandId: "30000000-0000-4000-8000-000000000031",
      leagueId: league.leagueId,
      seasonId: league.seasonId,
      expectedRevision: 2,
      moves: [{ assetType: "player", assetId: "2026-RB-jahmyr-gibbs", fromFranchiseId: null, toFranchiseId: league.teamIds[0]! }],
    });
    const accepted = await executeLeagueCommand({ commandValue: add, actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:01.000Z" });
    const transactionId = String(accepted.result.transactionId);
    expect(store.read(league.teamPaths[0]!)).toMatchObject({ roster_revision: 2, roster_player_ids: ["2026-RB-jahmyr-gibbs"] });
    expect(store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/assetLocks/player__2026-RB-jahmyr-gibbs`)).toMatchObject({ franchise_id: league.teamIds[0], roster_transaction_id: transactionId });
    expect(store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/rosterTransactions/${transactionId}`)).toMatchObject({ transaction_type: "commissioner_add_drop", approval_state: "accepted" });
    expect(store.read(`leagues/${league.leagueId}/auditEvents/${accepted.auditEventId}`)).toMatchObject({ transaction_id: transactionId, private_metadata: {} });
    expect(store.read(`leagues/${league.leagueId}/auditPrivate/${accepted.auditEventId}`)).toMatchObject({ reason: "Commissioner roster correction" });
    expect(store.read(`leagues/${league.leagueId}/notificationOutbox/notify-${add.commandId}`)).toMatchObject({ status: "pending", transaction_id: transactionId });
    expect(store.read(`leagues/${league.leagueId}/readModelInvalidations/invalidate-${add.commandId}`)).toMatchObject({ targets: ["league_home", "team_roster", "transactions"] });

    const retry = await executeLeagueCommand({ commandValue: add, actorUserId, actorEmail, store, processedAt: "2026-09-03T00:03:00.000Z" });
    expect(retry).toEqual(accepted);
    expect(store.paths().filter((path) => path.includes("/rosterTransactions/"))).toHaveLength(1);
  });

  it("allows exactly one of two commissioners to acquire the same player", async () => {
    const store = new LeagueCommandMemoryStore();
    const league = await publishedLeague(store, "41");
    const attempts = await Promise.allSettled([
      executeLeagueCommand({ commandValue: rosterCommand({ commandId: "30000000-0000-4000-8000-000000000041", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 2, moves: [{ assetType: "player", assetId: "2026-WR-justin-jefferson", fromFranchiseId: null, toFranchiseId: league.teamIds[0]! }] }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:01.000Z" }),
      executeLeagueCommand({ commandValue: rosterCommand({ commandId: "40000000-0000-4000-8000-000000000041", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 2, moves: [{ assetType: "player", assetId: "2026-WR-justin-jefferson", fromFranchiseId: null, toFranchiseId: league.teamIds[1]! }] }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:01.000Z" }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "stale_revision", currentRevision: 3 } });
    const lock = store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/assetLocks/player__2026-WR-justin-jefferson`);
    expect([league.teamIds[0], league.teamIds[1]]).toContain(lock?.franchise_id);
    expect(store.paths().filter((path) => path.includes("/rosterTransactions/"))).toHaveLength(1);
  });

  it("reverses an untouched transfer without rewriting the original receipt", async () => {
    const store = new LeagueCommandMemoryStore();
    const league = await publishedLeague(store, "51");
    await executeLeagueCommand({ commandValue: rosterCommand({ commandId: "30000000-0000-4000-8000-000000000051", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 2, moves: [{ assetType: "player", assetId: "2026-QB-josh-allen", fromFranchiseId: null, toFranchiseId: league.teamIds[0]! }] }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:00.000Z" });
    const transfer = await executeLeagueCommand({ commandValue: rosterCommand({ commandId: "40000000-0000-4000-8000-000000000051", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 3, moves: [{ assetType: "player", assetId: "2026-QB-josh-allen", fromFranchiseId: league.teamIds[0]!, toFranchiseId: league.teamIds[1]! }] }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:03:00.000Z" });
    const originalId = String(transfer.result.transactionId);
    const reversed = await executeLeagueCommand({
      commandValue: command({
        commandId: "50000000-0000-4000-8000-000000000051",
        commandType: "reverse_roster_transaction",
        actorUserId,
        leagueId: league.leagueId,
        seasonId: league.seasonId,
        expectedRevision: 4,
        payload: { transactionId: originalId },
        reason: "Trade entered against the wrong team",
        clientCreatedAt: "2026-09-03T00:04:00.000Z",
      }),
      actorUserId,
      actorEmail,
      store,
      processedAt: "2026-09-03T00:04:01.000Z",
    });
    expect(store.read(league.teamPaths[0]!)?.roster_player_ids).toEqual(["2026-QB-josh-allen"]);
    expect(store.read(league.teamPaths[1]!)?.roster_player_ids).toEqual([]);
    expect(store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/assetLocks/player__2026-QB-josh-allen`)?.franchise_id).toBe(league.teamIds[0]);
    expect(store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/rosterTransactions/${originalId}`)).toMatchObject({ approval_state: "reversed", reversed_by_transaction_id: reversed.result.transactionId });
    expect(store.read(`leagues/${league.leagueId}/seasons/${league.seasonId}/rosterTransactions/${String(reversed.result.transactionId)}`)).toMatchObject({ transaction_type: "reversal", reversal_of_transaction_id: originalId });
    expect(store.read(`leagues/${league.leagueId}/auditEvents/${reversed.auditEventId}`)?.reversal_of_audit_event_id).toBe(transfer.auditEventId);
  });

  it("requires a reason and rejects a player whose current owner does not match", async () => {
    const store = new LeagueCommandMemoryStore();
    const league = await publishedLeague(store, "61");
    await expect(executeLeagueCommand({ commandValue: rosterCommand({ commandId: "30000000-0000-4000-8000-000000000061", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 2, moves: [{ assetType: "player", assetId: "2026-TE-brock-bowers", fromFranchiseId: null, toFranchiseId: league.teamIds[0]! }], reason: "" }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:00.000Z" })).rejects.toMatchObject({ code: "reason_required" });
    await expect(executeLeagueCommand({ commandValue: rosterCommand({ commandId: "40000000-0000-4000-8000-000000000061", leagueId: league.leagueId, seasonId: league.seasonId, expectedRevision: 2, moves: [{ assetType: "player", assetId: "2026-TE-brock-bowers", fromFranchiseId: league.teamIds[1]!, toFranchiseId: league.teamIds[0]! }] }), actorUserId, actorEmail, store, processedAt: "2026-09-03T00:02:01.000Z" })).rejects.toMatchObject({ code: "asset_ownership_changed" });
  });
});
