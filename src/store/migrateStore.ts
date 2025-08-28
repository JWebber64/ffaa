import { DraftState } from './draftStore';

// Migration function to handle any data structure changes
export function migrateStoreData(persistedState: any, version: number): DraftState {
  if (!persistedState) return {} as DraftState;
  
  // Example migration (adjust based on actual changes)
  if (version === 0) {
    // Migrate from version 0 to 1
    return {
      ...persistedState,
      // Ensure nominationQueue exists and is an array
      nominationQueue: Array.isArray(persistedState.nominationQueue) 
        ? persistedState.nominationQueue 
        : [],
      // Ensure teams have roster objects
      teams: (persistedState.teams || []).map((team: any) => ({
        ...team,
        roster: team.roster || {}
      })),
      // Ensure players have required fields
      players: (persistedState.players || []).map((player: any) => ({
        ...player,
        pos: player.pos || '',
        name: player.name || 'Unknown Player'
      }))
    };
  }
  
  return persistedState;
}
