import { useCallback, useEffect, useState } from 'react';
import { useDraftStore } from './useDraftStore';
import { loadFantasyProsPlayers } from '../data/loadFantasyProsPlayers';

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
      if (players.length > 0 || playersLoaded || isLoading) {
        console.log(`[useGlobalPlayers] Players already loaded or loading:`, { 
          playersCount: players.length, 
          playersLoaded, 
          isLoading 
        });
        return;
      }

      try {
        setIsLoading(true);
        console.log('[useGlobalPlayers] Loading FantasyPros players...');
        
        // Load and process players
        const fantasyProsPlayers = loadFantasyProsPlayers();
        console.log(`[useGlobalPlayers] Loaded ${fantasyProsPlayers.length} players from FantasyPros`);
        
        // Log first few players for debugging
        console.log('[useGlobalPlayers] Sample players:', fantasyProsPlayers.slice(0, 3));
        
        // Update the store with the loaded players
        setPlayers(fantasyProsPlayers);
        playersLoaded = true;
        
        // Verify the players were set in the store
        const storePlayers = useDraftStore.getState().players;
        console.log(`[useGlobalPlayers] Players in store after set:`, storePlayers.length);
        
      } catch (error) {
        console.error('Failed to load FantasyPros players:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlayers();
  }, [setPlayers, isLoading, players.length]);

  return {
    players,
    filteredPlayers,
    setPlayers,
    isLoading
  };
}
