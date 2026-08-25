import { loadPlayerCareerStats } from "@/data/playerCareerStats";
import type { PlayerCareerSeason } from "@/data/playerCareerStats";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";

export interface TeamPointCoverage {
  total: number;
  coveredPlayers: number;
}

export interface TeamCareerPointCoverage extends TeamPointCoverage {
  pointsPerGame: number;
  pointsPerGameCoveredPlayers: number;
}

export interface TeamCareerPointCoverages {
  fullTeam: TeamCareerPointCoverage;
  starters: TeamCareerPointCoverage;
}

export function sumAvailablePlayerPoints(
  players: ToolPlayer[],
  selectPoints: (player: ToolPlayer) => number | null,
): TeamPointCoverage {
  return players.reduce<TeamPointCoverage>((result, player) => {
    const points = selectPoints(player);
    if (points === null || !Number.isFinite(points)) return result;
    return {
      total: result.total + points,
      coveredPlayers: result.coveredPlayers + 1,
    };
  }, { total: 0, coveredPlayers: 0 });
}

export function careerFantasyPoints(seasons: PlayerCareerSeason[], position: ToolPlayer["position"]) {
  return seasons.reduce((total, season) => {
    if (position === "K") {
      return total + season.fieldGoalsMade * 3 + season.extraPointsMade;
    }
    return total + season.fantasyPoints;
  }, 0);
}

export function careerFantasyPointsPerGame(
  seasons: PlayerCareerSeason[],
  position: ToolPlayer["position"],
) {
  const games = seasons.reduce((total, season) => total + season.games, 0);
  return games > 0 ? careerFantasyPoints(seasons, position) / games : null;
}

function emptyCareerCoverage(): TeamCareerPointCoverage {
  return {
    total: 0,
    coveredPlayers: 0,
    pointsPerGame: 0,
    pointsPerGameCoveredPlayers: 0,
  };
}

function addPlayerCareerCoverage(
  result: TeamCareerPointCoverage,
  seasons: PlayerCareerSeason[],
  position: ToolPlayer["position"],
) {
  result.total += careerFantasyPoints(seasons, position);
  result.coveredPlayers += 1;
  const pointsPerGame = careerFantasyPointsPerGame(seasons, position);
  if (pointsPerGame !== null) {
    result.pointsPerGame += pointsPerGame;
    result.pointsPerGameCoveredPlayers += 1;
  }
}

export async function loadTeamCareerPointCoverages(
  players: ToolPlayer[],
  starters: ToolPlayer[],
  scoring: ToolScoring,
): Promise<TeamCareerPointCoverages> {
  const result: TeamCareerPointCoverages = {
    fullTeam: emptyCareerCoverage(),
    starters: emptyCareerCoverage(),
  };
  const starterIds = new Set(starters.map((player) => player.id));

  // Load sequentially so the bundled career archive is fetched once, then read
  // from its in-memory cache for the rest of the roster.
  for (const player of players) {
    if (player.position === "DEF") continue;
    const history = await loadPlayerCareerStats({
      ...(player.summary?.playerId
        ? { playerId: player.summary.playerId }
        : /^00-/.test(player.id)
          ? { playerId: player.id }
          : {}),
      playerName: player.name,
      position: player.position,
      scoring,
    });
    if (!history.seasons.length) continue;
    addPlayerCareerCoverage(result.fullTeam, history.seasons, player.position);
    if (starterIds.has(player.id)) {
      addPlayerCareerCoverage(result.starters, history.seasons, player.position);
    }
  }

  return result;
}
