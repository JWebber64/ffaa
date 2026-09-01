import type { ToolPlayer } from "../../data/toolPlayerData";

export type LeagueProjectionFreshness = {
  matchedPlayers: number;
  sourceCount: number;
  updatedAt: string;
  updatedLabel: string;
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "refresh date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getLeagueProjectionFreshness(players: ToolPlayer[]): LeagueProjectionFreshness {
  let sourceCount = 0;
  let updatedAt = "";
  let matchedPlayers = 0;

  for (const player of players) {
    if (player.projectedPointsPerGame !== null) matchedPlayers += 1;
    sourceCount = Math.max(sourceCount, player.projectionSourceCount ?? 0);
    const candidate = player.projectionUpdatedAt?.trim() ?? "";
    if (candidate > updatedAt) updatedAt = candidate;
  }

  return {
    matchedPlayers,
    sourceCount,
    updatedAt,
    updatedLabel: updatedAt ? `refreshed ${formatDate(updatedAt)}` : "refresh date unavailable",
  };
}

export function projectionFreshnessSummary(freshness: LeagueProjectionFreshness) {
  const sourceLabel = freshness.sourceCount > 0
    ? `up to ${freshness.sourceCount} independent public sources`
    : "public season projection data";
  return `${sourceLabel} · ${freshness.updatedLabel}`;
}
