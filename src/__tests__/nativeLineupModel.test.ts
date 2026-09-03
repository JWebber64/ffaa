import { describe, expect, it } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { getNativePlayerLock, normalizeNativeLineupWeek, normalizeNativeWeeklyLineup } from "../features/native-lineup/nativeLineup";

const leagueId = "11111111-1111-4111-8111-111111111111";
const seasonId = "22222222-2222-4222-8222-222222222222";

function week(status: "scheduled" | "postponed" | "canceled" = "scheduled") {
  return normalizeNativeLineupWeek({
    league_id: leagueId,
    season_id: seasonId,
    id: "week-1",
    week: 1,
    settings_version_id: "settings-1",
    timezone: "America/New_York",
    revision: 2,
    players: [{ player_id: "player-1", position: "QB", nfl_team: "KC", game_id: "game-1", original_scheduled_start_at: "2026-09-10T00:20:00.000Z", scheduled_start_at: status === "postponed" ? "2026-09-14T00:20:00.000Z" : "2026-09-10T00:20:00.000Z", actual_started_at: "", game_status: status, availability: "active", projected_points: 21.5 }],
    lock_overrides: {},
    updated_at: "2026-09-09T00:00:00.000Z",
  }, leagueId, seasonId, 1)!;
}

describe("native lineup read model", () => {
  it("normalizes persisted revision and substitution lineage", () => {
    expect(normalizeNativeWeeklyLineup({ id: "team-1_week-1", league_id: leagueId, season_id: seasonId, franchise_id: "team-1", week: 1, settings_version_id: "settings-1", season_revision: 3, roster_revision: 4, lineup_week_revision: 2, assignments: { "QB-1": "player-1" }, ordered_fallback_player_ids: ["player-2"], selection_mode: "manual", automatic_substitutions: [{ slot: "QB-1", from: "player-1", to: "player-2" }], revision: 5, updated_at: "now" }, leagueId, seasonId)).toMatchObject({ revision: 5, rosterRevision: 4, assignments: { "QB-1": "player-1" }, automaticSubstitutions: [{ slot: "QB-1", from: "player-1", to: "player-2" }] });
  });

  it("keeps a postponed player open until the rescheduled kickoff", () => {
    const settings = createRedraftLeagueSettings("America/New_York");
    const model = week("postponed");
    expect(getNativePlayerLock(model.players[0]!, model, settings, Date.parse("2026-09-10T01:00:00.000Z"))).toMatchObject({ locked: false, lockAt: "2026-09-14T00:20:00.000Z" });
  });

  it("applies canceled-game and emergency-reopening policies exactly", () => {
    const settings = createRedraftLeagueSettings("America/New_York");
    settings.lineup.canceledGamePolicy = "lock";
    const canceled = week("canceled");
    expect(getNativePlayerLock(canceled.players[0]!, canceled, settings, Date.parse("2026-09-09T00:00:00.000Z"))).toMatchObject({ locked: true, reason: expect.stringContaining("Canceled-game") });
    canceled.lockOverrides["player-1"] = { reopenedUntil: "2026-09-11T00:00:00.000Z", reason: "Official correction", actorUserId: "commissioner" };
    expect(getNativePlayerLock(canceled.players[0]!, canceled, settings, Date.parse("2026-09-10T01:00:00.000Z"))).toMatchObject({ locked: false, reopened: true, reason: "Emergency reopening: Official correction" });
  });
});
