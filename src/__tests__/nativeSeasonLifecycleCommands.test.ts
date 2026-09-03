import { describe, expect, it } from "vitest";

import type { LeagueCommand } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "12121212-1212-4121-8121-121212121212";
const seasonId = "34343434-3434-4343-8343-343434343434";
const actorUserId = "commissioner-1";
const teamOne = "56565656-5656-4565-8565-565656565656";
const teamTwo = "78787878-7878-4787-8787-787878787878";

function seed() {
  const store = new LeagueCommandMemoryStore();
  store.seed(`leagues/${leagueId}`, { schema_version: 1, id: leagueId, name: "Lifecycle League", timezone: "America/New_York", status: "active", authority_mode: "native", current_season_id: seasonId, revision: 4 });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { schema_version: 1, id: seasonId, league_id: leagueId, year: 2026, phase: "playoffs", revision: 4, settings_version_id: "settings-live", draft_settings_version_id: "", draft_id: "draft-1", schedule_version_id: "schedule-1" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-live`, { schema_version: 1, id: "settings-live", league_id: leagueId, season_id: seasonId, status: "published", settings: createRedraftLeagueSettings("America/New_York") });
  store.seed(`leagues/${leagueId}/memberships/${actorUserId}`, { league_id: leagueId, user_id: actorUserId, status: "active", role_grant_ids: [`${actorUserId}__commissioner`] });
  store.seed(`leagues/${leagueId}/roleGrants/${actorUserId}__commissioner`, { id: `${actorUserId}__commissioner`, league_id: leagueId, user_id: actorUserId, role: "commissioner", effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" });
  for (const [index, franchiseId] of [teamOne, teamTwo].entries()) {
    store.seed(`leagues/${leagueId}/franchises/${franchiseId}`, { id: franchiseId, league_id: leagueId, created_at: "2026-01-01T00:00:00.000Z", retired_at: "" });
    store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${franchiseId}`, { schema_version: 1, id: franchiseId, league_id: leagueId, season_id: seasonId, franchise_id: franchiseId, name: `Team ${index + 1}`, logo_url: "", colors: { primary: "", secondary: "" }, division_id: "", draft_position: index + 1, budget: {}, cap: {}, roster_revision: 2, roster_player_ids: [`player-${index + 1}`], status: "active" });
  }
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/standings/current`, { revision: 3, rows: [{ franchise_id: teamOne, seed: 1 }, { franchise_id: teamTwo, seed: 2 }] });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/playoffBrackets/current`, { revision: 2, qualifiers: [teamOne, teamTwo], games: [{ id: "championship", home_franchise_id: teamOne, away_franchise_id: teamTwo }] });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/matchupResults/championship`, { game_id: "championship", home_franchise_id: teamOne, away_franchise_id: teamTwo, status: "final" });
  return store;
}

function command<T extends LeagueCommand["commandType"]>(value: LeagueCommand<T>) { return value; }

describe("native season lifecycle commands", () => {
  it("awards a playoff qualifier, archives the immutable season, exports it, and renews permanent franchises", async () => {
    const store = seed();
    const champion = await executeLeagueCommand({ commandValue: command({ commandId: "10101010-1010-4010-8010-101010101010", commandType: "award_native_champion", actorUserId, leagueId, seasonId, expectedRevision: 4, payload: { championFranchiseId: teamOne, runnerUpFranchiseId: teamTwo, expectedStandingsRevision: 3, expectedBracketRevision: 2 }, reason: "Confirm the completed championship result", clientCreatedAt: "2026-12-30T00:00:00.000Z" }), actorUserId, store, processedAt: "2026-12-30T00:00:01.000Z" });
    expect(champion.result).toMatchObject({ championFranchiseId: teamOne, status: "awarded" });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}`)).toMatchObject({ phase: "complete", revision: 5, champion_franchise_id: teamOne });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonAwards/champion`)).toMatchObject({ champion_franchise_id: teamOne, runner_up_franchise_id: teamTwo });

    const archived = await executeLeagueCommand({ commandValue: command({ commandId: "20202020-2020-4020-8020-202020202020", commandType: "archive_native_season", actorUserId, leagueId, seasonId, expectedRevision: 5, payload: { championFranchiseId: teamOne }, reason: "Close the final audited 2026 season", clientCreatedAt: "2026-12-31T00:00:00.000Z" }), actorUserId, store, processedAt: "2026-12-31T00:00:01.000Z" });
    expect(archived.result).toMatchObject({ archiveId: seasonId, status: "archived" });
    expect(store.read(`leagues/${leagueId}/seasonArchives/${seasonId}`)).toMatchObject({ champion_franchise_id: teamOne, counts: { seasonTeams: 2, matchupResults: 1 } });
    expect(store.read(`leagues/${leagueId}`)).toMatchObject({ status: "archived" });

    const exported = await executeLeagueCommand({ commandValue: command({ commandId: "30303030-3030-4030-8030-303030303030", commandType: "export_native_league", actorUserId, leagueId, seasonId, expectedRevision: 6, payload: { includePrivateAudit: true }, reason: "Create private native league data export", clientCreatedAt: "2026-12-31T00:01:00.000Z" }), actorUserId, store, processedAt: "2026-12-31T00:01:01.000Z" });
    const exportId = String(exported.result.exportId);
    const chunks = store.paths().filter((path) => path.startsWith(`leagues/${leagueId}/leagueExports/${exportId}/chunks/`)).map((path) => store.read(path)).sort((left, right) => Number(left?.index) - Number(right?.index));
    const snapshot = JSON.parse(chunks.map((entry) => String(entry?.content ?? "")).join("")) as { seasonCollections: { seasonAwards: unknown[] } };
    expect(snapshot.seasonCollections.seasonAwards).toHaveLength(1);
    expect(store.read(`leagues/${leagueId}/leagueExports/${exportId}`)).toMatchObject({ created_by: actorUserId, chunk_count: chunks.length });

    const renewed = await executeLeagueCommand({ commandValue: command({ commandId: "40404040-4040-4040-8040-404040404040", commandType: "renew_native_league", actorUserId, leagueId, seasonId, expectedRevision: 6, payload: { year: 2027 }, reason: "Open the next league season for managers", clientCreatedAt: "2027-01-02T00:00:00.000Z" }), actorUserId, store, processedAt: "2027-01-02T00:00:01.000Z" });
    const newSeasonId = String(renewed.result.seasonId);
    expect(newSeasonId).not.toBe(seasonId);
    expect(store.read(`leagues/${leagueId}`)).toMatchObject({ current_season_id: newSeasonId, status: "draft" });
    expect(store.read(`leagues/${leagueId}/seasons/${newSeasonId}`)).toMatchObject({ year: 2027, phase: "setup", renewed_from_season_id: seasonId });
    expect(store.read(`leagues/${leagueId}/seasons/${newSeasonId}/seasonTeams/${teamOne}`)).toMatchObject({ roster_player_ids: [], roster_revision: 1, name: "Team 1" });
    expect(store.read(`leagues/${leagueId}/settingsVersions/${String(renewed.result.draftSettingsVersionId)}`)).toMatchObject({ status: "draft", carried_from_settings_version_id: "settings-live" });
  });

  it("rejects stale playoff evidence and non-commissioner export access without writing partial state", async () => {
    const store = seed();
    await expect(executeLeagueCommand({ commandValue: command({ commandId: "50505050-5050-4050-8050-505050505050", commandType: "award_native_champion", actorUserId, leagueId, seasonId, expectedRevision: 4, payload: { championFranchiseId: teamOne, runnerUpFranchiseId: teamTwo, expectedStandingsRevision: 2, expectedBracketRevision: 2 }, reason: "Confirm the completed championship result", clientCreatedAt: "2026-12-30T00:00:00.000Z" }), actorUserId, store, processedAt: "2026-12-30T00:00:01.000Z" })).rejects.toMatchObject({ code: "standings_changed" });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/seasonAwards/champion`)).toBeNull();
    await expect(executeLeagueCommand({ commandValue: command({ commandId: "60606060-6060-4060-8060-606060606060", commandType: "export_native_league", actorUserId: "manager-1", leagueId, seasonId, expectedRevision: 4, payload: { includePrivateAudit: true }, reason: "Create private native league data export", clientCreatedAt: "2026-12-30T00:00:00.000Z" }), actorUserId: "manager-1", store, processedAt: "2026-12-30T00:00:01.000Z" })).rejects.toMatchObject({ code: "permission_denied" });
    expect(store.paths().some((path) => path.includes("/leagueExports/"))).toBe(false);
  });
});
