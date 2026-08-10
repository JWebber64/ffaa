import type { WeeklyPlayerStatRow } from "@/data/weeklyPlayerStats";
import { normalizeToolPosition, normalizeToolTeam } from "@/data/toolPlayerData";
import type { ToolPosition } from "@/data/toolPlayerData";

export type DvpPosition = Exclude<ToolPosition, "DEF">;

export interface DefenseVsPositionRating {
  id: string;
  team: string;
  position: DvpPosition;
  games: number;
  pointsAllowed: number;
  pointsAllowedPerGame: number;
  regressedPointsAllowedPerGame: number;
  leagueAveragePerGame: number;
  matchupIndex: number;
  favorableRank: number;
}

export interface DefenseVsPositionOptions {
  regressionGames?: number;
}

const DVP_POSITIONS = new Set<DvpPosition>(["QB", "RB", "WR", "TE", "K"]);

interface MutableDefensePosition {
  team: string;
  position: DvpPosition;
  games: Set<string>;
  pointsAllowed: number;
}

/**
 * Builds a transparent defense-v-position baseline from actual fantasy points
 * allowed. The displayed estimate is regressed toward the league average to
 * avoid treating small samples as stable defensive ability.
 */
export function buildDefenseVsPosition(
  rows: WeeklyPlayerStatRow[],
  { regressionGames = 4 }: DefenseVsPositionOptions = {},
): DefenseVsPositionRating[] {
  const safeRegressionGames = Math.max(0, regressionGames);
  const aggregates = new Map<string, MutableDefensePosition>();

  for (const row of rows) {
    const position = normalizeToolPosition(row.positionGroup || row.position);
    const defense = normalizeToolTeam(row.opponent);
    if (!position || !DVP_POSITIONS.has(position as DvpPosition) || !defense) continue;

    const dvpPosition = position as DvpPosition;
    const key = `${defense}|${dvpPosition}`;
    const aggregate = aggregates.get(key) ?? {
      team: defense,
      position: dvpPosition,
      games: new Set<string>(),
      pointsAllowed: 0,
    };
    aggregate.games.add(row.gameId || `${row.season}-${row.week}-${row.team}-${defense}`);
    aggregate.pointsAllowed += row.selectedFantasyPoints;
    aggregates.set(key, aggregate);
  }

  const leagueByPosition = new Map<DvpPosition, { points: number; games: number }>();
  for (const aggregate of aggregates.values()) {
    const league = leagueByPosition.get(aggregate.position) ?? { points: 0, games: 0 };
    league.points += aggregate.pointsAllowed;
    league.games += aggregate.games.size;
    leagueByPosition.set(aggregate.position, league);
  }

  const ratings: DefenseVsPositionRating[] = [...aggregates.values()].map((aggregate) => {
    const games = Math.max(aggregate.games.size, 1);
    const pointsAllowedPerGame = aggregate.pointsAllowed / games;
    const league = leagueByPosition.get(aggregate.position) ?? { points: 0, games: 0 };
    const leagueAveragePerGame = league.games > 0 ? league.points / league.games : 0;
    const regressedPointsAllowedPerGame =
      (aggregate.pointsAllowed + leagueAveragePerGame * safeRegressionGames) /
      (games + safeRegressionGames || 1);
    const matchupIndex = leagueAveragePerGame > 0
      ? (regressedPointsAllowedPerGame / leagueAveragePerGame) * 100
      : 100;

    return {
      id: `${aggregate.team}-${aggregate.position}`,
      team: aggregate.team,
      position: aggregate.position,
      games,
      pointsAllowed: aggregate.pointsAllowed,
      pointsAllowedPerGame,
      regressedPointsAllowedPerGame,
      leagueAveragePerGame,
      matchupIndex,
      favorableRank: 0,
    };
  });

  const ranks = new Map<string, number>();
  for (const position of DVP_POSITIONS) {
    ratings
      .filter((rating) => rating.position === position)
      .sort((left, right) =>
        right.regressedPointsAllowedPerGame - left.regressedPointsAllowedPerGame ||
        left.team.localeCompare(right.team)
      )
      .forEach((rating, index) => ranks.set(rating.id, index + 1));
  }

  return ratings
    .map((rating) => ({ ...rating, favorableRank: ranks.get(rating.id) ?? 0 }))
    .sort((left, right) =>
      left.position.localeCompare(right.position) ||
      left.favorableRank - right.favorableRank
    );
}

export function defenseVsPositionMap(ratings: DefenseVsPositionRating[]) {
  return new Map(ratings.map((rating) => [`${rating.team}|${rating.position}`, rating]));
}
