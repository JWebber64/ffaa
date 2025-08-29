import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce, type Draft } from 'immer';
import { nanoid } from 'nanoid';
import { loadAdp as fetchAdp } from '../api/adp';
import type { 
  Player as PlayerType,
  Team as TeamType,
  Position as PositionType,
  Nomination as NominationType,
  CurrentAuction as CurrentAuctionType,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
  DraftState,
  DraftActions,
  DraftStore,
  AssignmentHistory
} from '../types/draft';

/**
 * TYPES
 */
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
  players: string[]; // player ids
  budget: number;
  /** Remaining capacity per slot (we mutate downward as slots fill) */
  roster: Record<Position, number>;
}

export interface Player {
  id: string;
  name: string;
  pos: Position; // players are stored with base pos; FLEX/BENCH only used as assigned slot
  nflTeam?: string;
  draftedBy?: number;
  price?: number;
  search_rank?: number;
  search_rank_ppr?: number;
  rank?: number;
  posRank?: number;
  adp?: number;
  adpSource?: string;
  /** actual assigned slot on a team (QB/RB/WR/TE/K/DEF/FLEX/BENCH) */
  slot?: Position;
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
  createdAt: number; // ms
}

export interface CurrentAuction {
  playerId: string;
  highBid: number;
  highBidder: number | null;
}

/**
 * DEFAULTS
 */
const DEFAULT_AUCTION_SETTINGS: AuctionSettings = {
  countdownSeconds: 30,
  antiSnipeSeconds: 10,
  nominationOrderMode: 'regular',
  reverseAtRound: undefined,
};

const DEFAULT_BID_STATE: BidState = {
  isLive: false,
  highBid: 0,
  highBidder: null,
  startingBid: 1,
  playerId: undefined,
  endsAt: undefined,
  round: 1,
};

const DEFAULT_ROSTER: Record<Position, number> = {
  QB: 2,
  RB: 6,
  WR: 6,
  TE: 3,
  K: 2,
  DEF: 2,
  FLEX: 1,
  BENCH: 6,
};

const initialRuntime: DraftRuntime = {
  currentNominatorTeamId: null,
  nominationOrder: [],
  baseOrder: [],
  round: 1,
};

/**
 * HELPERS
 */
function computeNominationOrder(
  base: number[],
  mode: 'regular' | 'snake' | 'reverse',
  reverseAtRound: number | undefined,
  round: number
): number[] {
  if (!base.length) return [];
  if (mode === 'regular') return [...base];

  if (mode === 'snake') {
    const odd = round % 2 === 1;
    return odd ? [...base] : [...base].slice().reverse();
  }

  // reverse (from given round inclusive)
  if (mode === 'reverse') {
    if (reverseAtRound && round >= reverseAtRound) return [...base].slice().reverse();
    return [...base];
  }
  return [...base];
}

function draftedCountForTeam(players: Player[], teamId: number): number {
  return players.filter((p) => p.draftedBy === teamId).length;
}

function nextNominatorPointer(draft: Draft<DraftState>) {
  const order = draft.runtime.nominationOrder;
  if (!order.length) {
    draft.runtime.currentNominatorTeamId = null;
    return;
  }
  const idx = order.indexOf(draft.runtime.currentNominatorTeamId ?? -1);
  const nextIdx = idx >= 0 ? (idx + 1) % order.length : 0;

  // Completed lap → advance round & recompute snake/reverse as needed
  if (idx >= 0 && nextIdx === 0) {
    draft.runtime.round += 1;
    draft.bidState.round = draft.runtime.round;
    draft.runtime.nominationOrder = computeNominationOrder(
      draft.runtime.baseOrder,
      draft.auctionSettings.nominationOrderMode,
      draft.auctionSettings.reverseAtRound,
      draft.runtime.round
    );
  }
  draft.runtime.currentNominatorTeamId = draft.runtime.nominationOrder[nextIdx] ?? null;
}

/**
 * STORE
 */
// Helper type for store setter
type SetState = (
  partial: DraftState | Partial<DraftState> | ((state: DraftState) => DraftState | Partial<DraftState>),
  replace?: boolean
) => void;

// Helper type for store getter
type GetState = () => DraftState;

// Define the store's state and actions
type Store = DraftState & DraftActions;

// Helper type for the store creator
type StoreCreator = (
  set: (partial: Store | Partial<Store> | ((state: Store) => Store | Partial<Store>), replace?: boolean) => void,
  get: () => Store,
  api: any
) => Store;

/**
 * CREATE STORE
 */
// Create the store with proper typing
export const useDraftStore = create<DraftState & DraftActions>()(
  devtools(
    persist(
      ((set, get, api) => {
        const iSet = (
          producer: (draft: Draft<DraftState>) => void
        ) => set(produce(producer) as (state: DraftState) => DraftState);

        // Return the store object with proper typing
        // Helper function to add to assignment history
        const pushAssignmentHistory = (s: Draft<DraftState>, h: Omit<AssignmentHistory, 'id' | 'ts'>) => {
          const newHistory = {
            ...h,
            id: nanoid(),
            ts: Date.now(),
          };
          s.assignmentHistory.unshift(newHistory);
          if (s.assignmentHistory.length > 50) s.assignmentHistory.pop();
        };

        return {
          // Initial state
          players: [],
          playersLoaded: false,
          adpLoaded: false,
          teams: [],
          assignmentHistory: [],
          auctionSettings: DEFAULT_AUCTION_SETTINGS,
          bidState: DEFAULT_BID_STATE,
          runtime: initialRuntime,
          nominationQueue: [],
          currentAuction: null,
          currentNominatedId: null,
          baseBudget: 200,
          teamCount: 12,
          templateRoster: { ...DEFAULT_ROSTER },
          pendingAssignment: null,
          logs: [],

          // Actions
          setAuctionSettings: (settings: Partial<AuctionSettings>) => {
            set(state => ({
              ...state,
              auctionSettings: { ...state.auctionSettings, ...settings }
            }));
          },
          setPlayers: (players: Player[]) => {
            set(state => ({
              ...state,
              players,
              playersLoaded: true
            }));
          },
          setTeams: (teams: Team[]) => {
            set(state => ({
              ...state,
              teams
            }));
          },
          setCurrentNominatedId: (id: string | null) => {
            set(state => ({
              ...state,
              currentNominatedId: id
            }));
          },
          setCurrentBidder: (teamId?: number) => {
            set(state => ({
              ...state,
              currentBidder: teamId
            }));
          },
          applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => {
            set(state => {
              const newPlayers = [...state.players];
              updates.forEach(update => {
                const index = newPlayers.findIndex(p => p.id === update.id);
                if (index !== -1) {
                  newPlayers[index] = {
                    ...newPlayers[index],
                    adp: update.adp,
                    adpSource: update.adpSource
                  };
                }
              });
              return { ...state, players: newPlayers };
            });
          },
          loadAdp: async (opts = {}) => {
            try {
              const updates = await fetchAdp(opts);
              if (updates) {
                get().applyAdp(updates);
                return true;
              }
              return false;
            } catch (error) {
              console.error('Failed to load ADP:', error);
              return false;
            }
          },
          setConfig: (config: {
            teamCount: number;
            baseBudget: number;
            templateRoster: Record<Position, number>;
          }) => {
            iSet(draft => {
              draft.teamCount = config.teamCount;
              draft.baseBudget = config.baseBudget;
              draft.templateRoster = { ...config.templateRoster };
              // also refresh each team’s roster caps to match new template
              draft.teams = draft.teams.map(t => ({
                ...t,
                roster: { ...draft.templateRoster },
              }));
            });
          },
          setTeamNames: (names: string[]) => {
            if (!names.length) return;

            const teams: TeamType[] = names.map((name, i) => ({
              id: i + 1,
              name: name || `Team ${i + 1}`,
              players: [],
              owner: name || `Owner ${i + 1}`,
              budget: 200,
              roster: {} as Record<PositionType, number>,
            }));

            set({ teams } as Partial<Store>);
          },
          nominate: (playerId: string, startingBid?: number) => {
            const state = get();
            const player: PlayerType | undefined = state.players.find(p => p.id === playerId);
            if (!player || player.draftedBy != null) return;

            iSet(draft => {
              const start = Math.max(1, startingBid ?? 1);
              const now = Date.now();

              draft.currentNominatedId = playerId;
              draft.bidState.isLive = true;
              draft.bidState.playerId = playerId;
              draft.bidState.startingBid = start;
              draft.bidState.highBid = start - 1; // allow first bid at "start"
              draft.bidState.highBidder = null;
              draft.bidState.endsAt = now + draft.auctionSettings.countdownSeconds * 1000;

              draft.currentAuction = {
                playerId,
                highBid: 0,
                highBidder: null,
              };

              // advance nominator pointer for next nomination right away
              nextNominatorPointer(draft);
            });
          },
          placeBid: (playerId: string, byTeamId: number, amount: number) => {
            set(
              produce((state: DraftState) => {
                if (!state.bidState.isLive || state.bidState.playerId !== playerId) return;
                
                state.bidState.highBid = amount;
                state.bidState.highBidder = byTeamId;
                
                // Add anti-snipe time if needed
                const now = Date.now();
                const timeRemaining = (state.bidState.endsAt || 0) - now;
                if (timeRemaining < state.auctionSettings.antiSnipeSeconds * 1000) {
                  state.bidState.endsAt = now + state.auctionSettings.antiSnipeSeconds * 1000;
                }
              })
            );
          },
          settleAuctionIfExpired: () => {
            set(
              produce((state: DraftState) => {
                if (!state.bidState.isLive || !state.bidState.endsAt) return;
                
                const now = Date.now();
                if (now >= state.bidState.endsAt) {
                  const { highBidder, playerId, highBid } = state.bidState;
                  if (highBidder !== null && playerId) {
                    // Assign player to team
                    const player = state.players.find(p => p.id === playerId);
                    if (player) {
                      player.draftedBy = highBidder;
                      player.price = highBid;
                      
                      // Deduct from team budget
                      const team = state.teams.find(t => t.id === highBidder);
                      if (team) {
                        team.budget -= highBid;
                      }
                      
                      // Log the transaction
                      state.logs.push({
                        id: nanoid(),
                        ts: now,
                        type: 'AUCTION_ENDED',
                        message: `${player.name} drafted by Team ${highBidder} for $${highBid}`
                      } as LogEvent);
                    }
                  }
                  
                  // Reset auction state
                  state.bidState = {
                    ...DEFAULT_BID_STATE,
                    round: state.runtime.round
                  };
                  
                  // Move to next nominator
                  nextNominatorPointer(state);
                  
                  // Get references to player and team
                  const player = state.players.find(p => p.id === state.bidState.playerId);
                  const team = state.teams.find(t => t.id === state.bidState.highBidder);
                  
                  if (player && team) {
                    const price = state.bidState.highBid;
                    const slot = state.pendingAssignment?.validSlots?.[0]; // Get first valid slot if available
                    
                    // Assign player to team
                    player.draftedBy = team.id;
                    player.price = price;
                    if (slot) player.slot = slot as Position;

                    // Deduct from team budget
                    team.budget -= price;

                    // Update team's roster slot count if slot is provided
                    if (slot) {
                      team.roster[slot as Position] = (team.roster[slot as Position] ?? 0) - 1;
                    }

                    // Log the assignment
                    state.logs.push({
                      id: nanoid(),
                      ts: Date.now(),
                      type: 'ASSIGNED',
                      message: `Assigned ${player.name} to ${team.name} for $${price}${slot ? ` (${slot})` : ''}`,
                    });

                    // Record assignment history
                    state.assignmentHistory.unshift({
                      id: nanoid(),
                      ts: Date.now(),
                      playerId: player.id,
                      teamId: team.id,
                      slot: slot || null,
                      priceRefund: price,
                      source: 'auction' as const,
                    });
                    
                    // Keep only the last 50 assignments
                    if (state.assignmentHistory.length > 50) {
                      state.assignmentHistory.pop();
                    }
                  }
                }
              })
            );
          },
          
          hasSlotFor: (teamId: number, pos: Position, includeTeInFlex: boolean = false) => {
            const team = get().teams.find(t => t.id === teamId);
            if (!team) return false;
            
            // Check if position is directly available
            if (team.roster[pos] > 0) return true;
            
            // Check FLEX position if applicable
            if (pos === 'FLEX') {
              return (team.roster['RB'] > 0) ||
                     (team.roster['WR'] > 0) ||
                     (includeTeInFlex && team.roster['TE'] > 0);
            }
            
            // Check if TE can use FLEX slot
            if (pos === 'TE' && includeTeInFlex && team.roster['FLEX'] > 0) {
              return true;
            }
            
            return false;
          },
          computeMaxBid: (teamId: number, playerPos?: Position) => {
            const state = get();
            const team: TeamType | undefined = state.teams.find(t => t.id === teamId);
            if (!team) return 0;

            const getTeamSpent = (teamId: number): number => {
              const team = get().teams.find(t => t.id === teamId);
              if (!team) return 0;

              const players = get().players.filter(p => team.players.includes(p.id));
              return players.reduce((sum, p) => sum + (p.price || 0), 0);
            };

            const spent = getTeamSpent(teamId);
            const remainingCash = team.budget - spent;
            if (remainingCash <= 0) return 0;

            const totalRemainingSpots = (Object.keys(team.roster) as Position[]).reduce(
              (acc, k) => acc + (team.roster[k] ?? 0),
              0
            );

            // if no spots, cannot bid
            if (totalRemainingSpots <= 0) return 0;

            // $1 minimum for each *future* player (reserve 1 for each open spot except the one we’re bidding on)
            const reserveForOthers = Math.max(0, totalRemainingSpots - 1);
            const baselineMax = remainingCash - reserveForOthers;

            // additionally, ensure there is at least one legal slot if playerPos provided
            if (playerPos && !state.hasSlotFor(teamId, playerPos, true)) return 0;

            return Math.max(0, Math.floor(baselineMax));
        },

        undoLastAssignment: (opts?: { isAdmin?: boolean }) => {
          const state = get();
          
          if (!opts?.isAdmin) {
            state.pushLog({ 
              type: 'ERROR', 
              message: 'Undo rejected: admin only.' 
            });
            return;
          }
          
          const lastAssignment = state.assignmentHistory[0];
          if (!lastAssignment) {
            state.pushLog({ 
              type: 'ERROR', 
              message: 'No assignments to undo.' 
            });
            return;
          }
          
          const { playerId, teamId, slot, priceRefund } = lastAssignment;
          const player = state.players.find(p => p.id === playerId);
          const team = state.teams.find(t => t.id === teamId);
          
          if (!player || !team) {
            state.pushLog({ 
              type: 'ERROR', 
              message: 'Could not find player or team for undo.' 
            });
            return;
          }
          
          // Undo the assignment
          delete player.draftedBy;
          delete player.price;
          if (slot) {
            delete player.slot;
          }
          
          // Refund the team's budget if this was an auction win
          if (priceRefund) {
            team.budget += priceRefund;
          }
          
          // Restore roster slot if applicable
          if (slot) {
            team.roster[slot as Position] = (team.roster[slot as Position] || 0) + 1;
          }
          
          // Remove from assignment history
          state.assignmentHistory.shift();
          
          // Log the undo action
          state.pushLog({
            type: 'ASSIGNED',
            message: `Undo: Removed ${player.name} from ${team.name}${slot ? ` (${slot})` : ''}`,
          });
        },
        
        assignPlayer: (playerId: string, teamId: number, price: number, slot?: string) => {
          iSet(draft => {
            const player = draft.players.find(p => p.id === playerId);
            if (!player) return;

            const team = draft.teams.find(t => t.id === teamId);
            if (!team) return;

            // Update player
            player.draftedBy = teamId;
            player.price = price;
            if (slot) player.slot = slot as Position;

            // Deduct from team budget
            team.budget -= price;

            // Update team's roster slot count if slot is provided
            if (slot && team.roster[slot as Position] !== undefined) {
              team.roster[slot as Position] = (team.roster[slot as Position] || 0) - 1;
            }

            // Log the assignment
            draft.logs.push({
              id: nanoid(),
              ts: Date.now(),
              type: 'ASSIGNED',
              message: `Assigned ${player.name} to ${team.name} for $${price}${slot ? ` (${slot})` : ''}`,
            });

            // Record assignment history
            draft.assignmentHistory.unshift({
              id: nanoid(),
              ts: Date.now(),
              playerId: player.id,
              teamId: team.id,
              slot: slot as Position || null,
              priceRefund: price,
              source: 'instant' as const,
            });

            // Keep only the last 50 assignments
            if (draft.assignmentHistory.length > 50) {
              draft.assignmentHistory.pop();
            }
          });
        },

        resetDraft: () => {
            iSet(draft => {
              // reset players
              draft.players = draft.players.map(p => ({
                ...p,
                draftedBy: undefined,
                price: undefined,
                slot: undefined,
              }));
              // reset teams
              draft.teams = draft.teams.map(t => ({
                ...t,
                players: [],
                budget: draft.baseBudget,
                roster: { ...draft.templateRoster },
              }));

              // reset auction/runtime
              draft.currentAuction = null;
              draft.currentNominatedId = null;
              draft.currentBidder = undefined;
              draft.nominationQueue = [];
              draft.pendingAssignment = null;
              draft.bidState = { ...DEFAULT_BID_STATE };
              draft.runtime = { ...initialRuntime };
              if (draft.teams.length) {
                draft.runtime.baseOrder = draft.teams.map(x => x.id);
                draft.runtime.nominationOrder = computeNominationOrder(
                  draft.runtime.baseOrder,
                  draft.auctionSettings.nominationOrderMode,
                  draft.auctionSettings.reverseAtRound,
                  draft.runtime.round
                );
                draft.runtime.currentNominatorTeamId = draft.runtime.nominationOrder[0] ?? null;
              }
              draft.logs = [];
            });
          },

          pushLog: (event: Omit<LogEvent, 'id' | 'ts'>) => {
            set(
              produce((state: DraftState) => {
                if (!state.logs) state.logs = [];
                state.logs.unshift({
                  ...event,
                  id: nanoid(),
                  ts: Date.now(),
                } as LogEvent);
                // Keep logs at a reasonable size
                if (state.logs.length > 200) state.logs.pop();
              })
            );
          },

          clearLogs: () => {
            set({ logs: [] });
          },

          // Selectors (stateful functions)
          selectors: {
            undraftedPlayers: (state: DraftState) =>
              state.players.filter((p: PlayerType) => p.draftedBy === undefined),
            topAvailable: (state: DraftState, limit = 300) =>
              state.players
                .filter((p: PlayerType) => p.draftedBy === undefined)
                .sort((a: PlayerType, b: PlayerType) => (a.rank || 0) - (b.rank || 0))
                .slice(0, limit),
            topAvailableByPos: (state: DraftState, pos: Position, limit = 100) =>
              state.players
                .filter((p: Player) => p.draftedBy === undefined && p.pos === pos)
                .sort((a: Player, b: Player) => (a.rank || 0) - (b.rank || 0))
                .slice(0, limit),
            topAvailableByMultiPos: (state: DraftState, positions: Position[], limit = 100) =>
              state.players
                .filter(
                  (p: Player) => p.draftedBy === undefined && positions.includes(p.pos as Position)
                )
                .sort((a: Player, b: Player) => (a.rank || 0) - (b.rank || 0))
                .slice(0, limit),
            topAvailableForFlex: (state: DraftState, limit = 100, includeTE = true) => {
              const flexPositions: Position[] = ['RB', 'WR'];
              if (includeTE) flexPositions.push('TE');
              return state.players
                .filter(
                  (p: Player) =>
                    p.draftedBy === undefined &&
                    flexPositions.includes(p.pos as Position)
                )
                .sort((a: Player, b: Player) => (a.rank || 0) - (b.rank || 0))
                .slice(0, limit);
            },
          },
        };
      }) as StoreCreator,
      {
        name: 'draft-store',
        version: 1,
        storage: createJSONStorage(() => window.localStorage),
        partialize: (state: Store) => ({
          // keep only what we need to restore
          players: state.players.map(p => ({
            id: p.id,
            draftedBy: p.draftedBy,
            price: p.price,
            slot: p.slot,
          })),
          teams: state.teams.map(t => ({
            id: t.id,
            players: t.players,
            budget: t.budget,
            roster: t.roster,
            name: t.name,
          })),
          currentAuction: state.currentAuction,
          currentNominatedId: state.currentNominatedId,
          currentBidder: state.currentBidder,
          baseBudget: state.baseBudget,
          teamCount: state.teamCount,
          templateRoster: state.templateRoster,
          playersLoaded: state.playersLoaded,
          adpLoaded: state.adpLoaded,
          auctionSettings: state.auctionSettings,
          bidState: state.bidState,
          runtime: state.runtime,
        }),
      }
    )
  )
);

/**
 * Dev-only: expose in console
 */
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  // @ts-expect-error dev hook
  window.store = useDraftStore;
}

/**
 * HOOK WRAPPER FOR SELECTORS
 */
export const useDraftSelectors = () => {
  const selectors = useDraftStore((state) => state.selectors);
  const state = useDraftStore();

  return {
    undraftedPlayers: () => selectors.undraftedPlayers(state),
    topAvailable: (limit = 300) => selectors.topAvailable(state, limit),
    topAvailableByPos: (pos: Position, limit = 100) =>
      selectors.topAvailableByPos(state, pos, limit),
    topAvailableByMultiPos: (positions: Position[], limit = 100) =>
      selectors.topAvailableByMultiPos(state, positions, limit),
    topAvailableForFlex: (limit = 100, includeTE = true) =>
      selectors.topAvailableForFlex(state, limit, includeTE),
  };
};
