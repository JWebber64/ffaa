import { DraftState, Position } from '../store/draftStore';

const PERSISTENCE_KEY = 'ffaa-draft-state';
const CURRENT_VERSION = 1;

// Default position caps for roster slots
const POSITION_CAP: Record<Position, number> = {
  QB: 2,
  RB: 6,
  WR: 6,
  TE: 3,
  K: 2,
  DEF: 2,
  FLEX: 1,
  BENCH: 6
};

// Define the shape of the persisted state
type PersistedPlayer = {
  id: string;
  draftedBy?: number;
  price?: number;
};

type PersistedTeam = {
  id: number;
  players: string[];
  budget: number;
};

type PersistedState = {
  players: PersistedPlayer[];
  teams: PersistedTeam[];
  currentAuction: DraftState['currentAuction'] | null;
  currentNominatedId: string | null;
  currentBidder: number | null;
  baseBudget: number;
  teamCount: number;
  templateRoster: Record<Position, number>;
  playersLoaded: boolean;
  version: number;
};

// Helper to safely get persisted state
export const getPersistedState = (): Partial<DraftState> | null => {
  try {
    const saved = localStorage.getItem(PERSISTENCE_KEY);
    if (!saved) return null;

    const data = JSON.parse(saved) as Partial<PersistedState>;
    
    // Handle version mismatches
    if (data.version !== CURRENT_VERSION) {
      console.warn('Persisted state version mismatch, clearing...');
      localStorage.removeItem(PERSISTENCE_KEY);
      return null;
    }

    // Return only the parts we want to merge with the initial state
    return {
      players: [], // Will be merged in the store's merge function
      teams: data.teams?.map(t => ({
        id: t?.id ?? 0,
        name: `Team ${(t?.id ?? 0) + 1}`,
        players: t?.players ?? [],
        budget: t?.budget ?? 200,
        roster: {} as Record<Position, number>
      })) ?? [],
      currentAuction: data.currentAuction ?? null,
      currentNominatedId: data.currentNominatedId ?? null,
      currentBidder: data.currentBidder ?? undefined,
      baseBudget: data.baseBudget ?? 200,
      teamCount: data.teamCount ?? 12,
      templateRoster: data.templateRoster ?? { ...POSITION_CAP } as Record<Position, number>,
      playersLoaded: data.playersLoaded ?? false
    };
  } catch (error) {
    console.error('Error loading persisted state:', error);
    return null;
  }
};

// Helper to persist the current state
export const persistState = (state: DraftState) => {
  try {
    const data: PersistedState = {
      players: state.players.map(p => ({
        id: p.id,
        draftedBy: p.draftedBy ?? undefined,
        price: p.price
      })),
      teams: state.teams.map(t => ({
        id: t.id,
        players: t.players,
        budget: t.budget
      })),
      currentAuction: state.currentAuction,
      currentNominatedId: state.currentNominatedId ?? null,
      currentBidder: state.currentBidder ?? null,
      baseBudget: state.baseBudget,
      teamCount: state.teamCount,
      templateRoster: state.templateRoster,
      playersLoaded: state.playersLoaded,
      version: CURRENT_VERSION
    };
    
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error persisting state:', error);
  }
};

// Clear persisted state
export const clearPersistedState = () => {
  localStorage.removeItem(PERSISTENCE_KEY);
};
