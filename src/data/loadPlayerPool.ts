import type { Player, Position } from "@/types/draft";
import pool from "./player-pool-2026.json";
import { applyConsensusAuctionValues } from "./playerValues";
import type { AuctionValueOptions } from "./playerValues";

// Valid NFL team abbreviations
const VALID_TEAMS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS', 'FA'
]);

const TEAM_ALIASES: Record<string, string> = {
  ARZ: 'ARI',
  JAC: 'JAX',
  LA: 'LAR',
  LVR: 'LV',
  NOR: 'NO',
  NWE: 'NE',
  SFO: 'SF',
  TAM: 'TB',
  WSH: 'WAS',
};

// Valid positions
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

function cleanNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? undefined : num;
}

function cleanByeWeek(value: unknown): number | undefined {
  const byeWeek = cleanNumber(value);
  if (byeWeek === undefined || byeWeek <= 0) return undefined;
  return Math.round(byeWeek);
}

function cleanString(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  return str || undefined;
}

function cleanTeam(value: unknown): string {
  const rawTeam = cleanString(value)?.toUpperCase();
  const team = rawTeam ? TEAM_ALIASES[rawTeam] ?? rawTeam : undefined;
  return team && VALID_TEAMS.has(team) ? team : 'FA';
}

export type LoadPlayerPoolOptions = AuctionValueOptions & {
  budget?: number;
};

export function loadPlayerPool(options: LoadPlayerPoolOptions = {}): Player[] {
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
        const nflTeam = cleanTeam(raw.nflTeam ?? raw.team);
        
        // Clean numbers with fallbacks
        const rank = cleanNumber(raw.rank) || 999;
        const posRank = cleanNumber(raw.posRank);
        const adp = cleanNumber(raw.adp);
        const byeWeek = cleanByeWeek(raw.byeWeek ?? raw.bye);
        const rankSource =
          typeof raw.adpSource === 'string'
            ? raw.adpSource
            : typeof raw.source === 'string'
              ? raw.source
              : undefined;
        
        const player: Player = {
          id,
          name,
          pos,
          nflTeam,
          rank,
          ...(posRank !== undefined && { posRank }),
          ...(adp !== undefined && { adp }),
          ...(byeWeek !== undefined && { byeWeek }),
          ...(rankSource && { adpSource: rankSource }),
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
    
    const valuedPlayers = applyConsensusAuctionValues(
      validPlayers,
      options.budget ?? 200,
      options,
    );

    // Sort players by rank
    const sortedPlayers = [...valuedPlayers].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

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
          byeWeek: samplePlayer.byeWeek,
          rank: samplePlayer.rank,
          posRank: samplePlayer.posRank,
          adp: samplePlayer.adp,
          auctionValue: samplePlayer.auctionValue
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
