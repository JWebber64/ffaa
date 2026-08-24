import type { StatsPlayerWeek } from "@/components/stats/StatsPlayerDrawer";
import type { WeeklyPlayerStatRow } from "@/data/weeklyPlayerStats";

export function buildPlayerGameLog(rows: readonly WeeklyPlayerStatRow[]): StatsPlayerWeek[] {
  return rows
    .slice()
    .reverse()
    .map((week) => ({
      id: `${week.season}-${week.week}-${week.gameId || week.playerId}`,
      season: week.season,
      week: week.week,
      team: week.team,
      opponent: week.opponent,
      fantasyPoints: week.selectedFantasyPoints,
      carries: week.stats.carries ?? 0,
      targets: week.stats.targets ?? 0,
      receptions: week.stats.receptions ?? 0,
      totalYards:
        (week.stats.passing_yards ?? 0) +
        (week.stats.rushing_yards ?? 0) +
        (week.stats.receiving_yards ?? 0),
      totalTouchdowns:
        (week.stats.passing_tds ?? 0) +
        (week.stats.rushing_tds ?? 0) +
        (week.stats.receiving_tds ?? 0),
    }));
}
