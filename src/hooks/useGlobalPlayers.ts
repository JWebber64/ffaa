import { useCallback, useEffect, useState } from 'react';
import { useDraftStore } from './useDraftStore';
import { loadPlayerPool } from '../data/loadPlayerPool';

// Track if we've already loaded players to prevent duplicate loads
let playersLoaded = false;

export function useGlobalPlayers() {
  // Get players and setter from the store
  const players = useDraftStore((state) => state.players);
  const setPlayers = useDraftStore((state) => state.setPlayers);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get undrafted players using the selector
  const filteredPlayers = useDraftStore(useCallback(
    (state) => state.selectors.undraftedPlayers(state),
    []
  ));

  // Load players only once when the component mounts
  useEffect(() => {
    const loadPlayers = async () => {
      // Skip if already loaded or currently loading
      if (playersLoaded || isLoading) {
        console.log(`[useGlobalPlayers] Players already loaded or loading:`, { 
          playersCount: players.length, 
          playersLoaded, 
          isLoading 
        });
        return;
      }

      try {
        setIsLoading(true);
        console.log('[useGlobalPlayers] Loading player pool...');
        
        // Load and process players
        const loadedPlayers = await loadPlayerPool();
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
              rank: firstPlayer.rank
            };
            console.log('[useGlobalPlayers] Sample player:', playerInfo);
          }
          
          // Update the store with the loaded players
          setPlayers(loadedPlayers);
          playersLoaded = true;
          
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
        setIsLoading(false);
      }
    };

    loadPlayers();
  }, [setPlayers, isLoading, players.length]);

  return { 
    players, 
    filteredPlayers, 
    isLoading,
    refreshPlayers: async () => {
      setIsLoading(true);
      try {
        const loadedPlayers = await loadPlayerPool();
        setPlayers(loadedPlayers);
        return loadedPlayers;
      } finally {
        setIsLoading(false);
      }
    }
  };
}
