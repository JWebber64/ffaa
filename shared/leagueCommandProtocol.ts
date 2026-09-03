import type { LeagueSettingsV1 } from "./leagueSettings";

export const LEAGUE_COMMAND_ENDPOINT = "/ff/api/league-commands/execute";

export type LeagueCommandType =
  | "create_native_league"
  | "connect_external_league"
  | "save_weekly_lineup"
  | "save_settings_draft"
  | "publish_settings"
  | "restore_settings_version";

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
};

export type SaveSettingsDraftPayload = {
  settings: LeagueSettingsV1;
};

export type PublishSettingsPayload = {
  draftVersionId: string;
};

export type RestoreSettingsVersionPayload = {
  sourceVersionId: string;
};

export type LeagueCommandPayloadByType = {
  create_native_league: CreateNativeLeaguePayload;
  connect_external_league: ConnectExternalLeaguePayload;
  save_weekly_lineup: SaveWeeklyLineupPayload;
  save_settings_draft: SaveSettingsDraftPayload;
  publish_settings: PublishSettingsPayload;
  restore_settings_version: RestoreSettingsVersionPayload;
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
