import type { LeagueCommand, LeagueCommandReceipt, LeagueCommandType } from "../../shared/leagueCommandProtocol";
import { commandPath, commandRequestHash, deriveGamehqUuid, LeagueCommandFailure, normalizeReceipt, record, text, wholeNumber } from "./commandSupport";
import { executeConnectExternalLeague } from "./connectExternalLeague";
import { executeCreateNativeLeague } from "./createNativeLeague";
import { executeSaveWeeklyLineup } from "./saveWeeklyLineup";
import { executePublishSettings, executeRestoreSettingsVersion, executeSaveSettingsDraft } from "./settingsCommands";
import {
  executeAcceptLeagueInvitation,
  executeCreateLeagueInvitation,
  executeProvisionSeasonTeams,
  executeRemoveLeagueMember,
  executeRevokeLeagueInvitation,
} from "./membershipCommands";
import { executeApplyRosterTransaction, executeReverseRosterTransaction } from "./rosterTransactionCommands";
import {
  executeApplyNativeDraftAction,
  executeCreateNativeDraft,
  executeRevertNativeDraftAction,
  executeStartNativeDraft,
} from "./nativeDraftCommands";
import { executeConfigureLineupWeek, executeSetLineupLockOverride } from "./nativeLineupCommands";
import { executeIngestScoringEvents, executeRecalculateScoringWeek } from "./nativeScoringCommands";
import {
  executeAcquireFreeAgent,
  executeInitializeWaiverPlayerPool,
  executeProcessWaiverRun,
  executeSubmitWaiverClaimGroup,
} from "./nativeWaiverCommands";
import type { LeagueCommandStore } from "./store";

const COMMAND_TYPES = new Set<LeagueCommandType>([
  "create_native_league",
  "connect_external_league",
  "save_weekly_lineup",
  "configure_lineup_week",
  "set_lineup_lock_override",
  "ingest_scoring_events",
  "recalculate_scoring_week",
  "initialize_waiver_player_pool",
  "submit_waiver_claim_group",
  "process_waiver_run",
  "acquire_free_agent",
  "save_settings_draft",
  "publish_settings",
  "restore_settings_version",
  "provision_season_teams",
  "create_league_invitation",
  "accept_league_invitation",
  "revoke_league_invitation",
  "remove_league_member",
  "apply_roster_transaction",
  "reverse_roster_transaction",
  "create_native_draft",
  "start_native_draft",
  "apply_native_draft_action",
  "revert_native_draft_action",
]);

function normalizeCommand(value: unknown): LeagueCommand {
  const data = record(value);
  const commandType = text(data.commandType) as LeagueCommandType;
  const commandId = text(data.commandId);
  const leagueId = text(data.leagueId);
  const seasonId = text(data.seasonId);
  const actorUserId = text(data.actorUserId);
  const clientCreatedAt = text(data.clientCreatedAt);
  if (!COMMAND_TYPES.has(commandType)) throw new LeagueCommandFailure("invalid_command_type", "Choose a supported league command.");
  if (!/^[0-9a-f-]{36}$/iu.test(commandId)) throw new LeagueCommandFailure("invalid_command_id", "The command idempotency key is invalid.");
  if (!["create_native_league", "connect_external_league"].includes(commandType) && !leagueId) throw new LeagueCommandFailure("invalid_league_id", "A GameHQ league ID is required.");
  if (!actorUserId) throw new LeagueCommandFailure("invalid_actor", "The command actor is missing.");
  if (!Number.isFinite(Date.parse(clientCreatedAt))) throw new LeagueCommandFailure("invalid_client_time", "The command creation time is invalid.");
  const expectedRevision = wholeNumber(data.expectedRevision, -1);
  if (expectedRevision < 0) throw new LeagueCommandFailure("invalid_expected_revision", "The expected revision must be zero or greater.");
  return {
    commandId,
    commandType,
    actorUserId,
    leagueId,
    seasonId,
    expectedRevision,
    payload: record(data.payload),
    reason: text(data.reason).replace(/\s+/gu, " ").slice(0, 240),
    clientCreatedAt,
  } as LeagueCommand;
}

export async function executeLeagueCommand(input: {
  commandValue: unknown;
  actorUserId: string;
  actorEmail?: string;
  store: LeagueCommandStore;
  processedAt?: string;
}): Promise<LeagueCommandReceipt> {
  const requestedCommand = normalizeCommand(input.commandValue);
  if (requestedCommand.actorUserId !== input.actorUserId) throw new LeagueCommandFailure("actor_mismatch", "The authenticated account does not match the command actor.", 403);
  const command: LeagueCommand = requestedCommand.commandType === "create_native_league"
    ? {
        ...requestedCommand,
        leagueId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "league"),
        seasonId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "season"),
      }
    : requestedCommand.commandType === "connect_external_league"
      ? {
          ...requestedCommand,
          leagueId: deriveGamehqUuid(input.actorUserId, requestedCommand.commandId, "league"),
          seasonId: "",
        }
      : requestedCommand;
  const processedAt = input.processedAt ?? new Date().toISOString();
  const requestHash = commandRequestHash(command);
  const existing = normalizeReceipt(await input.store.get(commandPath(command.leagueId, command.commandId)));
  if (existing) {
    if (existing.requestHash !== requestHash || existing.actorUserId !== input.actorUserId) {
      throw new LeagueCommandFailure("idempotency_key_reused", "That command ID was already used for a different request.", 409);
    }
    return existing;
  }

  const shared = { command: command as never, actorUserId: input.actorUserId, actorEmail: input.actorEmail, requestHash, processedAt, store: input.store };
  if (command.commandType === "create_native_league") {
    return executeCreateNativeLeague(shared as Parameters<typeof executeCreateNativeLeague>[0]);
  }
  if (command.commandType === "connect_external_league") {
    return executeConnectExternalLeague(shared as Parameters<typeof executeConnectExternalLeague>[0]);
  }
  if (command.commandType === "save_weekly_lineup") {
    return executeSaveWeeklyLineup(shared as Parameters<typeof executeSaveWeeklyLineup>[0]);
  }
  if (command.commandType === "configure_lineup_week") {
    return executeConfigureLineupWeek(shared as Parameters<typeof executeConfigureLineupWeek>[0]);
  }
  if (command.commandType === "set_lineup_lock_override") {
    return executeSetLineupLockOverride(shared as Parameters<typeof executeSetLineupLockOverride>[0]);
  }
  if (command.commandType === "ingest_scoring_events") {
    return executeIngestScoringEvents(shared as Parameters<typeof executeIngestScoringEvents>[0]);
  }
  if (command.commandType === "recalculate_scoring_week") {
    return executeRecalculateScoringWeek(shared as Parameters<typeof executeRecalculateScoringWeek>[0]);
  }
  if (command.commandType === "initialize_waiver_player_pool") {
    return executeInitializeWaiverPlayerPool(shared as Parameters<typeof executeInitializeWaiverPlayerPool>[0]);
  }
  if (command.commandType === "submit_waiver_claim_group") {
    return executeSubmitWaiverClaimGroup(shared as Parameters<typeof executeSubmitWaiverClaimGroup>[0]);
  }
  if (command.commandType === "process_waiver_run") {
    return executeProcessWaiverRun(shared as Parameters<typeof executeProcessWaiverRun>[0]);
  }
  if (command.commandType === "acquire_free_agent") {
    return executeAcquireFreeAgent(shared as Parameters<typeof executeAcquireFreeAgent>[0]);
  }
  if (command.commandType === "save_settings_draft") {
    return executeSaveSettingsDraft(shared as Parameters<typeof executeSaveSettingsDraft>[0]);
  }
  if (command.commandType === "publish_settings") {
    return executePublishSettings(shared as Parameters<typeof executePublishSettings>[0]);
  }
  if (command.commandType === "restore_settings_version") {
    return executeRestoreSettingsVersion(shared as Parameters<typeof executeRestoreSettingsVersion>[0]);
  }
  if (command.commandType === "provision_season_teams") {
    return executeProvisionSeasonTeams(shared as Parameters<typeof executeProvisionSeasonTeams>[0]);
  }
  if (command.commandType === "create_league_invitation") {
    return executeCreateLeagueInvitation(shared as Parameters<typeof executeCreateLeagueInvitation>[0]);
  }
  if (command.commandType === "accept_league_invitation") {
    return executeAcceptLeagueInvitation(shared as Parameters<typeof executeAcceptLeagueInvitation>[0]);
  }
  if (command.commandType === "revoke_league_invitation") {
    return executeRevokeLeagueInvitation(shared as Parameters<typeof executeRevokeLeagueInvitation>[0]);
  }
  if (command.commandType === "remove_league_member") {
    return executeRemoveLeagueMember(shared as Parameters<typeof executeRemoveLeagueMember>[0]);
  }
  if (command.commandType === "apply_roster_transaction") {
    return executeApplyRosterTransaction(shared as Parameters<typeof executeApplyRosterTransaction>[0]);
  }
  if (command.commandType === "reverse_roster_transaction") {
    return executeReverseRosterTransaction(shared as Parameters<typeof executeReverseRosterTransaction>[0]);
  }
  if (command.commandType === "create_native_draft") {
    return executeCreateNativeDraft(shared as Parameters<typeof executeCreateNativeDraft>[0]);
  }
  if (command.commandType === "start_native_draft") {
    return executeStartNativeDraft(shared as Parameters<typeof executeStartNativeDraft>[0]);
  }
  if (command.commandType === "apply_native_draft_action") {
    return executeApplyNativeDraftAction(shared as Parameters<typeof executeApplyNativeDraftAction>[0]);
  }
  return executeRevertNativeDraftAction(shared as Parameters<typeof executeRevertNativeDraftAction>[0]);
}
