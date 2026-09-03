import { describe, expect, it } from "vitest";

import type { IngestScoringEventsPayload, LeagueCommand } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { executeLeagueCommand } from "../../server/league-commands/executeLeagueCommand";
import { LeagueCommandMemoryStore } from "./helpers/leagueCommandMemoryStore";

const leagueId = "a1111111-1111-4111-8111-111111111111";
const seasonId = "a2222222-2222-4222-8222-222222222222";
const commissionerId = "scoring-commissioner";
const teamOne = "a3333333-3333-4333-8333-333333333333";
const teamTwo = "a4444444-4444-4444-8444-444444444444";
let sequence = 0;
function id() { sequence += 1; return `a5000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`; }

function seed() {
  const store = new LeagueCommandMemoryStore();
  const settings = createRedraftLeagueSettings("America/New_York");
  settings.teamCount = 4; settings.schedule.playoffTeams = 4;
  store.seed(`leagues/${leagueId}`, { id: leagueId, name: "Scoring Lab", timezone: settings.timezone, authority_mode: "native", current_season_id: seasonId, status: "active", revision: 1 });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}`, { id: seasonId, league_id: leagueId, phase: "regular_season", revision: 1, settings_version_id: "settings-live" });
  store.seed(`leagues/${leagueId}/settingsVersions/settings-live`, { id: "settings-live", status: "published", settings });
  store.seed(`leagues/${leagueId}/memberships/${commissionerId}`, { user_id: commissionerId, status: "active", role_grant_ids: [`${commissionerId}__commissioner`] });
  store.seed(`leagues/${leagueId}/roleGrants/${commissionerId}__commissioner`, { user_id: commissionerId, role: "commissioner", franchise_id: "", effective_at: "2026-01-01T00:00:00.000Z", expires_at: "", revoked_at: "" });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teamOne}`, { id: teamOne, franchise_id: teamOne, name: "Receivers", roster_player_ids: ["wr-1", "qb-bench"], roster_revision: 1, status: "active" });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/seasonTeams/${teamTwo}`, { id: teamTwo, franchise_id: teamTwo, name: "Passers", roster_player_ids: ["qb-2", "wr-bench"], roster_revision: 1, status: "active" });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/lineupWeeks/week-1`, { id: "week-1", revision: 1, players: [
    { player_id: "wr-1", position: "WR", game_id: "game-1", projected_points: 8 }, { player_id: "qb-bench", position: "QB", game_id: "game-1", projected_points: 4 },
    { player_id: "qb-2", position: "QB", game_id: "game-2", projected_points: 6 }, { player_id: "wr-bench", position: "WR", game_id: "game-2", projected_points: 3 },
  ] });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/lineups/${teamOne}_week-1`, { franchise_id: teamOne, week: 1, assignments: { "WR-1": "wr-1", "QB-1": "qb-bench" } });
  store.seed(`leagues/${leagueId}/seasons/${seasonId}/lineups/${teamTwo}_week-1`, { franchise_id: teamTwo, week: 1, assignments: { "QB-1": "qb-2", "WR-1": "wr-bench" } });
  return store;
}

function payload(expectedScoringWeekRevision: number, events: IngestScoringEventsPayload["events"], withMatchup = false): IngestScoringEventsPayload {
  return {
    week: 1, expectedScoringWeekRevision, providerKey: "fixture", fallbackProviderKey: "fixture-backup", providerState: "live", ingestionVersion: "fixture-v1",
    ...(withMatchup ? { matchups: [{ matchupId: "m-1", awayFranchiseId: teamOne, homeFranchiseId: teamTwo }] } : {}),
    gameStatuses: [{ nflGameId: "game-1", status: "final" }, { nflGameId: "game-2", status: "final" }], events,
  };
}

async function ingest(store: LeagueCommandMemoryStore, expectedScoringWeekRevision: number, events: IngestScoringEventsPayload["events"], reason = "", withMatchup = false) {
  const command: LeagueCommand<"ingest_scoring_events"> = { commandId: id(), commandType: "ingest_scoring_events", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: payload(expectedScoringWeekRevision, events, withMatchup), reason, clientCreatedAt: "2026-09-13T17:00:00.000Z" };
  return executeLeagueCommand({ commandValue: command, actorUserId: commissionerId, store, processedAt: "2026-09-13T17:00:10.000Z" });
}

describe("native scoring commands", () => {
  it("deduplicates provider IDs and preserves the same player and matchup total", async () => {
    const store = seed();
    const reception = { providerEventId: "evt-1", providerTimestamp: "2026-09-13T17:00:05.000Z", occurredAt: "2026-09-13T17:00:04.000Z", playerId: "wr-1", nflGameId: "game-1", statistics: [{ statistic: "receiving_yards" as const, value: 18 }, { statistic: "receptions" as const, value: 1 }], description: "18-yard reception" };
    await ingest(store, 0, [reception], "", true);
    const duplicate = await ingest(store, 1, [reception]);
    expect(duplicate.result).toMatchObject({ acceptedEvents: 0, duplicateEvents: 1, settingsVersionId: "settings-live" });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-1`)).toMatchObject({ player_totals: { "wr-1": 2.3 }, matchups: [{ away_score: 2.3 }], event_count: 1, scoring_rule_version_id: "settings-live" });
  });

  it("applies an explicit correction and rebuilds player, matchup, and projected-standing output", async () => {
    const store = seed();
    await ingest(store, 0, [
      { providerEventId: "evt-wr", providerTimestamp: "2026-09-13T17:00:02.000Z", occurredAt: "2026-09-13T17:00:01.000Z", playerId: "wr-1", nflGameId: "game-1", statistics: [{ statistic: "receiving_yards", value: 18 }, { statistic: "receptions", value: 1 }], description: "18-yard reception" },
      { providerEventId: "evt-qb", providerTimestamp: "2026-09-13T17:00:04.000Z", occurredAt: "2026-09-13T17:00:03.000Z", playerId: "qb-2", nflGameId: "game-2", statistics: [{ statistic: "passing_yards", value: 50 }], description: "50 passing yards" },
    ], "", true);
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-1`)).toMatchObject({ matchups: [{ away_score: 2.3, home_score: 2 }], standings_projection: expect.any(Array) });
    await ingest(store, 1, [{ providerEventId: "evt-wr-corrected", providerTimestamp: "2026-09-13T17:00:08.000Z", occurredAt: "2026-09-13T17:00:01.000Z", playerId: "wr-1", nflGameId: "game-1", statistics: [{ statistic: "receiving_yards", value: 8 }, { statistic: "receptions", value: 1 }], description: "Corrected to 8-yard reception", correctionOfProviderEventId: "evt-wr" }], "Official scorer corrected the reception");
    const week = store.read(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-1`);
    expect(week).toMatchObject({ player_totals: { "wr-1": 1.3, "qb-2": 2 }, matchups: [{ away_score: 1.3, home_score: 2 }], stat_correction_state: "corrected", correction_count: 1, standings_projection: [{ franchise_id: teamTwo, projected_outcome: "loss" }, { franchise_id: teamOne, projected_outcome: "win" }] });
    const replayCommand: LeagueCommand<"recalculate_scoring_week"> = { commandId: id(), commandType: "recalculate_scoring_week", actorUserId: commissionerId, leagueId, seasonId, expectedRevision: 1, payload: { week: 1, expectedScoringWeekRevision: 2 }, reason: "Replay after verified correction", clientCreatedAt: "2026-09-13T17:01:00.000Z" };
    const replay = await executeLeagueCommand({ commandValue: replayCommand, actorUserId: commissionerId, store, processedAt: "2026-09-13T17:01:01.000Z" });
    expect(store.read(`leagues/${leagueId}/seasons/${seasonId}/scoringWeeks/week-1`)).toMatchObject({ revision: 3, player_totals: { "wr-1": 1.3, "qb-2": 2 } });
    expect(store.read(`leagues/${leagueId}/auditEvents/${text(replay.auditEventId)}`)).toMatchObject({ action: "scoring_week_recalculated", settings_version_id: "settings-live" });
  });
});

function text(value: unknown) { return typeof value === "string" ? value : ""; }
