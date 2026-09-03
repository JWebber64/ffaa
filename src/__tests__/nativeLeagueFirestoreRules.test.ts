import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "ffaa-native-league-rules";
const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";
const commissionerId = "commissioner-1";
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
let testEnvironment: RulesTestEnvironment;

function firestoreFor(userId: string, provider: "google.com" | "anonymous" = "google.com") {
  return testEnvironment.authenticatedContext(userId, {
    firebase: { sign_in_provider: provider },
  }).firestore();
}

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeWithEmulator("native league Firestore security", () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({ projectId, firestore: { rules } });
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await testEnvironment.withSecurityRulesDisabled(async (context: RulesTestContext) => {
      const firestore = context.firestore();
      await Promise.all([
        firestore.doc(`externalLeagueMappings/sleeper__1385319428408774656`).set({
          provider: "sleeper",
          external_league_id: "1385319428408774656",
          league_id: leagueId,
        }),
        firestore.doc(`leagues/${leagueId}`).set({
          id: leagueId,
          name: "Native Test League",
          authority_mode: "mirror",
          current_season_id: seasonId,
        }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}`).set({ id: seasonId, league_id: leagueId }),
        firestore.doc(`leagues/${leagueId}/memberships/${commissionerId}`).set({
          league_id: leagueId,
          user_id: commissionerId,
          status: "active",
          role_grant_ids: [`${commissionerId}__commissioner`],
        }),
        firestore.doc(`leagues/${leagueId}/roleGrants/${commissionerId}__commissioner`).set({
          league_id: leagueId,
          user_id: commissionerId,
          role: "commissioner",
        }),
        firestore.doc(`leagues/${leagueId}/settingsVersions/settings-1`).set({
          id: "settings-1",
          league_id: leagueId,
          season_id: seasonId,
          status: "published",
          revision: 1,
        }),
        firestore.doc(`leagues/${leagueId}/auditEvents/audit-1`).set({
          league_id: leagueId,
          actor_user_id: commissionerId,
          action: "league_created",
        }),
      ]);
    });
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("lets a signed-in route resolver read identity but keeps membership private", async () => {
    const anonymous = firestoreFor("anonymous-1", "anonymous");
    await assertSucceeds(anonymous.doc(`externalLeagueMappings/sleeper__1385319428408774656`).get());
    await assertSucceeds(anonymous.doc(`leagues/${leagueId}`).get());
    await assertSucceeds(anonymous.doc(`leagues/${leagueId}/seasons/${seasonId}`).get());
    await assertFails(anonymous.doc(`leagues/${leagueId}/memberships/${commissionerId}`).get());

    const commissioner = firestoreFor(commissionerId);
    await assertSucceeds(commissioner.doc(`leagues/${leagueId}/memberships/${commissionerId}`).get());
    await assertSucceeds(commissioner.doc(`leagues/${leagueId}/roleGrants/${commissionerId}__commissioner`).get());
    await assertSucceeds(commissioner.doc(`leagues/${leagueId}/auditEvents/audit-1`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/settingsVersions`).get());
    await assertFails(firestoreFor("outsider-1").doc(`leagues/${leagueId}/memberships/${commissionerId}`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/settingsVersions`).get());
  });

  it("rejects direct browser writes even from the commissioner", async () => {
    const commissioner = firestoreFor(commissionerId);
    await assertFails(commissioner.doc(`leagues/${leagueId}`).update({ name: "Changed in browser" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/commands/browser-command`).set({ actor_user_id: commissionerId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/auditEvents/browser-audit`).set({ actor_user_id: commissionerId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/lineups/team-1_week-1`).set({ revision: 1 }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/settingsVersions/browser-settings`).set({ league_id: leagueId, status: "draft" }));
  });
});
