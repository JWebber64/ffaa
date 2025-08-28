import { useEffect } from 'react';
import { useSleeperPlayers } from './useSleeperPlayers';
import { useDraftStore } from '../store/draftStore';

/**
 * Load players globally once and push them into the Zustand store.
 * Any screen (Auctioneer, DraftBoard, PlayerPool) can then read store.players.
 */
export function useGlobalPlayers() {
  const { players, loading } = useSleeperPlayers();
  const setPlayers = useDraftStore((s) => s.setPlayers);

  useEffect(() => {
    // Always push the latest snapshot into the store
    setPlayers(players);
  }, [players, setPlayers]);

  return { loading };
}
