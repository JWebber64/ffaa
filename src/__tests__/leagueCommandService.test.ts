import { describe, expect, it } from "vitest";

import type { LeagueCommand } from "../../shared/leagueCommandProtocol";
import { deriveGamehqUuid, LeagueCommandFailure } from "../../server/league-commands/commandSupport";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const actorUserId = "commissioner-1";
const connectCommandId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const leagueId = deriveGamehqUuid(actorUserId, connectCommandId, "league");
const legacyLeagueId = "1385319428408774656";
const processedAt = "2026-09-02T00:00:00.000Z";

function command<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) {
  return value;
}

function seedLegacySeason(store: LeagueCommandMemoryStore) {
  store.seed(`leagueSeasons/${legacyLeagueId}`, {
    version: 1,
    league_id: legacyLeagueId,
    commissioner_user_id: actorUserId,
    source_draft_revision: 7,
    payload: {
      config: {
        defaultBudget: 200,
        scoring: "ppr",
        rosterSlots: [{ slot: "QB", count: 1 }, { slot: "BENCH", count: 1 }],
        isOpen: true,
      },
      teams: [{
        teamId: "team-1",
        teamNumber: 1,
        name: "Clay",
        budget: 200,
        roster: [
          { playerId: "qb-1", name: "Quarterback One", pos: "QB", team: "BUF", price: 20 },
          { playerId: "qb-2", name: "Quarterback Two", pos: "QB", team: "KC", price: 10 },
        ],
      }],
    },
    schedule: [],
    franchise_ids: ["team-1"],
    revision: 3,
    created_at: "2026-08-31T00:00:00.000Z",
    published_at: "2026-08-31T00:01:00.000Z",
    updated_at: "2026-08-31T00:01:00.000Z",
  });
  store.seed(`leagueSeasons/${legacyLeagueId}/managerMemberships/${actorUserId}`, {
    league_id: legacyLeagueId,
    user_id: actorUserId,
    franchise_id: "team-1",
    status: "approved",
    requested_at: "2026-08-30T00:00:00.000Z",
    approved_at: "2026-08-31T00:00:00.000Z",
  });
}

function connectCommand(commandId = connectCommandId) {
  return command({
    commandId,
    commandType: "connect_external_league",
    actorUserId,
    leagueId: "",
    seasonId: "",
    expectedRevision: 0,
    payload: {
      provider: "sleeper",
      externalLeagueId: legacyLeagueId,
      leagueName: "G.O.A.T. League",
      season: "2026",
    },
    reason: "Attach external league connection",
    clientCreatedAt: "2026-09-02T00:00:00.000Z",
  });
}

describe("LeagueCommandService boundary", () => {
  it("rejects a request-body actor that differs from the verified actor", async () => {
    const store = new LeagueCommandMemoryStore();
    await expect(executeLeagueCommand({
      commandValue: { ...connectCommand(), actorUserId: "request-body-user" },
      actorUserId,
      store,
      processedAt,
    })).rejects.toMatchObject({ code: "actor_mismatch" });
    expect(store.paths()).toEqual([]);
  });

  it("creates native identity once and returns the same receipt for a retry", async () => {
    const store = new LeagueCommandMemoryStore();
    const create = command({
      commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      commandType: "create_native_league",
      actorUserId,
      leagueId: "",
      seasonId: "",
      expectedRevision: 0,
      payload: { name: "Native Test League", timezone: "Asia/Taipei", year: 2026 },
      reason: "Create native GameHQ league",
      clientCreatedAt: "2026-09-02T00:00:00.000Z",
    });
    const first = await executeLeagueCommand({ commandValue: create, actorUserId, store, processedAt });
    const retry = await executeLeagueCommand({
      commandValue: { ...create, clientCreatedAt: "2026-09-02T00:00:10.000Z" },
      actorUserId,
      store,
      processedAt: "2026-09-02T00:00:11.000Z",
    });
    expect(retry).toEqual(first);
    expect(first.leagueId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(first.seasonId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(store.read(`leagues/${first.leagueId}`)).toMatchObject({ id: first.leagueId, authority_mode: "native" });
    expect(store.paths().filter((path) => path.includes("/auditEvents/"))).toHaveLength(1);

    await expect(executeLeagueCommand({
      commandValue: { ...create, payload: { ...create.payload, name: "Different League" } },
      actorUserId,
      store,
      processedAt,
    })).rejects.toMatchObject({ code: "idempotency_key_reused" });
  });

  it("migrates GameHQ memberships and never grants authority from the provider owner", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLegacySeason(store);
    const receipt = await executeLeagueCommand({ commandValue: connectCommand(), actorUserId, store, processedAt });
    expect(receipt.result).toMatchObject({
      authorityMode: "mirror",
      migrationState: "legacy_backed_native",
      migratedFranchiseCount: 1,
    });
    expect(store.read(`externalLeagueMappings/sleeper__${legacyLeagueId}`)).toMatchObject({ league_id: leagueId });
    expect(store.read(`leagues/${leagueId}/externalConnections/sleeper`)).toMatchObject({ mode: "mirror", permissions: ["read"] });
    expect(store.read(`leagues/${leagueId}/memberships/${actorUserId}`)).toMatchObject({
      status: "active",
      role_grant_ids: expect.arrayContaining([`${actorUserId}__commissioner`]),
    });
    expect(store.paths().some((path) => path.includes("roleGrants") && path.includes("provider"))).toBe(false);
  });

  it("accepts one concurrent lineup save, rejects the stale writer, and keeps retry idempotent", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLegacySeason(store);
    const connection = await executeLeagueCommand({ commandValue: connectCommand(), actorUserId, store, processedAt });
    const base = {
      commandType: "save_weekly_lineup" as const,
      actorUserId,
      leagueId,
      seasonId: connection.seasonId,
      expectedRevision: 0,
      payload: {
        legacyLeagueId,
        franchiseId: "team-1",
        week: 1,
        assignments: { "QB-1": "qb-1" },
        overrideReason: "",
      },
      reason: "",
      clientCreatedAt: "2026-09-02T00:01:00.000Z",
    };
    const left = command({ ...base, commandId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    const right = command({ ...base, commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", payload: { ...base.payload, assignments: { "QB-1": "qb-2" } } });
    const results = await Promise.allSettled([
      executeLeagueCommand({ commandValue: left, actorUserId, store, processedAt: "2026-09-02T00:01:01.000Z" }),
      executeLeagueCommand({ commandValue: right, actorUserId, store, processedAt: "2026-09-02T00:01:01.000Z" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(LeagueCommandFailure);
    expect(rejected?.reason).toMatchObject({ code: "stale_revision", currentRevision: 1 });
    expect(store.read(`leagueSeasons/${legacyLeagueId}/lineups/team-1_week-1`)).toMatchObject({ revision: 1 });
    expect(store.paths().filter((path) => path.includes(`/leagues/${leagueId}/auditEvents/`) || path.startsWith(`leagues/${leagueId}/auditEvents/`))).toHaveLength(2);

    const winner = results.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof executeLeagueCommand>>> => result.status === "fulfilled")!;
    const winningCommand = winner.value.commandId === left.commandId ? left : right;
    const retry = await executeLeagueCommand({
      commandValue: { ...winningCommand, clientCreatedAt: "2026-09-02T00:02:00.000Z" },
      actorUserId,
      store,
      processedAt: "2026-09-02T00:02:01.000Z",
    });
    expect(retry).toEqual(winner.value);
    expect(store.paths().filter((path) => path.startsWith(`leagues/${leagueId}/auditEvents/`))).toHaveLength(2);

    await expect(executeLeagueCommand({
      commandValue: command({ ...base, commandId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }),
      actorUserId,
      store,
      processedAt: "2026-09-02T00:03:00.000Z",
    })).rejects.toMatchObject({ code: "stale_revision", currentRevision: 1 });
  });

  it("rejects a signed-in actor without a GameHQ membership or role grant", async () => {
    const store = new LeagueCommandMemoryStore();
    seedLegacySeason(store);
    const connection = await executeLeagueCommand({ commandValue: connectCommand(), actorUserId, store, processedAt });
    const outsider = "provider-owner-only";
    await expect(executeLeagueCommand({
      commandValue: {
        commandId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        commandType: "save_weekly_lineup",
        actorUserId: outsider,
        leagueId,
        seasonId: connection.seasonId,
        expectedRevision: 0,
        payload: { legacyLeagueId, franchiseId: "team-1", week: 1, assignments: { "QB-1": "qb-1" }, overrideReason: "" },
        reason: "",
        clientCreatedAt: "2026-09-02T00:04:00.000Z",
      },
      actorUserId: outsider,
      store,
      processedAt: "2026-09-02T00:04:01.000Z",
    })).rejects.toMatchObject({ code: "permission_denied" });
  });
});
