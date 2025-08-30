import playersData from './players-2025-espn.json';

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  byeWeek: number;
  espnValue: number;
  season: number;
}

export function loadEspnPlayers(): Player[] {
  return playersData.map((player: any) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    rank: player.rank,
    byeWeek: player.bye,
    espnValue: player.value,
    season: 2025
  }));
}

// For testing
try {
  const players = loadEspnPlayers();
  console.log(`Successfully loaded ${players.length} players`);
} catch (error) {
  console.warn('No player data found. Run `npm run espn:pull` to download the latest data.');
}
