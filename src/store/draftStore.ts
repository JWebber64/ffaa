import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { produce, Draft as ImmerDraft } from "immer";

/** Positions (standardize on DEF, not D/ST) */
export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "BENCH";
export type BasePosition = Exclude<Position, "FLEX" | "BENCH">;
export type AssignedSlot = Position;

export interface Team {
  id: number;
  name: string;
  budget: number;                     // remaining budget
  roster: Record<AssignedSlot, number>; // allowed counts per slot (template)
}

export interface Player {
  id: string;
  name: string;
  pos: BasePosition;
  nflTeam?: string;
  draftedBy?: number;                 // team id if drafted
  price?: number;                     // final price if drafted
  slot?: AssignedSlot;                // assigned slot (pos or FLEX)
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
}

/** Snapshot that can be serialized (no functions) */
type DraftSnapshot = {
  teamCount: number;
  baseBudget: number;
  templateRoster: Record<Position, number>;
  teams: Team[];
  players: Player[];
  nominationQueue: Nomination[];
  isProcessingQueue: boolean;
  currentBidder: number | null;
};

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
  history: DraftSnapshot[];
  future: DraftSnapshot[];
  maxHistorySize: number;
  currentBidder: number | null;

  // Actions
  setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;

  setTeamNames: (names: string[]) => void;
  setPlayers: (players: Player[]) => void;

  // Nomination & bidding
  nominate: (playerId: string, startingBid?: number) => void;
  nominatePlayer: (
    playerId: string,
    byTeamId: number,
    startAmount: number
  ) => { ok: boolean; error?: string; nomination?: Nomination };

  /** Validate ability to bid (does not mutate players/budget) */
  placeBid: (
    playerId: string,
    byTeamId: number,
    amount: number
  ) => { ok: boolean; error?: string };

  /** Finalize sale: deduct budget, assign slot, mark drafted */
  assignPlayer: (
    playerId: string,
    toTeamId: number,
    amount: number
  ) => { ok: boolean; error?: string; player?: Player };

  // Queue
  startProcessingQueue: () => void;
  finishProcessingQueue: () => void;
  popNomination: () => string | undefined;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;

  // Undo / Redo
  captureState: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Helpers
  hasSlotFor: (teamId: number, pos: BasePosition) => boolean;
  openSlotsFor: (teamId: number, pos: BasePosition) => number;
  computeMaxBid: (teamId: number) => number;
  setCurrentBidder: (teamId: number | null) => void;
}

/** Default roster (BENCH is optional—kept here for completeness) */
const DEFAULT_ROSTER: Record<AssignedSlot, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  DEF: 1,
  K: 1,
  BENCH: 0,
};

/** Count used slots (by looking at players drafted by team) */
function countUsedSlots(players: Player[], teamId: number): Record<AssignedSlot, number> {
  const init: Record<AssignedSlot, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0, BENCH: 0,
  };
  for (const p of players) {
    if (p.draftedBy === teamId && p.slot) {
      init[p.slot] = (init[p.slot] || 0) + 1;
    }
  }
  return init;
}

/** Build a serializable snapshot of current state */
function toSnapshot(state: DraftState): DraftSnapshot {
  return {
    teamCount: state.teamCount,
    baseBudget: state.baseBudget,
    templateRoster: JSON.parse(JSON.stringify(state.templateRoster)),
    teams: JSON.parse(JSON.stringify(state.teams)),
    players: JSON.parse(JSON.stringify(state.players)),
    nominationQueue: JSON.parse(JSON.stringify(state.nominationQueue)),
    isProcessingQueue: state.isProcessingQueue,
    currentBidder: state.currentBidder,
  };
}

/** Apply a snapshot into the mutable draft (immer) */
function applySnapshot(draft: ImmerDraft<DraftState>, snap: DraftSnapshot) {
  draft.teamCount = snap.teamCount;
  draft.baseBudget = snap.baseBudget;
  draft.templateRoster = JSON.parse(JSON.stringify(snap.templateRoster));
  draft.teams = JSON.parse(JSON.stringify(snap.teams));
  draft.players = JSON.parse(JSON.stringify(snap.players));
  draft.nominationQueue = JSON.parse(JSON.stringify(snap.nominationQueue));
  draft.isProcessingQueue = snap.isProcessingQueue;
  draft.currentBidder = snap.currentBidder;
}

/** Utility: sum of allowed non-bench slots for a team */
function totalAllowedSlots(roster: Record<AssignedSlot, number>): number {
  const { BENCH, ...starters } = roster;
  return Object.values(starters).reduce((s, n) => s + (n || 0), 0);
}

export const useDraftStore = create<DraftState>()(
  devtools(
    (set, get) => {
      const getState = () => get() as DraftState;

      return {
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
        currentBidder: null,

        // ----- Config -----
        setConfig: (config) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              const { teamCount, baseBudget, templateRoster } = config;
              draft.teamCount = teamCount;
              draft.baseBudget = baseBudget;
              draft.templateRoster = { ...templateRoster };

              draft.teams = Array.from({ length: teamCount }, (_, i) => ({
                id: i + 1,
                name: `Team ${i + 1}`,
                budget: baseBudget,
                roster: { ...templateRoster },
              }));

              draft.history = [];
              draft.future = [];
            })
          ),

        setTeamNames: (names) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              names.forEach((name, i) => {
                if (draft.teams[i]) draft.teams[i].name = name || `Team ${i + 1}`;
              });
            })
          ),

        setPlayers: (players) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              draft.players = players;
            })
          ),

        // ----- Nomination & Bidding -----
        nominate: (playerId, startingBid = 1) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              if (!playerId) return;
              draft.nominationQueue.push({ playerId, startingBid });
              draft.currentBidder = null;
            })
          ),

        nominatePlayer: (playerId, byTeamId, startAmount) => {
          const state = getState();
          if (!playerId) return { ok: false, error: "Player ID is required" };
          if (startAmount < 1) return { ok: false, error: "Starting bid must be at least $1" };

          const player = state.players.find((p) => p.id === playerId);
          if (!player) return { ok: false, error: "Player not found" };
          if (player.draftedBy !== undefined) return { ok: false, error: "Player has already been drafted" };

          // Validate the nominating team exists
          const team = state.teams.find((t) => t.id === byTeamId);
          if (!team) return { ok: false, error: "Team not found" };

          set(
            produce((draft: ImmerDraft<DraftState>) => {
              draft.nominationQueue.push({ playerId, startingBid: startAmount });
              draft.currentBidder = byTeamId;
            })
          );

          return { ok: true, nomination: { playerId, startingBid: startAmount } };
        },

        /** Validate only; don't mutate budgets/players here */
        placeBid: (playerId, byTeamId, amount) => {
          const state = getState();
          if (!playerId) return { ok: false, error: "Player ID is required" };
          if (amount < 1) return { ok: false, error: "Bid amount must be at least $1" };

          const player = state.players.find((p) => p.id === playerId);
          if (!player) return { ok: false, error: "Player not found" };
          if (player.draftedBy !== undefined) return { ok: false, error: "Player has already been drafted" };

          const team = state.teams.find((t) => t.id === byTeamId);
          if (!team) return { ok: false, error: "Team not found" };

          // Check roster capacity
          const canRoster =
            state.hasSlotFor(byTeamId, player.pos) ||
            (["RB", "WR", "TE"].includes(player.pos) &&
              state.openSlotsFor(byTeamId, "FLEX" as BasePosition) > 0);
          if (!canRoster) return { ok: false, error: "No available roster spots" };

          // Max bid logic: must reserve $1 for each remaining open slot after this purchase
          const maxBid = state.computeMaxBid(byTeamId);
          if (amount > maxBid) return { ok: false, error: `Bid exceeds max allowed ($${maxBid})` };

          // Record the current bidder for UI purposes
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              draft.currentBidder = byTeamId;
            })
          );

          return { ok: true };
        },

        /** Finalize player assignment */
        assignPlayer: (playerId, toTeamId, amount) => {
          const state = getState();
          if (!playerId) return { ok: false, error: "Player ID is required" };
          if (amount < 1) return { ok: false, error: "Amount must be at least $1" };

          const playerIndex = state.players.findIndex((p) => p.id === playerId);
          if (playerIndex === -1) return { ok: false, error: "Player not found" };

          const player = state.players[playerIndex];
          if (player.draftedBy !== undefined) return { ok: false, error: "Player has already been drafted" };

          const teamIndex = state.teams.findIndex((t) => t.id === toTeamId);
          if (teamIndex === -1) return { ok: false, error: "Team not found" };

          const team = state.teams[teamIndex];
          const maxBid = state.computeMaxBid(toTeamId);
          if (amount > maxBid) return { ok: false, error: `Amount exceeds max allowed ($${maxBid})` };

          // Determine slot to assign
          const used = countUsedSlots(state.players, toTeamId);
          let assignedSlot: AssignedSlot = player.pos;

          const allowedPos = team.roster[player.pos] || 0;
          const usedPos = used[player.pos] || 0;

          if (usedPos >= allowedPos) {
            // Try FLEX for RB/WR/TE
            if (["RB", "WR", "TE"].includes(player.pos) && (used.FLEX || 0) < (team.roster.FLEX || 0)) {
              assignedSlot = "FLEX";
            } else {
              return { ok: false, error: "No available roster spots for this position" };
            }
          }

          set(
            produce((draft: ImmerDraft<DraftState>) => {
              // Assign player
              draft.players[playerIndex].draftedBy = toTeamId;
              draft.players[playerIndex].price = amount;
              draft.players[playerIndex].slot = assignedSlot;

              // Deduct budget
              draft.teams[teamIndex].budget = Math.max(0, draft.teams[teamIndex].budget - amount);

              // Remove from head of queue if it matches current nomination
              if (draft.nominationQueue.length && draft.nominationQueue[0].playerId === playerId) {
                draft.nominationQueue.shift();
              }

              draft.currentBidder = null;
            })
          );

          return { ok: true, player: { ...getState().players[playerIndex] } };
        },

        // ----- Queue -----
        startProcessingQueue: () => set({ isProcessingQueue: true }),
        finishProcessingQueue: () => set({ isProcessingQueue: false }),

        popNomination: () => {
          let id: string | undefined;
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              const nom = draft.nominationQueue.shift();
              id = nom?.playerId;
            })
          );
          return id;
        },

        removeFromQueue: (index) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              if (index >= 0 && index < draft.nominationQueue.length) {
                draft.nominationQueue.splice(index, 1);
              }
            })
          ),

        clearQueue: () => set({ nominationQueue: [] }),

        // ----- Undo/Redo (snapshot-based) -----
        captureState: () =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              const snap = toSnapshot(draft as unknown as DraftState);
              draft.history = [...draft.history, snap].slice(-draft.maxHistorySize);
              draft.future = [];
            })
          ),

        undo: () =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              if (!draft.history.length) return;
              const prev = draft.history[draft.history.length - 1];
              draft.history = draft.history.slice(0, -1);

              // push current to future
              const currentSnap = toSnapshot(draft as unknown as DraftState);
              draft.future = [currentSnap, ...draft.future];

              // apply previous
              applySnapshot(draft, prev);
            })
          ),

        redo: () =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              if (!draft.future.length) return;
              const next = draft.future[0];
              draft.future = draft.future.slice(1);

              // push current to history
              const currentSnap = toSnapshot(draft as unknown as DraftState);
              draft.history = [...draft.history, currentSnap].slice(-draft.maxHistorySize);

              // apply next
              applySnapshot(draft, next);
            })
          ),

        canUndo: () => getState().history.length > 0,
        canRedo: () => getState().future.length > 0,

        // ----- Helpers -----
        hasSlotFor: (teamId, pos) => {
          const state = getState();
          const team = state.teams.find((t) => t.id === teamId);
          if (!team) return false;

          const used = countUsedSlots(state.players, teamId);
          const allowedPos = team.roster[pos] || 0;
          const usedPos = used[pos] || 0;
          if (usedPos < allowedPos) return true;

          // Try FLEX for RB/WR/TE
          if (["RB", "WR", "TE"].includes(pos)) {
            const allowedFlex = team.roster.FLEX || 0;
            const usedFlex = used.FLEX || 0;
            if (usedFlex < allowedFlex) return true;
          }
          return false;
        },

        openSlotsFor: (teamId, pos) => {
          const state = getState();
          const team = state.teams.find((t) => t.id === teamId);
          if (!team) return 0;

          const used = countUsedSlots(state.players, teamId);
          const posOpen = Math.max(0, (team.roster[pos] || 0) - (used[pos] || 0));
          const flexOpen =
            ["RB", "WR", "TE"].includes(pos as string)
              ? Math.max(0, (team.roster.FLEX || 0) - (used.FLEX || 0))
              : 0;

          return posOpen + flexOpen;
        },

        /** Max bid = team budget minus $1 for each remaining open roster slot after this purchase */
        computeMaxBid: (teamId) => {
          const state = getState();
          const team = state.teams.find((t) => t.id === teamId);
          if (!team) return 0;

          const startersAllowed = totalAllowedSlots(team.roster);
          const draftedCount = state.players.filter((p) => p.draftedBy === teamId).length;
          const openSpots = Math.max(0, startersAllowed - draftedCount);

          // If you buy one more player now, you must still reserve $1 for (openSpots - 1)
          const mustReserve = Math.max(0, openSpots - 1);
          return Math.max(0, team.budget - mustReserve);
        },

        setCurrentBidder: (teamId) =>
          set(
            produce((draft: ImmerDraft<DraftState>) => {
              draft.currentBidder = teamId;
            })
          ),
      };
    },
    { name: "draft-store" }
  )
);

export default useDraftStore;
