import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { DraftState } from './draftStore';
import { migrateStoreData } from './migrateStore';

// Run migration if needed
// Start with version 0 to force migration
const migratedData = migrateStoreData({}, 0);

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

      computeMaxBid: (teamId: number, playerPos?: string) => {
        const { teams, players, templateRoster } = get();
        const team = teams.find((t) => t.id === teamId);
        if (!team) return 0;

        // 1. Calculate total roster slots remaining
        const drafted = players.filter((p) => p.draftedBy === teamId);
        const totalSlotsRemaining = Math.max(0, ROSTER_SIZE - drafted.length);
        
        // 2. If we're checking for a specific position, validate roster slot availability
        if (playerPos) {
          const pos = playerPos.toUpperCase() as keyof typeof templateRoster;
          const posSlots = templateRoster[pos] || 0;
          const draftedAtPos = drafted.filter(p => p.pos === playerPos).length;
          
          // If no more slots at this position, can't bid
          if (draftedAtPos >= posSlots) return 0;
        }
        
        // 3. Calculate minimum required budget for remaining slots
        // Reserve at least $1 per remaining slot, but scale with remaining budget
        const minBidPerSlot = 1;
        const remainingBudget = team.budget;
        
        // More sophisticated reserve calculation:
        // - Reserve more if we have many slots left to fill
        // - Reserve less if we're close to filling the roster
        const baseReserve = Math.max(
          minBidPerSlot,
          Math.floor(remainingBudget / (totalSlotsRemaining * 2)) // Reserve more aggressively early, less later
        );
        
        const requiredReserve = Math.max(0, (totalSlotsRemaining - 1) * baseReserve);
        const maxBid = Math.max(0, remainingBudget - requiredReserve);
        
        // Ensure we don't return more than the remaining budget
        return Math.min(maxBid, remainingBudget);
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
