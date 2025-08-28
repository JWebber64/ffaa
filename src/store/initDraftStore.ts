import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { DraftState } from './draftStore.new';
import { migrateStoreData } from './migrateToNewStore';

// Run migration if needed
const migratedData = migrateStoreData();

// Create the store with proper typing and persistence
export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      // Initial state (will be overridden by persisted or migrated data)
      players: [],
      teams: [],
      nominationQueue: [],
      currentBidder: undefined,

      // Actions
      setPlayers: (players) => set({ players }),
      setTeams: (teams) => set({ teams }),
      setCurrentBidder: (currentBidder) => set({ currentBidder }),

      nominate: (playerId: string, startAmount = 1) =>
        set(
          produce((state: DraftState) => {
            if (!playerId) return;

            // Guards
            const player = state.players.find((p) => p.id === playerId);
            if (!player || player.draftedBy !== undefined) return;
            if (state.nominationQueue.some((n) => n.playerId === playerId)) return;

            // Add new nomination to the front of the queue
            state.nominationQueue.unshift({
              playerId,
              currentBid: Math.max(1, startAmount),
              highBidder: undefined,
            });

            // Reset current bidder when a new player is nominated
            state.currentBidder = undefined;
          })
        ),

      placeBid: (playerId: string, byTeamId: number, amount: number) =>
        set(
          produce((state: DraftState) => {
            const idx = state.nominationQueue.findIndex((n) => n.playerId === playerId);
            if (idx === -1) return;

            const maxBid = get().computeMaxBid(byTeamId);
            if (amount < 1 || amount > maxBid) {
              throw new Error(`Bid must be between $1 and $${maxBid}`);
            }

            state.nominationQueue[idx].currentBid = amount;
            state.nominationQueue[idx].highBidder = byTeamId;
          })
        ),

      assignPlayer: (playerId: string, teamId: number, price: number) =>
        set(
          produce((state: DraftState) => {
            const playerIndex = state.players.findIndex((p) => p.id === playerId);
            if (playerIndex === -1) throw new Error('Player not found');

            const teamIndex = state.teams.findIndex((t) => t.id === teamId);
            if (teamIndex === -1) throw new Error('Team not found');

            // Update player
            state.players[playerIndex].draftedBy = teamId;
            state.players[playerIndex].price = price;

            // Update team
            const team = state.teams[teamIndex];
            team.budget -= price;
            const pos = state.players[playerIndex].pos as keyof typeof POSITION_CAP;
            team.roster = {
              ...team.roster,
              [pos]: (team.roster?.[pos] || 0) + 1,
            };

            // Remove from queue
            state.nominationQueue = state.nominationQueue.filter((n) => n.playerId !== playerId);
          })
        ),

      computeMaxBid: (teamId: number) => {
        const { teams, players } = get();
        const team = teams.find((t) => t.id === teamId);
        if (!team) return 0;

        // Remaining roster slots (can't be negative)
        const drafted = players.filter((p) => p.draftedBy === teamId).length;
        const slotsRemaining = Math.max(0, ROSTER_SIZE - drafted);
        
        // Reserve $1 for each slot *after this bid*
        const requiredReserve = Math.max(0, slotsRemaining - 1);
        return Math.max(0, team.budget - requiredReserve);
      },

      hasSlotFor: (teamId: number, pos: string) => {
        const { teams } = get();
        const team = teams.find((t) => t.id === teamId);
        if (!team) return false;

        const key = (pos || '').toUpperCase() as keyof typeof POSITION_CAP;
        const cap = POSITION_CAP[key];
        if (!cap) return true; // if no cap is defined for this pos, allow

        const current = team.roster?.[key] || 0;
        return current < cap;
      },
    }),
    {
      name: 'auction-draft-state',
      storage: createJSONStorage(() => localStorage),
      // Merge with migrated data if available
      merge: (persistedState: any) => ({
        ...(migratedData || {}),
        ...(persistedState || {}),
      }),
    }
  )
);

// Position constraints
const POSITION_CAP = {
  QB: 2,
  RB: 6,
  WR: 6,
  TE: 3,
  K: 2,
  DEF: 2,
} as const;

const ROSTER_SIZE = 16;
