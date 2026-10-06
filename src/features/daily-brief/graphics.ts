import { addDays, type BriefEdition, type BriefStartPlan, type LeagueBriefContext, type Observation } from "./model";
import { scoredObservation } from "./ranking";

export type PerformancePoint = { date: string; gameId: string; points: number };
export function performanceHistory(player: Observation, rows: Observation[], context: LeagueBriefContext, sport: BriefEdition["sport"]): PerformancePoint[] {
  const sample = rows.filter(row => row.id === player.id && row.date <= player.date).slice(0, 5);
  if (sample.length < 3 || context.format !== "points") return [];
  const values = sample.map(row => ({ date: row.date, gameId: row.gameId, points: scoredObservation(row, context, sport) }));
  // Missing scoring is not a zero and must not be bridged by a continuous line.
  if (values.some(row => row.points === null)) return [];
  return values.map(row => ({ ...row, points: row.points! })).reverse();
}

export function usageComparison(player: Observation, rows: Observation[]) {
  const key = player.position === "QB" ? "pass_att" : player.position === "RB" ? "carries" : ["WR", "TE"].includes(player.position) ? "targets" : null;
  const sample = rows.filter(row => row.id === player.id && row.date <= player.date).slice(0, 5);
  if (!key || sample.length < 4 || sample.some(row => row.stats[key] === undefined || row.stats[key]! < 0)) return null;
  const currentCount = sample.length - 2, currentRows = sample.slice(0, currentCount), precedingRows = sample.slice(currentCount);
  const average = (entries: Observation[]) => entries.reduce((sum, row) => sum + row.stats[key]!, 0) / entries.length;
  const current = average(currentRows), preceding = average(precedingRows);
  return { label: key === "pass_att" ? "Passing attempts" : key === "carries" ? "Carries" : "Targets", current, preceding,
    currentDates: currentRows.map(row => row.date).reverse(), precedingDates: precedingRows.map(row => row.date).reverse(),
    difference: current - preceding, percent: preceding > 0 ? (current / preceding - 1) * 100 : null };
}

export function hockeySchedule(player: Observation, edition: BriefEdition, plan: BriefStartPlan | null) {
  if (edition.sport !== "hockey" || !edition.sources.some(row => row.name === "NHL upcoming schedule" && row.status === "ready")) return null;
  const games = [...new Map(edition.upcoming.map(game => [game.id, game])).values()].filter(game => !game.final);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(edition.date, index + 1), slate = games.filter(game => game.date === date);
    const teamGames = slate.filter(game => game.home === player.team || game.away === player.team);
    return { date, opponents: teamGames.map(game => `${game.home === player.team ? "vs" : "@"} ${game.home === player.team ? game.away : game.home}`),
      slateSize: slate.length, offNight: teamGames.length > 0 && slate.length <= 8,
      fits: Boolean(player.position !== "G" && plan && date >= plan.start && plan.days.some(day => day.date === date && day.gain > 0)) };
  });
}

export function sparklineGeometry(series: PerformancePoint[]) {
  const lower = Math.min(0, ...series.map(row => row.points)), upper = Math.max(0, ...series.map(row => row.points)), range = upper - lower || 1;
  const y = (value: number) => 28 - (value - lower) / range * 24;
  return { zero: y(0), points: series.map((row, index) => ({ x: 6 + index / Math.max(1, series.length - 1) * 100, y: y(row.points) })) };
}
