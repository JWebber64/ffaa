import { useDraftStore as useDraftStoreImpl } from '../store/draftStore';
import type { DraftStore, Player, Position } from '../types/draft';

// Re-export the store with a more convenient name
export const useDraftStore = useDraftStoreImpl;

// Type-safe selector hooks
export const useUndraftedPlayers = (): Player[] => 
  useDraftStore((state: DraftStore) => state.selectors.undraftedPlayers(state));

export const useTopAvailable = (limit = 300): Player[] => 
  useDraftStore((state: DraftStore) => state.selectors.topAvailable(state, limit));

export const useTopAvailableByPos = (pos: Position, limit = 100): Player[] => 
  useDraftStore((state: DraftStore) => state.selectors.topAvailableByPos(state, pos, limit));

export const useTopAvailableByMultiPos = (positions: Position[], limit = 100): Player[] => 
  useDraftStore((state: DraftStore) => state.selectors.topAvailableByMultiPos(state, positions, limit));

export const useTopAvailableForFlex = (limit = 100, includeTE = true): Player[] => 
  useDraftStore((state: DraftStore) => state.selectors.topAvailableForFlex(state, limit, includeTE));
