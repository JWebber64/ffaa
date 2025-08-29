import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { produce } from 'immer';
import FfcAdp from '../services/FfcAdp';
import { getPersistedState, persistState, clearPersistedState } from '../utils/persistState';

declare global {
  interface Window {
    localStorage: Storage;
  }
}

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';
export type BasePosition = Exclude<Position, 'FLEX' | 'BENCH'>;

export interface Team {
  id: number;
  name: string;
  players: string[];
  budget: number;
  roster: Record<Position, number>;
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  nflTeam?: string;
  draftedBy?: number;
  price?: number;
  search_rank?: number;
  search_rank_ppr?: number;
  rank?: number;
  posRank?: number;
  adp?: number;
  adpSource?: string;
  slot?: string; // Add slot property for compatibility
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
  createdAt: number;
}

export interface CurrentAuction {
  playerId: string;
  highBid: number;
  highBidder: number | null;
}

export interface DraftState {
  // State
  players: Player[];
  playersLoaded: boolean;
  adpLoaded: boolean;
  teams: Team[];
  nominationQueue: Nomination[];
  currentBidder?: number;
  currentAuction: CurrentAuction | null;
  baseBudget: number;
  teamCount: number;
  templateRoster: Record<Position, number>;
  currentNominatedId?: string | null;

  // Actions
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentNominatedId: (id: string | null) => void;
  setCurrentBidder: (teamId?: number) => void;
  applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => void;
  loadAdp: (opts?: {
    year?: number;
    teams?: number;
    scoring?: 'standard' | 'ppr' | 'half-ppr';
    useCache?: boolean;
  }) => Promise<boolean>;
  setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;
  setTeamNames: (names: string[]) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  assignPlayer: (playerId: string, teamId: number, price: number) => void;
  computeMaxBid: (teamId: number, playerPos?: string) => number;
  hasSlotFor: (teamId: number, pos: Position, includeTeInFlex?: boolean) => boolean;
  resetDraft: () => void;
  
  // Selectors
  selectors: {
    undraftedPlayers: (state: DraftState) => Player[];
    topAvailable: (state: DraftState, limit?: number) => Player[];
    topAvailableByPos: (state: DraftState, pos: Position, limit?: number) => Player[];
    topAvailableByMultiPos: (state: DraftState, positions: Position[], limit?: number) => Player[];
    topAvailableForFlex: (state: DraftState, limit?: number, includeTE?: boolean) => Player[];
  };
}

// Auction constraints
const ROSTER_SIZE = 16;
const POSITION_CAP: Record<Position, number> = {
  QB: 2, RB: 6, WR: 6, TE: 3, K: 2, DEF: 2, FLEX: 1, BENCH: 6
};

// Helper: count players drafted by a team
function draftedCountForTeam(players: Player[], teamId: number): number {
  return players.filter(p => p.draftedBy === teamId).length;
}

// Define the store type for persistence
interface PersistedDraftState {
  players: Array<{
    id: string;
    draftedBy?: number;
    price?: number;
  }>;
  teams: Array<{
    id: number;
    players: string[];
    budget: number;
  }>;
  currentAuction: CurrentAuction | null;
  currentNominatedId: string | null;
  currentBidder: number | undefined;
  baseBudget: number;
  teamCount: number;
  templateRoster: Record<Position, number>;
  playersLoaded: boolean;
}

// Create the store with persistence
type SetState = (partial: Partial<DraftState> | ((state: DraftState) => Partial<DraftState>)) => void;
type GetState = () => DraftState;

// Define the store type
export type DraftStore = Omit<DraftState, 'selectors'> & {
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentNominatedId: (id: string | null) => void;
  setCurrentBidder: (teamId?: number) => void;
  applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => void;
  loadAdp: (opts?: {
    year?: number;
    teams?: number;
    scoring?: 'standard' | 'ppr' | 'half-ppr';
    useCache?: boolean;
    signal?: AbortSignal;
  }) => Promise<boolean>;
  setConfig: (config: { baseBudget: number; teamCount: number; templateRoster: Record<Position, number> }) => void;
  setTeamNames: (names: string[]) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  assignPlayer: (playerId: string, teamId: number, price: number) => void;
  computeMaxBid: (teamId: number, playerPos?: string) => number;
  hasSlotFor: (teamId: number, pos: Position, includeTeInFlex?: boolean) => boolean;
  resetDraft: () => void;
  selectors: {
    undraftedPlayers: (state: DraftState) => Player[];
    topAvailable: (state: DraftState, limit?: number) => Player[];
    topAvailableByPos: (state: DraftState, pos: Position, limit?: number) => Player[];
    topAvailableByMultiPos: (state: DraftState, positions: Position[], limit?: number) => Player[];
    topAvailableForFlex: (state: DraftState, limit?: number, includeTE?: boolean) => Player[];
  };
};

// Helper function to get initial state with proper type safety
const getInitialState = (): DraftState => {
  const persistedState = getPersistedState();
  
  // Default state
  const defaultState: DraftState = {
    players: [],
    playersLoaded: false,
    adpLoaded: false,
    teams: [],
    nominationQueue: [],
    currentAuction: null,
    currentNominatedId: null,
    currentBidder: undefined,
    baseBudget: 200,
    teamCount: 12,
    templateRoster: { ...POSITION_CAP },
    setPlayers: () => {},
    setTeams: () => {},
    setCurrentNominatedId: () => {},
    setCurrentBidder: () => {},
    applyAdp: () => {},
    loadAdp: async () => false,
    setConfig: () => {},
    setTeamNames: () => {},
    nominate: () => {},
    placeBid: () => {},
    assignPlayer: () => {},
    computeMaxBid: () => 0,
    hasSlotFor: () => false,
    resetDraft: () => {},
    selectors: {
      undraftedPlayers: () => [],
      topAvailable: () => [],
      topAvailableByPos: () => [],
      topAvailableByMultiPos: () => [],
      topAvailableForFlex: () => []
    }
  };

  if (!persistedState) {
    return defaultState;
  }

  // Merge persisted state with defaults
  return {
    ...defaultState,
    ...persistedState,
    players: Array.isArray(persistedState.players) ? persistedState.players : [],
    teams: Array.isArray(persistedState.teams) ? persistedState.teams : [],
    nominationQueue: Array.isArray(persistedState.nominationQueue) ? persistedState.nominationQueue : [],
    currentNominatedId: persistedState.currentNominatedId ?? null,
    currentAuction: persistedState.currentAuction || null,
    currentBidder: persistedState.currentBidder,
    baseBudget: typeof persistedState.baseBudget === 'number' ? persistedState.baseBudget : 200,
    teamCount: typeof persistedState.teamCount === 'number' ? persistedState.teamCount : 12,
    templateRoster: persistedState.templateRoster || { ...POSITION_CAP },
    playersLoaded: !!persistedState.playersLoaded
  };
};

// Create the store with proper typing
export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(),
      // Actions

      // Actions
      setPlayers: (players: Player[]) => set({ players }),
      setTeams: (teams: Team[]) => set({ teams }),
      setCurrentNominatedId: (id: string | null) => set({ currentNominatedId: id }),
      setCurrentBidder: (teamId?: number) => set({ currentBidder: teamId }),
      
      // Apply ADP updates to players
      applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => set(produce((state: DraftState) => {
        updates.forEach(update => {
          const player = state.players.find(p => p.id === update.id);
          if (player) {
            Object.assign(player, update);
          }
        });
      })),
      
      // Load ADP data from FFC API
      loadAdp: async (opts?: {
        year?: number;
        teams?: number;
        scoring?: 'standard' | 'ppr' | 'half-ppr';
        useCache?: boolean;
        signal?: AbortSignal;
      }) => {
        try {
          const { 
            year = new Date().getFullYear(), 
            teams = 12, 
            scoring = 'ppr', 
            useCache = true,
            signal
          } = opts as {
            year?: number;
            teams?: number;
            scoring?: 'ppr' | 'standard' | 'half-ppr';
            useCache?: boolean;
            signal?: AbortSignal;
          };
          
          // FFC expects 'half', map from 'half-ppr'
          const ffcScoring: 'ppr' | 'half' | 'standard' = scoring === 'half-ppr' ? 'half' : scoring;
          
          const api = new FfcAdp();
          const rows = await api.load({ 
            year, 
            teams, 
            scoring: ffcScoring, 
            useCache, 
            signal 
          });
          
          // Build composite index from your existing players
          const normName = (s: string) => s.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
          const keyOf = (n: string, t?: string, p?: string) => `${normName(n)}|${(t ?? '').toUpperCase()}|${(p ?? '').toUpperCase()}`;
          
          const byKey = new Map<string, string>(); // key -> playerId
          const state = get();
          state.players.forEach(p => {
            // No need to check for 'D/ST' since Position type only includes 'DEF'
            byKey.set(keyOf(p.name, p.nflTeam, p.pos), p.id);
          });
          
          const updates = rows.flatMap(r => {
            const id = byKey.get(keyOf(r.name, r.team, r.position));
            return id ? [{
              id,
              rank: r.rank,
              posRank: r.posRank,
              adp: r.adp,
              adpSource: `FFC-${ffcScoring.toUpperCase()}-${teams}-${year}`,
            }] : [];
          });
          
          get().applyAdp(updates);
          set({ adpLoaded: true });
          return true;
        } catch (error) {
          console.error('Failed to load ADP data:', error);
          // Don't throw - we can continue without ADP data
          return false;
        };
      },

      // ... rest of the existing actions (setConfig, setTeamNames, nominate, placeBid, assignPlayer, resetDraft)
      setConfig: (config: { teamCount: number; baseBudget: number; templateRoster: Record<Position, number> }) => {
        const { teamCount, baseBudget, templateRoster } = config;
        set({
          teamCount,
          baseBudget,
          templateRoster,
        });
      },
      setTeamNames: (names: string[]) => {
        set(produce((state: DraftState) => {
          state.teams.forEach((team: Team, i: number) => {
            team.name = names[i] || `Team ${i + 1}`;
          });
        }));
      },
      nominate: (playerId: string, startingBid: number = 1) =>
        set((state) => ({
          nominationQueue: [
            { playerId, startingBid, createdAt: Date.now() },
            ...state.nominationQueue.filter((n) => n.playerId !== playerId),
          ],
          currentNominatedId: playerId,
          currentAuction: { playerId, highBid: startingBid, highBidder: null },
        })),
      placeBid: (playerId: string, byTeamId: number, amount: number) => {
        set(produce((state: DraftState) => {
          const auction = state.currentAuction;
          if (!auction) return;

          if (amount > (auction.highBid || 0)) {
            auction.highBid = amount;
            auction.highBidder = byTeamId;
          }
        }));
      },
      assignPlayer: (playerId: string) =>
        set((state) => {
          const ca = state.currentAuction;
          if (!ca || ca.playerId !== playerId) return {};
          if (!ca || ca.playerId !== playerId || ca.highBidder == null) return {};
          const teamId = ca.highBidder;
          const price = ca.highBid;

          const players = state.players.map((p) =>
            p.id === playerId ? { ...p, draftedBy: teamId, price } : p
          );
          const teams = state.teams.map((t) =>
            t.id === teamId ? { ...t, players: [...t.players, playerId] } : t
          );
          const nominationQueue = state.nominationQueue.filter(
            (n) => n.playerId !== playerId
          );
          return {
            players,
            teams,
            nominationQueue,
            currentNominatedId: null,
            currentBidder: undefined,
            currentAuction: null,
          };
        }),
      computeMaxBid: (teamId: number) => {
        const state = get();
        const budget = state.baseBudget;
        const owned = state.players.filter((p) => p.draftedBy === teamId);
        const spent = owned.reduce((sum, p) => sum + (p.price || 0), 0);

        // required roster slots (exclude BENCH)
        const requiredSlots = Object.entries(state.templateRoster).reduce(
          (sum, [pos, cnt]) => sum + (pos === 'BENCH' ? 0 : (cnt as number)),
          0
        );
        const filled = owned.filter((p) => p.pos !== 'BENCH').length;
        const remaining = Math.max(0, requiredSlots - filled);

        // must reserve $1 for every other required spot
        const reserve = Math.max(0, remaining - 1);
        return Math.max(0, budget - spent - reserve);
      },
      hasSlotFor: (teamId: number, pos: Position, includeTeInFlex: boolean = true) => {
        const state = get();
        const team = state.teams.find((t) => t.id === teamId);
        if (!team) return false;

        const cap = (position: keyof typeof state.templateRoster) =>
          state.templateRoster[position] ?? 0;

        const owned = state.players.filter((p) => p.draftedBy === teamId);
        const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0, BENCH: 0 } as Record<
          Position,
          number
        >;

        owned.forEach((p) => {
          if (p.pos in counts) counts[p.pos as keyof typeof counts] += 1;
        });

        // strict slot still open?
        if (counts[pos] < cap(pos as any)) return true;

        // FLEX eligibility by config
        const flexCap = cap('FLEX' as any);
        const isFlexEligible =
          pos === 'RB' || pos === 'WR' || (includeTeInFlex && pos === 'TE');

        if (flexCap > 0 && isFlexEligible) {
          const eligibleOwned = owned.filter(
            (p) => p.pos === 'RB' || p.pos === 'WR' || (includeTeInFlex && p.pos === 'TE')
          ).length;

          const strictUsed =
            Math.min(counts.RB, cap('RB' as any)) +
            Math.min(counts.WR, cap('WR' as any)) +
            Math.min(counts.TE, cap('TE' as any));

          const extraIntoFlex = eligibleOwned - strictUsed;
          return extraIntoFlex < flexCap;
        }

        return false;
      },
      resetDraft: () =>
        set((state) => ({
          players: state.players.map((p) => ({
            ...p,
            draftedBy: undefined,
            price: undefined,
          })),
          teams: state.teams.map((t) => ({ ...t, players: [] })),
          nominationQueue: [],
          currentNominatedId: null,
          currentBidder: undefined,
        })),

      // Selectors
      selectors: {
        undraftedPlayers: (state: DraftState) => state.players.filter((p: Player) => p.draftedBy === undefined),
        
        topAvailable: (state: DraftState, limit: number = 300) => {
          return state.players
            .filter((p: Player) => !p.draftedBy)
            .sort((a: Player, b: Player) => {
              // First by position rank if available
              if (a.posRank !== b.posRank) {
                return (a.posRank || 1000) - (b.posRank || 1000);
              }
              // Then by overall rank if available
              if (a.rank !== b.rank) {
                return (a.rank || 1000) - (b.rank || 1000);
              }
              // Then by ADP if available
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              // Finally by name (A-Z)
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        },
        
        topAvailableByPos: (state: DraftState, pos: Position, limit: number = 100) => {
          return state.players
            .filter((p: Player) => !p.draftedBy && p.pos === pos)
            .sort((a: Player, b: Player) => {
              if (a.posRank !== b.posRank) {
                return (a.posRank || 1000) - (b.posRank || 1000);
              }
              if (a.rank !== b.rank) {
                return (a.rank || 1000) - (b.rank || 1000);
              }
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        },
        
        topAvailableByMultiPos: (state: DraftState, positions: Position[], limit: number = 100) => {
          return state.players
            .filter((p: Player) => !p.draftedBy && positions.includes(p.pos))
            .sort((a: Player, b: Player) => {
              if (a.posRank !== b.posRank) {
                return (a.posRank || 1000) - (b.posRank || 1000);
              }
              if (a.rank !== b.rank) {
                return (a.rank || 1000) - (b.rank || 1000);
              }
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        },
        
        topAvailableForFlex: (state: DraftState, limit: number = 100, includeTE: boolean = true) => {
          return state.players
            .filter((p: Player) => {
              if (p.draftedBy) return false;
              return p.pos === 'RB' || p.pos === 'WR' || (includeTE && p.pos === 'TE');
            })
            .sort((a: Player, b: Player) => {
              if (a.rank !== b.rank) {
                return (a.rank || 1000) - (b.rank || 1000);
              }
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        }
      }
    }),
    {
      name: 'auction-draft-state',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try {
            return localStorage.getItem(name);
          } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
          }
        },
        setItem: (name: string, value: string) => {
          try {
            localStorage.setItem(name, value);
          } catch (error) {
            console.error('Error saving to localStorage:', error);
          }
        },
        removeItem: (name: string) => {
          try {
            localStorage.removeItem(name);
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        },
      })),
      partialize: (state: DraftState) => ({
        players: state.players.map(p => ({
          id: p.id,
          draftedBy: p.draftedBy,
          price: p.price
        })),
        teams: state.teams.map(t => ({
          id: t.id,
          players: t.players,
          budget: t.budget,
          roster: t.roster
        })),
        currentAuction: state.currentAuction,
        currentNominatedId: state.currentNominatedId,
        currentBidder: state.currentBidder,
        baseBudget: state.baseBudget,
        teamCount: state.teamCount,
        templateRoster: state.templateRoster,
        playersLoaded: state.playersLoaded
      })
    }
  )
);

// Dev-only: make the store available in the browser console
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // @ts-ignore
  window.store = useDraftStore;
}

export const useDraftSelectors = () => {
  const selectors = useDraftStore((state) => state.selectors);
  const getState = useDraftStore.getState;
  
  return {
    undraftedPlayers: () => selectors.undraftedPlayers(getState()),
    topAvailable: (limit = 300) => selectors.topAvailable(getState(), limit),
    topAvailableByPos: (pos: Position, limit = 100) => 
      selectors.topAvailableByPos(getState(), pos, limit),
    topAvailableByMultiPos: (positions: Position[], limit = 100) =>
      selectors.topAvailableByMultiPos(getState(), positions, limit),
    topAvailableForFlex: (limit = 100, includeTE = true) =>
      selectors.topAvailableForFlex(getState(), limit, includeTE)
  };
};
