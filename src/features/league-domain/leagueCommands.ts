import {
  createLeagueCommandId,
  type ApplyRosterTransactionPayload,
  type ConnectExternalLeaguePayload,
  type CreateNativeLeaguePayload,
  type SaveWeeklyLineupPayload,
  type SaveSettingsDraftPayload,
  type CreateLeagueInvitationPayload,
  type ReverseRosterTransactionPayload,
  type ApplyNativeDraftActionPayload,
  type CreateNativeDraftPayload,
  type RevertNativeDraftActionPayload,
  type StartNativeDraftPayload,
  type ConfigureLineupWeekPayload,
  type SetLineupLockOverridePayload,
  type IngestScoringEventsPayload,
  type RecalculateScoringWeekPayload,
  type InitializeWaiverPlayerPoolPayload,
  type SubmitWaiverClaimGroupPayload,
  type ProcessWaiverRunPayload,
  type AcquireFreeAgentPayload,
  type CreateTradeOfferPayload,
  type CounterTradeOfferPayload,
  type RespondTradeOfferPayload,
  type ReviewTradeOfferPayload,
  type GenerateNativeSchedulePayload,
  type SaveNativeSchedulePayload,
  type RecordNativeMatchupResultsPayload,
  type BuildNativePlayoffsPayload,
  type PublishPulseEventPayload,
  type ReactToPulseEventPayload,
  type CommentOnPulseEventPayload,
  type CreateRuleProposalPayload,
  type VoteRuleProposalPayload,
  type InitializeAdvancedLeagueAssetsPayload,
  type AwardNativeChampionPayload,
  type ArchiveNativeSeasonPayload,
  type RenewNativeLeaguePayload,
  type ExportNativeLeaguePayload,
} from "../../../shared/leagueCommandProtocol";
import { ensurePermanentFirebaseUserId } from "../../lib/authSession";
import { httpLeagueCommandService } from "./httpLeagueCommandService";

function nowIso() {
  return new Date().toISOString();
}

export async function createNativeLeague(
  payload: CreateNativeLeaguePayload,
  identifiers: { commandId?: string } = {},
) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: identifiers.commandId ?? createLeagueCommandId(),
    commandType: "create_native_league",
    actorUserId,
    leagueId: "",
    seasonId: "",
    expectedRevision: 0,
    payload,
    reason: "Create native GameHQ league",
    clientCreatedAt: nowIso(),
  });
}

export async function connectExternalLeague(
  payload: ConnectExternalLeaguePayload,
  identifiers: { commandId?: string } = {},
) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: identifiers.commandId ?? createLeagueCommandId(),
    commandType: "connect_external_league",
    actorUserId,
    leagueId: "",
    seasonId: "",
    expectedRevision: 0,
    payload,
    reason: "Attach external league connection",
    clientCreatedAt: nowIso(),
  });
}

export async function saveWeeklyLineupCommand(input: {
  commandId: string;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: SaveWeeklyLineupPayload;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId,
    commandType: "save_weekly_lineup",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.payload.overrideReason,
    clientCreatedAt: nowIso(),
  });
}

export async function configureLineupWeekCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: ConfigureLineupWeekPayload;
  reason?: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "configure_lineup_week",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason ?? `Publish Week ${input.payload.week} player game states`,
    clientCreatedAt: nowIso(),
  });
}

export async function setLineupLockOverrideCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: SetLineupLockOverridePayload;
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "set_lineup_lock_override",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason,
    clientCreatedAt: nowIso(),
  });
}

export async function ingestScoringEventsCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: IngestScoringEventsPayload;
  reason?: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "ingest_scoring_events",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason ?? `Ingest Week ${input.payload.week} normalized scoring events`,
    clientCreatedAt: nowIso(),
  });
}

export async function recalculateScoringWeekCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: RecalculateScoringWeekPayload;
  reason?: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "recalculate_scoring_week",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason ?? `Replay Week ${input.payload.week} scoring`,
    clientCreatedAt: nowIso(),
  });
}

export async function initializeWaiverPlayerPoolCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: InitializeWaiverPlayerPoolPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: "initialize_waiver_player_pool", actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: "Initialize native waiver player states", clientCreatedAt: nowIso() });
}

export async function submitWaiverClaimGroupCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: SubmitWaiverClaimGroupPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: "submit_waiver_claim_group", actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: "Submit ordered native waiver claim", clientCreatedAt: nowIso() });
}

export async function processWaiverRunCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: ProcessWaiverRunPayload;
  reason?: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: "process_waiver_run", actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: input.reason ?? "Process native waiver claims", clientCreatedAt: nowIso() });
}

export async function acquireFreeAgentCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: AcquireFreeAgentPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: "acquire_free_agent", actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: "Acquire a free agent", clientCreatedAt: nowIso() });
}

async function tradeCommand<T extends "create_trade_offer" | "counter_trade_offer" | "respond_trade_offer" | "review_trade_offer" | "expire_trade_offer">(input: { commandType: T; leagueId: string; seasonId: string; expectedRevision: number; payload: import("../../../shared/leagueCommandProtocol").LeagueCommandPayloadByType[T]; reason: string; commandId?: string }) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: input.commandType, actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240), clientCreatedAt: nowIso() });
}

export function createTradeOfferCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: CreateTradeOfferPayload; commandId?: string }) { return tradeCommand({ ...input, commandType: "create_trade_offer", reason: input.payload.message || "Send two-team trade offer" }); }
export function counterTradeOfferCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: CounterTradeOfferPayload; commandId?: string }) { return tradeCommand({ ...input, commandType: "counter_trade_offer", reason: input.payload.message || "Counter two-team trade offer" }); }
export function respondTradeOfferCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: RespondTradeOfferPayload; commandId?: string }) { return tradeCommand({ ...input, commandType: "respond_trade_offer", reason: `${input.payload.response} trade offer` }); }
export function reviewTradeOfferCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: ReviewTradeOfferPayload; commandId?: string }) { return tradeCommand({ ...input, commandType: "review_trade_offer", reason: input.payload.reason }); }
export function expireTradeOfferCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: { offerId: string; expectedOfferRevision: number }; commandId?: string }) { return tradeCommand({ ...input, commandType: "expire_trade_offer", reason: "Expire unanswered trade offer" }); }

async function competitionCommand<T extends "generate_native_schedule" | "save_native_schedule" | "record_native_matchup_results" | "build_native_playoffs">(input: { commandType: T; leagueId: string; seasonId: string; expectedRevision: number; payload: import("../../../shared/leagueCommandProtocol").LeagueCommandPayloadByType[T]; reason: string; commandId?: string }) { const actorUserId = await ensurePermanentFirebaseUserId(); return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: input.commandType, actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240), clientCreatedAt: nowIso() }); }
export function generateNativeScheduleCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: GenerateNativeSchedulePayload; commandId?: string }) { return competitionCommand({ ...input, commandType: "generate_native_schedule", reason: "Generate deterministic native schedule" }); }
export function saveNativeScheduleCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: SaveNativeSchedulePayload; reason: string; commandId?: string }) { return competitionCommand({ ...input, commandType: "save_native_schedule", reason: input.reason }); }
export function recordNativeMatchupResultsCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: RecordNativeMatchupResultsPayload; reason?: string; commandId?: string }) { return competitionCommand({ ...input, commandType: "record_native_matchup_results", reason: input.reason ?? "Record completed native matchup results" }); }
export function buildNativePlayoffsCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: BuildNativePlayoffsPayload; reason?: string; commandId?: string }) { return competitionCommand({ ...input, commandType: "build_native_playoffs", reason: input.reason ?? "Build native playoff bracket" }); }

export async function saveSettingsDraftCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: SaveSettingsDraftPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "save_settings_draft",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: "Save league settings draft",
    clientCreatedAt: nowIso(),
  });
}

export async function publishSettingsCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  draftVersionId: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "publish_settings",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { draftVersionId: input.draftVersionId },
    reason: "Publish complete league settings",
    clientCreatedAt: nowIso(),
  });
}

export async function restoreSettingsVersionCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  sourceVersionId: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "restore_settings_version",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { sourceVersionId: input.sourceVersionId },
    reason: "Restore prior league settings as a new version",
    clientCreatedAt: nowIso(),
  });
}

export async function provisionSeasonTeamsCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "provision_season_teams",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: {},
    reason: "Provision team slots from published rules",
    clientCreatedAt: nowIso(),
  });
}

export async function createLeagueInvitationCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: CreateLeagueInvitationPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "create_league_invitation",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: `Invite ${input.payload.displayName} to the league`,
    clientCreatedAt: nowIso(),
  });
}

export async function acceptLeagueInvitationCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  invitationId: string;
  token: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "accept_league_invitation",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { invitationId: input.invitationId, token: input.token },
    reason: "Accept league invitation",
    clientCreatedAt: nowIso(),
  });
}

export async function revokeLeagueInvitationCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  invitationId: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "revoke_league_invitation",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { invitationId: input.invitationId },
    reason: "Revoke pending league invitation",
    clientCreatedAt: nowIso(),
  });
}

export async function removeLeagueMemberCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  userId: string;
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "remove_league_member",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: { userId: input.userId },
    reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt: nowIso(),
  });
}

export async function applyRosterTransactionCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: ApplyRosterTransactionPayload;
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "apply_roster_transaction",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt: nowIso(),
  });
}

export async function reverseRosterTransactionCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: ReverseRosterTransactionPayload;
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "reverse_roster_transaction",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt: nowIso(),
  });
}

export async function createNativeDraftCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: CreateNativeDraftPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "create_native_draft",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: "Configure the native league draft",
    clientCreatedAt: nowIso(),
  });
}

export async function startNativeDraftCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: StartNativeDraftPayload;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "start_native_draft",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: "Launch the native league draft",
    clientCreatedAt: nowIso(),
  });
}

export async function applyNativeDraftActionCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: ApplyNativeDraftActionPayload;
  reason?: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "apply_native_draft_action",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: (input.reason ?? `Native draft ${input.payload.action.type}`).trim().replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt: nowIso(),
  });
}

export async function revertNativeDraftActionCommand(input: {
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: RevertNativeDraftActionPayload;
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({
    commandId: input.commandId ?? createLeagueCommandId(),
    commandType: "revert_native_draft_action",
    actorUserId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    expectedRevision: input.expectedRevision,
    payload: input.payload,
    reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt: nowIso(),
  });
}

async function pulseCommand<T extends "publish_pulse_event" | "react_to_pulse_event" | "comment_on_pulse_event" | "create_rule_proposal" | "vote_rule_proposal">(input: {
  commandType: T;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: import("../../../shared/leagueCommandProtocol").LeagueCommandPayloadByType[T];
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: input.commandType, actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240), clientCreatedAt: nowIso() });
}

export function publishPulseEventCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: PublishPulseEventPayload; commandId?: string }) { return pulseCommand({ ...input, commandType: "publish_pulse_event", reason: `Publish ${input.payload.kind} to League Pulse` }); }
export function reactToPulseEventCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: ReactToPulseEventPayload; commandId?: string }) { return pulseCommand({ ...input, commandType: "react_to_pulse_event", reason: "Update League Pulse reaction" }); }
export function commentOnPulseEventCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: CommentOnPulseEventPayload; commandId?: string }) { return pulseCommand({ ...input, commandType: "comment_on_pulse_event", reason: "Reply to League Pulse item" }); }
export function createRuleProposalCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: CreateRuleProposalPayload; commandId?: string }) { return pulseCommand({ ...input, commandType: "create_rule_proposal", reason: input.payload.commissionerExplanation }); }
export function voteRuleProposalCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: VoteRuleProposalPayload; commandId?: string }) { return pulseCommand({ ...input, commandType: "vote_rule_proposal", reason: `Record ${input.payload.vote} vote on formal rule proposal` }); }

export async function initializeAdvancedLeagueAssetsCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: InitializeAdvancedLeagueAssetsPayload; commandId?: string }) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: "initialize_advanced_league_assets", actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: "Initialize dynasty asset and salary ledgers from published rules", clientCreatedAt: nowIso() });
}

async function lifecycleCommand<T extends "award_native_champion" | "archive_native_season" | "renew_native_league" | "export_native_league">(input: {
  commandType: T;
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: import("../../../shared/leagueCommandProtocol").LeagueCommandPayloadByType[T];
  reason: string;
  commandId?: string;
}) {
  const actorUserId = await ensurePermanentFirebaseUserId();
  return httpLeagueCommandService.execute({ commandId: input.commandId ?? createLeagueCommandId(), commandType: input.commandType, actorUserId, leagueId: input.leagueId, seasonId: input.seasonId, expectedRevision: input.expectedRevision, payload: input.payload, reason: input.reason.trim().replace(/\s+/gu, " ").slice(0, 240), clientCreatedAt: nowIso() });
}

export function awardNativeChampionCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: AwardNativeChampionPayload; reason: string; commandId?: string }) {
  return lifecycleCommand({ ...input, commandType: "award_native_champion" });
}

export function archiveNativeSeasonCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: ArchiveNativeSeasonPayload; reason: string; commandId?: string }) {
  return lifecycleCommand({ ...input, commandType: "archive_native_season" });
}

export function renewNativeLeagueCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: RenewNativeLeaguePayload; reason: string; commandId?: string }) {
  return lifecycleCommand({ ...input, commandType: "renew_native_league" });
}

export function exportNativeLeagueCommand(input: { leagueId: string; seasonId: string; expectedRevision: number; payload: ExportNativeLeaguePayload; commandId?: string }) {
  return lifecycleCommand({ ...input, commandType: "export_native_league", reason: "Create private native league data export" });
}
