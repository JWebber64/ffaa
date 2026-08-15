import { describe, expect, it } from "vitest";
import {
  createStarterLeagueHQ,
  getDraftCountdown,
  getLeagueLeaders,
  migrateLegacyProductBranding,
  parseLeagueHQData,
  syncLeagueTeams,
} from "../features/league-hq/leagueHQData";

const starterInput = {
  teams: [
    { id: 1, name: "Night Owls" },
    { id: 2, name: "Fourth & Long" },
  ],
  teamCount: 2,
  baseBudget: 250,
  roster: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, BENCH: 5 },
  nominationSeconds: 25,
  antiSnipeSeconds: 8,
};

describe("League HQ data model", () => {
  it("builds an honest starter file from the active draft configuration", () => {
    const data = createStarterLeagueHQ(starterInput);

    expect(data.managers.map((manager) => manager.teamName)).toEqual(["Night Owls", "Fourth & Long"]);
    expect(data.rules.find((rule) => rule.id === "teams")?.value).toBe("2 teams");
    expect(data.rules.find((rule) => rule.id === "draft")?.value).toBe("$250 budget");
    expect(data.seasons).toEqual([]);
    expect(data.rivalries).toEqual([]);
  });

  it("preserves manager history while syncing the current GameHQ team list", () => {
    const original = createStarterLeagueHQ(starterInput);
    original.managers[0] = { ...original.managers[0]!, titles: 3, wins: 40 };

    const synced = syncLeagueTeams(original, [
      { id: 1, name: "Night Owls" },
      { id: 3, name: "Expansion Club" },
    ]);

    expect(synced.managers).toHaveLength(2);
    expect(synced.managers[0]?.titles).toBe(3);
    expect(synced.managers[0]?.wins).toBe(40);
    expect(synced.managers[1]?.teamName).toBe("Expansion Club");
  });

  it("derives the record-book leaders from imported manager history", () => {
    const data = createStarterLeagueHQ(starterInput);
    data.managers[0] = { ...data.managers[0]!, titles: 2, wins: 20, losses: 10, pointsFor: 3000, playoffWins: 5 };
    data.managers[1] = { ...data.managers[1]!, titles: 1, wins: 9, losses: 1, pointsFor: 900, playoffWins: 2 };

    const leaders = getLeagueLeaders(data);

    expect(leaders.find((leader) => leader.id === "titles")?.managerId).toBe(data.managers[0]?.id);
    expect(leaders.find((leader) => leader.id === "win-pct")?.managerId).toBe(data.managers[1]?.id);
    expect(leaders.find((leader) => leader.id === "scoring")?.value).toBe("100.0 PPG");
  });

  it("validates imported commissioner JSON before accepting it", () => {
    const valid = createStarterLeagueHQ(starterInput);
    expect(parseLeagueHQData(JSON.stringify(valid)).error).toBe("");
    expect(parseLeagueHQData('{"identity":{"name":"Fantasy Football"}}').error).toContain("currentSeason");
  });

  it("migrates the placeholder brand in saved league data", () => {
    const legacy = createStarterLeagueHQ(starterInput);
    legacy.identity.name = "FFAA League HQ";
    legacy.identity.shortName = "FFAA";
    legacy.identity.tagline = "FFAA history with the FFAA model.";
    legacy.futures[0] = { ...legacy.futures[0]!, source: "ffaa-model" };

    const migrated = migrateLegacyProductBranding(legacy);

    expect(migrated.identity.name).toBe("Fantasy Football League HQ");
    expect(migrated.identity.shortName).toBe("Fantasy Football");
    expect(migrated.identity.tagline).toBe("Fantasy Football history with the GameHQ model.");
    expect(migrated.futures[0]?.source).toBe("gamehq-model");
  });

  it("returns a stable draft countdown", () => {
    const countdown = getDraftCountdown("2026-08-12T12:30:00.000Z", Date.parse("2026-08-10T10:00:00.000Z"));
    expect(countdown.label).toBe("2d 2h 30m");
    expect(countdown.isPast).toBe(false);
  });
});
