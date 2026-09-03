import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

describe("league season Firestore rules", () => {
  it("keeps synced fantasy-manager profiles private to permanent account owners", () => {
    expect(rules).toMatch(/match \/fantasyManagerProfiles\/\{userId\}/);
    expect(rules).toMatch(/allow get: if permanentUser\(\) && request\.auth\.uid == userId/);
    expect(rules).toMatch(/allow list: if false/);
    expect(rules).toMatch(/connections_json[\s\S]*?size\(\) <= 100000/);
    expect(rules).toMatch(/request\.resource\.data\.updated_at == request\.time/);
  });

  it("keeps season publication with the saved draft owner and future updates with the commissioner", () => {
    expect(rules).toMatch(/match \/leagueSeasons\/\{leagueId\}/);
    expect(rules).toMatch(/get\(savedDraftPath\(\)\)\.data\.owner_user_id == request\.auth\.uid/);
    expect(rules).toMatch(/allow update: if isCommissioner\(\)/);
    expect(rules).toMatch(/request\.resource\.data\.commissioner_user_id == resource\.data\.commissioner_user_id/);
    expect(rules).toMatch(/permanentUser\(\)/);
    expect(rules).toMatch(/'franchise_ids'/);
  });

  it("requires commissioner approval before a requested franchise becomes controllable", () => {
    expect(rules).toMatch(/resource\.data\.status == 'requested'[\s\S]*?request\.resource\.data\.status == 'approved'/);
    expect(rules).toMatch(/request\.resource\.data\.approved_user_id == resource\.data\.requested_by_user_id/);
    expect(rules).toMatch(/get\(claimPath\(franchiseId\)\)\.data\.status == 'approved'/);
    expect(rules).toMatch(/match \/managerMemberships\/\{userId\}/);
    expect(rules).toMatch(/matchingMembershipAfter\(\)/);
  });

  it("routes weekly lineup writes through the server command boundary", () => {
    expect(rules).toMatch(/match \/lineups\/\{lineupId\}/);
    expect(rules).toMatch(/match \/leagueSeasons\/\{leagueId\}[\s\S]*?match \/lineups\/\{lineupId\}[\s\S]*?allow create, update, delete: if false/);
    expect(rules).toMatch(/match \/leagues\/\{leagueId\}[\s\S]*?match \/commands\/\{commandId\}[\s\S]*?allow list, create, update, delete: if false/);
    expect(rules).toMatch(/match \/leagues\/\{leagueId\}[\s\S]*?match \/lineups\/\{lineupId\}[\s\S]*?allow create, update, delete: if false/);
    expect(rules).toMatch(/match \/auditEvents\/\{eventId\}/);
  });
});
