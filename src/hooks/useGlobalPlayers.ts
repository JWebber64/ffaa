import { useEffect } from 'react';
import { useDraftStore } from '../store/draftStore';
import { FALLBACK_PLAYERS } from '../data/players';

export function useGlobalPlayers() {
  const setPlayers = useDraftStore((s) => s.setPlayers);
  const currentPlayers = useDraftStore((s) => s.players);

  // Load fallback players if no players are loaded
  useEffect(() => {
    if (currentPlayers.length === 0) {
      console.log('[useGlobalPlayers] Setting fallback players:', FALLBACK_PLAYERS.length);
      setPlayers(FALLBACK_PLAYERS);
    }
  }, [currentPlayers.length, setPlayers]);

  return { loading: false };
}
