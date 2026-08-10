import { describe, expect, it } from "vitest";
import {
  buildDraftResultsReport,
  createDraftResultsCsv,
  createDraftResultsJson,
  type DraftRecordLike,
} from "../features/draft-results/draftResults";
import type { ToolPlayer, ToolPosition } from "../data/toolPlayerData";

function toolPlayer(
  id: string,
  name: string,
  position: ToolPosition,
  projectedPoints: number,
  auctionValue: number,
  rank: number,
): ToolPlayer {
  return {
    id,
    name,
    position,
    team: "BUF",
    rank,
    positionRank: rank,
    byeWeek: rank + 5,
    adp: rank,
    auctionValue,
    marketValue: auctionValue,
    projectedPoints,
    projectedPointsPerGame: projectedPoints / 17,
    valueConfidence: 0.9,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 17,
    historicalPoints: projectedPoints - 20,
    historicalPointsPerGame: (projectedPoints - 20) / 17,
    last3PointsPerGame: projectedPoints / 17,
    floorPoints: null,
    ceilingPoints: null,
    standardDeviation: null,
    opportunitiesPerGame: null,
    targetsPerGame: null,
    carriesPerGame: null,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
  };
}

const pool = [
  toolPlayer("a-qb", "Josh \"Air\" Allen", "QB", 410, 70, 1),
  toolPlayer("b-qb", "Quarterback B", "QB", 260, 20, 2),
  toolPlayer("free-qb", "Quarterback C", "QB", 220, 8, 3),
  toolPlayer("a-rb", "Running Back A", "RB", 330, 55, 1),
  toolPlayer("b-rb", "Running Back B", "RB", 185, 15, 2),
  toolPlayer("free-rb", "Running Back C", "RB", 150, 5, 3),
];

const draft: DraftRecordLike = {
  id: "draft-1",
  code: "ROOM42",
  status: "complete",
  draft_type: "auction",
  team_count: 2,
  created_at: "2026-08-09T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  settings: {
    draftType: "auction",
    teamCount: 2,
    scoring: "ppr",
    leagueType: "redraft",
    rosterSlots: [{ slot: "QB", count: 1 }, { slot: "RB", count: 1 }],
  },
  snapshot: {
    phase: "complete",
    settings: {
      draftType: "auction",
      teamCount: 2,
      startingBudget: 200,
      teamBudgets: [200, 200],
      rosterSlots: [{ slot: "QB", count: 1 }, { slot: "RB", count: 1 }],
    },
    teams: [
      {
        teamId: "alpha",
        name: "Alpha, United",
        budget: 200,
        spent: 75,
        roster: [
          { playerId: "a-qb", name: "Josh \"Air\" Allen", pos: "QB", team: "BUF", price: 40, projectedValue: 70, projectedPoints: 410 },
          { playerId: "a-rb", name: "Running Back A", pos: "RB", team: "BUF", price: 35, projectedValue: 55, projectedPoints: 330 },
        ],
      },
      {
        teamId: "beta",
        name: "Beta",
        budget: 200,
        spent: 110,
        roster: [
          { playerId: "b-qb", name: "Quarterback B", pos: "QB", team: "BUF", price: 60, projectedValue: 20, projectedPoints: 260 },
          { playerId: "b-rb", name: "Running Back B", pos: "RB", team: "BUF", price: 50, projectedValue: 15, projectedPoints: 185 },
        ],
      },
    ],
  },
};

describe("draft results report", () => {
  it("ranks teams and exposes transparent auction summaries", () => {
    const report = buildDraftResultsReport(draft, {
      pool,
      generatedAt: "2026-08-10T12:00:00.000Z",
    });

    expect(report).toMatchObject({
      draftId: "draft-1",
      roomCode: "ROOM42",
      draftType: "auction",
      totalPlayers: 4,
      totalSpent: 185,
      generatedAt: "2026-08-10T12:00:00.000Z",
    });
    expect(report.teams.map((team) => team.name)).toEqual(["Alpha, United", "Beta"]);
    expect(report.teams[0]).toMatchObject({
      rank: 1,
      spent: 75,
      remaining: 125,
      projectedValue: 125,
      netValue: 50,
      bestValue: { playerId: "a-qb", surplus: 30 },
    });
    expect(report.teams[0]!.score).toBeGreaterThan(report.teams[1]!.score);
    expect(report.teams[0]!.rating.components.map((component) => component.id)).toContain("starters");
  });

  it("creates CSV-safe rows and a complete JSON artifact", () => {
    const report = buildDraftResultsReport(draft, { pool });
    const csv = createDraftResultsCsv(report);
    const json = JSON.parse(createDraftResultsJson(report)) as { teams: Array<{ name: string }> };

    expect(csv).toContain('"Alpha, United"');
    expect(csv).toContain('"Josh ""Air"" Allen"');
    expect(csv.split("\r\n")).toHaveLength(5);
    expect(json.teams[0]?.name).toBe("Alpha, United");
  });
});
