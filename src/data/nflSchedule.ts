import scheduleRowsJson from "./nfl-schedule-2026.json";
import { normalizeToolTeam } from "@/data/toolPlayerData";

export interface NflScheduleGame {
  id: string;
  season: number;
  week: number;
  awayTeam: string;
  homeTeam: string;
  gameType: string;
  gameday: string;
}

type ScheduleInput = {
  season?: unknown;
  week?: unknown;
  awayTeam?: unknown;
  homeTeam?: unknown;
  gameType?: unknown;
  gameday?: unknown;
};

export function parseNflSchedule(rows: ScheduleInput[]): NflScheduleGame[] {
  return rows.flatMap((row): NflScheduleGame[] => {
    const season = Number(row.season);
    const week = Number(row.week);
    const awayTeam = normalizeToolTeam(row.awayTeam);
    const homeTeam = normalizeToolTeam(row.homeTeam);
    const gameType = String(row.gameType ?? "REG").toUpperCase();
    const gameday = String(row.gameday ?? "");
    if (
      !Number.isInteger(season) ||
      !Number.isInteger(week) ||
      week < 1 ||
      !awayTeam ||
      !homeTeam ||
      awayTeam === homeTeam
    ) {
      return [];
    }
    return [{
      id: `${season}-${String(week).padStart(2, "0")}-${awayTeam}-${homeTeam}`,
      season,
      week,
      awayTeam,
      homeTeam,
      gameType,
      gameday,
    }];
  }).sort((left, right) =>
    left.season - right.season ||
    left.week - right.week ||
    left.id.localeCompare(right.id)
  );
}

export const NFL_SCHEDULE_2026 = parseNflSchedule(scheduleRowsJson as ScheduleInput[])
  .filter((game) => game.season === 2026 && game.gameType === "REG");

export function scheduleOpponent(game: NflScheduleGame, team: string) {
  const normalizedTeam = normalizeToolTeam(team);
  if (game.homeTeam === normalizedTeam) return game.awayTeam;
  if (game.awayTeam === normalizedTeam) return game.homeTeam;
  return null;
}
