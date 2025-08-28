import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type Result<T, E = string> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';
export type BasePosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export type AssignedSlot = BasePosition | 'FLEX';

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

export interface Nomination {
  playerId: string;
  startingBid: number;
}

interface DraftState {
  // Config
  teamCount: number;
  baseBudget: number;
  templateRoster: Record<Position, number>;
  
  // State
  teams: Team[];
  players: Player[];
  nominationQueue: Nomination[];
  isProcessingQueue: boolean;
  history: DraftState[];
  future: DraftState[];
  maxHistorySize: number;
  
  // Actions
  setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => Result<true, string>;
  
  setTeamNames: (names: string[]) => void;
  setPlayers: (players: Player[]) => void;
  
  // Nomination queue actions
  nominate: (playerId: string, startingBid?: number) => Result<undefined, string>;
  startProcessingQueue: () => void;
  finishProcessingQueue: () => void;
  popNomination: () => Nomination | undefined;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  
  // Draft actions
  finalizeSale: (teamId: number, playerId: string, price: number) => Result<{
    teamId: number;
    playerId: string;
    price: number;
    slot: AssignedSlot;
  }, string>;
  
  // Undo/redo
  captureState: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Utility functions
  hasSlotFor: (teamId: number, pos: AssignedSlot) => boolean;
  openSlotsFor: (teamId: number, pos: AssignedSlot) => number;
  computeMaxBid: (teamId: number) => number;
  
  // Additional methods from implementation
  assignPlayer: (playerId: string, toTeamId: number, amount: number) => Result<Player, string>;
  placeBid: (playerId: string, byTeamId: number, amount: number) => Result<{
    playerId: string;
    teamId: number;
    amount: number;
  }, string>;
  nominatePlayer: (playerId: string, byTeamId: number, startAmount: number) => Result<Nomination, string>;
}

const DEFAULT_ROSTER: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  K: 1,
  DEF: 1,
  FLEX: 1,
  BENCH: 6,
};

const countUsedSlots = (players: Player[], teamId: number): Record<AssignedSlot, number> => {
  const used: Record<AssignedSlot, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0
  };
  
  players
    .filter(p => p.draftedBy === teamId && p.slot)
    .forEach(p => {
      const slot = p.slot as AssignedSlot;
      if (used[slot] !== undefined) {
        used[slot]++;
      }
    });
    
  return used;
};

const captureDraftState = (state: DraftState): DraftState => {
  const baseState = {
    teamCount: state.teamCount,
    baseBudget: state.baseBudget,
    templateRoster: { ...state.templateRoster },
    teams: state.teams.map(t => ({ ...t, roster: { ...t.roster } })),
    players: state.players.map(p => ({ ...p })),
    nominationQueue: [...state.nominationQueue],
    isProcessingQueue: state.isProcessingQueue,
    history: [],
    future: [],
    maxHistorySize: state.maxHistorySize || 100,
    
    // Methods
    setConfig: state.setConfig,
    setTeamNames: state.setTeamNames,
    setPlayers: state.setPlayers,
    nominate: state.nominate,
    startProcessingQueue: state.startProcessingQueue,
    finishProcessingQueue: state.finishProcessingQueue,
    popNomination: state.popNomination,
    removeFromQueue: state.removeFromQueue,
    clearQueue: state.clearQueue,
    finalizeSale: state.finalizeSale,
    captureState: state.captureState,
    undo: state.undo,
    redo: state.redo,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    hasSlotFor: state.hasSlotFor,
    openSlotsFor: state.openSlotsFor,
    computeMaxBid: state.computeMaxBid,
    assignPlayer: state.assignPlayer,
    placeBid: state.placeBid,
    nominatePlayer: state.nominatePlayer,
  };
  
  return baseState;
};

export const useDraftStore = create<DraftState>()(
  devtools(
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
      maxHistorySize: 100,
      
      // Actions
      setConfig: ({ teamCount, baseBudget, templateRoster }) => {
        // Validate inputs
        if (teamCount < 1 || teamCount > 32) {
          return { ok: false, error: 'Team count must be between 1 and 32' };
        }
        
        if (baseBudget < 1) {
          return { ok: false, error: 'Base budget must be at least 1' };
        }
        
        const requiredPositions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX', 'BENCH'];
        for (const pos of requiredPositions) {
          if (templateRoster[pos] === undefined) {
            return { ok: false, error: `Missing required position: ${pos}` };
          }
          if (templateRoster[pos] < 0) {
            return { ok: false, error: `Invalid count for position ${pos}: cannot be negative` };
          }
        }
        
        const teams = Array(teamCount).fill(null).map((_, i) => ({
          id: i + 1,
          name: `Team ${i + 1}`,
          budget: baseBudget,
          roster: { ...templateRoster }
        }));
        
        set({
          teamCount,
          baseBudget,
          templateRoster: { ...templateRoster },
          teams,
          players: [],
          nominationQueue: [],
          isProcessingQueue: false,
          history: [],
          future: [],
        });
        
        return { ok: true, value: true };
      },
      
      setTeamNames: (names) => {
        set(state => ({
          teams: state.teams.map((team, i) => ({
            ...team,
            name: names[i] || team.name
          }))
        }));
      },
      
      setPlayers: (players) => {
        set({
          players: players.map(p => ({
            ...p,
            draftedBy: undefined,
            price: undefined,
            slot: undefined,
          })),
          nominationQueue: [],
          isProcessingQueue: false,
        });
      },
      
      nominate: (playerId, startingBid = 1) => {
        const state = get();
        const player = state.players.find(p => p.id === playerId);
        
        if (!player) {
          return { ok: false, error: 'Player not found' } as const;
        }
        
        if (player.draftedBy !== undefined) {
          return { ok: false, error: 'Player already drafted' } as const;
        }
        
        if (state.nominationQueue.some(n => n.playerId === playerId)) {
          return { ok: false, error: 'Player already in nomination queue' } as const;
        }
        
        set(state => ({
          nominationQueue: [
            ...state.nominationQueue,
            { playerId, startingBid }
          ]
        }));
        
        return { ok: true, value: undefined } as const;
      },
      
      startProcessingQueue: () => set({ isProcessingQueue: true }),
      finishProcessingQueue: () => set({ isProcessingQueue: false }),
      
      popNomination: () => {
        let result: Nomination | undefined;
        
        set(state => {
          if (state.isProcessingQueue || state.nominationQueue.length === 0) {
            return {};
          }
          
          const [first, ...rest] = state.nominationQueue;
          result = first;
          
          return {
            nominationQueue: rest,
            isProcessingQueue: true
          };
        });
        
        return result;
      },
      
      removeFromQueue: (index) => {
        set(state => ({
          nominationQueue: state.nominationQueue.filter((_, i) => i !== index)
        }));
      },
      
      clearQueue: () => set({ 
        nominationQueue: [],
        isProcessingQueue: false 
      }),
      
      finalizeSale: (teamId, playerId, price) => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        const player = state.players.find(p => p.id === playerId);
        
        if (!team) {
          return { ok: false, error: 'Team not found' } as const;
        }
        
        if (!player) {
          return { ok: false, error: 'Player not found' } as const;
        }
        
        if (player.draftedBy !== undefined) {
          return { ok: false, error: 'Player already drafted' } as const;
        }
        
        // Check if team has enough budget
        const maxBid = get().computeMaxBid(teamId);
        if (price > maxBid) {
          return { 
            ok: false, 
            error: `Bid of $${price} exceeds maximum allowed bid of $${maxBid}` 
          } as const;
        }
        
        // Determine slot (primary or FLEX)
        const used = countUsedSlots(state.players, teamId);
        const canPrimary = used[player.pos] < (team.roster[player.pos] ?? 0);
        const slot: AssignedSlot = canPrimary ? player.pos : 'FLEX';
        
        // Check if team has space in the determined slot
        const slotLimit = team.roster[slot] ?? 0;
        if (used[slot] >= slotLimit) {
          return { 
            ok: false, 
            error: `No available ${slot} slots on ${team.name}` 
          } as const;
        }
        
        // Update state
        set(state => ({
          teams: state.teams.map(t => 
            t.id === teamId 
              ? { ...t, budget: t.budget - price }
              : t
          ),
          players: state.players.map(p =>
            p.id === playerId
              ? { ...p, draftedBy: teamId, price, slot }
              : p
          ),
          isProcessingQueue: false
        }));
        
        return { 
          ok: true, 
          value: { teamId, playerId, price, slot } 
        } as const;
      },
      
      // Undo/redo functionality
      captureState: () => {
        set(state => ({
          history: [...state.history, captureDraftState(state)],
          future: []
        }));
      },
      
      undo: () => {
        set(state => {
          if (state.history.length === 0) return {};
          
          const previous = state.history[state.history.length - 1];
          const newHistory = state.history.slice(0, -1);
          
          return {
            ...previous,
            history: newHistory,
            future: [captureDraftState(state), ...state.future]
          };
        });
      },
      
      redo: () => {
        set(state => {
          if (state.future.length === 0) return {};
          
          const next = state.future[0];
          const newFuture = state.future.slice(1);
          
          return {
            ...next,
            history: [...state.history, captureDraftState(state)],
            future: newFuture
          };
        });
      },
      
      canUndo: () => get().history.length > 0,
      canRedo: () => get().future.length > 0,
      
      // Utility functions
      hasSlotFor: (teamId, pos) => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) return false;
        
        const used = countUsedSlots(state.players, teamId);
        const available = (team.roster[pos] ?? 0) - (used[pos] ?? 0);
        return available > 0;
      },
      
      openSlotsFor: (teamId, pos) => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) return 0;
        
        const used = countUsedSlots(state.players, teamId);
        return Math.max(0, (team.roster[pos] ?? 0) - (used[pos] ?? 0));
      },
      
      computeMaxBid: (teamId) => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) return 0;
        
        const totalSlots = Object.values(team.roster).reduce((sum, count) => sum + count, 0);
        const filled = state.players.filter(p => p.draftedBy === teamId).length;
        const remaining = Math.max(0, totalSlots - filled);
        
        // Can spend all but (remaining - 1) dollars
        return remaining > 0 ? team.budget - (remaining - 1) : 0;
      },
    }),
    { name: 'draft-store' }
  )
);
