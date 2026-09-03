import type { LeagueSettingsV1 } from "./leagueSettings";

export const LEAGUE_COMMAND_ENDPOINT = "/ff/api/league-commands/execute";

export type LeagueCommandType =
  | "create_native_league"
  | "connect_external_league"
  | "save_weekly_lineup"
  | "configure_lineup_week"
  | "set_lineup_lock_override"
  | "ingest_scoring_events"
  | "recalculate_scoring_week"
  | "initialize_waiver_player_pool"
  | "submit_waiver_claim_group"
  | "process_waiver_run"
  | "acquire_free_agent"
  | "create_trade_offer"
  | "counter_trade_offer"
  | "respond_trade_offer"
  | "review_trade_offer"
  | "expire_trade_offer"
  | "save_settings_draft"
  | "publish_settings"
  | "restore_settings_version"
  | "provision_season_teams"
  | "create_league_invitation"
  | "accept_league_invitation"
  | "revoke_league_invitation"
  | "remove_league_member"
  | "apply_roster_transaction"
  | "reverse_roster_transaction"
  | "create_native_draft"
  | "start_native_draft"
  | "apply_native_draft_action"
  | "revert_native_draft_action";

export type CreateNativeLeaguePayload = {
  name: string;
  timezone: string;
  year: number;
};

export type ConnectExternalLeaguePayload = {
  provider: "sleeper";
  externalLeagueId: string;
  leagueName: string;
  season: string;
};

export type SaveWeeklyLineupPayload = {
  legacyLeagueId: string;
  franchiseId: string;
  week: number;
  assignments: Record<string, string>;
  overrideReason: string;
  expectedSeasonRevision?: number;
  expectedRosterRevision?: number;
  settingsVersionId?: string;
  orderedFallbackPlayerIds?: string[];
};

export type LineupGameStatus = "scheduled" | "in_progress" | "postponed" | "canceled" | "final";
export type LineupPlayerAvailability = "active" | "questionable" | "doubtful" | "inactive" | "out" | "ir";

export type LineupWeekPlayerInput = {
  playerId: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nflTeam: string;
  gameId: string;
  originalScheduledStartAt: string;
  scheduledStartAt: string;
  actualStartedAt: string;
  gameStatus: LineupGameStatus;
  availability: LineupPlayerAvailability;
  projectedPoints: number;
};

export type ConfigureLineupWeekPayload = {
  week: number;
  expectedWeekRevision: number;
  players: LineupWeekPlayerInput[];
};

export type SetLineupLockOverridePayload = {
  week: number;
  expectedWeekRevision: number;
  playerIds: string[];
  reopenedUntil: string | null;
};

export type NativeScoringStatistic =
  | "passing_yards"
  | "passing_touchdowns"
  | "interceptions"
  | "rushing_yards"
  | "rushing_touchdowns"
  | "receiving_yards"
  | "receptions"
  | "receiving_touchdowns";

export type NativeScoringEventInput = {
  providerEventId: string;
  providerTimestamp: string;
  occurredAt: string;
  playerId: string;
  nflGameId: string;
  statistics: Array<{ statistic: NativeScoringStatistic; value: number }>;
  description: string;
  correctionOfProviderEventId?: string;
};

export type NativeScoringMatchupInput = {
  matchupId: string;
  homeFranchiseId: string;
  awayFranchiseId: string;
};

export type IngestScoringEventsPayload = {
  week: number;
  expectedScoringWeekRevision: number;
  providerKey: string;
  fallbackProviderKey?: string;
  providerState: "live" | "delayed" | "unavailable";
  ingestionVersion: string;
  matchups?: NativeScoringMatchupInput[];
  gameStatuses?: Array<{ nflGameId: string; status: "scheduled" | "in_progress" | "final" | "postponed" | "canceled" }>;
  events: NativeScoringEventInput[];
};

export type RecalculateScoringWeekPayload = {
  week: number;
  expectedScoringWeekRevision: number;
};

export type WaiverPlayerPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type WaiverPlayerState = "free_agent" | "on_waivers" | "owned" | "locked" | "ineligible" | "protected" | "trade_block";

export type InitializeWaiverPlayerPoolPayload = {
  expectedWaiverStateRevision: number;
  players: Array<{ playerId: string; position: WaiverPlayerPosition }>;
};

export type WaiverClaimAlternative = {
  addPlayerId: string;
  dropPlayerId: string;
  bid: number;
};

export type SubmitWaiverClaimGroupPayload = {
  franchiseId: string;
  week: number;
  expectedRosterRevision: number;
  settingsVersionId: string;
  alternatives: WaiverClaimAlternative[];
};

export type ProcessWaiverRunPayload = {
  week: number;
  expectedWaiverStateRevision: number;
  processThrough: string;
  approvePendingReview?: boolean;
};

export type AcquireFreeAgentPayload = {
  franchiseId: string;
  week: number;
  expectedRosterRevision: number;
  settingsVersionId: string;
  addPlayerId: string;
  dropPlayerId: string;
};

export type TradeAssetType = "player" | "draft_pick" | "faab" | "salary" | "contract" | "keeper_right" | "conditional";
export type TradeAssetInput = { type: TradeAssetType; id: string; amount?: number; metadata?: Record<string, unknown> };

export type CreateTradeOfferPayload = {
  fromFranchiseId: string;
  toFranchiseId: string;
  week: number;
  expiresAt: string;
  settingsVersionId: string;
  offeredAssets: TradeAssetInput[];
  requestedAssets: TradeAssetInput[];
  message: string;
};

export type CounterTradeOfferPayload = CreateTradeOfferPayload & {
  originalOfferId: string;
  expectedOriginalRevision: number;
};

export type RespondTradeOfferPayload = {
  offerId: string;
  expectedOfferRevision: number;
  response: "accept" | "reject";
  week: number;
  immediateCutPlayerIds: string[];
};

export type ReviewTradeOfferPayload = {
  offerId: string;
  expectedOfferRevision: number;
  decision: "approve" | "reject";
  reason: string;
};

export type ExpireTradeOfferPayload = { offerId: string; expectedOfferRevision: number };

export type SaveSettingsDraftPayload = {
  settings: LeagueSettingsV1;
};

export type PublishSettingsPayload = {
  draftVersionId: string;
};

export type RestoreSettingsVersionPayload = {
  sourceVersionId: string;
};

export type LeagueInvitationRole = "team_owner" | "co_manager" | "co_commissioner";

export type ProvisionSeasonTeamsPayload = Record<string, never>;

export type CreateLeagueInvitationPayload = {
  email: string;
  displayName: string;
  role: LeagueInvitationRole;
  franchiseId: string;
  expiresInDays: number;
};

export type AcceptLeagueInvitationPayload = {
  invitationId: string;
  token: string;
};

export type RevokeLeagueInvitationPayload = {
  invitationId: string;
};

export type RemoveLeagueMemberPayload = {
  userId: string;
};

export type RosterTransactionType =
  | "draft_selection"
  | "auction_win"
  | "add"
  | "drop"
  | "waiver_award"
  | "trade"
  | "commissioner_add_drop"
  | "keeper_assignment"
  | "contract_assignment"
  | "roster_correction";

export type RosterAssetMove = {
  assetType: "player";
  assetId: string;
  fromFranchiseId: string | null;
  toFranchiseId: string | null;
};

export type ApplyRosterTransactionPayload = {
  transactionType: RosterTransactionType;
  moves: RosterAssetMove[];
};

export type ReverseRosterTransactionPayload = {
  transactionId: string;
};

export type NativeDraftFormat = "auction" | "snake" | "linear" | "third_round_reversal";
export type NativeDraftMode = "live" | "slow";

export type CreateNativeDraftPayload = {
  format: NativeDraftFormat;
  mode: NativeDraftMode;
  draftOrderFranchiseIds: string[];
  pickSeconds: number;
  nominationSeconds: number;
  bidSeconds: number;
  antiSnipeSeconds: number;
  spectatorEnabled: boolean;
};

export type StartNativeDraftPayload = {
  draftId: string;
};

export type NativeDraftAction =
  | { type: "pick"; playerId: string }
  | { type: "autopick"; playerId?: string }
  | { type: "set_queue"; franchiseId: string; playerIds: string[] }
  | { type: "nominate"; playerId: string; openingBid: number }
  | { type: "bid"; franchiseId: string; amount: number }
  | { type: "settle" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "complete" };

export type ApplyNativeDraftActionPayload = {
  draftId: string;
  expectedDraftRevision: number;
  action: NativeDraftAction;
};

export type RevertNativeDraftActionPayload = {
  draftId: string;
  expectedDraftRevision: number;
};

export type LeagueCommandPayloadByType = {
  create_native_league: CreateNativeLeaguePayload;
  connect_external_league: ConnectExternalLeaguePayload;
  save_weekly_lineup: SaveWeeklyLineupPayload;
  configure_lineup_week: ConfigureLineupWeekPayload;
  set_lineup_lock_override: SetLineupLockOverridePayload;
  ingest_scoring_events: IngestScoringEventsPayload;
  recalculate_scoring_week: RecalculateScoringWeekPayload;
  initialize_waiver_player_pool: InitializeWaiverPlayerPoolPayload;
  submit_waiver_claim_group: SubmitWaiverClaimGroupPayload;
  process_waiver_run: ProcessWaiverRunPayload;
  acquire_free_agent: AcquireFreeAgentPayload;
  create_trade_offer: CreateTradeOfferPayload;
  counter_trade_offer: CounterTradeOfferPayload;
  respond_trade_offer: RespondTradeOfferPayload;
  review_trade_offer: ReviewTradeOfferPayload;
  expire_trade_offer: ExpireTradeOfferPayload;
  save_settings_draft: SaveSettingsDraftPayload;
  publish_settings: PublishSettingsPayload;
  restore_settings_version: RestoreSettingsVersionPayload;
  provision_season_teams: ProvisionSeasonTeamsPayload;
  create_league_invitation: CreateLeagueInvitationPayload;
  accept_league_invitation: AcceptLeagueInvitationPayload;
  revoke_league_invitation: RevokeLeagueInvitationPayload;
  remove_league_member: RemoveLeagueMemberPayload;
  apply_roster_transaction: ApplyRosterTransactionPayload;
  reverse_roster_transaction: ReverseRosterTransactionPayload;
  create_native_draft: CreateNativeDraftPayload;
  start_native_draft: StartNativeDraftPayload;
  apply_native_draft_action: ApplyNativeDraftActionPayload;
  revert_native_draft_action: RevertNativeDraftActionPayload;
};

export type LeagueCommand<TType extends LeagueCommandType = LeagueCommandType> = {
  commandId: string;
  commandType: TType;
  actorUserId: string;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: LeagueCommandPayloadByType[TType];
  reason: string;
  clientCreatedAt: string;
};

export type LeagueCommandReceiptStatus = "accepted" | "rejected";

export type LeagueCommandReceipt = {
  commandId: string;
  commandType: LeagueCommandType;
  actorUserId: string;
  leagueId: string;
  seasonId: string;
  status: LeagueCommandReceiptStatus;
  previousRevision: number;
  resultingRevision: number;
  auditEventId: string | null;
  serverProcessedAt: string;
  requestHash: string;
  result: Record<string, unknown>;
  error: { code: string; message: string; currentRevision?: number } | null;
};

export type LeagueCommandResponse =
  | { ok: true; receipt: LeagueCommandReceipt }
  | { ok: false; error: { code: string; message: string; currentRevision?: number }; receipt?: LeagueCommandReceipt };

export function createLeagueCommandId() {
  return crypto.randomUUID();
}

export function normalizeCommandText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, maxLength) : "";
}
