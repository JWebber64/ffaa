import { describe, expect, it } from "vitest";

import type { ToolPlayer, ToolPosition } from "../data/toolPlayerData";
import { DEFAULT_TEAM_RATER_SLOTS, rateFantasyTeam } from "../data/teamRater";

function player(id: string, position: ToolPosition, projectedPoints: number, rank: number): ToolPlayer {
  return {
    id,
    name: id,
    position,
    team: "BUF",
    rank,
    positionRank: rank,
    byeWeek: rank % 10 + 5,
    adp: rank,
    auctionValue: Math.max(1, 70 - rank),
    marketValue: Math.max(1, 70 - rank),
    projectedPoints,
    projectedPointsPerGame: projectedPoints / 17,
    valueConfidence: 0.8,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 17,
    historicalPoints: projectedPoints - 10,
    historicalPointsPerGame: (projectedPoints - 10) / 17,
    last3PointsPerGame: 15,
    floorPoints: 10,
    ceilingPoints: 20,
    standardDeviation: 5,
    opportunitiesPerGame: 15,
    targetsPerGame: 5,
    carriesPerGame: 10,
    targetShare: 0.2,
    airYardsShare: 0.2,
    weeklyPoints: [],
    summary: null,
  };
}

const pool = [
  ...Array.from({ length: 20 }, (_, index) => player(`QB-${index}`, "QB", 400 - index * 8, index + 1)),
  ...Array.from({ length: 50 }, (_, index) => player(`RB-${index}`, "RB", 320 - index * 5, index + 1)),
  ...Array.from({ length: 50 }, (_, index) => player(`WR-${index}`, "WR", 310 - index * 5, index + 1)),
  ...Array.from({ length: 24 }, (_, index) => player(`TE-${index}`, "TE", 250 - index * 6, index + 1)),
  ...Array.from({ length: 20 }, (_, index) => player(`K-${index}`, "K", 150 - index * 2, index + 1)),
  ...Array.from({ length: 20 }, (_, index) => player(`DEF-${index}`, "DEF", 145 - index * 2, index + 1)),
];

describe("rateFantasyTeam", () => {
  it("optimizes fixed and flex starters and returns transparent components", () => {
    const roster = [
      pool.find((candidate) => candidate.id === "QB-0")!,
      pool.find((candidate) => candidate.id === "RB-0")!,
      pool.find((candidate) => candidate.id === "RB-1")!,
      pool.find((candidate) => candidate.id === "RB-2")!,
      pool.find((candidate) => candidate.id === "WR-0")!,
      pool.find((candidate) => candidate.id === "WR-1")!,
      pool.find((candidate) => candidate.id === "TE-0")!,
      pool.find((candidate) => candidate.id === "K-0")!,
      pool.find((candidate) => candidate.id === "DEF-0")!,
      ...pool.filter((candidate) => candidate.position === "WR").slice(2, 8),
    ];
    const result = rateFantasyTeam(roster, pool, {
      teamCount: 12,
      scoring: "ppr",
      slots: DEFAULT_TEAM_RATER_SLOTS,
    });

    expect(result.isComplete).toBe(true);
    expect(result.lineup).toHaveLength(9);
    expect(result.lineup.find((entry) => entry.slot === "FLEX")?.player.id).toBe("RB-2");
    expect(result.components.map((component) => component.id)).toEqual([
      "starters", "vor", "depth", "byes", "availability",
    ]);
    expect(result.score).toBeGreaterThan(70);
  });

  it("marks an incomplete roster provisional and recommends filling open starters", () => {
    const result = rateFantasyTeam([pool[0]!], pool, {
      teamCount: 12,
      scoring: "ppr",
      slots: DEFAULT_TEAM_RATER_SLOTS,
    });
    expect(result.isComplete).toBe(false);
    expect(result.missingSlots).toContain("RB1");
    expect(result.recommendations[0]).toContain("Fill");
  });

  it("honors custom position counts and assigns a second quarterback to superflex", () => {
    const slots = DEFAULT_TEAM_RATER_SLOTS.map((slot) => {
      if (slot.position === "FLEX" || slot.position === "K" || slot.position === "DEF") {
        return { ...slot, count: 0 };
      }
      if (slot.position === "SUPERFLEX") return { ...slot, count: 1 };
      if (slot.position === "BENCH") return { ...slot, count: 2 };
      return { ...slot };
    });
    const roster = [
      pool.find((candidate) => candidate.id === "QB-0")!,
      pool.find((candidate) => candidate.id === "QB-1")!,
      pool.find((candidate) => candidate.id === "RB-0")!,
      pool.find((candidate) => candidate.id === "RB-1")!,
      pool.find((candidate) => candidate.id === "WR-0")!,
      pool.find((candidate) => candidate.id === "WR-1")!,
      pool.find((candidate) => candidate.id === "TE-0")!,
      pool.find((candidate) => candidate.id === "WR-2")!,
      pool.find((candidate) => candidate.id === "RB-2")!,
    ];
    const result = rateFantasyTeam(roster, pool, {
      teamCount: 12,
      scoring: "ppr",
      slots,
    });

    expect(result.totalStarterSlots).toBe(7);
    expect(result.lineup.find((entry) => entry.slot === "SUPERFLEX")?.player.id).toBe("QB-1");
    expect(result.isComplete).toBe(true);
  });

  it("treats a replacement-level starter as viable instead of zero-value", () => {
    const replacementQuarterback = pool.find((candidate) => candidate.id === "QB-11")!;
    const result = rateFantasyTeam([replacementQuarterback], pool, {
      teamCount: 12,
      scoring: "ppr",
      slots: [
        { position: "QB", count: 1 },
        { position: "BENCH", count: 0 },
      ],
    });

    expect(result.components.find((component) => component.id === "vor")?.score).toBe(70);
  });

  it("makes bench and bye scores tie-breakers instead of primary grade drivers", () => {
    const result = rateFantasyTeam([
      pool.find((candidate) => candidate.id === "QB-0")!,
      pool.find((candidate) => candidate.id === "K-0")!,
      pool.find((candidate) => candidate.id === "DEF-0")!,
    ], pool, {
      teamCount: 12,
      scoring: "ppr",
      slots: [
        { position: "QB", count: 1 },
        { position: "BENCH", count: 2 },
      ],
    });

    expect(Object.fromEntries(result.components.map((component) => [component.id, component.weight]))).toEqual({
      starters: 0.7,
      vor: 0.2,
      depth: 0.05,
      byes: 0.02,
      availability: 0.03,
    });
    expect(result.components.find((component) => component.id === "depth")?.score).toBe(0);
  });

  it("assigns the letter grade from the same rounded score shown in the UI", () => {
    const quarterback = {
      ...pool.find((candidate) => candidate.id === "QB-4")!,
      injuryStatus: "Questionable",
    };
    const result = rateFantasyTeam([quarterback], pool, {
      teamCount: 12,
      scoring: "ppr",
      slots: [
        { position: "QB", count: 1 },
        { position: "BENCH", count: 0 },
      ],
    });

    expect(result.score).toBeGreaterThanOrEqual(82.5);
    expect(result.score).toBeLessThan(83);
    expect(Math.round(result.score)).toBe(83);
    expect(result.letterGrade).toBe("B+");
  });
});
