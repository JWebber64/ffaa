import { describe, expect, it } from "vitest";

import type { LeagueCommand } from "../../shared/leagueCommandProtocol";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const commissionerId = "commissioner-1";
const commissionerEmail = "commissioner@example.com";
const createdAt = "2026-09-03T00:00:00.000Z";

function command<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) {
  return value;
}

function createCommand(commandId: string) {
  return command({
    commandId,
    commandType: "create_native_league",
    actorUserId: commissionerId,
    leagueId: "",
    seasonId: "",
    expectedRevision: 0,
    payload: { name: "Native Membership League", timezone: "Asia/Taipei", year: 2026 },
    reason: "Create native league",
    clientCreatedAt: createdAt,
  });
}

async function createPublishedLeague(store: LeagueCommandMemoryStore, createId = "10000000-0000-4000-8000-000000000001") {
  const created = await executeLeagueCommand({
    commandValue: createCommand(createId),
    actorUserId: commissionerId,
    actorEmail: commissionerEmail,
    store,
    processedAt: createdAt,
  });
  const published = await executeLeagueCommand({
    commandValue: command({
      commandId: "20000000-0000-4000-8000-000000000002",
      commandType: "publish_settings",
      actorUserId: commissionerId,
      leagueId: created.leagueId,
      seasonId: created.seasonId,
      expectedRevision: 1,
      payload: { draftVersionId: `settings-${createId}` },
      reason: "Publish complete league settings",
      clientCreatedAt: "2026-09-03T00:01:00.000Z",
    }),
    actorUserId: commissionerId,
    actorEmail: commissionerEmail,
    store,
    processedAt: "2026-09-03T00:01:01.000Z",
  });
  const teamPaths = store.paths().filter((path) => path.includes(`/seasons/${created.seasonId}/seasonTeams/`));
  const firstTeamPath = teamPaths.find((path) => store.read(path)?.draft_position === 1) ?? teamPaths[0] ?? "";
  return { created, published, teamPaths, franchiseId: String(store.read(firstTeamPath)?.franchise_id ?? "") };
}

function invitationCommand(input: {
  commandId: string;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  email: string;
  displayName: string;
  franchiseId: string;
  role?: "team_owner" | "co_manager" | "co_commissioner";
  actorUserId?: string;
}) {
  return command({
    commandId: input.commandId,
    commandType: "create_league_invitation",
    actorUserId: input.actorUserId ?? commissionerId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: {
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? "team_owner",
      franchiseId: input.role === "co_commissioner" ? "" : input.franchiseId,
      expiresInDays: 7,
    },
    reason: `Invite ${input.displayName}`,
    clientCreatedAt: "2026-09-03T00:02:00.000Z",
  });
}

async function acceptInvitation(input: {
  store: LeagueCommandMemoryStore;
  receipt: Awaited<ReturnType<typeof executeLeagueCommand>>;
  userId: string;
  email: string;
  expectedRevision: number;
  commandId: string;
  processedAt: string;
}) {
  return executeLeagueCommand({
    commandValue: command({
      commandId: input.commandId,
      commandType: "accept_league_invitation",
      actorUserId: input.userId,
      leagueId: input.receipt.leagueId,
      seasonId: input.receipt.seasonId,
      expectedRevision: input.expectedRevision,
      payload: {
        invitationId: String(input.receipt.result.invitationId),
        token: String(input.receipt.result.token),
      },
      reason: "Accept league invitation",
      clientCreatedAt: input.processedAt,
    }),
    actorUserId: input.userId,
    actorEmail: input.email,
    store: input.store,
    processedAt: input.processedAt,
  });
}

describe("native league membership commands", () => {
  it("provisions published team slots and grants email-bound team ownership exactly once", async () => {
    const store = new LeagueCommandMemoryStore();
    const { created, published, teamPaths, franchiseId } = await createPublishedLeague(store);
    expect(published.result).toMatchObject({ teamCount: 12, createdTeamCount: 12 });
    expect(teamPaths).toHaveLength(12);

    const invitation = await executeLeagueCommand({
      commandValue: invitationCommand({
        commandId: "30000000-0000-4000-8000-000000000003",
        leagueId: created.leagueId,
        seasonId: created.seasonId,
        expectedRevision: 2,
        email: "manager@example.com",
        displayName: "Manager One",
        franchiseId,
      }),
      actorUserId: commissionerId,
      actorEmail: commissionerEmail,
      store,
      processedAt: "2026-09-03T00:02:01.000Z",
    });
    await expect(acceptInvitation({
      store,
      receipt: invitation,
      userId: "wrong-manager",
      email: "wrong@example.com",
      expectedRevision: 3,
      commandId: "40000000-0000-4000-8000-000000000004",
      processedAt: "2026-09-03T00:03:00.000Z",
    })).rejects.toMatchObject({ code: "invitation_email_mismatch" });

    const accepted = await acceptInvitation({
      store,
      receipt: invitation,
      userId: "manager-1",
      email: "Manager@Example.com",
      expectedRevision: 3,
      commandId: "50000000-0000-4000-8000-000000000005",
      processedAt: "2026-09-03T00:03:01.000Z",
    });
    expect(store.read(`leagues/${created.leagueId}/memberships/manager-1`)).toMatchObject({
      status: "active",
      email: "manager@example.com",
      role_grant_ids: [`manager-1__team_owner__${franchiseId}`],
    });
    expect(store.read(`leagues/${created.leagueId}/roleGrants/manager-1__team_owner__${franchiseId}`)).toMatchObject({ role: "team_owner", franchise_id: franchiseId, revoked_at: "" });
    expect(store.read(`leagues/${created.leagueId}/invitations/${String(invitation.result.invitationId)}`)).toMatchObject({ status: "accepted", accepted_by: "manager-1" });

    const retry = await acceptInvitation({
      store,
      receipt: invitation,
      userId: "manager-1",
      email: "manager@example.com",
      expectedRevision: 3,
      commandId: accepted.commandId,
      processedAt: "2026-09-03T00:04:00.000Z",
    });
    expect(retry).toEqual(accepted);
  });

  it("allows a co-manager when published policy permits and removes all grants with an audit reason", async () => {
    const store = new LeagueCommandMemoryStore();
    const { created, franchiseId } = await createPublishedLeague(store, "10000000-0000-4000-8000-000000000011");
    const ownerInvite = await executeLeagueCommand({
      commandValue: invitationCommand({ commandId: "30000000-0000-4000-8000-000000000013", leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 2, email: "owner@example.com", displayName: "Team Owner", franchiseId }),
      actorUserId: commissionerId,
      store,
      processedAt: "2026-09-03T00:02:01.000Z",
    });
    await acceptInvitation({ store, receipt: ownerInvite, userId: "owner-1", email: "owner@example.com", expectedRevision: 3, commandId: "40000000-0000-4000-8000-000000000014", processedAt: "2026-09-03T00:03:00.000Z" });
    const coManagerInvite = await executeLeagueCommand({
      commandValue: invitationCommand({ commandId: "50000000-0000-4000-8000-000000000015", leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 4, email: "co@example.com", displayName: "Co Manager", franchiseId, role: "co_manager" }),
      actorUserId: commissionerId,
      store,
      processedAt: "2026-09-03T00:04:00.000Z",
    });
    await acceptInvitation({ store, receipt: coManagerInvite, userId: "co-manager-1", email: "co@example.com", expectedRevision: 5, commandId: "60000000-0000-4000-8000-000000000016", processedAt: "2026-09-03T00:05:00.000Z" });
    expect(store.read(`leagues/${created.leagueId}/roleGrants/co-manager-1__co_manager__${franchiseId}`)).toMatchObject({ role: "co_manager", revoked_at: "" });

    await expect(executeLeagueCommand({
      commandValue: command({
        commandId: "70000000-0000-4000-8000-000000000017",
        commandType: "remove_league_member",
        actorUserId: commissionerId,
        leagueId: created.leagueId,
        seasonId: created.seasonId,
        expectedRevision: 6,
        payload: { userId: "co-manager-1" },
        reason: "",
        clientCreatedAt: "2026-09-03T00:06:00.000Z",
      }),
      actorUserId: commissionerId,
      store,
      processedAt: "2026-09-03T00:06:01.000Z",
    })).rejects.toMatchObject({ code: "reason_required" });

    await executeLeagueCommand({
      commandValue: command({
        commandId: "80000000-0000-4000-8000-000000000018",
        commandType: "remove_league_member",
        actorUserId: commissionerId,
        leagueId: created.leagueId,
        seasonId: created.seasonId,
        expectedRevision: 6,
        payload: { userId: "co-manager-1" },
        reason: "Manager requested access removal",
        clientCreatedAt: "2026-09-03T00:06:02.000Z",
      }),
      actorUserId: commissionerId,
      store,
      processedAt: "2026-09-03T00:06:03.000Z",
    });
    expect(store.read(`leagues/${created.leagueId}/memberships/co-manager-1`)).toMatchObject({ status: "removed" });
    expect(store.read(`leagues/${created.leagueId}/roleGrants/co-manager-1__co_manager__${franchiseId}`)?.revoked_at).toBe("2026-09-03T00:06:03.000Z");
  });

  it("lets a co-commissioner invite managers but not appoint another co-commissioner", async () => {
    const store = new LeagueCommandMemoryStore();
    const { created, franchiseId } = await createPublishedLeague(store, "10000000-0000-4000-8000-000000000021");
    const coCommissionerInvite = await executeLeagueCommand({
      commandValue: invitationCommand({ commandId: "30000000-0000-4000-8000-000000000023", leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 2, email: "cocommish@example.com", displayName: "Co Commissioner", franchiseId: "", role: "co_commissioner" }),
      actorUserId: commissionerId,
      store,
      processedAt: "2026-09-03T00:02:01.000Z",
    });
    await acceptInvitation({ store, receipt: coCommissionerInvite, userId: "co-commissioner-1", email: "cocommish@example.com", expectedRevision: 3, commandId: "40000000-0000-4000-8000-000000000024", processedAt: "2026-09-03T00:03:00.000Z" });

    const managerInvite = await executeLeagueCommand({
      commandValue: invitationCommand({ commandId: "50000000-0000-4000-8000-000000000025", leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 4, email: "manager2@example.com", displayName: "Manager Two", franchiseId, actorUserId: "co-commissioner-1" }),
      actorUserId: "co-commissioner-1",
      actorEmail: "cocommish@example.com",
      store,
      processedAt: "2026-09-03T00:04:00.000Z",
    });
    expect(managerInvite.result).toMatchObject({ role: "team_owner", franchiseId });

    await expect(executeLeagueCommand({
      commandValue: invitationCommand({ commandId: "60000000-0000-4000-8000-000000000026", leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 5, email: "another@example.com", displayName: "Another Commissioner", franchiseId: "", role: "co_commissioner", actorUserId: "co-commissioner-1" }),
      actorUserId: "co-commissioner-1",
      actorEmail: "cocommish@example.com",
      store,
      processedAt: "2026-09-03T00:05:00.000Z",
    })).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("allows only one invitation mutation from a shared season revision", async () => {
    const store = new LeagueCommandMemoryStore();
    const { created, franchiseId } = await createPublishedLeague(store, "10000000-0000-4000-8000-000000000031");
    const base = { leagueId: created.leagueId, seasonId: created.seasonId, expectedRevision: 2, franchiseId };
    const results = await Promise.allSettled([
      executeLeagueCommand({ commandValue: invitationCommand({ ...base, commandId: "30000000-0000-4000-8000-000000000033", email: "left@example.com", displayName: "Left Manager" }), actorUserId: commissionerId, store, processedAt: "2026-09-03T00:02:01.000Z" }),
      executeLeagueCommand({ commandValue: invitationCommand({ ...base, commandId: "40000000-0000-4000-8000-000000000034", email: "right@example.com", displayName: "Right Manager" }), actorUserId: commissionerId, store, processedAt: "2026-09-03T00:02:01.000Z" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason).toMatchObject({ code: "stale_revision", currentRevision: 3 });
    expect(store.paths().filter((path) => path.includes("/invitations/"))).toHaveLength(1);
  });
});
