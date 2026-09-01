import { describe, expect, it } from "vitest";

import {
  normalizeFranchiseClaim,
  normalizeLeagueWeekSettings,
  normalizeManagerMembership,
  normalizePublishedLeagueSeasonRecord,
  normalizeSavedLeagueLineup,
} from "../features/league-season/leagueSeasonPersistence";

const leagueId = "1385319428408774656";

function publishedRecord() {
  return {
    league_id: leagueId,
    commissioner_user_id: "commissioner-1",
    source_draft_revision: 7,
    revision: 2,
    created_at: "2026-08-31T00:00:00.000Z",
    published_at: "2026-08-31T00:01:00.000Z",
    updated_at: "2026-08-31T00:01:00.000Z",
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
  };
}

describe("published league season persistence model", () => {
  it("normalizes a published roster snapshot and rejects schedule references outside it", () => {
    const value = publishedRecord();
    value.schedule.push({ id: "bad", week: 1, homeFranchiseId: "team-1", awayFranchiseId: "missing" });
    const record = normalizePublishedLeagueSeasonRecord(value, leagueId);

    expect(record?.commissionerUserId).toBe("commissioner-1");
    expect(record?.season.source).toBe("published");
    expect(record?.season.franchises).toHaveLength(2);
    expect(record?.schedule).toHaveLength(1);
  });

  it("requires an approved user for approved franchise claims", () => {
    const base = {
      league_id: leagueId,
      franchise_id: "team-1",
      franchise_name: "Clay",
      requested_by_user_id: "manager-1",
      requested_display_name: "Clay Manager",
      requested_at: "2026-08-31T00:00:00.000Z",
      approved_at: "",
      updated_at: "2026-08-31T00:00:00.000Z",
    };

    expect(normalizeFranchiseClaim({ ...base, status: "requested", approved_user_id: "" }, leagueId)?.status).toBe("requested");
    expect(normalizeFranchiseClaim({ ...base, status: "approved", approved_user_id: "" }, leagueId)).toBeNull();
    expect(normalizeFranchiseClaim({ ...base, status: "approved", approved_user_id: "manager-1" }, leagueId)?.approvedUserId).toBe("manager-1");
  });

  it("normalizes a bounded weekly lineup record", () => {
    const lineup = normalizeSavedLeagueLineup({
      league_id: leagueId,
      franchise_id: "team-1",
      week: 4,
      week_key: "week-4",
      season_revision: 2,
      assignments: { "QB-0": "qb-1", empty: "" },
      revision: 3,
      updated_by_user_id: "manager-1",
      created_at: "2026-08-31T00:00:00.000Z",
      updated_at: "2026-08-31T00:02:00.000Z",
    }, leagueId);

    expect(lineup?.assignments).toEqual({ "QB-0": "qb-1" });
    expect(lineup?.seasonRevision).toBe(2);
    expect(normalizeSavedLeagueLineup({ ...lineup, week: 19, assignments: {} }, leagueId)).toBeNull();
  });

  it("normalizes the one-team membership and commissioner week lock", () => {
    expect(normalizeManagerMembership({
      league_id: leagueId,
      user_id: "manager-1",
      franchise_id: "team-1",
      franchise_name: "Clay",
      display_name: "Clay Manager",
      status: "approved",
      requested_at: "2026-08-31T00:00:00.000Z",
      approved_at: "2026-08-31T00:01:00.000Z",
      updated_at: "2026-08-31T00:01:00.000Z",
    }, leagueId)).toMatchObject({ userId: "manager-1", franchiseId: "team-1", status: "approved" });

    expect(normalizeLeagueWeekSettings({
      league_id: leagueId,
      week: 4,
      week_key: "week-4",
      locked: true,
      updated_by_user_id: "commissioner-1",
      created_at: "2026-08-31T00:00:00.000Z",
      updated_at: "2026-08-31T00:01:00.000Z",
    }, leagueId)).toMatchObject({ week: 4, locked: true });
  });
});
