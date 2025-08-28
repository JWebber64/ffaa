import { useEffect, useState, useCallback } from "react";
import { Player, BasePosition } from "../store/draftStore";

// Define position limits - these are the maximum number of players we'll take per position
// The actual number of players will be less if there aren't enough ranked players
const POSITION_LIMITS = {
  QB: 32,    // 32 starting QBs in the league
  RB: 96,    // ~3 per team
  WR: 128,   // ~4 per team
  TE: 48,    // ~1.5 per team
  K: 32,     // 32 starting Ks
  DEF: 32,   // 32 starting DEFs
  'W/R/T': 0, // This is a flex position, not a primary position
  'W/R': 0,   // This is a flex position, not a primary position
  'Q/W/R/T': 0, // This is a superflex position, not a primary position
  '': 0,       // Handle any empty positions
} as const satisfies Record<string, number>;

// Cache for player data
const PLAYER_CACHE_KEY = 'ffaa_players_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function getCachedPlayers(): Player[] | null {
  try {
    const cached = localStorage.getItem(PLAYER_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_EXPIRY) {
      return data;
    }
  } catch (e) {
    console.warn('Failed to load players from cache', e);
  }
  return null;
}

function savePlayersToCache(players: Player[]) {
  try {
    localStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify({
      data: players,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save players to cache', e);
  }
}

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: BasePosition;
  team: string;
  active: boolean;
  status?: string;
  years_exp?: number;
  search_rank?: number;
  fantasy_positions?: string[];
}


export function useSleeperPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlayers = useCallback(async () => {
    // Check cache first
    const cachedPlayers = getCachedPlayers();
    if (cachedPlayers) {
      setPlayers(cachedPlayers);
      setLoading(false);
    }

    try {
      setLoading(true);
      // Fetch fresh data in the background
      const response = await fetch("https://api.sleeper.app/v1/players/nfl");
      const playersData = await response.json();
      
      // Process and filter players by position
      const processAndFilterPlayers = (allPlayers: Record<string, SleeperPlayer>): Player[] => {
        // First, convert to array and filter out inactive/irrelevant players
        const validPlayers = Object.values(allPlayers).filter(player => {
          // Skip if basic info is missing
          if (!player.active || !player.position || !player.team || player.team === 'FA') {
            return false;
          }
          
          // Skip if no search rank (likely not relevant for fantasy)
          if (player.search_rank === undefined) {
            return false;
          }
          
          // Filter out players who are not active for 2025
          // This includes checking status and other indicators
          const inactiveStatuses = [
            'Injured Reserve', 'PUP', 'Suspended', 'Exempt', 
            'Not With Team', 'Did Not Report', 'Retired', 'Retirement',
            'Left Squad', 'Reserve', 'Physically Unable to Perform',
            'Practice Squad', 'Non-Football Injury', 'Non-Football Illness'
          ];
          
          const status = player.status?.toLowerCase() || '';
          
          // Check if status contains any inactive indicator
          if (inactiveStatuses.some(s => status.includes(s.toLowerCase()))) {
            return false;
          }
          
          // Additional check for retired players by name (temporary measure)
          const retiredPlayers = [
            'ben roethlisberger', 'drew brees', 'philip rivers',
            'julio jones', 'frank gore', 'adrian peterson'
          ];
          
          const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
          if (retiredPlayers.includes(fullName)) {
            console.log(`Filtering out retired player: ${fullName}`);
            return false;
          }
          
          // No need to filter by years_exp - rely on search_rank for relevance
          // Sleeper's rankings should already account for current player relevance
          
          return true;
        });
        
        // Sort all players by search_rank first (lower is better)
        validPlayers.sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999));
        
        // Group players by position
        const playersByPosition = validPlayers.reduce((acc, player) => {
          const position = player.position as BasePosition;
          if (!acc[position]) {
            acc[position] = [];
          }
          
          acc[position].push({
            ...player,
            fullName: `${player.first_name} ${player.last_name}`.trim()
          });
          
          return acc;
        }, {} as Record<BasePosition, Array<SleeperPlayer & { fullName: string }>>);
        
        // Process each position group and take the top N players
        const processedPlayers: Player[] = [];
        
        (Object.entries(playersByPosition) as [BasePosition, Array<SleeperPlayer & { fullName: string }>][]).forEach(([position, players]) => {
          const limit = POSITION_LIMITS[position] || 0;
          if (limit > 0) {
            // Take the top N players (already pre-sorted by search_rank)
            const sortedPlayers = players.slice(0, limit);
              
            sortedPlayers.forEach(player => {
              processedPlayers.push({
                id: player.player_id,
                name: player.fullName,
                pos: position,
                nflTeam: player.team,
                draftedBy: undefined,
                price: 0,
              });
            });
          }
        });
        
        return processedPlayers;
      };
      
      // Process all players at once for filtering
      const processedPlayers = processAndFilterPlayers(playersData);
      
      // Sort by position and name
      processedPlayers.sort((a, b) => 
        a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name)
      );
      
      savePlayersToCache(processedPlayers);
      setPlayers(processedPlayers);
      
    } catch (error) {
      console.error("Error loading players:", error);
      if (!cachedPlayers) {
        // If we have no cached data, set empty array to prevent infinite loading
        setPlayers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  return { players, loading };
}
