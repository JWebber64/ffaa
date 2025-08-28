import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export type BasePosition = Position;

// === Auction constraints (tune to your league) ===
const ROSTER_SIZE = 16; // total roster spots each team must fill

// Per-position caps (used by hasSlotFor)
const POSITION_CAP: Record<Position, number> = {
  QB: 2, RB: 6, WR: 6, TE: 3, K: 2, DEF: 2,
};

// Helper: how many players a team already drafted
function draftedCountForTeam(players: Player[], teamId: number) {
  return players.reduce((acc, p) => acc + (p.draftedBy === teamId ? 1 : 0), 0);
}

export interface Team {
  id: number;
  name: string;
  budget: number; // remaining dollars
  roster: Partial<Record<Position, number>>;
}

export interface Player {
  id: string;
  name: string;
  pos: BasePosition;
  nflTeam?: string;
  draftedBy?: number;  // teamId if drafted
  price?: number;      // price drafted for
}

export interface Nomination {
  playerId: string;
  currentBid: number;
  highBidder?: number; // teamId
}

interface DraftState {
  // state
  players: Player[];
  teams: Team[];
  nominationQueue: Nomination[];
  currentBidder?: number;

  // actions
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentBidder: (teamId?: number) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  assignPlayer: (playerId: string, teamId: number, price: number) => void;
  computeMaxBid: (teamId: number) => number;
  hasSlotFor: (teamId: number, pos: string) => boolean;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      // Initial state
      players: [],
      teams: [
        // seed demo teams if you want:
        // { id: 1, name: 'Team A', budget: 200, roster: {} },
        // { id: 2, name: 'Team B', budget: 200, roster: {} },
      ],
      nominationQueue: [],
      currentBidder: undefined,

      // Actions
      setPlayers: (players: Player[]) => set({ players }),

      setTeams: (teams: Team[]) => set({ teams }),

      setCurrentBidder: (teamId?: number) => set({ currentBidder: teamId }),

      nominate: (playerId: string, startingBid = 1) =>
        set(
          produce((draft: DraftState) => {
            if (!playerId) return;

            // guards
            const player = draft.players.find((p) => p.id === playerId);
            if (!player || player.draftedBy !== undefined) return;
            if (draft.nominationQueue.some((n) => n.playerId === playerId)) return;

            // put new nomination at the front so queue[0] is always the current lot
            draft.nominationQueue.unshift({
              playerId,
              currentBid: Math.max(1, startingBid),
              highBidder: undefined, // Reset bidder until someone places a bid
            });

            // Reset current bidder when a new player is nominated
            draft.currentBidder = undefined;
          })
        ),

      placeBid: (playerId: string, byTeamId: number, amount: number) =>
        set(
          produce((draft: DraftState) => {
            const idx = draft.nominationQueue.findIndex((n) => n.playerId === playerId);
            if (idx === -1) return;

            const maxBid = get().computeMaxBid(byTeamId);
            if (amount < 1 || amount > maxBid) {
              throw new Error(`Bid must be between $1 and $${maxBid}`);
            }

            draft.nominationQueue[idx].currentBid = amount;
            draft.nominationQueue[idx].highBidder = byTeamId;
          })
        ),

      assignPlayer: (playerId: string, teamId: number, price: number) =>
        set(
          produce((draft: DraftState) => {
            const playerIndex = draft.players.findIndex((p) => p.id === playerId);
            if (playerIndex === -1) throw new Error('Player not found');

            const teamIndex = draft.teams.findIndex((t) => t.id === teamId);
            if (teamIndex === -1) throw new Error('Team not found');

            // Update player
            draft.players[playerIndex].draftedBy = teamId;
            draft.players[playerIndex].price = price;

            // Update team
            const team = draft.teams[teamIndex];
            team.budget -= price;
            const pos = draft.players[playerIndex].pos as Position;
            team.roster = {
              ...team.roster,
              [pos]: (team.roster?.[pos] || 0) + 1,
            };

            // Remove from queue
            draft.nominationQueue = draft.nominationQueue.filter((n) => n.playerId !== playerId);
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

        const key = (pos || '').toUpperCase() as Position;
        const cap = POSITION_CAP[key];
        if (!cap) return true; // if no cap is defined for this pos, allow

        const current = team.roster?.[key] || 0;
        return current < cap;
      },
    }),
    {
      name: 'auction-draft-state',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
