// Base player type
export interface Player {
  id: string;
  name: string;
  pos: Position;
  nflTeam?: string;
  team?: string; // For backward compatibility
  draftedBy?: number;
  price?: number;
  search_rank?: number;
  search_rank_ppr?: number;
  rank?: number;
  posRank?: number;
  adp?: number;
  adpSource?: string;
  slot?: Position; // For compatibility with roster slots
  [key: string]: any; // For any additional properties
}

// Team roster structure
export interface Roster {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  BENCH: number;
  [key: string]: number;
}

// Team type
export interface Team {
  id: number;
  name: string;
  budget: number;
  players: string[];
  roster: Roster;
}

// Draft state
export interface DraftState {
  players: Player[];
  teams: Team[];
  playersLoaded: boolean;
  adpLoaded: boolean;
  pendingAssignment: {
    teamId: number;
    playerId: string;
    validSlots: string[];
  } | null;
  auctionSettings: {
    [key: string]: any;
  };
  bidState: {
    [key: string]: any;
  };
  runtime: {
    [key: string]: any;
  };
  nominationQueue: Array<{
    playerId: string;
    [key: string]: any;
  }>;
  currentAuction: any;
  currentNominatedId: string | null;
  currentBidder: number | undefined;
  baseBudget: number;
  teamCount: number;
  templateRoster: Roster;
}

// Position type
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';

// Draft store interface
export interface DraftStore extends DraftState {
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  assignPlayer: (playerId: string, teamId: number, price: number, slot?: string) => void;
  selectPlayerImmediate: (playerId: string, teamId: number) => void;
  computeMaxBid: (teamId: number, playerPos?: string) => number;
  resetDraft: () => void;
  selectors: {
    undraftedPlayers: (state: DraftState) => Player[];
    topAvailable: (state: DraftState, limit?: number) => Player[];
    topAvailableByPos: (state: DraftState, pos: Position, limit?: number) => Player[];
    topAvailableByMultiPos: (state: DraftState, positions: Position[], limit?: number) => Player[];
    topAvailableForFlex: (state: DraftState, limit?: number, includeTE?: boolean) => Player[];
  };
}
