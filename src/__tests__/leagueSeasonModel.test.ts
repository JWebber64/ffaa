import { describe, expect, it } from "vitest";
import type { ToolPlayer } from "../data/toolPlayerData";
import {
  buildRoundRobinSchedule,
  leaguePositionClass,
  normalizeLineupAssignments,
  parseLeagueSeasonDraft,
  projectAssignedLineup,
  projectFranchiseLineup,
} from "../features/league-season/leagueSeasonModel";

const rosterSlots = [
  { slot: "QB", count: 1 },
  { slot: "RB", count: 2 },
  { slot: "WR", count: 2 },
  { slot: "TE", count: 1 },
  { slot: "FLEX", count: 1, flexEligible: ["RB", "WR", "TE"] },
  { slot: "BENCH", count: 4 },
];

function toolPlayer(id: string, position: ToolPlayer["position"], points: number, byeWeek: number | null = null): ToolPlayer {
  return {
    id,
    name: id,
    position,
    team: "NFL",
    rank: 1,
    positionRank: 1,
    byeWeek,
    adp: null,
    auctionValue: null,
    marketValue: null,
    projectedPoints: points * 17,
    projectedPointsPerGame: points,
    valueConfidence: null,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 0,
    historicalPoints: null,
    historicalPointsPerGame: null,
    last3PointsPerGame: null,
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

function savedDraft(teamCount = 4) {
  return {
    config: { defaultBudget: 200, scoring: "ppr", rosterSlots, isOpen: true },
    teams: Array.from({ length: teamCount }, (_, index) => ({
      teamId: `team-${index + 1}`,
      teamNumber: index + 1,
      name: `Manager ${index + 1}`,
      budget: 200,
      spent: 999,
      roster: index === 0
        ? [
            { playerId: "qb", name: "QB", pos: "QB", price: 22 },
            { playerId: "rb1", name: "RB1", pos: "RB", price: 31 },
            { playerId: "rb2", name: "RB2", pos: "RB", price: 17 },
            { playerId: "rb3", name: "RB3", pos: "RB", price: 9 },
            { playerId: "wr1", name: "WR1", pos: "WR", price: 30 },
            { playerId: "wr2", name: "WR2", pos: "WR", price: 15 },
            { playerId: "te", name: "TE", pos: "TE", price: 6 },
          ]
        : [],
    })),
  };
}

describe("league season draft model", () => {
  it("maps numbered lineup labels to their semantic position color classes", () => {
    expect([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "WR3",
      "TE",
      "FLEX",
      "BN1",
      "DST",
    ].map((position) => leaguePositionClass(position))).toEqual([
      "pos-qb",
      "pos-rb",
      "pos-rb",
      "pos-wr",
      "pos-wr",
      "pos-wr",
      "pos-te",
      "pos-flex",
      "pos-bench",
      "pos-def",
    ]);
  });

  it("normalizes saved draft teams into franchises and recalculates spend from the roster", () => {
    const season = parseLeagueSeasonDraft(savedDraft(), {
      leagueId: "1385319428408774656",
      source: "shared",
      revision: 4,
      updatedAt: "2026-08-31T00:00:00.000Z",
    });

    expect(season?.franchises).toHaveLength(4);
    expect(season?.franchises[0]).toMatchObject({
      id: "team-1",
      displayName: "Manager 1",
      spent: 130,
      remaining: 70,
    });
    expect(season?.revision).toBe(4);
  });

  it("creates the strongest legal baseline lineup and zeros a player on bye", () => {
    const season = parseLeagueSeasonDraft(savedDraft(), { leagueId: "1385319428408774656", source: "local" })!;
    const players = [
      toolPlayer("qb", "QB", 20),
      toolPlayer("rb1", "RB", 18),
      toolPlayer("rb2", "RB", 14),
      toolPlayer("rb3", "RB", 12),
      toolPlayer("wr1", "WR", 17, 5),
      toolPlayer("wr2", "WR", 13),
      toolPlayer("te", "TE", 10),
    ];
    const lineup = projectFranchiseLineup(season.franchises[0]!, season.rosterSlots, players, 5);

    expect(lineup.slots).toHaveLength(7);
    expect(lineup.starterCount).toBe(7);
    expect(lineup.projectedStarterCount).toBe(7);
    expect(lineup.projectedTotal).toBe(87);
    expect(lineup.slots.find((slot) => slot.player?.id === "wr1")?.player?.isOnBye).toBe(true);
  });

  it("builds one complete round robin before scheduling rematches", () => {
    const season = parseLeagueSeasonDraft(savedDraft(12), { leagueId: "1385319428408774656", source: "shared" })!;
    const schedule = buildRoundRobinSchedule(season.franchises, 14);

    expect(schedule.filter((matchup) => matchup.week === 1)).toHaveLength(6);
    expect(schedule).toHaveLength(84);
    const firstCyclePairs = schedule
      .filter((matchup) => matchup.week <= 11)
      .map((matchup) => [matchup.homeFranchiseId, matchup.awayFranchiseId].sort().join("|"));
    expect(new Set(firstCyclePairs).size).toBe(66);
  });

  it("drops duplicate and position-ineligible saved starters before projection", () => {
    const season = parseLeagueSeasonDraft(savedDraft(), { leagueId: "1385319428408774656", source: "published" })!;
    const franchise = season.franchises[0]!;
    const assignments = normalizeLineupAssignments(franchise, season.rosterSlots, {
      "QB-0": "qb",
      "RB-0": "rb1",
      "RB-1": "rb1",
      "WR-0": "rb2",
      "WR-1": "wr2",
      "TE-0": "te",
      "FLEX-0": "rb3",
      "unknown-0": "wr1",
    });

    expect(assignments).toEqual({
      "QB-0": "qb",
      "RB-0": "rb1",
      "WR-1": "wr2",
      "TE-0": "te",
      "FLEX-0": "rb3",
    });

    const lineup = projectAssignedLineup(franchise, season.rosterSlots, [
      toolPlayer("qb", "QB", 20),
      toolPlayer("rb1", "RB", 18),
      toolPlayer("rb2", "RB", 14),
      toolPlayer("rb3", "RB", 12),
      toolPlayer("wr1", "WR", 17),
      toolPlayer("wr2", "WR", 13),
      toolPlayer("te", "TE", 10),
    ], 1, assignments);

    expect(lineup.starterCount).toBe(5);
    expect(lineup.missingStarterCount).toBe(2);
    expect(lineup.projectedTotal).toBe(73);
  });
});
