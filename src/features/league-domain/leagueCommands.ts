import {
  createLeagueCommandId,
  type ConnectExternalLeaguePayload,
  type CreateNativeLeaguePayload,
  type SaveWeeklyLineupPayload,
  type SaveSettingsDraftPayload,
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
