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
      completions: week.stats.completions ?? 0,
      passingAttempts: week.stats.attempts ?? 0,
      passingYards: week.stats.passing_yards ?? 0,
      passingTouchdowns: week.stats.passing_tds ?? 0,
      interceptions: week.stats.passing_interceptions ?? 0,
      rushingYards: week.stats.rushing_yards ?? 0,
      rushingTouchdowns: week.stats.rushing_tds ?? 0,
      receivingYards: week.stats.receiving_yards ?? 0,
      receivingTouchdowns: week.stats.receiving_tds ?? 0,
      fieldGoalsMade: week.stats.fg_made ?? 0,
      extraPointsMade: week.stats.pat_made ?? 0,
    }));
}
