import { loadPlayerCareerStats } from "@/data/playerCareerStats";
import type { PlayerCareerSeason } from "@/data/playerCareerStats";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";

export interface TeamPointCoverage {
  total: number;
  coveredPlayers: number;
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

export async function loadTeamCareerPointCoverage(
  players: ToolPlayer[],
  scoring: ToolScoring,
): Promise<TeamPointCoverage> {
  const result: TeamPointCoverage = { total: 0, coveredPlayers: 0 };

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
    result.total += careerFantasyPoints(history.seasons, player.position);
    result.coveredPlayers += 1;
  }

  return result;
}
