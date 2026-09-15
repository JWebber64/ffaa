export type PulseMonitoringMode = "preseason" | "in-season";

function isFiniteValue(value: unknown) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

export function monitoringModeForSeasonType(seasonType: string | undefined): PulseMonitoringMode {
  return seasonType === "regular" || seasonType === "post" ? "in-season" : "preseason";
}

export function shouldCheckPreseasonSource(mode: PulseMonitoringMode, preseasonOnly = false) {
  return mode === "preseason" || !preseasonOnly;
}

export function emptyImportStatus(mode: PulseMonitoringMode, preseasonOnly = false) {
  return mode === "in-season" && preseasonOnly ? "not_configured" as const : "warning" as const;
}

export function sleeperProjectionMetrics(text: string) {
  try {
    const rows = JSON.parse(text) as unknown;
    if (!Array.isArray(rows)) return { rowCount: undefined, dataUpdatedAt: undefined };
    let rowCount = 0;
    let newestUpdate = 0;
    for (const value of rows) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const stats = row.stats && typeof row.stats === "object" ? row.stats as Record<string, unknown> : {};
      const hasProjection = ["pts_std", "pts_half_ppr", "pts_ppr"].some((key) => isFiniteValue(stats[key]));
      if (String(row.player_id ?? "").trim() && hasProjection) {
        rowCount += 1;
        const updatedAt = Number(row.updated_at);
        if (Number.isFinite(updatedAt)) newestUpdate = Math.max(newestUpdate, updatedAt);
      }
    }
    return {
      rowCount,
      dataUpdatedAt: newestUpdate > 0 ? new Date(newestUpdate).toISOString() : undefined,
    };
  } catch {
    return { rowCount: undefined, dataUpdatedAt: undefined };
  }
}

export function sleeperMatchupMetrics(text: string) {
  try {
    const rows = JSON.parse(text) as unknown;
    if (!Array.isArray(rows)) return { rowCount: undefined, playerPointRows: undefined };
    let rowCount = 0;
    let playerPointRows = 0;
    for (const value of rows) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      if (String(row.roster_id ?? "").trim() && isFiniteValue(row.points)) rowCount += 1;
      if (row.players_points && typeof row.players_points === "object" && Object.keys(row.players_points).length > 0) {
        playerPointRows += 1;
      }
    }
    return { rowCount, playerPointRows };
  } catch {
    return { rowCount: undefined, playerPointRows: undefined };
  }
}
