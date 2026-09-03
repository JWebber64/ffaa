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
