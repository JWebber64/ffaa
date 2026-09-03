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
        firestore.doc(`leagues/${leagueId}/invitations/invite-1`).set({
          league_id: leagueId,
          season_id: seasonId,
          id: "invite-1",
          status: "pending",
          email: "manager@example.com",
        }),
        firestore.doc(`leagues/${leagueId}/memberships/member-1`).set({ league_id: leagueId, user_id: "member-1", status: "active", role_grant_ids: [] }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/tx-1`).set({ league_id: leagueId, season_id: seasonId, id: "tx-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/assetLocks/player__player-1`).set({ league_id: leagueId, season_id: seasonId, asset_id: "player-1", franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/auditPrivate/audit-1`).set({ league_id: leagueId, season_id: seasonId, id: "audit-1", reason: "Private commissioner context" }),
        firestore.doc(`leagues/${leagueId}/pulseEvents/event-1`).set({ league_id: leagueId, season_id: seasonId, id: "event-1", kind: "chat" }),
        firestore.doc(`leagues/${leagueId}/pulseReactions/event-1__member-1`).set({ league_id: leagueId, event_id: "event-1", user_id: "member-1", reaction: "like" }),
        firestore.doc(`leagues/${leagueId}/pulseComments/comment-1`).set({ league_id: leagueId, event_id: "event-1", user_id: "member-1", body: "Ready." }),
        firestore.doc(`leagues/${leagueId}/ruleProposals/proposal-1`).set({ league_id: leagueId, season_id: seasonId, id: "proposal-1", result: "open" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-public`).set({ league_id: leagueId, season_id: seasonId, id: "draft-public", spectator_enabled: true }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-private`).set({ league_id: leagueId, season_id: seasonId, id: "draft-private", spectator_enabled: false }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/lineupWeeks/week-1`).set({ league_id: leagueId, season_id: seasonId, id: "week-1", week: 1, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/lineups/team-1_week-1`).set({ league_id: leagueId, season_id: seasonId, id: "team-1_week-1", franchise_id: "team-1", week: 1, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-1`).set({ league_id: leagueId, season_id: seasonId, id: "week-1", week: 1, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/scoringEvents/event-1`).set({ league_id: leagueId, season_id: seasonId, event_key: "event-1", week: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/scoringEventRevisions/event-1__r-1`).set({ league_id: leagueId, season_id: seasonId, event_key: "event-1", revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverState/current`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/playerStates/player-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "player-1", state: "free_agent" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates/team-1`).set({ league_id: leagueId, season_id: seasonId, franchise_id: "team-1", faab_remaining: 100 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims/claim-member`).set({ league_id: leagueId, season_id: seasonId, id: "claim-member", actor_user_id: "member-1", alternatives: [{ add_player_id: "secret-player", bid: 27 }] }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims/claim-other`).set({ league_id: leagueId, season_id: seasonId, id: "claim-other", actor_user_id: "other-member", alternatives: [{ add_player_id: "other-secret", bid: 31 }] }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverRuns/run-1`).set({ league_id: leagueId, season_id: seasonId, id: "run-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverReceipts/receipt-1`).set({ league_id: leagueId, season_id: seasonId, id: "receipt-1", status: "won" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeOffers/trade-1`).set({ league_id: leagueId, season_id: seasonId, id: "trade-1", status: "sent" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeReceipts/trade-1`).set({ league_id: leagueId, season_id: seasonId, id: "trade-1", processing_result: "completed" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeAssetLocks/player__player-1`).set({ league_id: leagueId, season_id: seasonId, offer_id: "trade-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/draftPickStates/pick__2027-1-team-1`).set({ league_id: leagueId, season_id: seasonId, owner_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeableAssets/keeper_right__player-1`).set({ league_id: leagueId, season_id: seasonId, owner_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/schedule/current`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/scheduleVersions/schedule-1`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/standings/current`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/matchupResults/game-1`).set({ league_id: leagueId, season_id: seasonId, game_id: "game-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/matchupResultRevisions/game-1__r-1`).set({ league_id: leagueId, season_id: seasonId, game_id: "game-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/playoffBrackets/current`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/playoffBracketVersions/bracket-1`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/advancedLeagueState/current`).set({ league_id: leagueId, season_id: seasonId, revision: 1 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/futureDraftPicks/pick-1`).set({ league_id: leagueId, season_id: seasonId, owner_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/keeperAssignments/keeper-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "player-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/playerContracts/contract-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "player-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/deadCapCharges/dead-1`).set({ league_id: leagueId, season_id: seasonId, amount: 4 }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/salaryLedgers/team-1`).set({ league_id: leagueId, season_id: seasonId, franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/taxiAssignments/taxi-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "rookie-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/rfaTenders/tender-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "player-2" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/franchiseTags/tag-1`).set({ league_id: leagueId, season_id: seasonId, player_id: "player-3" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/orphanTeamStates/team-1`).set({ league_id: leagueId, season_id: seasonId, franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/compensatoryPicks/comp-1`).set({ league_id: leagueId, season_id: seasonId, owner_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/advancedDraftPlans/rookie-2027`).set({ league_id: leagueId, season_id: seasonId, kind: "rookie" }),
        firestore.doc(`leagues/${leagueId}/seasons/${seasonId}/seasonAwards/champion`).set({ league_id: leagueId, season_id: seasonId, champion_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/seasonArchives/${seasonId}`).set({ league_id: leagueId, season_id: seasonId, champion_franchise_id: "team-1" }),
        firestore.doc(`leagues/${leagueId}/leagueExports/export-1`).set({ league_id: leagueId, season_id: seasonId, created_by: commissionerId, chunk_count: 1 }),
        firestore.doc(`leagues/${leagueId}/leagueExports/export-1/chunks/0000`).set({ export_id: "export-1", index: 0, content: "{}" }),
        firestore.doc(`nativeDraftShares/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`).set({ league_id: leagueId, season_id: seasonId, draft_id: "draft-public", state: { status: "live" } }),
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
    await assertFails(commissioner.doc(`leagues/${leagueId}/invitations/browser-invite`).set({ league_id: leagueId, status: "pending" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/browser-transaction`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/assetLocks/player__player-2`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/auditPrivate/browser-audit`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/browser-draft`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/lineupWeeks/week-2`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/lineups/team-1_week-2`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-2`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/scoringEvents/event-2`).set({ league_id: leagueId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/playerStates/player-2`).set({ state: "free_agent" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims/browser-claim`).set({ actor_user_id: commissionerId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverReceipts/browser-receipt`).set({ status: "won" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeOffers/browser-offer`).set({ status: "sent" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeReceipts/browser-receipt`).set({ processing_result: "completed" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/tradeAssetLocks/browser-lock`).set({ offer_id: "trade-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/schedule/browser-schedule`).set({ revision: 1 }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/standings/browser-standings`).set({ revision: 1 }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/matchupResults/browser-result`).set({ game_id: "browser-result" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/playoffBrackets/browser-bracket`).set({ revision: 1 }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/pulseEvents/browser-event`).set({ kind: "chat" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/pulseReactions/event-1__${commissionerId}`).set({ reaction: "like" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/pulseComments/browser-comment`).set({ body: "Browser write" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/ruleProposals/browser-proposal`).set({ result: "open" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/advancedLeagueState/browser-state`).set({ revision: 1 }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/futureDraftPicks/browser-pick`).set({ owner_franchise_id: "team-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/playerContracts/browser-contract`).set({ player_id: "player-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/salaryLedgers/browser-ledger`).set({ franchise_id: "team-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/taxiAssignments/browser-taxi`).set({ player_id: "rookie-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasons/${seasonId}/seasonAwards/browser-award`).set({ champion_franchise_id: "team-1" }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/seasonArchives/browser-archive`).set({ season_id: seasonId }));
    await assertFails(commissioner.doc(`leagues/${leagueId}/leagueExports/browser-export`).set({ created_by: commissionerId }));
  });

  it("lets only canonical commissioners list people and invitations", async () => {
    const commissioner = firestoreFor(commissionerId);
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/memberships`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/roleGrants`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/invitations`).get());

    const outsider = firestoreFor("outsider-1");
    await assertFails(outsider.collection(`leagues/${leagueId}/memberships`).get());
    await assertFails(outsider.collection(`leagues/${leagueId}/roleGrants`).get());
    await assertFails(outsider.collection(`leagues/${leagueId}/invitations`).get());
  });

  it("separates member-readable roster receipts from commissioner-only audit metadata", async () => {
    const member = firestoreFor("member-1");
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/assetLocks`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/lineupWeeks`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/lineups`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/scoringEvents`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/playerStates`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverTeamStates`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverReceipts`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims`).where("actor_user_id", "==", "member-1").get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims`).get());
    await assertFails(member.doc(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims/claim-other`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverRuns`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/tradeOffers`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/tradeReceipts`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/draftPickStates`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/tradeableAssets`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/tradeAssetLocks`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/schedule`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/standings`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/matchupResults`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/playoffBrackets`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/scheduleVersions`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/matchupResultRevisions`).get());
    await assertFails(member.collection(`leagues/${leagueId}/seasons/${seasonId}/playoffBracketVersions`).get());
    await assertFails(member.doc(`leagues/${leagueId}/auditPrivate/audit-1`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/pulseEvents`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/pulseReactions`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/pulseComments`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/ruleProposals`).get());
    for (const collectionName of ["advancedLeagueState", "futureDraftPicks", "keeperAssignments", "playerContracts", "deadCapCharges", "salaryLedgers", "taxiAssignments", "rfaTenders", "franchiseTags", "orphanTeamStates", "compensatoryPicks", "advancedDraftPlans"]) await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/${collectionName}`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasons/${seasonId}/seasonAwards`).get());
    await assertSucceeds(member.collection(`leagues/${leagueId}/seasonArchives`).get());
    await assertFails(member.doc(`leagues/${leagueId}/leagueExports/export-1`).get());
    await assertFails(member.collection(`leagues/${leagueId}/leagueExports/export-1/chunks`).get());

    const commissioner = firestoreFor(commissionerId);
    await assertSucceeds(commissioner.doc(`leagues/${leagueId}/auditPrivate/audit-1`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/scoringEvents`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/scoringEventRevisions`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverClaims`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/waiverRuns`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/tradeAssetLocks`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/scheduleVersions`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/matchupResultRevisions`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/seasons/${seasonId}/playoffBracketVersions`).get());
    await assertSucceeds(commissioner.doc(`leagues/${leagueId}/leagueExports/export-1`).get());
    await assertSucceeds(commissioner.collection(`leagues/${leagueId}/leagueExports/export-1/chunks`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/rosterTransactions`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/lineups`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/pulseEvents`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/pulseReactions`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/pulseComments`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/ruleProposals`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/futureDraftPicks`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/playerContracts`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasons/${seasonId}/salaryLedgers`).get());
    await assertFails(firestoreFor("outsider-1").collection(`leagues/${leagueId}/seasonArchives`).get());
    await assertFails(firestoreFor("outsider-1").doc(`leagues/${leagueId}/leagueExports/export-1`).get());
  });

  it("allows exact-link spectators to read enabled draft state without granting writes or private draft access", async () => {
    const anonymous = firestoreFor("anonymous-spectator", "anonymous");
    await assertSucceeds(anonymous.doc("nativeDraftShares/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa").get());
    await assertFails(anonymous.collection("nativeDraftShares").get());
    await assertFails(anonymous.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-public`).get());
    await assertFails(anonymous.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-private`).get());
    await assertFails(anonymous.collection(`leagues/${leagueId}/seasons/${seasonId}/drafts`).get());
    await assertFails(anonymous.doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-public`).update({ status: "complete" }));
    await assertFails(anonymous.doc("nativeDraftShares/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa").update({ updated_at: "later" }));

    await assertSucceeds(firestoreFor("member-1").doc(`leagues/${leagueId}/seasons/${seasonId}/drafts/draft-private`).get());
  });
});
