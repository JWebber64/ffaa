import type { Player, Position } from "@/types/draft";
import pool from "./player-pool-2025.json" assert { type: 'json' };

// Valid NFL team abbreviations
const VALID_TEAMS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS', 'FA'
]);

// Valid positions
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

function cleanNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? undefined : num;
}

function cleanString(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  return str || undefined;
}

export function loadPlayerPool(): Player[] {
  console.log('[loadPlayerPool] Starting to load player pool...');
  
  try {
    const rawPlayers = Array.isArray(pool) ? pool : [];
    console.log(`[loadPlayerPool] Found ${rawPlayers.length} players in pool`);
    
    const validPlayers: Player[] = [];
    const errors: string[] = [];
    
    rawPlayers.forEach((r: unknown, index: number) => {
      try {
        // Basic type checking
        if (typeof r !== 'object' || r === null) {
          throw new Error('Invalid player data format');
        }
        
        const raw = r as Record<string, unknown>;
        
        // Validate required fields
        const id = cleanString(raw.id) || `player-${index}`;
        const name = cleanString(raw.name) || `Player ${index + 1}`;
        const pos = cleanString(raw.pos)?.toUpperCase() as Position | undefined;
        
        if (!pos || !VALID_POSITIONS.has(pos)) {
          throw new Error(`Invalid position: ${raw.pos}`);
        }
        
        // Clean team
        const team = cleanString(raw.nflTeam)?.toUpperCase();
        const nflTeam = team && VALID_TEAMS.has(team) ? team : 'FA';
        
        // Clean numbers with fallbacks
        const rank = cleanNumber(raw.rank) || 999;
        const posRank = cleanNumber(raw.posRank);
        const adp = cleanNumber(raw.adp);
        
        const player: Player = {
          id,
          name,
          pos,
          nflTeam,
          rank,
          ...(posRank !== undefined && { posRank }),
          ...(adp !== undefined && { adp }),
          ...(typeof raw.adpSource === 'string' && { adpSource: raw.adpSource }),
          search_rank: rank,
          search_rank_ppr: rank
        };
        
        validPlayers.push(player);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const playerId = (r as Record<string, unknown>)?.id || `player-${index}`;
        errors.push(`[${playerId}]: ${errorMsg}`);
      }
    });
    
    // Log any errors
    if (errors.length > 0) {
      console.warn(`[loadPlayerPool] Encountered ${errors.length} errors while loading players:`);
      errors.slice(0, 5).forEach(err => console.warn(`  - ${err}`));
      if (errors.length > 5) {
        console.warn(`  ...and ${errors.length - 5} more errors`);
      }
    }
    
    // Sort players by rank
    const sortedPlayers = [...validPlayers].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    
    console.log(`[loadPlayerPool] Successfully loaded ${sortedPlayers.length} valid players`);
    
    // Log sample data for debugging
    if (sortedPlayers.length > 0) {
      const samplePlayer = sortedPlayers[0];
      if (samplePlayer) {
        const sampleData = {
          id: samplePlayer.id,
          name: samplePlayer.name,
          pos: samplePlayer.pos,
          nflTeam: samplePlayer.nflTeam,
          rank: samplePlayer.rank,
          posRank: samplePlayer.posRank,
          adp: samplePlayer.adp
        };
        console.log('[loadPlayerPool] Sample player:', sampleData);
      }
    }
    
    return sortedPlayers;
    
  } catch (error) {
    console.error('[loadPlayerPool] Fatal error loading player pool:', error);
    return [];
  }
}
