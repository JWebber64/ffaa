import { describe, expect, it } from "vitest";

import { buildPlayerProfileDetail } from "@/features/player-profile/playerProfileData";

describe("shared player profile data", () => {
  it("builds the same complete profile contract from a roster-style player", () => {
    const profile = buildPlayerProfileDetail({
      id: "custom-player",
      sleeperId: "12345",
      name: "Profile Player",
      position: "RB",
      team: "BUF",
      byeWeek: 7,
      projectedPoints: 245.6,
      weeklyProjectedPoints: 15.4,
      targetsPerGame: 5.2,
      carriesPerGame: 13.7,
      status: "Active",
    }, "halfPpr");

    expect(profile).toMatchObject({
      id: "custom-player",
      sleeperId: "12345",
      name: "Profile Player",
      position: "RB",
      team: "BUF",
      status: "Active",
      career: {
        playerName: "Profile Player",
        position: "RB",
        scoring: "halfPpr",
      },
    });
    expect(profile.headshotUrl).toContain("/12345.jpg");
    expect(profile.overviewMetrics.find((metric) => metric.label === "Season projection")?.value).toBe("245.6");
    expect(profile.usageMetrics.find((metric) => metric.label === "Targets/G")?.value).toBe("5.2");
    expect(profile.sources.map((source) => source.name)).toEqual(expect.arrayContaining(["nflverse", "Sleeper", "ESPN NFL headlines"]));
  });
});
