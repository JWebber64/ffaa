import { describe, expect, it } from "vitest";

import type { LeagueCommand } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "f1111111-1111-4111-8111-111111111111"; const seasonId = "f2222222-2222-4222-8222-222222222222";
function command(id: string, actorUserId = "commissioner"): LeagueCommand<"initialize_advanced_league_assets"> { return { commandId: id, commandType: "initialize_advanced_league_assets", actorUserId, leagueId, seasonId, expectedRevision: 5, payload: { settingsVersionId: "settings-dynasty" }, reason: "Initialize dynasty ledgers", clientCreatedAt: "2026-09-03T10:00:00.000Z" }; }
function seed(kind: "dynasty" | "redraft" = "dynasty") {
  const store = new LeagueCommandMemoryStore(); const settings = createRedraftLeagueSettings("UTC");
  if (kind === "dynasty") { settings.leagueType = "dynasty"; settings.keeper = { enabled: true, maxKeepers: 30, declarationDeadline: "2026-08-25T18:00:00.000Z", costMode: "auction_salary", baseCost: 5, annualEscalation: 2 }; settings.advanced.enabled = true; }
  store.seed(`leagues/${leagueId}`, { id: leagueId, authority_mode: "native", current_season_id: seasonId, timezone: "UTC" });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, league_id: leagueId, year: 2026, phase: "setup", revision: 5, settings_version_id: "settings-dynasty" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-dynasty`, { id: "settings-dynasty", league_id: leagueId, season_id: seasonId, status: "published", settings });
  for (const franchiseId of ["team-a", "team-b"]) store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`, { franchise_id: franchiseId, status: "active" });
  for (const [userId, role] of [["commissioner", "commissioner"], ["member", "team_owner"]]) { const grantId = `${userId}__${role}`; store.seed(`leagues/${leagueId}/memberships/${userId}`, { user_id: userId, status: "active", role_grant_ids: [grantId] }); store.seed(`leagues/${leagueId}/roleGrants/${grantId}`, { user_id: userId, role, franchise_id: role === "team_owner" ? "team-a" : "", effective_at: "2026-01-01T00:00:00.000Z", revoked_at: "" }); }
  return store;
}
function run(store: LeagueCommandMemoryStore, value: LeagueCommand<"initialize_advanced_league_assets">) { return executeLeagueCommand({ commandValue: value, actorUserId: value.actorUserId, store, processedAt: "2026-09-03T10:00:01.000Z" }); }

describe("Phase 12 advanced league initialization command", () => {
  it("atomically creates permanent pick, salary, orphan, and special-draft ledgers", async () => {
    const store = seed(); const request = command("f5000000-0000-4000-8000-000000000001"); const receipt = await run(store, request);
    expect(receipt.result).toMatchObject({ futurePickCount: 24, draftPlanCount: 2, salaryLedgerCount: 2 });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/advancedLeagueState/current`)).toMatchObject({ settings_version_id: "settings-dynasty", contract_controls_enabled: true });
    expect(store.paths().filter((path) => path.includes("/futureDraftPicks/"))).toHaveLength(24);
    expect(store.paths().filter((path) => path.includes("/salaryLedgers/"))).toHaveLength(2);
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}`)).toMatchObject({ revision: 6, advanced_assets_initialized: true });
    await expect(run(store, request)).resolves.toEqual(receipt);
    expect(store.paths().filter((path) => path.includes("/futureDraftPicks/"))).toHaveLength(24);
  });

  it("rejects team managers and redraft settings without creating partial assets", async () => {
    const memberStore = seed(); await expect(run(memberStore, command("f5000000-0000-4000-8000-000000000002", "member"))).rejects.toMatchObject({ code: "permission_denied" }); expect(memberStore.paths().some((path) => path.includes("/futureDraftPicks/"))).toBe(false);
    const redraftStore = seed("redraft"); await expect(run(redraftStore, command("f5000000-0000-4000-8000-000000000003"))).rejects.toMatchObject({ code: "advanced_settings_required" }); expect(redraftStore.paths().some((path) => path.includes("/advancedLeagueState/"))).toBe(false);
  });

  it("allows exactly one concurrent initialization from the same season revision", async () => {
    const store = seed(); const results = await Promise.allSettled([run(store, command("f5000000-0000-4000-8000-000000000004")), run(store, command("f5000000-0000-4000-8000-000000000005"))]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
    expect(results.find((row) => row.status === "rejected")).toMatchObject({ reason: { code: "advanced_assets_initialized" } });
    expect(store.paths().filter((path) => path.includes("/futureDraftPicks/"))).toHaveLength(24);
    expect(store.paths().filter((path) => path.includes("/commands/"))).toHaveLength(1);
  });
});
