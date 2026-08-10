import { useEffect, useRef, useState } from 'react';
import { useDraftStore } from './useDraftStore';
import type { Player } from '../types/draft';

let loadInFlight: Promise<Player[]> | null = null;

async function loadPlayersOnDemand() {
  const { loadPlayerPool } = await import('../data/loadPlayerPool');
  return loadPlayerPool();
}

export function useGlobalPlayers() {
  // Get players and setter from the store
  const players = useDraftStore((state) => state.players);
  const playersLoaded = useDraftStore((state) => state.playersLoaded);
  const setPlayers = useDraftStore((state) => state.setPlayers);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);
  
  // Load players only once when the component mounts
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadPlayers = async () => {
      // Skip if already loaded or currently loading
      if (playersLoaded || loadInFlight) {
        console.log(`[useGlobalPlayers] Players already loaded or loading:`, { 
          playersCount: players.length, 
          playersLoaded,
        });
        return;
      }

      const request = loadPlayersOnDemand();
      try {
        loadInFlight = request;
        if (mountedRef.current) setIsLoading(true);
        console.log('[useGlobalPlayers] Loading player pool...');
        
        // Load and process players
        const loadedPlayers = await request;
        console.log(`[useGlobalPlayers] Loaded ${loadedPlayers.length} players from player pool`);
        
        if (loadedPlayers.length > 0) {
          // Log first player for debugging
          const firstPlayer = loadedPlayers[0];
          if (firstPlayer) {
            const playerInfo = {
              id: firstPlayer.id,
              name: firstPlayer.name,
              pos: firstPlayer.pos,
              nflTeam: firstPlayer.nflTeam,
              byeWeek: firstPlayer.byeWeek,
              rank: firstPlayer.rank
            };
            console.log('[useGlobalPlayers] Sample player:', playerInfo);
          }
          
          // Update the store with the loaded players
          setPlayers(loadedPlayers);
          
          // Verify the players were set in the store
          const storePlayers = useDraftStore.getState().players;
          console.log(`[useGlobalPlayers] Players in store after set:`, storePlayers.length);
          
          if (storePlayers.length === 0) {
            console.error('[useGlobalPlayers] No players were set in the store!');
          } else if (process.env.NODE_ENV === 'development') {
            // In development, log the first few players for debugging
            console.log('[useGlobalPlayers] First few players in store:', 
              storePlayers.slice(0, 3).map(p => ({
                id: p.id,
                name: p.name,
                pos: p.pos,
                team: p.nflTeam,
                byeWeek: p.byeWeek,
                rank: p.rank
              }))
            );
          }
        } else {
          console.warn('[useGlobalPlayers] No players were loaded from the pool');
        }
      } catch (error) {
        console.error('[useGlobalPlayers] Error loading players:', error);
      } finally {
        if (loadInFlight === request) loadInFlight = null;
        if (mountedRef.current) setIsLoading(false);
      }
    };

    loadPlayers();
  }, [playersLoaded, setPlayers, players.length]);

  return { 
    players, 
    isLoading,
    refreshPlayers: async () => {
      setIsLoading(true);
      try {
        const loadedPlayers = await loadPlayersOnDemand();
        setPlayers(loadedPlayers);
        return loadedPlayers;
      } finally {
        setIsLoading(false);
      }
    }
  };
}
