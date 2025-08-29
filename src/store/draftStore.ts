// src/store/draftStore.ts
import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce, type Draft } from 'immer';
import { nanoid } from 'nanoid';
import { loadAdp as fetchAdp } from '../api/adp';

import type {
  Player,
  Team,
  Position,
  BasePosition,
  Nomination,
  CurrentAuction,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
  DraftState,
  DraftActions,
  DraftStore as DraftStoreType,
  AssignmentHistory,
  NominationOrderMode,
  LogEventType,
} from '../types/draft';

// Re-export for compatibility (prevents unused-type lint noise elsewhere)
export type {
  Position,
  BasePosition,
  Player,
  Team,
  Nomination,
  CurrentAuction,
  AuctionSettings,
  BidState,
  DraftRuntime,
  LogEvent,
  AssignmentHistory,
  NominationOrderMode,
  LogEventType,
} from '../types/draft';

/* ---------------------------------------------------------------------------------------------- */

declare global {
  interface Window {
    localStorage: Storage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store?: any;
  }
}

type DraftStore = DraftStoreType;

/* Defaults */
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
  if (basePos !== 'FLEX' && basePos !== 'BENCH' && (team.roster[basePos] ?? 0) > 0) {
    out.push(basePos);
  }
  if (
    player.pos !== 'FLEX' &&
    player.pos !== 'BENCH' &&
    isFlexEligible(player.pos, includeTEinFlex) &&
    (team.roster.FLEX ?? 0) > 0
  ) {
    out.push('FLEX');
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
      const { isAdmin = false } = options as { isAdmin?: boolean };
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to update auction settings');
        return;
      }
      set((state) => ({
        ...state,
        auctionSettings: { ...state.auctionSettings, ...settings },
      }));
    },

    setPlayers: (players: Player[]) => {
      set((state) => ({
        ...state,
        players,
        playersLoaded: true,
      }));
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
      }));
    },

    applyAdp: (updates: { id: string; adp: number; adpSource: string }[]) => {
      set((state) => {
        const newPlayers = [...state.players];
        updates.forEach((u: { id: string; adp: number; adpSource: string }) => {
          const i = newPlayers.findIndex((p) => p.id === u.id);
          if (i !== -1) {
            newPlayers[i] = {
              ...newPlayers[i],
              adp: u.adp,
              adpSource: u.adpSource,
            };
          }
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
      isAdmin?: boolean;
    } = {}) => {
      const { isAdmin = false } = opts;
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to load ADP data');
        return false;
      }
      try {
        const updates = await fetchAdp(opts);
        if (updates) {
          get().applyAdp(updates);
          set({ adpLoaded: true });
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load ADP:', e);
        return false;
      }
    },

    setConfig: (config: { teamCount: number; baseBudget: number; templateRoster: Record<Position, number> }, options: { isAdmin?: boolean } = {}) => {
      const { isAdmin = false } = options as { isAdmin?: boolean };
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to update config');
        return;
      }
      iSet((draft) => {
        draft.teamCount = config.teamCount;
        draft.baseBudget = config.baseBudget;
        draft.templateRoster = { ...config.templateRoster };
        draft.teams = draft.teams.map((t) => ({
          ...t,
          roster: { ...draft.templateRoster },
        }));
      });
    },

    setTeamNames: (names: string[], options: { isAdmin?: boolean } = {}) => {
      const { isAdmin = false } = options as { isAdmin?: boolean };
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to update team names');
        return;
      }
      if (!names.length) return;
      const baseBudget = get().baseBudget;
      const template = get().templateRoster;

      const newTeams: Team[] = Array.from({ length: names.length }, (_, i: number) => ({
        id: i + 1,
        name: names[i] || `Team ${i + 1}`,
        players: [],
        budget: baseBudget,
        roster: { ...template },
      }));

      set({ teams: newTeams });
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

          const validSlots = getValidSlots(team, player, true);

          // Deduct budget
          team.budget -= highBid;

          if (validSlots.length === 1) {
            const slot = validSlots[0];
            player.draftedBy = team.id;
            player.price = highBid;
            player.slot = slot;
            team.roster[slot] = Math.max(0, (team.roster[slot] ?? 0) - 1);

            state.logs.unshift({
              id: nanoid(),
              ts: now,
              type: 'ASSIGNED',
              message: `Assigned ${player.name} to ${team.name} for $${highBid} (${slot})`,
            } as LogEvent);

            state.assignmentHistory.unshift({
              id: nanoid(),
              ts: now,
              playerId: player.id,
              teamId: team.id,
              slot,
              priceRefund: highBid,
              source: 'auction',
            });
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

    undoLastAssignment: (opts: { isAdmin?: boolean } = {}) => {
      const state = get();
      const { isAdmin = false } = opts;

      if (!isAdmin) {
        state.pushLog({
          type: 'ERROR' as LogEventType,
          message: 'Undo rejected: admin only.',
        });
        return;
      }

      const last = state.assignmentHistory[0];
      if (!last) {
        state.pushLog({
          type: 'ERROR' as LogEventType,
          message: 'No assignments to undo.',
        });
        return;
      }

      const { playerId, teamId, slot, priceRefund } = last;
      const player = state.players.find((p) => p.id === playerId);
      const team = state.teams.find((t) => t.id === teamId);

      if (!player || !team) {
        state.pushLog({
          type: 'ERROR' as LogEventType,
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
        type: 'ASSIGNED' as LogEventType,
        message: `Undo: Removed ${player.name} from ${team.name}${slot ? ` (${slot})` : ''}`,
      });
    },

    assignPlayer: (playerId: string, teamId: number, price: number, slot?: Position | null, options = {}) => {
      const { isAdmin = false } = options as { isAdmin?: boolean };
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to assign players');
        return;
      }
      iSet((draft) => {
        const player = draft.players.find((p: Player) => p.id === playerId);
        const team = draft.teams.find((t: Team) => t.id === teamId);
        if (!player || !team) return;

        player.draftedBy = teamId;
        player.price = price;
        if (slot) player.slot = slot;

        team.budget -= price;
        if (slot && slot in team.roster) {
          team.roster[slot] = Math.max(0, (team.roster[slot] ?? 0) - 1);
        }

        draft.logs.unshift({
          id: nanoid(),
          ts: Date.now(),
          type: 'ASSIGNED',
          message: `Assigned ${player.name} to ${team.name} for $${price}${slot ? ` (${slot})` : ''}`,
        });

        draft.assignmentHistory.unshift({
          id: nanoid(),
          ts: Date.now(),
          playerId: player.id,
          teamId: team.id,
          slot: slot ?? null,
          priceRefund: price,
          source: 'instant',
        });

        if (draft.assignmentHistory.length > 50) draft.assignmentHistory.pop();
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

    clearLogs: (opts?: { isAdmin?: boolean }) => {
      const isAdmin = opts?.isAdmin ?? false;
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to clear logs');
        return;
      }
      set({ logs: [] });
    },

    resetDraft: (options: { isAdmin?: boolean } = {}) => {
      const { isAdmin = false } = options;
      if (!isAdmin) {
        // eslint-disable-next-line no-console
        console.warn('Unauthorized: Admin access required to reset draft');
        return;
      }
      iSet((draft) => {
        draft.players.forEach((p) => {
          p.draftedBy = undefined;
          p.price = undefined;
          p.slot = undefined;
        });

        draft.teams = [];

        draft.bidState = { ...DEFAULT_BID_STATE };
        draft.runtime = { ...initialRuntime };
        draft.nominationQueue = [];
        draft.currentAuction = null;
        draft.currentNominatedId = null;
        draft.currentBidder = undefined;
        draft.pendingAssignment = null;
        draft.assignmentHistory = [];
        draft.logs = [];
      });
    },

    /* -------------------------------- Selectors bag ------------------------------- */
    selectors: {
      undraftedPlayers: (state: { players: Player[] }) => state.players.filter((p: Player) => p.draftedBy === undefined),
topAvailable: (state: { players: Player[] }, limit = 300) =>
        state.players
          .filter((p: Player) => p.draftedBy === undefined)
          .sort((a: Player, b: Player) => (a.rank ?? 0) - (b.rank ?? 0))
          .slice(0, limit),
topAvailableByPos: (state: { players: Player[] }, pos: Position, limit = 100) =>
        state.players
          .filter((p: Player) => p.draftedBy === undefined && (p.pos as Position) === pos)
          .sort((a: Player, b: Player) => (a.rank ?? 0) - (b.rank ?? 0))
          .slice(0, limit),
topAvailableByMultiPos: (state: { players: Player[] }, positions: Position[], limit = 100) =>
        state.players
          .filter((p: Player) => p.draftedBy === undefined && positions.includes(p.pos as Position))
          .sort((a: Player, b: Player) => (a.rank ?? 0) - (b.rank ?? 0))
          .slice(0, limit),
topAvailableForFlex: (state: { players: Player[] }, limit = 100, includeTE = true) => {
        const flexPositions: Position[] = ['RB', 'WR'];
        if (includeTE) flexPositions.push('TE');
        return state.players
          .filter((p: Player) => p.draftedBy === undefined && flexPositions.includes(p.pos as Position))
          .sort((a: Player, b: Player) => (a.rank ?? 0) - (b.rank ?? 0))
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
        players: state.players.map((p) => ({
          id: p.id,
          draftedBy: p.draftedBy,
          price: p.price,
          slot: p.slot,
        })),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).store = useDraftStore;
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
