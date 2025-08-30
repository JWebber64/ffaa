import type { Player, Position } from "@/types/draft";
import rows from "./players-2025-fantasypros.json";

interface Raw {
  id: string;
  season: number;
  source: string;
  rank: number;
  name: string;
  pos: Position;
  nflTeam: string;
  // Optional fields that might exist in the data
  draftedBy?: number;
  price?: number;
  posRank?: number;
  adp?: number;
  slot?: string;
}

// Type guard to validate player data
function isValidPosition(pos: string): pos is Position {
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX', 'BENCH'].includes(pos);
}

function processPlayerData(raw: Raw, index: number): Player | null {
  try {
    // In this specific dataset, the 'pos' field is always 'K' (kicker) and the actual position is in 'nflTeam'
    const pos = (raw.nflTeam as Position) || 'UNK';
    const nflTeam = raw.pos || 'FA';
    
    // Validate position
    if (!isValidPosition(pos)) {
      console.warn(`[loadFantasyProsPlayers] Invalid position '${pos}' for player ${raw.name || raw.id}`);
      return null;
    }
    
    return {
      id: raw.id,
      name: raw.name || `Player ${index}`,
      pos: pos,
      rank: raw.rank || 999,
      search_rank: raw.rank || 999,
      search_rank_ppr: raw.rank || 999,
      nflTeam: nflTeam,
      adpSource: 'FantasyPros'
    };
  } catch (error) {
    console.error(`[loadFantasyProsPlayers] Error processing player ${raw.id}:`, error);
    return null;
  }
}

export function loadFantasyProsPlayers(): Player[] {
  console.log('[loadFantasyProsPlayers] Loading players...');
  
  // Process all players and filter out any invalid ones
  const players = (rows as unknown as Raw[])
    .map((r, i) => processPlayerData(r, i))
    .filter((p): p is Player => p !== null);
    
  console.log(`[loadFantasyProsPlayers] Successfully loaded ${players.length} valid players`);
  const firstPlayer = players[0];
  if (firstPlayer) {
    console.log('[loadFantasyProsPlayers] Sample player:', {
      id: firstPlayer.id,
      name: firstPlayer.name,
      pos: firstPlayer.pos,
      nflTeam: firstPlayer.nflTeam,
      rank: firstPlayer.rank
    });
  }
  
  return players;
}
