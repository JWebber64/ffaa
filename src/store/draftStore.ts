import { create } from "zustand";

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "BENCH";
export type BasePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
export type AssignedSlot = BasePosition | "FLEX";

export type Team = {
  id: number;
  name: string;
  budget: number;
  /** Required counts (target roster config) */
  roster: Record<Position, number>;
};

export type Player = {
  id: string;
  name: string;
  /** Player's native position */
  pos: BasePosition;
  nflTeam?: string;
  draftedBy?: number;
  price?: number;
  /** Slot the player occupies on their team (QB/RB/WR/TE/FLEX) */
  slot?: AssignedSlot;
};

export type Nomination = { 
  playerId: string;
  startingBid?: number;
};

export type DraftState = {
  teams: Team[];
  players: Player[];
  nominationQueue: Nomination[];
  isProcessingQueue: boolean;
};

export type State = {
  // Config
  teamCount: number;
  baseBudget: number;
  templateRoster: Record<Position, number>;

  // Live state
  teams: Team[];
  players: Player[];
  nominationQueue: Nomination[];
  isProcessingQueue: boolean;
  
  // History
  history: Array<{
    teams: Team[];
    players: Player[];
    nominationQueue: Nomination[];
    isProcessingQueue: boolean;
  }>;
  future: Array<{
    teams: Team[];
    players: Player[];
    nominationQueue: Nomination[];
    isProcessingQueue: boolean;
  }>;
  maxHistorySize: number;

  // Actions
  setConfig: (opts: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;

  setTeamNames: (names: string[]) => void;
  setPlayers: (list: Player[]) => void;
  
  // Queue management
  nominate: (playerId: string) => void;
  startProcessingQueue: () => void;
  finishProcessingQueue: () => void;
  popNomination: () => string | undefined;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;

  /** Roster-aware finalize: assigns slot and deducts budget; returns true if success */
  finalizeSale: (teamId: number, playerId: string, price: number) => boolean;

  // Helpers
  computeMaxBid: (teamId: number) => number;
  hasSlotFor: (teamId: number, pos: BasePosition) => boolean;
  openSlotsFor: (teamId: number, pos: BasePosition) => number;
  
  // Undo/Redo
  captureState: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const DEFAULT_ROSTER: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  K: 1,
  DEF: 1,
  FLEX: 1,
  BENCH: 4,
};

function countUsedSlots(players: Player[], teamId: number) {
  const used: Record<AssignedSlot, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
    FLEX: 0,
  };
  for (const p of players) {
    if (p.draftedBy === teamId && p.slot) {
      used[p.slot] = (used[p.slot] ?? 0) + 1;
    }
  }
  return used;
}

function captureDraftState(state: State) {
  return {
    teams: state.teams.map(team => ({ ...team, roster: { ...team.roster } })),
    players: state.players.map(player => ({ ...player })),
    nominationQueue: [...state.nominationQueue],
    isProcessingQueue: state.isProcessingQueue,
  };
}

export const useDraftStore = create<State>((set, get) => ({
  teamCount: 12,
  baseBudget: 200,
  templateRoster: { ...DEFAULT_ROSTER },
  
  // Current state
  teams: [],
  players: [],
  nominationQueue: [],
  isProcessingQueue: false,
  
  // History tracking
  history: [],
  future: [],
  maxHistorySize: 50,

  captureState: () => {
    const state = get();
    const currentState = captureDraftState(state);
    
    set({
      history: [...state.history.slice(-state.maxHistorySize + 1), currentState],
      future: [], // Clear redo stack on new action
    });
  },
  
  undo: () => {
    const state = get();
    if (state.history.length === 0) return;
    
    const previous = state.history[state.history.length - 1];
    const newHistory = state.history.slice(0, -1);
    
    set({
      teams: previous.teams,
      players: previous.players,
      nominationQueue: previous.nominationQueue,
      isProcessingQueue: previous.isProcessingQueue,
      history: newHistory,
      future: [{
        teams: [...state.teams],
        players: [...state.players],
        nominationQueue: [...state.nominationQueue],
        isProcessingQueue: state.isProcessingQueue,
      }, ...state.future],
    });
  },
  
  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    
    set({
      teams: next.teams,
      players: next.players,
      nominationQueue: next.nominationQueue,
      isProcessingQueue: next.isProcessingQueue,
      history: [...state.history, {
        teams: [...state.teams],
        players: [...state.players],
        nominationQueue: [...state.nominationQueue],
        isProcessingQueue: state.isProcessingQueue,
      }],
      future: newFuture,
    });
  },
  
  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  setConfig: ({ teamCount, baseBudget, templateRoster }) => {
    const state = get();
    const newState = {
      teamCount,
      baseBudget,
      templateRoster: { ...templateRoster },
      teams: Array.from({ length: teamCount }).map((_, i) => ({
        id: i,
        name: `Team ${i + 1}`,
        budget: baseBudget,
        roster: { ...templateRoster },
      })),
      players: state.players.map((p) => ({
        ...p,
        draftedBy: undefined,
        price: undefined,
        slot: undefined,
      })),
      nominationQueue: [],
    };
    
    // Capture state after config change
    set({
      ...newState,
      history: [...state.history, captureDraftState(state)],
      future: [],
    });
  },

  setTeamNames: (names) =>
    set((s) => ({
      teams: s.teams.map((t, i) => ({ ...t, name: names[i] ?? t.name })),
    })),

  setPlayers: (list) =>
    set(() => ({
      players: list.map((p) => ({
        ...p,
        draftedBy: undefined,
        price: undefined,
        slot: undefined,
      })),
      nominationQueue: [],
      isProcessingQueue: false,
    })),

  nominate: (playerId, startingBid = 1) => {
    return set((state) => {
      const player = state.players.find((p) => p.id === playerId);
      const alreadyDrafted = player?.draftedBy != null;
      const alreadyQueued = state.nominationQueue.some((n) => n.playerId === playerId);
      
      if (alreadyDrafted) {
        console.log(`Player ${playerId} already drafted, skipping nomination`);
        return {}; // No state change needed
      }
      if (alreadyQueued) {
        console.log(`Player ${playerId} already in queue, skipping duplicate`);
        return {}; // No state change needed
      }
      
      const newQueue = [...state.nominationQueue, { playerId, startingBid }];
      console.log(`Adding player ${player?.name || playerId} to nomination queue`, { 
        queueLength: newQueue.length,
        queue: newQueue,
        isProcessing: state.isProcessingQueue,
        startingBid
      });
      
      return { 
        nominationQueue: newQueue,
        isProcessingQueue: state.isProcessingQueue // Preserve processing state
      };
    });
  },

  startProcessingQueue: () => {
    set({ isProcessingQueue: true });
  },

  finishProcessingQueue: () => {
    set({ isProcessingQueue: false });
  },

  popNomination: () => {
    const currentState = get();
    
    // Don't allow popping if we're already processing
    if (currentState.isProcessingQueue) {
      console.log('Already processing a nomination, skipping pop');
      return undefined;
    }
    
    const currentQueue = [...currentState.nominationQueue];
    
    if (!currentQueue.length) {
      console.log('popNomination: queue is empty');
      return undefined;
    }
    
    const [first, ...rest] = currentQueue;
    const player = currentState.players.find(p => p.id === first.playerId);
    
    console.log(`Popping nomination: ${player?.name || first.playerId}`, { 
      queueLengthBefore: currentQueue.length,
      queueLengthAfter: rest.length,
      isProcessing: currentState.isProcessingQueue
    });
    
    // Mark as processing and update queue
    set({ 
      nominationQueue: rest,
      isProcessingQueue: true 
    });
    
    return first.playerId;
  },

  removeFromQueue: (index) =>
    set((s) => ({
      nominationQueue: s.nominationQueue.filter((_, i) => i !== index),
    })),

  clearQueue: () => set({ 
    nominationQueue: [],
    isProcessingQueue: false 
  }),

  finalizeSale: (teamId, playerId, price) => {
    const s = get();
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return false;

    const player = s.players.find((p) => p.id === playerId);
    if (!player || player.draftedBy != null) return false;

    // Determine slot availability
    const used = countUsedSlots(s.players, teamId);
    const slotCap = team.roster;

    const canPrimary = used[player.pos] < (slotCap[player.pos] ?? 0);
    const canFlex = used.FLEX < (slotCap.FLEX ?? 0);

    if (!canPrimary && !canFlex) {
      return false;
    }

    const slot: AssignedSlot = canPrimary ? player.pos : "FLEX";

    // Compute max bid safety
    const totalSlots =
      (slotCap.QB ?? 0) + (slotCap.RB ?? 0) + (slotCap.WR ?? 0) + (slotCap.TE ?? 0) +
      (slotCap.FLEX ?? 0) + (slotCap.BENCH ?? 0);
    const filled = s.players.filter((p) => p.draftedBy === teamId).length;
    const remainingBefore = Math.max(0, totalSlots - filled);
    const maxBid = Math.max(0, team.budget - (remainingBefore - 1));
    if (price > maxBid) return false;

    set(() => ({
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, budget: t.budget - price } : t
      ),
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, draftedBy: teamId, price, slot } : p
      ),
    }));
    return true;
  },

  computeMaxBid: (teamId) => {
    const s = get();
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return 0;
    const totalSlots =
      (team.roster.QB ?? 0) + (team.roster.RB ?? 0) + (team.roster.WR ?? 0) + (team.roster.TE ?? 0) +
      (team.roster.FLEX ?? 0) + (team.roster.BENCH ?? 0);
    const filled = s.players.filter((p) => p.draftedBy === teamId).length;
    const remaining = Math.max(0, totalSlots - filled);
    return Math.max(0, team.budget - (remaining - 1));
  },

  hasSlotFor: (teamId, pos) => {
    const s = get();
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return false;
    const used = countUsedSlots(s.players, teamId);
    const slotCap = team.roster;
    const canPrimary = used[pos] < (slotCap[pos] ?? 0);
    const canFlex = used.FLEX < (slotCap.FLEX ?? 0);
    return canPrimary || canFlex;
  },

  openSlotsFor: (teamId, pos) => {
    const s = get();
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return 0;
    const used = countUsedSlots(s.players, teamId);
    const slotCap = team.roster;
    const primaryOpen = Math.max(0, (slotCap[pos] ?? 0) - (used[pos] ?? 0));
    const flexOpen = Math.max(0, (slotCap.FLEX ?? 0) - (used.FLEX ?? 0));
    return primaryOpen + flexOpen;
  },
}));
