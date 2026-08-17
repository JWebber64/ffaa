import type { JsonValue } from "../domain/types";

export type SleeperRecord = Record<string, JsonValue>;

export interface SleeperLeague {
  league_id: string;
  previous_league_id?: string | null;
  name: string;
  sport: string;
  season: string;
  season_type?: string;
  status: string;
  total_rosters: number;
  draft_id?: string | null;
  avatar?: string | null;
  settings: SleeperRecord;
  scoring_settings: SleeperRecord;
  roster_positions: string[];
}

export interface SleeperUser {
  user_id: string;
  username?: string;
  display_name?: string;
  avatar?: string | null;
  is_owner?: boolean;
  metadata?: SleeperRecord;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id?: string | null;
  co_owners?: string[] | null;
  players?: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  settings: SleeperRecord;
  metadata?: SleeperRecord | null;
}

export interface SleeperMatchupRow {
  roster_id: number;
  matchup_id: number | null;
  points?: number;
  custom_points?: number | null;
  players?: string[] | null;
  starters?: string[] | null;
  players_points?: Record<string, number> | null;
}

export interface SleeperBracketMatch {
  r: number;
  m: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  p?: number | null;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: string;
  status: string;
  season?: string;
  start_time?: number | null;
  last_picked?: number | null;
  created?: number | null;
  settings?: SleeperRecord;
  metadata?: SleeperRecord;
  draft_order?: Record<string, number> | null;
  slot_to_roster_id?: Record<string, number> | null;
}

export interface SleeperDraftPick {
  draft_id: string;
  player_id?: string;
  picked_by?: string;
  roster_id?: number | string;
  round: number;
  draft_slot: number;
  pick_no: number;
  is_keeper?: boolean | null;
  metadata?: SleeperRecord;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: string;
  status: string;
  status_updated?: number;
  created?: number;
  leg?: number;
  creator?: string;
  roster_ids?: number[];
  consenter_ids?: number[];
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: SleeperTradedPick[] | null;
  waiver_budget?: Array<{ sender: number; receiver: number; amount: number }> | null;
  settings?: SleeperRecord | null;
  metadata?: SleeperRecord | null;
}

export interface SleeperState {
  week?: number;
  display_week?: number;
  league_season?: string;
  season?: string;
}

export interface SleeperDraftBundle {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
  tradedPicks: SleeperTradedPick[];
}

export interface SleeperSeasonBundle {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  winnersBracket: SleeperBracketMatch[];
  losersBracket: SleeperBracketMatch[];
  tradedPicks: SleeperTradedPick[];
  matchups: Array<{ week: number; rows: SleeperMatchupRow[] }>;
  transactions: SleeperTransaction[];
  drafts: SleeperDraftBundle[];
}

export interface SleeperHistoryBundle {
  requestedLeagueId: string;
  state: SleeperState;
  seasons: SleeperSeasonBundle[];
  fetchedAt: string;
}
