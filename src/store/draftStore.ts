// src/store/draftStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { produce, type Draft } from 'immer';
import { nanoid } from 'nanoid';
import { loadAdp as fetchAdp } from '../api/adp';

import type {
  Player,
  Team,
  Position,
  BasePosition,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
  DraftStore as DraftStoreType,
  AssignmentHistory,
  NominationOrderMode,
} from '../types/draft';

// Re-export for compatibility (prevents unused-type lint noise elsewhere)
export type {
  DraftState,
  Position,
  BasePosition,
  Player,
  Team,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
  AssignmentHistory,
  NominationOrderMode,
  LogEventType,
} from '../types/draft';

/* ---------------------------------------------------------------------------------------------- */

// Type for the store that will be exposed on window for debugging
type DebugStore = {
  getState: () => DraftStoreType;
  setState: (state: Partial<DraftStoreType> | ((state: DraftStoreType) => DraftStoreType)) => void;
  subscribe: (listener: (state: DraftStoreType, prevState: DraftStoreType) => void) => () => void;
};

declare global {
  interface Window {
    localStorage: Storage;
    store?: DebugStore;
  }
}

type DraftStore = DraftStoreType;

/* Defaults */
const DEFAULT_AUCTION_SETTINGS: Omit<AuctionSettings, 'reverseAtRound'> & { reverseAtRound?: number | undefined } = {
  countdownSeconds: 30,
  antiSnipeSeconds: 10,
  nominationOrderMode: 'regular',
  reverseAtRound: undefined,
};

const DEFAULT_BID_STATE: Omit<BidState, 'playerId' | 'endsAt'> & {
  playerId?: string;
  endsAt?: number;
} = {
  isLive: false,
  highBid: 0,
  highBidder: null,
  startingBid: 1,
  round: 1,
};

const DEFAULT_ROSTER: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  K: 0,
  DEF: 0,
  FLEX: 1,
  BENCH: 4,
};

const initialRuntime: DraftRuntime = {
  currentNominatorTeamId: null,
  nominationOrder: [],
  baseOrder: [],
  round: 1,
};

/* Helpers */
function computeNominationOrder(
  base: number[],
  mode: NominationOrderMode,
  reverseAtRound: number | undefined,
  round: number
): number[] {
  if (!base.length) return [];
  if (mode === 'regular') return [...base];
  if (mode === 'snake') return (round % 2 === 1) ? [...base] : [...base].slice().reverse();
  if (mode === 'reverse') {
    if (reverseAtRound && round >= reverseAtRound) return [...base].slice().reverse();
    return [...base];
  }
  return [...base];
}

function nextNominatorPointer(draft: Draft<DraftStore>) {
  const order = draft.runtime.nominationOrder;
  if (!order.length) {
    draft.runtime.currentNominatorTeamId = null;
    return;
  }
  const idx = order.indexOf(draft.runtime.currentNominatorTeamId ?? -1);
  const nextIdx = idx >= 0 ? (idx + 1) % order.length : 0;

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

function isFlexEligible(pos: BasePosition, includeTE = true): pos is 'RB' | 'WR' | 'TE' {
  return pos === 'RB' || pos === 'WR' || (includeTE && pos === 'TE');
}

function getValidSlots(team: Team, player: Player, includeTEinFlex = true): Position[] {
  const out: Position[] = [];
  const basePos = player.pos as Position;
  
  // Special handling for QBs - prioritize QB slot
  if (basePos === 'QB') {
    if ((team.roster.QB ?? 0) > 0) {
      return ['QB'];
    }
    // If no QB slot, don't assign to other positions
    return (team.roster.BENCH ?? 0) > 0 ? ['BENCH'] : [];
  }
  
  // For other positions, check primary position first
  if (basePos !== 'FLEX' && basePos !== 'BENCH' && (team.roster[basePos] ?? 0) > 0) {
    out.push(basePos);
  }
  
  // Check FLEX eligibility if needed
  if (
    player.pos !== 'FLEX' &&
    player.pos !== 'BENCH' &&
    isFlexEligible(player.pos, includeTEinFlex) &&
    (team.roster.FLEX ?? 0) > 0
  ) {
    out.push('FLEX');
  }
  
  // Always include BENCH as a fallback if no other slots are available
  if ((team.roster.BENCH ?? 0) > 0) {
    out.push('BENCH');
  }
  
  return out;
}

/* ---------------------------------------------------------------------------------------------- */
/* Store creator */
/* ---------------------------------------------------------------------------------------------- */

type Creator = StateCreator<
  DraftStore,
  [['zustand/devtools', never], ['zustand/persist', unknown]],
  [],
  DraftStore
>;

const creator: Creator = ((set: (partial: DraftStore | Partial<DraftStore> | ((state: DraftStore) => DraftStore | Partial<DraftStore>), replace?: boolean) => void, get: () => DraftStore) => {
  const iSet = (fn: (draft: Draft<DraftStoreType>) => void) =>
    set(produce(fn) as (s: DraftStore) => DraftStore);

  return {
    /* ----------------------------- Initial State ----------------------------- */
    players: [],
    playersLoaded: false,
    adpLoaded: false,

    teams: [],
    teamCount: 12,
    baseBudget: 200,
    templateRoster: { ...DEFAULT_ROSTER },

    auctionSettings: { ...DEFAULT_AUCTION_SETTINGS },
    bidState: { ...DEFAULT_BID_STATE },

    runtime: { ...initialRuntime },

    nominationQueue: [],
    currentAuction: null,
    currentNominatedId: null,
    currentBidder: undefined,

    pendingAssignment: null,

    assignmentHistory: [],
    logs: [],

    /* -------------------------------- Actions -------------------------------- */

    setAuctionSettings: (settings: Partial<AuctionSettings>, options: { isAdmin?: boolean } = {}) => {
      if (!options.isAdmin) {
        throw new Error('Admin privileges required to update auction settings');
      }
      
      iSet((draft) => {
        draft.auctionSettings = { ...draft.auctionSettings, ...settings };
        draft.pushLog({
          type: 'AUCTION_SETTINGS_UPDATED',
          message: `Auction settings updated`,
        });
      });
    },

    setPlayers: (players: Player[]) => {
      console.log('[DraftStore] Setting players:', players.length);
      const firstPlayer = players[0];
      if (firstPlayer) {
        console.log('[DraftStore] First player:', {
          id: firstPlayer.id,
          name: firstPlayer.name,
          pos: firstPlayer.pos,
          nflTeam: firstPlayer.nflTeam,
          rank: firstPlayer.rank
        });
      }
      iSet((draft) => {
        draft.players = players;
        draft.playersLoaded = true;
      });
      // Verify the players were set
      const updatedPlayers = get().players;
      console.log('[DraftStore] Players after set:', updatedPlayers.length);
      if (updatedPlayers.length > 0) {
        console.log('[DraftStore] First player after set:', {
          id: updatedPlayers[0]?.id,
          name: updatedPlayers[0]?.name,
          pos: updatedPlayers[0]?.pos,
          nflTeam: updatedPlayers[0]?.nflTeam,
          rank: updatedPlayers[0]?.rank
        });
      }
    },

    setTeams: (teams: Team[]) => {
      set((state) => ({
        ...state,
        teams,
      }));
    },

    updateTeam: (teamId: number, updates: Partial<Team>) => {
      set((state) => ({
        ...state,
        teams: state.teams.map((team) => (team.id === teamId ? { ...team, ...updates } : team)),
      }));
    },

    setCurrentNominatedId: (id: string | null) => {
      set((state) => ({
        ...state,
        currentNominatedId: id,
      }));
    },

    setCurrentBidder: (teamId?: number) => {
      set((state) => ({
        ...state,
        currentBidder: teamId,
      } as DraftStore));
    },

    applyAdp: (updates: { id: string; adp: number; adpSource: string }[]) => {
      set((state) => {
        const newPlayers = state.players.map(player => {
          const update = updates.find(u => u.id === player.id);
          if (!update) return player;
          
          return {
            ...player,
            adp: update.adp,
            adpSource: update.adpSource,
          };
        });
        return { ...state, players: newPlayers };
      });
    },

    loadAdp: async (opts: { 
    year?: number;
    teams?: number;
    scoring?: 'standard' | 'ppr' | 'half-ppr';
    useCache?: boolean;
    signal?: AbortSignal;
  } = {}) => {
      const { year = 2023, teams = 12, scoring = 'ppr', useCache = true, signal } = opts;
      
      try {
        const fetchOptions = { year, teams, scoring, useCache };
        // Only include signal if it's defined
        if (signal) {
          Object.assign(fetchOptions, { signal });
        }
        const updates = await fetchAdp(fetchOptions);
        
        iSet((draft) => {
          draft.applyAdp(updates);
          draft.adpLoaded = true;
          draft.pushLog({
            type: 'ADP_LOADED',
            message: `ADP data loaded for ${year} (${teams} teams, ${scoring} scoring)`,
          });
        });
        
        return true;
      } catch (error) {
        console.error('Failed to load ADP data:', error);
        iSet(draft => {
          draft.pushLog({
            type: 'ADP_LOAD_ERROR',
            message: `Failed to load ADP data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        });
        return false;
      }
    },

    setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }, options: { isAdmin?: boolean } = {}) => {
      if (!options.isAdmin) {
        throw new Error('Admin privileges required to update draft configuration');
      }
      
      iSet((draft) => {
        draft.teamCount = config.teamCount;
        draft.baseBudget = config.baseBudget;
        draft.templateRoster = config.templateRoster;
        
        // Reset teams with new config
        draft.teams = Array.from({ length: config.teamCount }, (_, i) => ({
          id: i + 1,
          name: `Team ${i + 1}`,
          players: [],
          budget: config.baseBudget,
          roster: { ...draft.templateRoster },
        }));
        
        draft.pushLog({
          type: 'DRAFT_CONFIG_UPDATED',
          message: `Draft config updated: ${config.teamCount} teams, $${config.baseBudget} budget`,
        });
      });
    },

    setTeamNames: (names: string[]) => {
      iSet((draft) => {
        if (names.length !== draft.teamCount) {
          console.warn(`Expected ${draft.teamCount} team names, got ${names.length}. Using default names.`);
          return;
        }
        
        draft.teams.forEach((team, i) => {
          if (names[i]) {
            team.name = names[i];
          }
        });
        
        draft.pushLog({
          type: 'TEAM_NAMES_UPDATED',
          message: 'Team names updated',
        });
      });
    },

    nominate: (playerId: string, startingBid: number) => {
      const state = get();
      const player = state.players.find((p) => p.id === playerId);
      if (!player || player.draftedBy != null) return;

      iSet((draft) => {
        const start = Math.max(1, startingBid ?? 1);
        const now = Date.now();

        draft.currentNominatedId = playerId;
        draft.bidState.isLive = true;
        draft.bidState.playerId = playerId;
        draft.bidState.startingBid = start;
        draft.bidState.highBid = start - 1; // first bid can be == start
        draft.bidState.highBidder = null;
        draft.bidState.endsAt = now + draft.auctionSettings.countdownSeconds * 1000;

        draft.currentAuction = {
          playerId,
          highBid: 0,
          highBidder: null,
        };

        // move pointer immediately to know who's next
        nextNominatorPointer(draft);
      });
    },

    placeBid: (playerId: string, byTeamId: number, amount: number) => {
      set(
        produce((state: DraftStore) => {
          if (!state.bidState.isLive || state.bidState.playerId !== playerId) return;
          if (amount <= (state.bidState.highBid ?? 0)) return;

          state.bidState.highBid = amount;
          state.bidState.highBidder = byTeamId;

          // Anti-snipe
          const now = Date.now();
          const remaining = (state.bidState.endsAt ?? 0) - now;
          if (remaining < state.auctionSettings.antiSnipeSeconds * 1000) {
            state.bidState.endsAt = now + state.auctionSettings.antiSnipeSeconds * 1000;
          }

          if (state.currentAuction) {
            state.currentAuction.highBid = amount;
            state.currentAuction.highBidder = byTeamId ?? null;
          }
        })
      );
    },

    settleAuctionIfExpired: () => {
      set(
        produce((state: DraftStore) => {
          const bs = state.bidState;
          if (!bs.isLive || !bs.endsAt) return;

          const now = Date.now();
          if (now < bs.endsAt) return;

          // Snapshot pre-reset
          const { highBidder, playerId, highBid } = bs;

          // Reset live auction
          state.bidState = { ...DEFAULT_BID_STATE, round: state.runtime.round };
          state.currentAuction = null;
          state.currentNominatedId = null;

          // Advance nominator for next time
          nextNominatorPointer(state);

          // No winner / no player → just log and stop
          if (highBidder == null || !playerId) {
            state.logs.unshift({
              id: nanoid(),
              ts: now,
              type: 'AUCTION_ENDED',
              message: 'Auction ended with no valid bids',
            } as LogEvent);
            return;
          }

          const player = state.players.find((p) => p.id === playerId);
          const team = state.teams.find((t) => t.id === highBidder);
          if (!player || !team) return;

          // For QBs, handle specially to ensure they go to QB slot first
          if (player.pos === 'QB') {
            const teamIndex = state.teams.findIndex((t: Team) => t.id === team.id);
            const playerIndex = state.players.findIndex((p: Player) => p.id === player.id);
            
            if (teamIndex === -1 || playerIndex === -1) return;
            
            // Get current state with proper type assertions
            const currentTeam = state.teams[teamIndex] as Team & {
              roster: Record<Position, number>;
              budget: number;
            };
            const currentPlayer = state.players[playerIndex] as Player & {
              name: string;
              pos: Position;
            };
            
            if (currentTeam.roster.QB > 0) {
              // Assign to QB slot
              // Create the updated player
              const updatedPlayer: Player = {
                ...currentPlayer,
                draftedBy: team.id,
                price: highBid,
                slot: 'QB' as const
              };
              
              // Update the players array first
              state.players = state.players.map(p => 
                p.id === playerId ? updatedPlayer : p
              );
              
              // Then update the team
              state.teams[teamIndex] = {
                ...currentTeam,
                roster: {
                  ...currentTeam.roster,
                  QB: currentTeam.roster.QB - 1
                },
                budget: currentTeam.budget - highBid,
                players: [...new Set([...(currentTeam.players || []), playerId])]
              };
              
              state.logs = [{
                id: nanoid(),
                ts: now,
                type: 'ASSIGNED' as const,
                message: `Assigned ${currentPlayer.name} to ${currentTeam.name} for $${highBid} (QB)`,
              }, ...state.logs];

              state.assignmentHistory = [{
                id: nanoid(),
                ts: now,
                playerId: currentPlayer.id,
                teamId: currentTeam.id,
                slot: 'QB' as const,
                priceRefund: highBid,
                source: 'auction' as const,
              }, ...state.assignmentHistory];
              
              return;
            } else if (currentTeam.roster.BENCH > 0) {
              // No QB slot available, assign to bench
              // Create the updated player
              const updatedPlayer: Player = {
                ...currentPlayer,
                draftedBy: team.id,
                price: highBid,
                slot: 'BENCH' as const
              };
              
              // Update the players array first
              state.players = state.players.map(p => 
                p.id === playerId ? updatedPlayer : p
              );
              
              // Then update the team
              state.teams[teamIndex] = {
                ...currentTeam,
                roster: {
                  ...currentTeam.roster,
                  BENCH: currentTeam.roster.BENCH - 1
                },
                budget: currentTeam.budget - highBid,
                players: [...new Set([...(currentTeam.players || []), playerId])]
              };
              
              state.logs = [{
                id: nanoid(),
                ts: now,
                type: 'ASSIGNED' as const,
                message: `Assigned ${currentPlayer.name} to ${currentTeam.name} for $${highBid} (BENCH - No QB slot available)`,
              }, ...state.logs];

              state.assignmentHistory = [{
                id: nanoid(),
                ts: now,
                playerId: currentPlayer.id,
                teamId: currentTeam.id,
                slot: 'BENCH' as const,
                priceRefund: highBid,
                source: 'auction' as const,
              }, ...state.assignmentHistory];
              
              return;
            }
          }
          
          // For non-QB players, use normal slot assignment
          const validSlots = getValidSlots(team, player, true);
          team.budget -= highBid;

          if (validSlots.length >= 1) {
            const slot = validSlots[0];
            if (!slot) return;
            
            const updatedPlayer = {
              ...player,
              draftedBy: team.id,
              price: highBid,
              slot: slot,
            };
            
            // Create a new roster object with the updated slot count
            const updatedRoster = { ...team.roster };
            const rosterKey = slot as keyof typeof updatedRoster;
            if (rosterKey in updatedRoster && rosterKey !== 'BENCH') {
              updatedRoster[rosterKey] = Math.max(0, (updatedRoster[rosterKey] ?? 1) - 1);
            }
            
            const updatedTeam = {
              ...team,
              roster: updatedRoster
            };

            state.logs.unshift({
              id: nanoid(),
              ts: now,
              type: 'ASSIGNED',
              message: `Assigned ${player.name} to ${team.name} for $${highBid} (${slot})`,
            });

            state.assignmentHistory.unshift({
              id: nanoid(),
              ts: now,
              playerId: player.id,
              teamId: team.id,
              slot: slot as Position,
              priceRefund: highBid,
              source: 'auction',
            } as AssignmentHistory);
            
            // Update the player and team in the state
            const playerIndex = state.players.findIndex(p => p.id === player.id);
            const teamIndex = state.teams.findIndex(t => t.id === team.id);
            
            if (playerIndex !== -1) {
              state.players[playerIndex] = updatedPlayer;
            }
            
            if (teamIndex !== -1) {
              state.teams[teamIndex] = updatedTeam;
            }
          } else if (validSlots.length > 1) {
            state.pendingAssignment = {
              teamId: team.id,
              playerId: player.id,
              validSlots,
            };

            state.logs.unshift({
              id: nanoid(),
              ts: now,
              type: 'PENDING_ASSIGNMENT',
              message: `Awaiting slot selection for ${player.name} (${player.pos}) on ${team.name}`,
            } as LogEvent);

            state.assignmentHistory.unshift({
              id: nanoid(),
              ts: now,
              playerId: player.id,
              teamId: team.id,
              slot: null,
              priceRefund: highBid,
              source: 'auction',
            });
          } else {
            // No legal slot — still mark as drafted without a slot
            player.draftedBy = team.id;
            player.price = highBid;
            delete player.slot;

            state.logs.unshift({
              id: nanoid(),
              ts: now,
              type: 'ASSIGNED',
              message: `Assigned ${player.name} to ${team.name} for $${highBid}`,
            } as LogEvent);

            state.assignmentHistory.unshift({
              id: nanoid(),
              ts: now,
              playerId: player.id,
              teamId: team.id,
              slot: null,
              priceRefund: highBid,
              source: 'auction',
            });
          }

          if (state.assignmentHistory.length > 50) state.assignmentHistory.pop();
        })
      );
    },

    hasSlotFor: (teamId: number, pos: Position, includeTeInFlex = false) => {
      const team = get().teams.find((t: Team) => t.id === teamId);
      if (!team) return false;

      if ((team.roster[pos] ?? 0) > 0) return true;

      if (pos === 'FLEX') {
        return (
          (team.roster.RB ?? 0) > 0 ||
          (team.roster.WR ?? 0) > 0 ||
          (includeTeInFlex && (team.roster.TE ?? 0) > 0)
        );
      }

      if (pos === 'TE' && includeTeInFlex && (team.roster.FLEX ?? 0) > 0) {
        return true;
      }

      return false;
    },

    computeMaxBid: (teamId: number, playerPos: Position | undefined) => {
      const state = get();
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return 0;

      const spent = state.players
        .filter((p: Player) => p.draftedBy === teamId)
        .reduce((sum: number, p: Player) => sum + (p.price ?? 0), 0);

      const remainingCash = team.budget - spent;
      if (remainingCash <= 0) return 0;

      const totalRemainingSpots = (Object.keys(team.roster) as Position[]).reduce(
        (acc, k) => acc + (team.roster[k] ?? 0),
        0
      );
      if (totalRemainingSpots <= 0) return 0;

      const reserveForOthers = Math.max(0, totalRemainingSpots - 1);
      const baselineMax = remainingCash - reserveForOthers;

      if (playerPos && !state.hasSlotFor(teamId, playerPos, true)) return 0;

      return Math.max(0, Math.floor(baselineMax));
    },

    undoLastAssignment: (options: { isAdmin?: boolean } = {}) => {
      const state = get();
      const { isAdmin = false } = options;

      if (!isAdmin) {
        state.pushLog({
          type: 'ERROR',
          message: 'Undo rejected: admin only.',
        });
        return;
      }

      const last = state.assignmentHistory[0];
      if (!last) {
        state.pushLog({
          type: 'ERROR',
          message: 'No assignments to undo.',
        });
        return;
      }

      const { playerId, teamId, slot, priceRefund } = last;
      const player = state.players.find((p) => p.id === playerId);
      const team = state.teams.find((t) => t.id === teamId);

      if (!player || !team) {
        state.pushLog({
          type: 'ERROR',
          message: 'Could not find player or team for undo.',
        });
        return;
      }

      delete player.draftedBy;
      delete player.price;
      if (slot) delete player.slot;

      if (priceRefund) team.budget += priceRefund;
      if (slot && slot in team.roster) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        team.roster[slot as keyof typeof team.roster] =
          (team.roster[slot as keyof typeof team.roster] ?? 0) + 1;
      }

      set((s) => ({ assignmentHistory: s.assignmentHistory.slice(1) }));

      state.pushLog({
        type: 'ASSIGNED',
        message: `Undo: Removed ${player.name} from ${team.name}${slot ? ` (${slot})` : ''}`,
      });
    },

    assignPlayer: (playerId: string, teamId: number, price: number, slot?: Position | null, options: { isAdmin?: boolean } = {}) => {
      iSet((draft) => {
        const player = draft.players.find(p => p.id === playerId);
        const team = draft.teams.find(t => t.id === teamId);

        if (!player || !team) {
          console.warn('Player or team not found');
          return;
        }

        // If this is an admin override, skip validation
        if (!options.isAdmin) {
          // Check if team has enough budget
          if (team.budget < price) {
            draft.pushLog({
              type: 'ASSIGN_REJECTED',
              message: `Cannot assign ${player.name} to ${team.name}: Not enough budget`,
            });
            return;
          }

          // Check if position is valid
          if (slot && !getValidSlots(team, player).includes(slot)) {
            draft.pushLog({
              type: 'ASSIGN_REJECTED',
              message: `Cannot assign ${player.name} to ${slot}: Invalid position`,
            });
            return;
          }
        } else if (price > team.budget) {
          // For admin overrides, just log a warning but allow it
          draft.pushLog({
            type: 'ADMIN_OVERRIDE',
            message: `Admin override: Assigning ${player.name} to ${team.name} with insufficient budget`,
          });
        }

        // Deduct price from team budget (if they have enough, or it's an admin override)
        const actualPrice = Math.min(price, team.budget);
        team.budget -= actualPrice;
        
        // Add player to team
        team.players.push(playerId);
        player.draftedBy = teamId;
        player.price = actualPrice;
        
        // Assign to specific slot if provided
        if (slot) {
          player.slot = slot;
          // Only decrement roster slot if it's not a bench assignment
          if (slot in team.roster && slot !== 'BENCH') {
            team.roster[slot as keyof typeof team.roster] = Math.max(0, (team.roster[slot as keyof typeof team.roster] ?? 0) - 1);
          }
        }
        
        // Add to assignment history
        const assignment: AssignmentHistory = {
          id: nanoid(),
          ts: Date.now(),
          playerId,
          teamId,
          slot: slot || null,
          priceRefund: actualPrice,
          source: options.isAdmin ? 'admin' : 'instant',
        };
        
        draft.assignmentHistory.push(assignment);
        
        draft.pushLog({
          type: options.isAdmin ? 'ADMIN_ASSIGN' : 'INSTANT_ASSIGN',
          message: `${player.name} assigned to ${team.name} for $${actualPrice}${slot ? ` (${slot})` : ''}${options.isAdmin ? ' (admin override)' : ''}`,
        });
      });
    },

    pushLog: (event: Omit<LogEvent, 'id' | 'ts'>) => {
      set(
        produce((state: DraftStore) => {
          if (!state.logs) state.logs = [];
          state.logs.unshift({
            ...event,
            id: nanoid(),
            ts: Date.now(),
          } as LogEvent);
          if (state.logs.length > 200) state.logs.pop();
        })
      );
    },

    clearLogs: (options: { isAdmin?: boolean } = {}) => {
      if (!options.isAdmin) {
        throw new Error('Admin privileges required to clear logs');
      }
      
      iSet((draft) => {
        draft.logs = [];
        draft.pushLog({
          type: 'LOGS_CLEARED',
          message: 'Logs cleared by admin',
        });
      });
    },

    resetDraft: (options: { isAdmin?: boolean } = {}) => {
      if (!options.isAdmin) {
        throw new Error('Admin privileges required to reset the draft');
      }
      
      iSet((draft) => {
        // Reset all draft state
        draft.bidState = {
          isLive: false,
          highBid: 0,
          highBidder: null,
          startingBid: 0,
          round: 1,
        };
        
        draft.runtime = {
          currentNominatorTeamId: null,
          nominationOrder: [],
          baseOrder: [],
          round: 1,
        };
        
        draft.nominationQueue = [];
        draft.currentAuction = null;
        draft.currentNominatedId = null;
        draft.currentBidder = undefined;
        draft.pendingAssignment = null;
        
        // Reset teams
        draft.teams.forEach(team => {
          team.players = [];
          team.budget = draft.baseBudget;
          team.roster = { ...draft.templateRoster };
        });
        
        // Reset player assignments
        draft.players.forEach(player => {
          delete player.draftedBy;
          delete player.price;
          delete player.slot;
        });
        
        draft.pushLog({
          type: 'DRAFT_RESET',
          message: 'Draft has been reset',
        });
      });
    },

    initializeDraft: (firstNominatorTeamId?: number | null) => {
      iSet((draft) => {
        const teamIds = draft.teams.map(t => t.id);
        const nominatorId = firstNominatorTeamId ?? teamIds[0] ?? undefined;
        
        draft.runtime = {
          currentNominatorTeamId: nominatorId,
          nominationOrder: teamIds,
          baseOrder: teamIds,
          round: 1,
        };
        
        draft.currentBidder = nominatorId;
        
        draft.pushLog({
          type: 'AUCTION_STARTED',
          message: `Draft initialized with ${draft.teams.find(t => t.id === nominatorId)?.name || 'Unknown'} as first nominator`,
        });
      });
    },

    /* -------------------------------- Utils ------------------------------- */
    maxBidForTeam: (teamId: number) => {
      const state = get();
      const team = state.teams.find(t => t.id === teamId);
      if (!team) return 0;
      
      // Get all players that have been assigned to this team
      const teamPlayers = state.players.filter(p => p.draftedBy === teamId);
      
      // Calculate total spent by summing up all player prices
      const spent = teamPlayers.reduce((sum, player) => {
        return sum + (player.price || 0);
      }, 0);
      
      const remainingBudget = team.budget - spent;
      return Math.max(0, remainingBudget);
    },

    /* -------------------------------- Selectors bag ------------------------------- */
    selectors: {
      undraftedPlayers: (state: { players: Player[] }) => state.players.filter((p: Player) => p.draftedBy == null),
      topAvailable: (state: { players: Player[] }, limit = 300) =>
        state.players
          .filter((p: Player) => p.draftedBy == null)
          .sort((a: Player, b: Player) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, limit),
      topAvailableByPos: (state: { players: Player[] }, pos: Position, limit = 100) =>
        state.players
          .filter((p: Player) => p.draftedBy == null && (p.pos as Position) === pos)
          .sort((a: Player, b: Player) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, limit),
      topAvailableByMultiPos: (state: { players: Player[] }, positions: Position[], limit = 100) =>
        state.players
          .filter((p: Player) => p.draftedBy == null && positions.includes(p.pos as Position))
          .sort((a: Player, b: Player) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, limit),
      topAvailableForFlex: (state: { players: Player[] }, limit = 100, includeTE = true) => {
        const flexPositions: Position[] = ['RB', 'WR'];
        if (includeTE) flexPositions.push('TE');
        return state.players
          .filter((p: Player) => p.draftedBy == null && flexPositions.includes(p.pos as Position))
          .sort((a: Player, b: Player) => (a.rank ?? 999) - (b.rank ?? 999))
          .slice(0, limit);
      },
    },
  };
}) as unknown as Creator;

/* Persisted store */
export const useDraftStore = create<DraftStore>()(
  devtools(
    persist(creator, {
      name: 'draft-store',
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        // Save all player data, not just a subset of fields
        players: state.players,
        teams: state.teams.map((t) => ({
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
    })
  )
);

/* Dev: expose store in console */
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  // Safely expose store to window for debugging in development
  window.store = useDraftStore as unknown as DebugStore;
}

/* Selector hook */
export const useDraftSelectors = () => {
  const selectors = useDraftStore((s) => s.selectors);
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
