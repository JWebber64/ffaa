import type { BriefEdition, BriefRosterPlayer, LeagueBriefContext, Observation } from "./model";
import { recentPlayers, scoredObservation, statLabels } from "./ranking";
import { fills } from "./eligibility";
export { fills } from "./eligibility";

export function playerPositions(player: Observation, context: LeagueBriefContext) {
  return context.candidatePositions?.[player.id] ?? [player.position === "L" ? "LW" : player.position === "R" ? "RW" : player.position];
}
function average(rows: Observation[], key: string) {
  return rows.length >= 2 && rows.every(row => row.stats[key] !== undefined)
    ? rows.reduce((sum, row) => sum + row.stats[key]!, 0) / rows.length : null;
}
export type BenchComparison = { bench: BriefRosterPlayer; text: string; candidateAverage: number | null; benchAverage: number | null; delta: number | null };
export function eligibleBenchPlayers(player: Observation, context: LeagueBriefContext | null) {
  return context?.complete ? (context.roster ?? []).filter(bench => context.myIds.includes(bench.id) && !bench.protected && ["BN", "BENCH"].includes(bench.slot) && context.positions.some(slot => fills(playerPositions(player, context), slot, context.slotEligibility) && fills(bench.positions, slot, context.slotEligibility))) : [];
}
export function compareBench(player: Observation, edition: BriefEdition, context: LeagueBriefContext | null, benchId?: string): BenchComparison | null {
  if (!context?.complete || !context.roster) return null;
  const byId = recentPlayers(edition), recent = byId.get(player.id)?.slice(0, 3) ?? [];
  if (recent.length < 2) return null;
  const comparisons: BenchComparison[] = [];
  for (const bench of eligibleBenchPlayers(player, context)) {
    if (benchId && bench.id !== benchId) continue;
    const rows = [...byId.values()].find(entries => (edition.sport === "football" ? entries[0]!.providerId : entries[0]!.id) === bench.id)?.slice(0, 3) ?? [];
    if (rows.length < 2) continue;
    if (context.format === "points") {
      const scores = [...recent, ...rows].map(row => scoredObservation(row, context, edition.sport));
      if (scores.some(score => score === null)) continue;
      const candidateAverage = scores.slice(0, recent.length).reduce<number>((sum, value) => sum + value!, 0) / recent.length;
      const benchAverage = scores.slice(recent.length).reduce<number>((sum, value) => sum + value!, 0) / rows.length;
      comparisons.push({ bench, candidateAverage, benchAverage, delta: candidateAverage - benchAverage,
        text: `${candidateAverage.toFixed(1)} versus ${benchAverage.toFixed(1)} league points per game across each player's last ${recent.length}/${rows.length} observed games.` });
    } else {
      const differences = context.categories.flatMap(key => {
        const a = average(recent, key), b = average(rows, key);
        return a === null || b === null ? [] : [`${statLabels[key] ?? key}: ${a.toFixed(2)} versus ${b.toFixed(2)}`];
      });
      if (differences.length) comparisons.push({ bench, candidateAverage: null, benchAverage: null, delta: null, text: differences.join(" · ") + " per observed game. Category units are compared separately." });
    }
  }
  // The weakest comparable bench scorer is a benchmark, not an automatic drop.
  return comparisons.sort((a, b) => (a.benchAverage ?? 0) - (b.benchAverage ?? 0) || a.bench.id.localeCompare(b.bench.id))[0] ?? null;
}
