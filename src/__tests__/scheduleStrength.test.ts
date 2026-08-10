import { describe, expect, it } from "vitest";

import type { DefenseVsPositionRating } from "../data/defenseVsPosition";
import type { NflScheduleGame } from "../data/nflSchedule";
import { buildScheduleStrength, scheduleMatchupTone } from "../data/scheduleStrength";

function rating(team: string, matchupIndex: number): DefenseVsPositionRating {
  return {
    id: `${team}-RB`,
    team,
    position: "RB",
    games: 17,
    pointsAllowed: 300,
    pointsAllowedPerGame: 17,
    regressedPointsAllowedPerGame: matchupIndex / 5,
    leagueAveragePerGame: 20,
    matchupIndex,
    favorableRank: 1,
  };
}

function game(week: number, awayTeam: string, homeTeam: string): NflScheduleGame {
  return {
    id: `2026-${week}-${awayTeam}-${homeTeam}`,
    season: 2026,
    week,
    awayTeam,
    homeTeam,
    gameType: "REG",
    gameday: `2026-09-${String(week).padStart(2, "0")}`,
  };
}

describe("buildScheduleStrength", () => {
  it("joins future opponents to positional ratings and ranks favorable schedules", () => {
    const rows = buildScheduleStrength(
      [game(1, "BUF", "MIA"), game(2, "BUF", "NYJ")],
      [rating("MIA", 120), rating("NYJ", 110), rating("BUF", 80)],
      { position: "RB", weekStart: 1, weekEnd: 2 },
    );
    const buffalo = rows.find((row) => row.team === "BUF")!;

    expect(buffalo.averageMatchupIndex).toBe(115);
    expect(buffalo.favorableGames).toBe(2);
    expect(buffalo.toughGames).toBe(0);
    expect(buffalo.matchups.map((matchup) => matchup.opponent)).toEqual(["MIA", "NYJ"]);
    expect(buffalo.rank).toBe(1);
  });

  it("records missing schedule weeks as byes and exposes stable matchup tones", () => {
    const [buffalo] = buildScheduleStrength(
      [game(1, "BUF", "MIA")],
      [rating("MIA", 100)],
      { position: "RB", weekStart: 1, weekEnd: 3 },
    );
    expect(buffalo!.byeWeeks).toEqual([2, 3]);
    expect(scheduleMatchupTone(105)).toBe("favorable");
    expect(scheduleMatchupTone(95)).toBe("tough");
    expect(scheduleMatchupTone(100)).toBe("neutral");
    expect(scheduleMatchupTone(null)).toBe("unknown");
  });
});
