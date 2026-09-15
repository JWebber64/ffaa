export function nativeScoreStatus(scoringWeek: { activeNflGameIds: string[]; gameStatuses: Record<string, string> }) {
  if (scoringWeek.activeNflGameIds.length) return "Live" as const;
  const statuses = Object.values(scoringWeek.gameStatuses);
  if (statuses.length && statuses.every((status) => ["final", "canceled"].includes(status))) return "Final" as const;
  return "Projected" as const;
}
