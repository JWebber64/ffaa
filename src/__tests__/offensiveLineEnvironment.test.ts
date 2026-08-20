import { describe, expect, it } from "vitest";

import { buildOffensiveLineEnvironments } from "../data/offensiveLineEnvironment";
import {
  buildOffensiveLineProjection2026,
  OFFENSIVE_LINE_PROJECTION_AS_OF,
  OFFENSIVE_LINE_PROJECTION_SOURCES,
} from "../data/offensiveLineProjection2026";
import type { WeeklyPlayerStatRow } from "../data/weeklyPlayerStats";

function row(team: string, playerId: string, stats: Record<string, number>): WeeklyPlayerStatRow {
  return {
    playerId,
    playerName: playerId,
    shortName: playerId,
    position: playerId.includes("qb") ? "QB" : "RB",
    positionGroup: playerId.includes("qb") ? "QB" : "RB",
    headshotUrl: null,
    team,
    opponent: team === "A" ? "B" : "A",
    season: 2025,
    week: 1,
    seasonType: "REG",
    gameId: `2025_01_${team}`,
    standardFantasyPoints: 0,
    halfPprFantasyPoints: 0,
    pprFantasyPoints: 0,
    selectedFantasyPoints: 0,
    stats,
  };
}

describe("buildOffensiveLineEnvironments", () => {
  it("ranks better pass and run outcomes higher while preserving raw metrics", () => {
    const environments = buildOffensiveLineEnvironments([
      row("BUF", "qb-a", { attempts: 40, sacks_suffered: 1, passing_epa: 12 }),
      row("BUF", "rb-a", { carries: 25, rushing_yards: 140, rushing_epa: 7, rushing_first_downs: 9 }),
      row("NYJ", "qb-b", { attempts: 30, sacks_suffered: 6, passing_epa: -5 }),
      row("NYJ", "rb-b", { carries: 20, rushing_yards: 55, rushing_epa: -6, rushing_first_downs: 2 }),
    ]);

    expect(environments.map((row) => row.team)).toEqual(["BUF", "NYJ"]);
    expect(environments[0]!.overallRank).toBe(1);
    expect(environments[0]!.sackRate).toBeCloseTo(1 / 41);
    expect(environments[0]!.rushingYardsPerCarry).toBeCloseTo(5.6);
    expect(environments[0]!.passEnvironmentScore).toBeGreaterThan(environments[1]!.passEnvironmentScore!);
    expect(environments[0]!.runEnvironmentScore).toBeGreaterThan(environments[1]!.runEnvironmentScore!);
  });

  it("returns null rates instead of dividing by zero", () => {
    const [environment] = buildOffensiveLineEnvironments([row("BUF", "qb-a", {})]);
    expect(environment).toMatchObject({ sackRate: null, rushEpaPerCarry: null });
  });
});

describe("buildOffensiveLineProjection2026", () => {
  it("builds an all-team consensus from four source-dated public rankings", () => {
    const projection = buildOffensiveLineProjection2026();

    expect(projection).toHaveLength(32);
    expect(OFFENSIVE_LINE_PROJECTION_SOURCES).toHaveLength(4);
    expect(OFFENSIVE_LINE_PROJECTION_AS_OF).toBe("2026-07-31");
    expect(projection.map((row) => row.team)).toEqual(expect.arrayContaining(["ARI", "WAS"]));
  });

  it("keeps the published source ranks and derives consensus agreement", () => {
    const projection = buildOffensiveLineProjection2026();
    const denver = projection[0]!;
    const sanFrancisco = projection.find((row) => row.team === "SF")!;

    expect(denver).toMatchObject({
      team: "DEN",
      consensusRank: 1,
      averageRank: 1,
      bestSourceRank: 1,
      worstSourceRank: 1,
      sourceAgreement: "Strong",
      sourceAgreementScore: 100,
    });
    expect(Object.values(denver.sourceRanks)).toEqual([1, 1, 1, 1]);
    expect(sanFrancisco).toMatchObject({
      consensusRank: 11,
      bestSourceRank: 5,
      worstSourceRank: 25,
      rankSpread: 20,
      sourceAgreement: "Low",
    });
    expect(projection.at(-1)?.team).toBe("CLE");
  });
});
