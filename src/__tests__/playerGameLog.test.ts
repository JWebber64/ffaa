import { describe, expect, it } from "vitest";

import { buildPlayerGameLog } from "@/data/playerGameLog";
import type { WeeklyPlayerStatRow } from "@/data/weeklyPlayerStats";

function makeWeek(week: number): WeeklyPlayerStatRow {
  return {
    playerId: "00-0033280",
    playerName: "Christian McCaffrey",
    shortName: "C. McCaffrey",
    position: "RB",
    positionGroup: "RB",
    headshotUrl: null,
    team: "SF",
    opponent: "SEA",
    season: 2025,
    week,
    seasonType: "REG",
    gameId: `2025-${week}`,
    standardFantasyPoints: week,
    halfPprFantasyPoints: week + 0.5,
    pprFantasyPoints: week + 1,
    selectedFantasyPoints: week + 1,
    stats: {
      carries: week,
      targets: 5,
      receptions: 4,
      rushing_yards: 80,
      receiving_yards: 35,
      rushing_tds: 1,
    },
  };
}

describe("player season game log", () => {
  it("keeps all 17 regular-season games and shows the newest game first", () => {
    const seasonWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18];
    const source = seasonWeeks.map(makeWeek);

    const gameLog = buildPlayerGameLog(source);

    expect(gameLog).toHaveLength(17);
    expect(gameLog.map((game) => game.week)).toEqual([...seasonWeeks].reverse());
    expect(source.map((game) => game.week)).toEqual(seasonWeeks);
  });
});
