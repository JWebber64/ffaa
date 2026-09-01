import type { LeagueHistorySnapshot } from "../domain/types";

export type RosterLegacyEvidenceStatus = "complete" | "provisional" | "missing";

export interface RosterLegacyRow {
  position: string;
  providerPlayerId: string;
  playerName: string;
  starts: number;
  seasons: number;
  starterPoints: number | null;
  pointSamples: number;
}

export interface RosterLegacy {
  rows: RosterLegacyRow[];
  recordedStarts: number;
  recordedSeasons: number;
  evidenceStatus: RosterLegacyEvidenceStatus;
}

const POSITION_ORDER = new Map([
  ["QB", 0],
  ["RB", 1],
  ["WR", 2],
  ["TE", 3],
  ["K", 4],
  ["DEF", 5],
]);

function normalizePosition(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized || "OTHER";
}

function compareLegacyRows(left: RosterLegacyRow, right: RosterLegacyRow) {
  if (left.starts !== right.starts) return right.starts - left.starts;
  const leftPoints = left.starterPoints ?? Number.NEGATIVE_INFINITY;
  const rightPoints = right.starterPoints ?? Number.NEGATIVE_INFINITY;
  if (leftPoints !== rightPoints) return rightPoints - leftPoints;
  return left.playerName.localeCompare(right.playerName);
}

function evidenceStatus(snapshot: LeagueHistorySnapshot, seasonIds: Set<string>, rowCount: number): RosterLegacyEvidenceStatus {
  if (!rowCount) return "missing";
  if (!snapshot.coverage || !seasonIds.size) return "provisional";
  const coverageBySeason = new Map(snapshot.coverage.seasons.map((season) => [season.seasonId, season]));
  for (const seasonId of seasonIds) {
    if (coverageBySeason.get(seasonId)?.domains.weeklyPlayerResults.status !== "complete") return "provisional";
  }
  return "complete";
}

export function buildRosterLegacy(snapshot: LeagueHistorySnapshot, managerId?: string): RosterLegacy {
  const targetFranchiseIds = new Set<string>();
  const targetSeasonIds = new Set<string>();

  for (const franchise of snapshot.franchises) {
    if (managerId && franchise.managerId !== managerId) continue;
    targetFranchiseIds.add(franchise.id);
    targetSeasonIds.add(franchise.leagueSeasonId);
  }

  const weeklyContextById = new Map<string, { seasonId: string }>();
  for (const result of snapshot.weeklyResults) {
    if (!targetFranchiseIds.has(result.franchiseId)) continue;
    weeklyContextById.set(result.id, { seasonId: result.leagueSeasonId });
  }

  type MutablePlayerLegacy = Omit<RosterLegacyRow, "seasons" | "starterPoints"> & {
    seasonIds: Set<string>;
    starterPointTotal: number;
  };

  const playerRows = new Map<string, MutablePlayerLegacy>();
  const recordedSeasonIds = new Set<string>();
  let recordedStarts = 0;

  for (const player of snapshot.weeklyPlayerResults) {
    if (!player.isStarter) continue;
    const context = weeklyContextById.get(player.weeklyRosterResultId);
    if (!context) continue;
    const position = normalizePosition(player.position);
    const key = `${position}\u0000${player.providerPlayerId}`;
    const row = playerRows.get(key) ?? {
      position,
      providerPlayerId: player.providerPlayerId,
      playerName: player.playerName || player.providerPlayerId,
      starts: 0,
      seasonIds: new Set<string>(),
      starterPointTotal: 0,
      pointSamples: 0,
    };
    row.starts += 1;
    row.seasonIds.add(context.seasonId);
    recordedSeasonIds.add(context.seasonId);
    recordedStarts += 1;
    if (player.fantasyPoints != null && Number.isFinite(player.fantasyPoints)) {
      row.starterPointTotal += player.fantasyPoints;
      row.pointSamples += 1;
    }
    playerRows.set(key, row);
  }

  const leaderByPosition = new Map<string, RosterLegacyRow>();
  for (const row of playerRows.values()) {
    const candidate: RosterLegacyRow = {
      position: row.position,
      providerPlayerId: row.providerPlayerId,
      playerName: row.playerName,
      starts: row.starts,
      seasons: row.seasonIds.size,
      starterPoints: row.pointSamples ? row.starterPointTotal : null,
      pointSamples: row.pointSamples,
    };
    const leader = leaderByPosition.get(row.position);
    if (!leader || compareLegacyRows(candidate, leader) < 0) leaderByPosition.set(row.position, candidate);
  }

  const rows = [...leaderByPosition.values()].sort((left, right) => {
    const leftOrder = POSITION_ORDER.get(left.position) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = POSITION_ORDER.get(right.position) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.position.localeCompare(right.position);
  });

  return {
    rows,
    recordedStarts,
    recordedSeasons: recordedSeasonIds.size,
    evidenceStatus: evidenceStatus(snapshot, targetSeasonIds, rows.length),
  };
}
