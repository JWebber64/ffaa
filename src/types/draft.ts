export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';
export type BasePosition = Exclude<Position, 'FLEX' | 'BENCH'>;

export type NominationOrderMode = 'regular' | 'snake' | 'reverse';

export type LogEventType =
  | 'NOMINATION'
  | 'BID_PLACED'
  | 'BID_REJECTED'
  | 'AUCTION_STARTED'
  | 'AUCTION_EXTENDED'
  | 'AUCTION_ENDED'
  | 'ASSIGNED'
  | 'ASSIGN_PENDING_SLOT'
  | 'ASSIGN_REJECTED'
  | 'INSTANT_ASSIGN'
  | 'ERROR';

export interface LogEvent {
  id: string;           // nanoid or Date.now().toString()
  ts: number;           // epoch ms
  type: LogEventType;
  message: string;
}

export interface AssignmentHistory {
  id: string;           // Unique identifier for the assignment
  ts: number;           // Timestamp of the assignment
  playerId: string;     // ID of the player being assigned
  teamId: number;       // ID of the team receiving the player
  slot?: string | null; // Optional slot assignment
  priceRefund?: number; // If auction win deducted budget, we refund this
  source: 'auction' | 'instant'; // Source of the assignment
}

export interface AuctionSettings {
  countdownSeconds: number;       // default 30
  antiSnipeSeconds: number;       // fixed 10 per spec
  nominationOrderMode: NominationOrderMode;
  reverseAtRound?: number;        // applies only when mode === 'reverse'
}

export interface BidState {
  isLive: boolean;
  playerId?: string;
  highBid: number;
  highBidder: number | null;      // team ID of the current high bidder
  startingBid: number;            // starting bid for the current auction
  endsAt?: number;                // epoch ms
  round: number;                  // current nomination round (1-indexed)
}

export interface DraftRuntime {
  currentNominatorTeamId: number | null;
  nominationOrder: number[];      // array of team IDs for current round
  baseOrder: number[];            // the original team order
  round: number;                  // 1-indexed draft round
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
  slot?: Position;
}

export interface Team {
  id: number;
  name: string;
  players: string[]; // player ids
  budget: number;
  roster: Record<Position, number>;
}

export interface Nomination {
  playerId: string;
  startingBid?: number;
  createdAt: number;
}

export interface CurrentAuction {
  playerId: string;
  highBid: number;
  highBidder: number | null;
}

export interface DraftState {
  // data
  players: Player[];
  playersLoaded: boolean;
  adpLoaded: boolean;
  teams: Team[];
  assignmentHistory: AssignmentHistory[];
  
  // auction
  auctionSettings: AuctionSettings;
  bidState: BidState;
  runtime: DraftRuntime;
  nominationQueue: Nomination[];
  currentAuction: CurrentAuction | null;
  currentNominatedId: string | null;
  currentBidder?: number;
  
  // config
  baseBudget: number;
  teamCount: number;
  templateRoster: Record<Position, number>;
  
  // pending assignment UI
  pendingAssignment: { teamId: number; playerId: string; validSlots: Position[] } | null;
  
  // logs
  logs: LogEvent[];
}

export interface DraftActions {
  // State setters
  setAuctionSettings: (settings: Partial<AuctionSettings>) => void;
  setPlayers: (players: Player[]) => void;
  setTeams: (teams: Team[]) => void;
  setCurrentNominatedId: (id: string | null) => void;
  setCurrentBidder: (teamId?: number) => void;
  setConfig: (config: {
    teamCount: number;
    baseBudget: number;
    templateRoster: Record<Position, number>;
  }) => void;
  setTeamNames: (names: string[]) => void;
  
  // Auction actions
  nominate: (playerId: string, startingBid?: number) => void;
  placeBid: (playerId: string, byTeamId: number, amount: number) => void;
  settleAuctionIfExpired: () => void;
  assignPlayer: (playerId: string, teamId: number, price: number, slot?: Position) => void;
  
  // Helpers
  computeMaxBid: (teamId: number, playerPos?: Position) => number;
  hasSlotFor: (teamId: number, pos: Position, includeTeInFlex?: boolean) => boolean;
  resetDraft: () => void;
  
  // ADP
  applyAdp: (updates: Array<{ id: string } & Partial<Player>>) => void;
  loadAdp: (opts?: {
    year?: number;
    teams?: number;
    scoring?: 'standard' | 'ppr' | 'half-ppr';
    useCache?: boolean;
    signal?: AbortSignal;
  }) => Promise<boolean>;
  
  // Logging
  pushLog: (event: Omit<LogEvent, 'id' | 'ts'>) => void;
  clearLogs: () => void;
  
  // Undo functionality
  undoLastAssignment: (opts?: { isAdmin?: boolean }) => void;
  
  // Selectors
  selectors: {
    undraftedPlayers: (state: DraftState) => Player[];
    topAvailable: (state: DraftState, limit?: number) => Player[];
    topAvailableByPos: (state: DraftState, pos: Position, limit?: number) => Player[];
    topAvailableByMultiPos: (state: DraftState, positions: Position[], limit?: number) => Player[];
    topAvailableForFlex: (state: DraftState, limit?: number, includeTE?: boolean) => Player[];
  };
}

export type DraftStore = DraftState & DraftActions;
