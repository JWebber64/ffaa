import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import FfcAdp from '../services/FfcAdp';
import type { FfcPlayer } from '../services/FfcAdp';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';
export type BasePosition = Exclude<Position, 'FLEX' | 'BENCH'>;

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
  search_rank?: number;
  search_rank_ppr?: number;
  rank?: number;
  posRank?: number;
  adp?: number;
  adpSource?: string;
  averagePick?: number;
  minPick?: number;
  maxPick?: number;
  percentDrafted?: number;
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
  currentBid: number;
  highBidder?: number;
}

export interface DraftState {
  // state
  players: Player[];
  playersLoaded: boolean;
  adpLoaded: boolean;
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
  setCurrentNominatedId: (id: string | null) => void;
  setCurrentBidder: (teamId?: number) => void;
  applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => void;
  loadAdp: (opts: { year: number; teams: number; scoring: 'standard' | 'ppr' | 'half-ppr' }) => Promise<void>;
  
  // config helpers
  setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;
  setTeamNames: (names: string[]) => void;
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  assignPlayer: (playerId: string, teamId: number, price: number) => void;
  computeMaxBid: (teamId: number) => number;
  hasSlotFor: (teamId: number, pos: Position) => boolean;
  resetDraft: () => void;
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

// Create the store with all state and actions
export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      // State
      players: [],
      playersLoaded: false,
      adpLoaded: false,
      teams: [],
      baseBudget: 200,
      teamCount: 12,
      templateRoster: { ...POSITION_CAP },
      nominationQueue: [],
      currentNominatedId: null,
      currentBidder: undefined,

      // Actions
      setPlayers: (players: Player[]) => set({ players, playersLoaded: true }),
      setTeams: (teams: Team[]) => set({ teams }),
      setCurrentNominatedId: (id: string | null) => set({ currentNominatedId: id }),
      setCurrentBidder: (teamId?: number) => set({ currentBidder: teamId }),
      applyAdp: (updates: Array<{ id: string } & Partial<FfcPlayer>>) => {
        set(produce((state: DraftState) => {
          let updatedCount = 0;
          
          updates.forEach(update => {
            const player = state.players.find(p => p.id === update.id);
            if (player) {
              // Map FfcPlayer fields to Player fields
              if (update.adp !== undefined) player.adp = update.adp;
              if (update.position) player.pos = update.position as Position;
              if (update.team) player.nflTeam = update.team;
              if (update.averagePick !== undefined) player.averagePick = update.averagePick;
              if (update.minPick !== undefined) player.minPick = update.minPick;
              if (update.maxPick !== undefined) player.maxPick = update.maxPick;
              if (update.percentDrafted !== undefined) player.percentDrafted = update.percentDrafted;
              
              updatedCount++;
            }
          });
          
          console.log(`Updated ADP data for ${updatedCount} players`);
          state.adpLoaded = true;
        }));
      },
      loadAdp: async (opts: { year: number; teams: number; scoring: 'standard' | 'ppr' | 'half-ppr' }) => {
        const { applyAdp } = get();
        const ffc = new FfcAdp();
        const updates = await ffc.load({
          year: opts.year,
          teams: opts.teams,
          scoring: opts.scoring,
        });
        applyAdp(updates);
      },
      setConfig: (config: {
        teamCount: number;
        baseBudget: number;
        templateRoster: Record<Position, number>;
      }) => set(produce((state: DraftState) => {
        state.teamCount = config.teamCount;
        state.baseBudget = config.baseBudget;
        state.templateRoster = { ...config.templateRoster };

        if (state.teams.length !== config.teamCount) {
          const next: Team[] = [];
          for (let i = 0; i < config.teamCount; i++) {
            const existing = state.teams[i];
            next.push({
              id: i + 1,
              name: existing?.name ?? `Team ${i + 1}`,
              budget: existing?.budget ?? config.baseBudget,
              roster: existing?.roster ?? {} as Record<Position, number>,
            });
          }
          state.teams = next;
        }
      })),
      setTeamNames: (names: string[]) => set(produce((state: DraftState) => {
        if (state.teams.length !== state.teamCount) {
          state.teams = Array.from({ length: state.teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${i + 1}`,
            budget: state.baseBudget,
            roster: {} as Record<Position, number>,
          }));
        }
        names.forEach((name, i) => {
          if (state.teams[i]) state.teams[i].name = name || `Team ${i + 1}`;
        });
      })),
      nominate: (playerId: string, startingBid: number = 1) => {
        const { players, nominationQueue } = get();
        const player = players.find(p => p.id === playerId);
        
        if (!player || player.draftedBy !== undefined) {
          throw new Error('Invalid player or already drafted');
        }
        
        // Ensure startingBid is a number, default to 1 if not provided or invalid
        const bid = typeof startingBid === 'number' && !isNaN(startingBid) ? startingBid : 1;
        
        const newNomination: Nomination = {
          playerId,
          startingBid: bid,
          currentBid: bid,
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
        if (!player) {
          throw new Error('Player not found');
        }
        if (player.draftedBy !== undefined) {
          throw new Error('Player already drafted');
        }

        // Validate team exists
        const team = teams.find(t => t.id === teamId);
        if (!team) {
          throw new Error('Team not found');
        }

        // Validate price is positive and within budget
        if (price <= 0) {
          throw new Error('Bid amount must be positive');
        }
        
        // Validate team has enough budget
        if (price > team.budget) {
          throw new Error('Team does not have enough budget');
        }

        // Check if team has an open slot for this position
        if (!hasSlotFor(teamId, player.pos)) {
          throw new Error(`No available ${player.pos} slot on team`);
        }

        // Update state using immer's produce for immutable updates
        set(produce((state: DraftState) => {
          // Update player
          const playerIndex = state.players.findIndex(p => p.id === playerId);
          if (playerIndex !== -1) {
            state.players[playerIndex].draftedBy = teamId;
            state.players[playerIndex].price = price;
          }

          // Update team budget and roster
          const teamIndex = state.teams.findIndex(t => t.id === teamId);
          if (teamIndex !== -1) {
            // Decrement budget
            state.teams[teamIndex].budget -= price;
            
            // Initialize roster if needed and update position count
            const pos = player.pos;
            if (!state.teams[teamIndex].roster) {
              state.teams[teamIndex].roster = { ...POSITION_CAP };
              Object.keys(state.teams[teamIndex].roster).forEach(key => {
                state.teams[teamIndex].roster[key as Position] = 0;
              });
            }
            
            // Increment position count
            state.teams[teamIndex].roster[pos] = (state.teams[teamIndex].roster[pos] || 0) + 1;
          }

          // Remove from nomination queue and reset current nomination
          state.nominationQueue = state.nominationQueue.filter(n => n.playerId !== playerId);
          state.currentNominatedId = null;
          state.currentBidder = undefined;
        }));
      },
      resetDraft: () => set(produce((state: DraftState) => {
        // Reset players (remove draft info but keep player data)
        state.adpLoaded = false;
        state.players.forEach(player => {
          delete player.draftedBy;
          delete player.price;
        });

        // Reset teams (reset budget and roster)
        const baseBudget = state.baseBudget;
        state.teams.forEach(team => {
          team.budget = baseBudget;
          // Reset roster counts
          if (team.roster) {
            Object.keys(team.roster).forEach(pos => {
              team.roster[pos as Position] = 0;
            });
          } else {
            team.roster = { ...POSITION_CAP };
            Object.keys(team.roster).forEach(key => {
              team.roster[key as Position] = 0;
            });
          }
        });
      })),
    }),
    {
      name: 'auction-draft-state',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist certain parts of the state
      partialize: (state) => ({
        players: state.players,
        playersLoaded: state.playersLoaded,
        adpLoaded: state.adpLoaded,
        teams: state.teams,
        baseBudget: state.baseBudget,
        teamCount: state.teamCount,
        templateRoster: state.templateRoster,
        nominationQueue: state.nominationQueue,
        currentNominatedId: state.currentNominatedId,
        currentBidder: state.currentBidder
      })
    }
  )
);

// Selectors
export const useDraftStoreSelectors = () => {
  const { players, teams, nominationQueue, currentNominatedId } = useDraftStore.getState();

  return {
    // Get undrafted players
    undraftedPlayers: players.filter(p => p.draftedBy === undefined),
    
    // Get top available players (undrafted, sorted by rank/adp)
    topAvailable: (limit = 300) => {
      const undrafted = players.filter(p => p.draftedBy === undefined);
      return [...undrafted].sort((a, b) => {
        // Sort by rank (ascending)
        if (a.rank !== undefined && b.rank !== undefined) {
          return a.rank - b.rank;
        }
        // If ranks are equal or missing, sort by ADP (ascending)
        if (a.adp !== undefined && b.adp !== undefined) {
          return a.adp - b.adp;
        }
        // Fall back to name
        return a.name.localeCompare(b.name);
      }).slice(0, limit);
    },
    
    // Get top available players by position
    topAvailableByPos: (pos: Position, limit = 100) => {
      const undrafted = players.filter(p => 
        p.draftedBy === undefined && p.pos === pos
      );
      
      return [...undrafted].sort((a, b) => {
        // Prefer posRank over rank when available
        if (a.posRank !== undefined && b.posRank !== undefined) {
          return a.posRank - b.posRank;
        }
        if (a.rank !== undefined && b.rank !== undefined) {
          return a.rank - b.rank;
        }
        // Fall back to ADP if ranks are equal or missing
        if (a.adp !== undefined && b.adp !== undefined) {
          return a.adp - b.adp;
        }
        // Finally, sort by name
        return a.name.localeCompare(b.name);
      }).slice(0, limit);
    },
    
    // Get top available players by multiple positions
    topAvailableByMultiPos: (positions: Position[], limit = 100) => {
      const posSet = new Set(positions);
      const undrafted = players.filter(p => 
        p.draftedBy === undefined && posSet.has(p.pos)
      );
      
      return [...undrafted].sort((a, b) => {
        // Use rank or posRank if available
        const aRank = a.posRank ?? a.rank ?? Infinity;
        const bRank = b.posRank ?? b.rank ?? Infinity;
        
        if (aRank !== bRank) {
          return aRank - bRank;
        }
        
        // Fall back to ADP if ranks are equal
        if (a.adp !== undefined && b.adp !== undefined) {
          return a.adp - b.adp;
        }
        
        // Finally, sort by name
        return a.name.localeCompare(b.name);
      }).slice(0, limit);
    },
    
    // Get top available flex players (RB/WR/TE or RB/WR)
    topAvailableForFlex: (limit = 100, includeTE = true) => {
      const flexPositions: Position[] = includeTE ? ['RB', 'WR', 'TE'] : ['RB', 'WR'];
      return useDraftStoreSelectors().topAvailableByMultiPos(flexPositions, limit);
    }
  }
}
