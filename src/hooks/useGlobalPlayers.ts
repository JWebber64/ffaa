import { useEffect, useCallback } from 'react';
import { useSleeperPlayers } from './useSleeperPlayers';
import { useDraftStore } from '../store/draftStore';
import { FALLBACK_PLAYERS } from '../data/players';
import type { Player } from '../store/draftStore';

export function useGlobalPlayers() {
  const { players: sleeperPlayers, loading } = useSleeperPlayers();
  const setPlayers = useDraftStore((s) => s.setPlayers);
  const currentPlayers = useDraftStore((s) => s.players);

  // Load fallback players if no players are loaded and no data from Sleeper after loading
  useEffect(() => {
    if (!loading && currentPlayers.length === 0 && (!sleeperPlayers || sleeperPlayers.length === 0)) {
      console.log('[useGlobalPlayers] Setting fallback players:', FALLBACK_PLAYERS.length);
      setPlayers(FALLBACK_PLAYERS);
    }
  }, [loading, currentPlayers.length, sleeperPlayers, setPlayers]);

  // Update players if we have new data from Sleeper
  useEffect(() => {
    if (sleeperPlayers && sleeperPlayers.length > 0 && 
        JSON.stringify(sleeperPlayers) !== JSON.stringify(currentPlayers)) {
      console.log('[useGlobalPlayers] Setting players from Sleeper:', {
        sleeperPlayers: sleeperPlayers.length,
        currentPlayers: currentPlayers.length,
        byPosition: sleeperPlayers.reduce((acc, p) => {
          acc[p.pos] = (acc[p.pos] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      setPlayers(sleeperPlayers);
    }
  }, [sleeperPlayers, currentPlayers, setPlayers]);

  return { loading };
}
