// League Types
export const LEAGUE_TYPES = ['redraft', 'keeper', 'dynasty'] as const;
export type LeagueType = typeof LEAGUE_TYPES[number];

// Draft Types (reusing from existing draft.ts)
export const DRAFT_TYPES = ['snake', 'auction'] as const;
export type DraftTypeV2 = typeof DRAFT_TYPES[number];

// Scoring Types
export const SCORING_TYPES = ['standard', 'half_ppr', 'ppr'] as const;
export type ScoringType = typeof SCORING_TYPES[number];

// Team Counts (reusing from existing draft.ts)
export const TEAM_COUNTS = [8, 10, 12, 14, 16] as const;
export type TeamCountV2 = typeof TEAM_COUNTS[number];

// Slot Types (including IDP)
export const SLOT_TYPES = [
  'QB', 'RB', 'WR', 'TE', 'FLEX',
  'K', 'DST',
  'BENCH', 'IR',
  'DL', 'LB', 'DB', 'IDP_FLEX'
] as const;
export type SlotType = typeof SLOT_TYPES[number];

// FLEX eligibility
export const FLEX_ELIGIBLE = ['RB', 'WR', 'TE'] as const;
export const IDP_FLEX_ELIGIBLE = ['DL', 'LB', 'DB'] as const;

// Nomination Order Modes
export const NOMINATION_ORDER_MODES = [
  'random_first_rotate',
  'fixed', 
  'random_each'
] as const;
export type NominationOrderModeV2 = typeof NOMINATION_ORDER_MODES[number];

// Roster Slot interface
export interface RosterSlot {
  slot: SlotType;
  count: number;
  flexEligible?: SlotType[]; // Only for FLEX and IDP_FLEX
}

// Auction Settings
export interface AuctionSettingsV2 {
  defaultBudget: number;
  teamBudgets: number[];
  nominationSeconds: number;
  bidResetSeconds: number;
  minIncrement: number;
  nominationOrderMode: NominationOrderModeV2;
}

// Snake Settings
export interface SnakeSettings {
  pickSeconds: number;
  autopick: boolean;
  pauseBetweenRounds: boolean;
}

// Main Draft Config
export interface DraftConfigV2 {
  leagueType: LeagueType;
  draftType: DraftTypeV2;
  teamCount: TeamCountV2;
  scoring: ScoringType;
  rosterSlots: RosterSlot[];
  auctionSettings?: AuctionSettingsV2;
  snakeSettings?: SnakeSettings;
}

// Helper function to create default budgets
export function makeDefaultBudgets(teamCount: TeamCountV2, defaultBudget: number): number[] {
  return Array(teamCount).fill(defaultBudget);
}

// Default roster slots for standard 12-team auction
const DEFAULT_ROSTER_SLOTS: RosterSlot[] = [
  { slot: 'QB', count: 1 },
  { slot: 'RB', count: 2 },
  { slot: 'WR', count: 2 },
  { slot: 'TE', count: 1 },
  { slot: 'FLEX', count: 1, flexEligible: [...FLEX_ELIGIBLE] },
  { slot: 'K', count: 1 },
  { slot: 'DST', count: 1 },
  { slot: 'BENCH', count: 6 },
  { slot: 'IR', count: 1 },
  { slot: 'DL', count: 1 },
  { slot: 'LB', count: 2 },
  { slot: 'DB', count: 2 },
  { slot: 'IDP_FLEX', count: 1, flexEligible: [...IDP_FLEX_ELIGIBLE] },
];

// Default Auction Config for 12 teams
export const DEFAULT_CONFIG_AUCTION_12: DraftConfigV2 = {
  leagueType: 'redraft',
  draftType: 'auction',
  teamCount: 12,
  scoring: 'ppr',
  rosterSlots: DEFAULT_ROSTER_SLOTS,
  auctionSettings: {
    defaultBudget: 200,
    teamBudgets: makeDefaultBudgets(12, 200),
    nominationSeconds: 30,
    bidResetSeconds: 10,
    minIncrement: 1,
    nominationOrderMode: 'random_first_rotate',
  },
};

// Default Snake Config for 12 teams
export const DEFAULT_CONFIG_SNAKE_12: DraftConfigV2 = {
  leagueType: 'redraft',
  draftType: 'snake',
  teamCount: 12,
  scoring: 'ppr',
  rosterSlots: DEFAULT_ROSTER_SLOTS,
  snakeSettings: {
    pickSeconds: 60,
    autopick: true,
    pauseBetweenRounds: false,
  },
};
