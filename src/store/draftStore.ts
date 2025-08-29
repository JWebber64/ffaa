import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import FfcAdp from '../services/FfcAdp';

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
  currentBid: number;
  highBidder?: number;
}

export interface DraftState {
  // State
  players: Player[];
  playersLoaded: boolean;
  adpLoaded: boolean;
  teams: Team[];
  nominationQueue: Nomination[];
  currentBidder?: number;
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

// Create the store with persistence
export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      // Initial state
      players: [],
      playersLoaded: false,
      adpLoaded: false,
      teams: [],
      baseBudget: 200,
      teamCount: 12,
      templateRoster: { ...POSITION_CAP },
      nominationQueue: [],
      currentNominatedId: null,
      currentBidder: undefined,

      // Actions
      setPlayers: (players) => set({ players, playersLoaded: true }),
      setTeams: (teams) => set({ teams }),
      setCurrentNominatedId: (id) => set({ currentNominatedId: id }),
      setCurrentBidder: (teamId) => set({ currentBidder: teamId }),
      
      // Apply ADP updates to players
      applyAdp: (updates) => set(produce((state: DraftState) => {
        const playerMap = new Map(state.players.map(p => [p.id, p]));
        for (const update of updates) {
          const player = playerMap.get(update.id);
          if (player) {
            Object.assign(player, {
              rank: update.rank,
              posRank: update.posRank,
              adp: update.adp,
              adpSource: update.adpSource
            });
          }
        }
      })),
      
      // Load ADP data from FFC API
      loadAdp: async (opts = {}) => {
        try {
          const { 
            year = new Date().getFullYear(), 
            teams = 12, 
            scoring = 'ppr', 
            useCache = true 
          } = opts as {
            year?: number;
            teams?: number;
            scoring?: 'ppr' | 'standard' | 'half-ppr';
            useCache?: boolean;
          };
          
          // FFC expects 'half', map from 'half-ppr'
          const ffcScoring: 'ppr' | 'half' | 'standard' = scoring === 'half-ppr' ? 'half' : scoring;
          
          const api = new FfcAdp();
          const rows = await api.load({ year, teams, scoring: ffcScoring, useCache });
          
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
      setConfig: (config) => {
        const { teamCount, baseBudget, templateRoster } = config;
        return set(() => ({
          teamCount,
          baseBudget,
          templateRoster: { ...templateRoster },
        }));
      },
      setTeamNames: (names) =>
        set(() => ({
          teams: names.map((name, i) => ({
            id: i + 1,
            name: name || `Team ${i + 1}`,
            players: [],
            budget: get().baseBudget,
            roster: { ...get().templateRoster }
          })),
        })),
      nominate: (playerId: string, startingBid: number = 1) =>
        set((state) => {
          const nom = { playerId, startingBid, currentBid: startingBid, createdAt: Date.now() };
          const nominationQueue = [
            nom,
            ...state.nominationQueue.filter((n) => n.playerId !== playerId),
          ];
          return { nominationQueue, currentNominatedId: playerId };
        }),
      placeBid: (_playerId, byTeamId) => set({ currentBidder: byTeamId }),
      assignPlayer: (playerId: string, teamId: number, price: number) =>
        set((state) => {
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
        // Get undrafted players
        undraftedPlayers: (state: DraftState) => state.players.filter(p => p.draftedBy === undefined),
        
        // Get top available players (undrafted, sorted by rank/adp)
        topAvailable: (state: DraftState, limit = 300) => {
          return state.players
            .filter(p => !p.draftedBy)
            .sort((a, b) => {
              // First by position rank if available
              if (a.posRank !== b.posRank) {
                return (a.posRank || 999) - (b.posRank || 999);
              }
              
              // Then by overall rank
              if (a.rank !== b.rank) {
                return (a.rank || 999) - (b.rank || 999);
              }
              
              // Then by ADP
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              
              // Finally by name (A-Z)
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        },
        
        // Get top available players by position
        topAvailableByPos: (state: DraftState, pos: Position, limit = 100) => {
          const posUpper = pos.toUpperCase();
          // Create a new array reference by spreading the result
          return [...state.players
            .filter(p => p.pos && p.pos.toUpperCase() === posUpper && !p.draftedBy)
            .sort((a, b) => {
              // First by position rank (most important for position-specific views)
              if (a.posRank !== b.posRank) {
                return (a.posRank || 999) - (b.posRank || 999);
              }
              
              // Then by overall rank
              if (a.rank !== b.rank) {
                return (a.rank || 999) - (b.rank || 999);
              }
              
              // Then by ADP
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              
              // Finally by name (A-Z)
              return a.name.localeCompare(b.name);
            })]
            .slice(0, limit);
        },
        
        // Get top available players by multiple positions
        topAvailableByMultiPos: (state: DraftState, positions: Position[], limit = 100) => {
          const posSet = new Set(positions.map(p => p.toUpperCase()));
          const undrafted = state.players.filter(p => 
            p.draftedBy === undefined && p.pos && posSet.has(p.pos.toUpperCase())
          );
          
          return [...undrafted].sort((a, b) => {
            // Use rank or posRank if available
            const aRank = a.posRank ?? a.rank ?? Infinity;
            const bRank = b.posRank ?? b.rank ?? Infinity;
            
            if (aRank !== bRank) {
              return aRank - bRank;
            }
            
            // Fall back to ADP if ranks are equal
            if (a.adp !== undefined && b.adp !== undefined) {
              return a.adp - b.adp;
            }
            
            // Finally, sort by name
            return a.name.localeCompare(b.name);
          }).slice(0, limit);
        },
        
        // Get top available flex players (RB/WR/TE or RB/WR)
        topAvailableForFlex: (state: DraftState, limit = 100, includeTE = true) => {
          const flexPositions = includeTE ? ['RB', 'WR', 'TE'] : ['RB', 'WR'];
          const flexPositionsUpper = flexPositions.map(p => p.toUpperCase());
          return state.players
            .filter(p => p.pos && flexPositionsUpper.includes(p.pos.toUpperCase()) && !p.draftedBy)
            .sort((a, b) => {
              // First by rank
              if (a.rank !== b.rank) {
                return (a.rank || 999) - (b.rank || 999);
              }
              
              // Then by position (RB > WR > TE for flex)
              const posValue = (pos: string) => {
                if (pos === 'RB') return 0;
                if (pos === 'WR') return 1;
                return 2; // TE
              };
              
              const aPos = posValue(a.pos);
              const bPos = posValue(b.pos);
              
              if (aPos !== bPos) {
                return aPos - bPos;
              }
              
              // Then by ADP
              if (a.adp !== b.adp) {
                return (a.adp || 1000) - (b.adp || 1000);
              }
              
              // Finally by name (A-Z)
              return a.name.localeCompare(b.name);
            })
            .slice(0, limit);
        }
      }
    }),
    {
      name: 'auction-draft-state',
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      partialize: (state) => ({
        players: state.players,
        playersLoaded: state.playersLoaded,
        teams: state.teams,
        baseBudget: state.baseBudget,
        teamCount: state.teamCount,
        templateRoster: state.templateRoster,
        nominationQueue: state.nominationQueue,
        currentNominatedId: state.currentNominatedId,
        currentBidder: state.currentBidder
      })
    }
  )
);

// Export selectors for easier access
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
