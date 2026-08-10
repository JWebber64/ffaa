import type { DefenseVsPositionRating, DvpPosition } from "@/data/defenseVsPosition";
import { defenseVsPositionMap } from "@/data/defenseVsPosition";
import type { NflScheduleGame } from "@/data/nflSchedule";
import { scheduleOpponent } from "@/data/nflSchedule";

export interface ScheduleMatchup {
  id: string;
  week: number;
  opponent: string;
  venue: "home" | "away";
  gameday: string;
  matchupIndex: number | null;
  regressedPointsAllowedPerGame: number | null;
  favorableRank: number | null;
}

export interface TeamScheduleStrength {
  id: string;
  team: string;
  position: DvpPosition;
  weekStart: number;
  weekEnd: number;
  games: number;
  averageMatchupIndex: number | null;
  favorableGames: number;
  toughGames: number;
  rank: number;
  byeWeeks: number[];
  matchups: ScheduleMatchup[];
}

export interface ScheduleStrengthOptions {
  position: DvpPosition;
  weekStart: number;
  weekEnd: number;
}

export function buildScheduleStrength(
  schedule: NflScheduleGame[],
  ratings: DefenseVsPositionRating[],
  { position, weekStart, weekEnd }: ScheduleStrengthOptions,
): TeamScheduleStrength[] {
  const start = Math.max(1, Math.min(weekStart, weekEnd));
  const end = Math.min(18, Math.max(weekStart, weekEnd));
  const selectedSchedule = schedule.filter((game) => game.week >= start && game.week <= end);
  const teams = [...new Set(selectedSchedule.flatMap((game) => [game.awayTeam, game.homeTeam]))].sort();
  const ratingMap = defenseVsPositionMap(ratings);

  const rows = teams.map((team): TeamScheduleStrength => {
    const teamGames = selectedSchedule.filter((game) => game.awayTeam === team || game.homeTeam === team);
    const matchups = teamGames.map((game): ScheduleMatchup => {
      const opponent = scheduleOpponent(game, team) ?? "";
      const rating = ratingMap.get(`${opponent}|${position}`) ?? null;
      return {
        id: `${team}-${game.id}`,
        week: game.week,
        opponent,
        venue: game.homeTeam === team ? "home" : "away",
        gameday: game.gameday,
        matchupIndex: rating?.matchupIndex ?? null,
        regressedPointsAllowedPerGame: rating?.regressedPointsAllowedPerGame ?? null,
        favorableRank: rating?.favorableRank ?? null,
      };
    });
    const indices = matchups.flatMap((matchup) =>
      matchup.matchupIndex === null ? [] : [matchup.matchupIndex]
    );
    const playedWeeks = new Set(matchups.map((matchup) => matchup.week));
    const byeWeeks = Array.from({ length: end - start + 1 }, (_, index) => start + index)
      .filter((week) => !playedWeeks.has(week));
    return {
      id: `${team}-${position}-${start}-${end}`,
      team,
      position,
      weekStart: start,
      weekEnd: end,
      games: matchups.length,
      averageMatchupIndex: indices.length
        ? indices.reduce((total, value) => total + value, 0) / indices.length
        : null,
      favorableGames: indices.filter((index) => index >= 105).length,
      toughGames: indices.filter((index) => index <= 95).length,
      rank: 0,
      byeWeeks,
      matchups,
    };
  });

  return rows
    .sort((left, right) =>
      (right.averageMatchupIndex ?? -1) - (left.averageMatchupIndex ?? -1) ||
      left.team.localeCompare(right.team)
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function scheduleMatchupTone(index: number | null) {
  if (index === null) return "unknown" as const;
  if (index >= 105) return "favorable" as const;
  if (index <= 95) return "tough" as const;
  return "neutral" as const;
}
