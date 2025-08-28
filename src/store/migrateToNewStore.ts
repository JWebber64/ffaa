import { DraftState } from './draftStore.new';

/**
 * Migrates data from the old store format to the new store format
 * @param oldState The state from the old store
 * @returns A new state object compatible with the new store
 */
export function migrateFromOldStore(oldState: any): Partial<DraftState> {
  if (!oldState) return {};

  const newState: Partial<DraftState> = {
    players: [],
    teams: [],
    nominationQueue: [],
    currentBidder: undefined,
  };

  // Migrate players
  if (Array.isArray(oldState.players)) {
    newState.players = oldState.players.map((p: any) => ({
      id: p.id || '',
      name: p.name || 'Unknown Player',
      pos: p.pos || 'RB', // Default to RB if position is missing
      nflTeam: p.nflTeam,
      draftedBy: p.draftedBy,
      price: p.price,
    }));
  }

  // Migrate teams
  if (Array.isArray(oldState.teams)) {
    newState.teams = oldState.teams.map((t: any) => ({
      id: t.id,
      name: t.name || `Team ${t.id}`,
      budget: typeof t.budget === 'number' ? t.budget : 200,
      roster: t.roster || {},
    }));
  }

  // Migrate nomination queue
  if (Array.isArray(oldState.nominationQueue)) {
    newState.nominationQueue = oldState.nominationQueue.map((n: any) => ({
      playerId: n.playerId,
      currentBid: n.currentBid || 1,
      highBidder: n.highBidder,
    }));
  }

  // Migrate current bidder if it exists
  if (oldState.currentBidder !== undefined) {
    newState.currentBidder = oldState.currentBidder;
  }

  return newState;
}

/**
 * Clears the old store's data from localStorage
 */
export function clearOldStoreData() {
  const oldKeys = [
    'draft-store', // Default key used by zustand
    'auction-draft-state', // Key from the new store
  ];

  oldKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove old store key: ${key}`, e);
    }
  });
}

/**
 * Migrates data from the old store to the new one
 * @returns The migrated state or null if no migration was needed
 */
export function migrateStoreData(): Partial<DraftState> | null {
  try {
    // Try to get the old store data
    const oldData = localStorage.getItem('draft-store');
    if (!oldData) return null;

    const parsed = JSON.parse(oldData);
    if (!parsed || !parsed.state) return null;

    console.log('Migrating store data from old format...');
    const migrated = migrateFromOldStore(parsed.state);
    
    // Clear old data
    clearOldStoreData();
    
    return migrated;
  } catch (e) {
    console.error('Error during store migration:', e);
    return null;
  }
}
