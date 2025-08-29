import { useCallback } from 'react';
import { useDraftStore } from './useDraftStore';
import { FALLBACK_PLAYERS } from '../data/players';
import type { Player } from '../types/index';
import type { Position } from '../types/index';

export function useGlobalPlayers() {
  // Get players and setter from the store
  const players = useDraftStore((state) => state.players);
  const setPlayers = useDraftStore((state) => state.setPlayers);
  
  // Get undrafted players using the selector
  const filteredPlayers = useDraftStore(useCallback(
    (state) => state.selectors.undraftedPlayers(state),
    []
  ));

  // Initialize with fallback players if none are loaded
  const initializeWithFallback = useCallback(() => {
    if (players.length === 0) {
      console.log('[useGlobalPlayers] Setting fallback players:', FALLBACK_PLAYERS.length);
      setPlayers(FALLBACK_PLAYERS as Player[]);
    }
  }, [players.length, setPlayers]);

  // Run initialization
  initializeWithFallback();

  return {
    players,
    filteredPlayers,
    setPlayers,
  };
}
