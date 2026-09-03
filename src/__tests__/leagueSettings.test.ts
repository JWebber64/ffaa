import { describe, expect, it } from "vitest";

import {
  buildLeagueConstitution,
  createRedraftLeagueSettings,
  parseLeagueSettings,
  simulateLeagueSettings,
  validateLeagueSettings,
} from "../../shared/leagueSettings";

describe("native league settings", () => {
  it("ships a valid deterministic redraft template and impact preview", () => {
    const settings = createRedraftLeagueSettings("Asia/Taipei");
    expect(validateLeagueSettings(settings)).toEqual([]);
    expect(simulateLeagueSettings(settings)).toEqual({
      teams: 12,
      startersPerTeam: 9,
      benchPerTeam: 6,
      reservePerTeam: 1,
      draftedPlayers: 180,
      matchupsPerWeek: 6,
      byeTeamsPerWeek: 0,
      playoffByes: 2,
      auctionPool: null,
    });
    expect(buildLeagueConstitution(settings).map((section) => section.title)).toEqual([
      "League membership",
      "Roster and draft",
      "Scoring",
      "Schedule and playoffs",
      "Waivers and trades",
      "Lineups and time",
    ]);
  });

  it("reports cross-field errors instead of silently creating an unplayable league", () => {
    const settings = createRedraftLeagueSettings("UTC");
    settings.teamCount = 4;
    settings.schedule.playoffTeams = 6;
    settings.transactions.tradeDeadlineWeek = 15;
    settings.schedule.regularSeasonWeeks = 14;
    settings.lineup.lineupWeekCount = 12;
    const fields = validateLeagueSettings(settings).map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining([
      "schedule.playoffTeams",
      "transactions.tradeDeadlineWeek",
      "lineup.lineupWeekCount",
    ]));
  });

  it("marks an unknown or legacy document as needing a current template save", () => {
    const parsed = parseLeagueSettings({ setup_complete: false }, "UTC");
    expect(parsed.settings.leagueType).toBe("redraft");
    expect(parsed.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["schemaVersion", "leagueType"]));
  });
});
