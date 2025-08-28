import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';

export interface Team {
  id: number;
  name: string;
  budget: number;
  roster: Record<Position, number>;
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  nflTeam?: string;
  draftedBy?: number;
  price?: number;
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
  currentBid: number;
  highBidder?: number;
}

interface DraftState {
  // state
  players: Player[];
  teams: Team[];
  nominationQueue: Nomination[];
  currentBidder?: number;
  baseBudget: number;
  teamCount: number;
  templateRoster: Record<Position, number>;
  currentNominatedId?: string | null;

  // actions
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentBidder: (teamId?: number) => void;
  setCurrentNominatedId: (id: string | null) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  assignPlayer: (playerId: string, teamId: number, price: number) => void;
  computeMaxBid: (teamId: number) => number;
  hasSlotFor: (teamId: number, pos: Position) => boolean;
}

// Auction constraints
const ROSTER_SIZE = 16;
const POSITION_CAP: Record<Position, number> = {
  QB: 2, RB: 6, WR: 6, TE: 3, K: 2, DEF: 2, FLEX: 1, BENCH: 6
};

// Helper: count players drafted by a team
function draftedCountForTeam(players: Player[], teamId: number): number {
  return players.filter(p => p.draftedBy === teamId).length;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      players: [],
      teams: [],
      baseBudget: 200,
      teamCount: 12,
      templateRoster: POSITION_CAP,
      nominationQueue: [],
      currentNominatedId: null,

        setPlayers: (players: Player[]) => set({ players }),
        setTeams: (teams: Team[]) => set({ teams }),
        setCurrentNominatedId: (id: string | null) => set({ currentNominatedId: id }),
        setCurrentBidder: (teamId?: number) => set({ currentBidder: teamId }),
        nominate: (playerId: string, startingBid: number = 1) => {
          const { players, nominationQueue } = get();
          const player = players.find(p => p.id === playerId);
          
          if (!player || player.draftedBy !== undefined) {
            throw new Error('Invalid player or already drafted');
          }
          
          const newNomination: Nomination = {
            playerId,
            startingBid,
            currentBid: startingBid,
            highBidder: undefined
          };
          
          set({
            nominationQueue: [...nominationQueue, newNomination],
            currentNominatedId: playerId
          });
        },

        computeMaxBid: (teamId: number): number => {
          const { players, teams } = get();
          const team = teams.find(t => t.id === teamId);
          if (!team) return 0;

          const draftedCount = draftedCountForTeam(players, teamId);
          const remainingSlots = ROSTER_SIZE - draftedCount;
          if (remainingSlots <= 0) return 0;

          const reserve = remainingSlots - 1;
          return Math.max(0, team.budget - reserve);
        },

        hasSlotFor: (teamId: number, pos: Position): boolean => {
          const { players, teams } = get();
          const team = teams.find(t => t.id === teamId);
          if (!team) return false;

          const currentCount = team.roster[pos] || 0;
          return currentCount < (POSITION_CAP[pos] || 0);
        },

        placeBid: (playerId: string, byTeamId: number, amount: number) => {
          const { players, teams, nominationQueue, computeMaxBid } = get();
          
          // Validate player exists and not drafted
          const player = players.find(p => p.id === playerId);
          if (!player || player.draftedBy !== undefined) {
            throw new Error('Invalid player or already drafted');
          }

          // Validate team exists
          const team = teams.find(t => t.id === byTeamId);
          if (!team) {
            throw new Error('Team not found');
          }

          // Validate bid amount
          const maxBid = computeMaxBid(byTeamId);
          if (amount < 1 || amount > maxBid) {
            throw new Error(`Bid amount must be between $1 and $${maxBid}`);
          }

          // Update nomination
          set({
            nominationQueue: nominationQueue.map(nom => 
              nom.playerId === playerId 
                ? { ...nom, currentBid: amount, highBidder: byTeamId }
                : nom
            )
          });
        },

        assignPlayer: (playerId: string, teamId: number, price: number) => {
          const { players, teams, computeMaxBid, hasSlotFor } = get();
          
          // Validate player exists and not drafted
          const player = players.find(p => p.id === playerId);
          if (!player || player.draftedBy !== undefined) {
            throw new Error('Invalid player or already drafted');
          }

          // Validate team exists
          const team = teams.find(t => t.id === teamId);
          if (!team) {
            throw new Error('Team not found');
          }

          // Validate price and slot availability
          if (price > computeMaxBid(teamId) || !hasSlotFor(teamId, player.pos)) {
            throw new Error('Invalid bid or no available slot');
          }

          // Update state
          set(produce((state: DraftState) => {
            // Update player
            const playerIndex = state.players.findIndex(p => p.id === playerId);
            if (playerIndex !== -1) {
              state.players[playerIndex].draftedBy = teamId;
              state.players[playerIndex].price = price;
            }

            // Update team
            const teamIndex = state.teams.findIndex(t => t.id === teamId);
            if (teamIndex !== -1) {
              // Decrement budget
              state.teams[teamIndex].budget -= price;
              
              // Update roster count
              const pos = player.pos;
              state.teams[teamIndex].roster[pos] = (state.teams[teamIndex].roster[pos] || 0) + 1;
            }

            // Remove from nomination queue
            state.nominationQueue = state.nominationQueue.filter(n => n.playerId !== playerId);
            
            // Clear current nominated if it was this player
            if (state.currentNominatedId === playerId) {
              state.currentNominatedId = null;
            }
          }));
        }
      }),
      {
        name: 'auction-draft-state',
        storage: createJSONStorage(() => localStorage),
        version: 1
      }
    )
  )
