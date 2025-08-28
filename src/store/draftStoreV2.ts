import { create } from "zustand";
import { z } from 'zod';
import { produce } from 'immer';

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "BENCH";
export type BasePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
export type AssignedSlot = BasePosition | "FLEX";

// Validation schemas
const PlayerSchema = z.object({
  id: z.string().min(1, 'Player ID is required'),
  name: z.string().min(1, 'Player name is required'),
  pos: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
  nflTeam: z.string().optional(),
  draftedBy: z.number().optional(),
  price: z.number().nonnegative('Price must be non-negative').optional(),
  slot: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX']).optional(),
});

const TeamSchema = z.object({
  id: z.number().int().positive('Team ID must be positive'),
  name: z.string().min(1, 'Team name is required'),
  budget: z.number().nonnegative('Budget cannot be negative'),
  roster: z.record(z.number().int().nonnegative('Roster count must be non-negative')),
});

type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export interface Team {
  id: number;
  name: string;
  budget: number;
  roster: Record<Position, number>;
}

export interface Player {
  id: string;
  name: string;
  pos: BasePosition;
  nflTeam?: string;
  draftedBy?: number;
  price?: number;
  slot?: AssignedSlot;
}

type Nomination = { 
  playerId: string;
  startingBid?: number;
};

interface DraftState {
  teams: Team[];
  players: Player[];
  nominationQueue: Nomination[];
  isProcessingQueue: boolean;
  captureState: () => void;
  history: DraftState[];
  future: DraftState[];
  maxHistorySize: number;
}

type State = DraftState & {
  // Config
  teamCount: number;
  baseBudget: number;
  templateRoster: Record<Position, number>;
  
  // History
  history: DraftState[];
  future: DraftState[];
  maxHistorySize: number;

  // Command methods
  nominatePlayer: (playerId: string, byTeamId: number, startAmount: number) => Result<Nomination>;
  placeBid: (playerId: string, byTeamId: number, amount: number) => Result<{ playerId: string; teamId: number; amount: number }>;
  assignPlayer: (playerId: string, toTeamId: number, amount: number) => Result<Player>;
  
  // Other methods...
  setConfig: (opts: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;

  setTeamNames: (names: string[]) => void;
  setPlayers: (list: Player[]) => void;
  startProcessingQueue: () => void;
  finishProcessingQueue: () => void;
  popNomination: () => string | undefined;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
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
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0
  };
  
  for (const p of players) {
    if (p.draftedBy === teamId && p.slot) {
      used[p.slot] = (used[p.slot] ?? 0) + 1;
    }
  }
  return used;
}

function captureDraftState(state: DraftState): DraftState {
  return {
    teams: state.teams.map(team => ({ ...team, roster: { ...team.roster } })),
    players: state.players.map(p => ({ ...p })),
    nominationQueue: [...state.nominationQueue],
    isProcessingQueue: state.isProcessingQueue,
  };
}

// Create the store with immer middleware for easy state updates
export const useDraftStoreV2 = create<State>()(
  (set, get) => ({
  // Initial state
  teamCount: 12,
  baseBudget: 200,
  templateRoster: { ...DEFAULT_ROSTER },
  teams: [],
  players: [],
  nominationQueue: [],
  isProcessingQueue: false,
  history: [],
  future: [],
  maxHistorySize: 50,

  // Command methods
  nominatePlayer: (playerId, byTeamId, startAmount) => {
    const state = get();
    
    // Input validation
    if (typeof playerId !== 'string' || playerId.trim() === '') {
      return { ok: false, error: 'Invalid player ID' };
    }
    
    if (typeof byTeamId !== 'number' || byTeamId <= 0) {
      return { ok: false, error: 'Invalid team ID' };
    }
    
    if (typeof startAmount !== 'number' || startAmount < 1) {
      return { ok: false, error: 'Starting bid must be at least $1' };
    }
    
    // Find and validate player
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { ok: false, error: 'Player not found' };
    }
    
    // Validate player data structure
    const playerValidation = PlayerSchema.safeParse(player);
    if (!playerValidation.success) {
      return { 
        ok: false, 
        error: `Invalid player data: ${playerValidation.error.message}` 
      };
    }
    
    if (player.draftedBy !== undefined) {
      return { ok: false, error: 'Player already drafted' };
    }
    
    // Find and validate team
    const team = state.teams.find(t => t.id === byTeamId);
    if (!team) {
      return { ok: false, error: 'Team not found' };
    }
    
    // Validate team data structure
    const teamValidation = TeamSchema.safeParse(team);
    if (!teamValidation.success) {
      return { 
        ok: false, 
        error: `Invalid team data: ${teamValidation.error.message}` 
      };
    }
    
    // Check if team has available roster spots for this position
    const position = player.pos as Position;
    const maxAtPosition = team.roster[position] || 0;
    const currentAtPosition = state.players.filter(
      p => p.draftedBy === team.id && p.pos === position
    ).length;
    
    if (currentAtPosition >= maxAtPosition) {
      return { 
        ok: false, 
        error: `No available ${position} roster spots on ${team.name}` 
      };
    }
    
    // Add to nomination queue
    const nomination: Nomination = { playerId, startingBid: startAmount };
    
    set(produce((state: DraftState) => {
      state.nominationQueue.push(nomination);
      state.captureState();
      return state;
    }));
    
    return { ok: true, value: nomination };
  },
  
  placeBid: (playerId, byTeamId, amount) => {
    const state = get();
    
    // Validate player exists and is in the auction
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { ok: false, error: 'Player not found' };
    }
    
    if (player.draftedBy !== undefined) {
      return { ok: false, error: 'Player already drafted' };
    }
    
    // Validate team exists and has enough budget
    const team = state.teams.find(t => t.id === byTeamId);
    if (!team) {
      return { ok: false, error: 'Team not found' };
    }
    
    if (amount <= 0) {
      return { ok: false, error: 'Bid amount must be positive' };
    }
    
    if (amount > team.budget) {
      return { ok: false, error: 'Insufficient budget' };
    }
    
    // Check if this is the highest bid
    const currentBid = player.price || 0;
    if (amount <= currentBid) {
      return { 
        ok: false, 
        error: `Bid must be higher than current bid of $${currentBid}` 
      };
    }
    
    // Update the player's price
    set(produce((state: DraftState) => {
      const player = state.players.find(p => p.id === playerId);
      if (player) {
        player.price = amount;
      }
      state.captureState();
      return state;
    }));
    
    return { 
      ok: true, 
      value: { playerId, teamId: byTeamId, amount } 
    };
  },
  
  assignPlayer: (playerId, toTeamId, amount) => {
    const state = get();
    
    // Input validation
    if (typeof playerId !== 'string' || playerId.trim() === '') {
      return { ok: false, error: 'Invalid player ID' };
    }
    
    if (typeof toTeamId !== 'number' || toTeamId <= 0) {
      return { ok: false, error: 'Invalid team ID' };
    }
    
    if (typeof amount !== 'number' || amount < 1) {
      return { ok: false, error: 'Invalid bid amount' };
    }
    
    // Find and validate player
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { ok: false, error: 'Player not found' };
    }
    
    // Find and validate team
    const team = state.teams.find(t => t.id === toTeamId);
    if (!team) {
      return { ok: false, error: 'Team not found' };
    }
    
    // Check if team has enough budget
    if (team.budget < amount) {
      return { 
        ok: false, 
        error: `Insufficient budget. Need $${amount} but only $${team.budget} available` 
      };
    }
    
    // Check if player is already drafted
    if (player.draftedBy !== undefined) {
      return { 
        ok: false, 
        error: `Player already drafted by team ${player.draftedBy}` 
      };
    }
    
    // Check roster constraints
    const position = player.pos as Position;
    const maxAtPosition = team.roster[position] || 0;
    const currentAtPosition = state.players.filter(
      p => p.draftedBy === team.id && p.pos === position
    ).length;
    
    if (currentAtPosition >= maxAtPosition) {
      // Check FLEX position if primary position is full
      const flexMax = team.roster.FLEX || 0;
      const currentFlex = state.players.filter(
        p => p.draftedBy === team.id && p.slot === 'FLEX'
      ).length;
      
      if (['RB', 'WR', 'TE'].includes(position) && currentFlex < flexMax) {
        // Can assign to FLEX
        player.slot = 'FLEX';
      } else {
        return { 
          ok: false, 
          error: `No available ${position} roster spots on ${team.name}` 
        };
      }
    } else {
      player.slot = position;
    }
      // Check if we can use a FLEX spot
      if (['RB', 'WR', 'TE'].includes(player.pos)) {
        const flexSlots = team.roster.FLEX || 0;
        if (usedSlots.FLEX >= flexSlots) {
          return { 
            ok: false, 
            error: `No available ${player.pos} or FLEX slots` 
          };
        }
        // Assign to FLEX
        player.slot = 'FLEX';
      } else {
        return { 
          ok: false, 
          error: `No available ${player.pos} slots` 
        };
      }
    } else {
      // Assign to natural position
      player.slot = player.pos as AssignedSlot;
    }
    
    // Deduct from team budget and assign player
    set(produce(state => {
      const team = state.teams.find((t: Team) => t.id === toTeamId);
      if (team) {
        team.budget -= amount;
      }
      
      const player = state.players.find((p: Player) => p.id === playerId);
      if (player) {
        player.draftedBy = toTeamId;
        player.price = amount;
      }
      
      state.captureState();
    }));
    
    return { ok: true, value: { ...player, draftedBy: toTeamId, price: amount } };
  },
  
  // Existing methods (simplified for brevity)
  setConfig: (opts) => {
    set({
      teamCount: opts.teamCount,
      baseBudget: opts.baseBudget,
      templateRoster: { ...opts.templateRoster },
      teams: Array.from({ length: opts.teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        budget: opts.baseBudget,
        roster: { ...opts.templateRoster }
      }))
    });
  },
  
  setTeamNames: (names) => {
    set(produce(state => {
      names.forEach((name, i) => {
        const team = state.teams[i];
        if (team) team.name = name;
      });
      state.captureState();
    }));
  },
  
  setPlayers: (list) => {
    set({
      players: list.map(p => ({ ...p }))
    });
  },
  
  startProcessingQueue: () => {
    set({ isProcessingQueue: true });
  },
  
  finishProcessingQueue: () => {
    set({ isProcessingQueue: false });
  },
  
  popNomination: () => {
    let result: string | undefined;
    set(produce(state => {
      const nom = state.nominationQueue.shift();
      result = nom?.playerId;
      state.captureState();
    }));
    return result;
  },
  
  removeFromQueue: (index) => {
    set(produce(state => {
      state.nominationQueue.splice(index, 1);
      state.captureState();
    }));
  },
  
  clearQueue: () => {
    set({ nominationQueue: [] });
  },
  
  captureState: () => {
    const state = get();
    const newHistory = [...state.history, captureDraftState(state)];
    
    if (newHistory.length > state.maxHistorySize) {
      newHistory.shift();
    }
    
    set({ history: newHistory, future: [] });
  },
  
  undo: () => {
    set(produce(state => {
      if (state.history.length === 0) return;
      
      const previous = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);
      
      state.teams = previous.teams;
      state.players = previous.players;
      state.nominationQueue = previous.nominationQueue;
      state.isProcessingQueue = previous.isProcessingQueue;
      
      state.future = [
        captureDraftState(state),
        ...state.future
      ];
      
      state.history = newHistory;
    }));
  },
  
  redo: () => {
    set(produce(state => {
      if (state.future.length === 0) return;
      
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      
      state.history = [...state.history, captureDraftState(state)];
      
      state.teams = next.teams;
      state.players = next.players;
      state.nominationQueue = next.nominationQueue;
      state.isProcessingQueue = next.isProcessingQueue;
      
      state.future = newFuture;
    }));
  },
  
  canUndo: () => {
    return get().history.length > 0;
  },
  
  canRedo: () => {
    return get().future.length > 0;
  }
}));

export default useDraftStoreV2;
