import { useEffect, useCallback } from 'react';
import { useSleeperPlayers } from './useSleeperPlayers';
import { useDraftStore } from '../store/draftStore.new';
import type { Player } from '../store/draftStore.new';

export function useGlobalPlayers() {
  const { players: sleeperPlayers, loading } = useSleeperPlayers();
  const setPlayers = useDraftStore((s) => s.setPlayers);
  const currentPlayers = useDraftStore((s) => s.players);

  // Only update players if they've changed and we have new data
  useEffect(() => {
    if (sleeperPlayers.length > 0 && 
        JSON.stringify(sleeperPlayers) !== JSON.stringify(currentPlayers)) {
      setPlayers(sleeperPlayers);
    }
  }, [sleeperPlayers, currentPlayers, setPlayers]);

  return { loading };
}
