import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "ffaa-league-season-rules";
const leagueId = "1385319428408774656";
const commissionerId = "commissioner-1";
const managerId = "manager-1";
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

let testEnvironment: RulesTestEnvironment;
type TestFirestore = ReturnType<RulesTestContext["firestore"]>;

function firestoreFor(userId: string, provider: "google.com" | "anonymous" = "google.com") {
  return testEnvironment.authenticatedContext(userId, {
    firebase: { sign_in_provider: provider },
  }).firestore();
}

function seasonDocument() {
  return {
    version: 1,
    league_id: leagueId,
    commissioner_user_id: commissionerId,
    source_draft_revision: 7,
    payload: {
      config: {
        defaultBudget: 200,
        scoring: "ppr",
        rosterSlots: [{ slot: "QB", count: 1 }, { slot: "BENCH", count: 1 }],
        isOpen: true,
      },
      teams: [
        { teamId: "team-1", teamNumber: 1, name: "Clay", budget: 200, roster: [{ playerId: "qb-1", name: "Quarterback", pos: "QB", price: 20 }] },
        { teamId: "team-2", teamNumber: 2, name: "Rival", budget: 200, roster: [] },
      ],
    },
    schedule: [{ id: "week-1-team-1-team-2", week: 1, homeFranchiseId: "team-1", awayFranchiseId: "team-2" }],
    franchise_ids: ["team-1", "team-2"],
    revision: 1,
    created_at: "2026-08-31T00:00:00.000Z",
    published_at: "2026-08-31T00:01:00.000Z",
    updated_at: "2026-08-31T00:01:00.000Z",
  };
}

function claimDocument(status: "requested" | "approved" = "requested") {
  return {
    league_id: leagueId,
    franchise_id: "team-1",
    franchise_name: "Clay",
    requested_by_user_id: managerId,
    requested_display_name: "Clay Manager",
    status,
    approved_user_id: status === "approved" ? managerId : "",
    requested_at: "2026-08-31T00:02:00.000Z",
    approved_at: status === "approved" ? "2026-08-31T00:03:00.000Z" : "",
    updated_at: status === "approved" ? "2026-08-31T00:03:00.000Z" : "2026-08-31T00:02:00.000Z",
  };
}

function membershipDocument(status: "requested" | "approved" = "requested") {
  return {
    league_id: leagueId,
    user_id: managerId,
    franchise_id: "team-1",
    franchise_name: "Clay",
    display_name: "Clay Manager",
    status,
    requested_at: "2026-08-31T00:02:00.000Z",
    approved_at: status === "approved" ? "2026-08-31T00:03:00.000Z" : "",
    updated_at: status === "approved" ? "2026-08-31T00:03:00.000Z" : "2026-08-31T00:02:00.000Z",
  };
}

async function seedSavedDraft() {
  await testEnvironment.withSecurityRulesDisabled(async (context: RulesTestContext) => {
    await context.firestore().doc(`offlineLeagueDrafts/${leagueId}`).set({
      league_id: leagueId,
      owner_user_id: commissionerId,
      revision: 7,
    });
  });
}

async function publishSeason(firestore: TestFirestore) {
  await firestore.doc(`leagueSeasons/${leagueId}`).set(seasonDocument());
}

async function requestAndApproveTeam() {
  const manager = firestoreFor(managerId);
  const requestBatch = manager.batch();
  requestBatch.set(manager.doc(`leagueSeasons/${leagueId}/franchiseClaims/team-1`), claimDocument());
  requestBatch.set(manager.doc(`leagueSeasons/${leagueId}/managerMemberships/${managerId}`), membershipDocument());
  await requestBatch.commit();

  const commissioner = firestoreFor(commissionerId);
  const approvalBatch = commissioner.batch();
  approvalBatch.set(commissioner.doc(`leagueSeasons/${leagueId}/franchiseClaims/team-1`), claimDocument("approved"));
  approvalBatch.set(commissioner.doc(`leagueSeasons/${leagueId}/managerMemberships/${managerId}`), membershipDocument("approved"));
  await approvalBatch.commit();
}

function lineupDocument(actorUserId: string, auditEventId: string, revision = 1) {
  return {
    league_id: leagueId,
    franchise_id: "team-1",
    week: 1,
    week_key: "week-1",
    season_revision: 1,
    assignments: { "QB-0": "qb-1" },
    revision,
    audit_event_id: auditEventId,
    updated_by_user_id: actorUserId,
    created_at: "2026-08-31T00:04:00.000Z",
    updated_at: revision === 1 ? "2026-08-31T00:04:00.000Z" : "2026-08-31T00:06:00.000Z",
  };
}

function auditDocument(actorUserId: string, eventId: string, type: "lineup_saved" | "lineup_override", reason = "") {
  return {
    league_id: leagueId,
    event_id: eventId,
    lineup_id: "team-1_week_1",
    type,
    actor_user_id: actorUserId,
    franchise_id: "team-1",
    week: 1,
    week_key: "week-1",
    season_revision: 1,
    before_assignments: type === "lineup_saved" ? {} : { "QB-0": "qb-1" },
    after_assignments: { "QB-0": "qb-1" },
    reason,
    created_at: type === "lineup_saved" ? "2026-08-31T00:04:00.000Z" : "2026-08-31T00:06:00.000Z",
  };
}

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeWithEmulator("league season Firestore security", () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seedSavedDraft();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("requires a durable account to publish the saved draft", async () => {
    await assertFails(publishSeason(firestoreFor(commissionerId, "anonymous")));
    await assertSucceeds(publishSeason(firestoreFor(commissionerId)));
  });

  it("requires an atomic one-team membership alongside every franchise claim", async () => {
    const commissioner = firestoreFor(commissionerId);
    await publishSeason(commissioner);
    const manager = firestoreFor(managerId);

    await assertFails(manager.doc(`leagueSeasons/${leagueId}/franchiseClaims/team-1`).set(claimDocument()));

    const requestBatch = manager.batch();
    requestBatch.set(manager.doc(`leagueSeasons/${leagueId}/franchiseClaims/team-1`), claimDocument());
    requestBatch.set(manager.doc(`leagueSeasons/${leagueId}/managerMemberships/${managerId}`), membershipDocument());
    await assertSucceeds(requestBatch.commit());

    const secondClaim = { ...claimDocument(), franchise_id: "team-2", franchise_name: "Rival" };
    const secondMembership = { ...membershipDocument(), franchise_id: "team-2", franchise_name: "Rival" };
    const secondBatch = manager.batch();
    secondBatch.set(manager.doc(`leagueSeasons/${leagueId}/franchiseClaims/team-2`), secondClaim);
    secondBatch.set(manager.doc(`leagueSeasons/${leagueId}/managerMemberships/${managerId}`), secondMembership);
    await assertFails(secondBatch.commit());
  });

  it("routes every weekly lineup and audit mutation through the server command boundary", async () => {
    const commissioner = firestoreFor(commissionerId);
    await publishSeason(commissioner);
    await requestAndApproveTeam();
    const manager = firestoreFor(managerId);

    const openBatch = manager.batch();
    openBatch.set(manager.doc(`leagueSeasons/${leagueId}/lineups/team-1_week_1`), lineupDocument(managerId, "audit-open-1"));
    openBatch.set(manager.doc(`leagueSeasons/${leagueId}/auditEvents/audit-open-1`), auditDocument(managerId, "audit-open-1", "lineup_saved"));
    await assertFails(openBatch.commit());

    await testEnvironment.withSecurityRulesDisabled(async (context: RulesTestContext) => {
      const admin = context.firestore();
      const seedBatch = admin.batch();
      seedBatch.set(admin.doc(`leagueSeasons/${leagueId}/lineups/team-1_week_1`), lineupDocument(managerId, "audit-open-1"));
      seedBatch.set(admin.doc(`leagueSeasons/${leagueId}/auditEvents/audit-open-1`), auditDocument(managerId, "audit-open-1", "lineup_saved"));
      await seedBatch.commit();
    });

    await assertSucceeds(commissioner.doc(`leagueSeasons/${leagueId}/weekSettings/week-1`).set({
      league_id: leagueId,
      week: 1,
      week_key: "week-1",
      locked: true,
      updated_by_user_id: commissionerId,
      created_at: "2026-08-31T00:05:00.000Z",
      updated_at: "2026-08-31T00:05:00.000Z",
    }));

    const blockedBatch = manager.batch();
    blockedBatch.set(manager.doc(`leagueSeasons/${leagueId}/lineups/team-1_week_1`), lineupDocument(managerId, "audit-blocked-1", 2));
    blockedBatch.set(manager.doc(`leagueSeasons/${leagueId}/auditEvents/audit-blocked-1`), auditDocument(managerId, "audit-blocked-1", "lineup_saved"));
    await assertFails(blockedBatch.commit());

    const overrideBatch = commissioner.batch();
    overrideBatch.set(commissioner.doc(`leagueSeasons/${leagueId}/lineups/team-1_week_1`), lineupDocument(commissionerId, "audit-override-1", 2));
    overrideBatch.set(commissioner.doc(`leagueSeasons/${leagueId}/auditEvents/audit-override-1`), auditDocument(commissionerId, "audit-override-1", "lineup_override", "Correcting an injured starter"));
    await assertFails(overrideBatch.commit());

    await assertFails(commissioner.doc(`leagueSeasons/${leagueId}/auditEvents/audit-override-1`).update({ reason: "Changed" }));
    await assertFails(commissioner.doc(`leagueSeasons/${leagueId}/auditEvents/audit-override-1`).delete());
  });
});
