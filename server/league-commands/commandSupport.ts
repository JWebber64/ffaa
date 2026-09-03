import { createHash } from "node:crypto";

import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
  LeagueCommandType,
} from "../../shared/leagueCommandProtocol";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

export class LeagueCommandFailure extends Error {
  readonly code: string;
  readonly status: number;
  readonly currentRevision: number | undefined;

  constructor(code: string, message: string, status = 400, currentRevision?: number) {
    super(message);
    this.name = "LeagueCommandFailure";
    this.code = code;
    this.status = status;
    this.currentRevision = currentRevision;
  }
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortedValue(entry)]));
}

export function commandRequestHash(command: LeagueCommand) {
  const { clientCreatedAt: _clientCreatedAt, ...idempotentRequest } = command;
  return createHash("sha256").update(JSON.stringify(sortedValue(idempotentRequest))).digest("hex");
}

export function deriveGamehqUuid(actorUserId: string, commandId: string, domain: "league" | "season" | "franchise" | "scheduled-waiver-run") {
  const bytes = createHash("sha256").update(`${domain}:${actorUserId}:${commandId}`).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function wholeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function commandPath(leagueId: string, commandId: string) {
  return `leagues/${leagueId}/commands/${commandId}`;
}

export function auditPath(leagueId: string, auditId: string) {
  return `leagues/${leagueId}/auditEvents/${auditId}`;
}

export function grantPath(leagueId: string, grantId: string) {
  return `leagues/${leagueId}/roleGrants/${grantId}`;
}

export function membershipPath(leagueId: string, userId: string) {
  return `leagues/${leagueId}/memberships/${userId}`;
}

export function invitationPath(leagueId: string, invitationId: string) {
  return `leagues/${leagueId}/invitations/${invitationId}`;
}

export function rosterTransactionPath(leagueId: string, seasonId: string, transactionId: string) {
  return `leagues/${leagueId}/seasons/${seasonId}/rosterTransactions/${transactionId}`;
}

export function assetLockPath(leagueId: string, seasonId: string, assetType: string, assetId: string) {
  return `leagues/${leagueId}/seasons/${seasonId}/assetLocks/${assetType}__${assetId}`;
}

export function auditPrivatePath(leagueId: string, auditId: string) {
  return `leagues/${leagueId}/auditPrivate/${auditId}`;
}

export function nativeDraftPath(leagueId: string, seasonId: string, draftId: string) {
  return `leagues/${leagueId}/seasons/${seasonId}/drafts/${draftId}`;
}

export function createOnlyWrite(store: LeagueCommandStore, path: string, data: Record<string, unknown>): FirestoreWrite {
  return { update: store.document(path, data), currentDocument: { exists: false } };
}

export function replaceWrite(store: LeagueCommandStore, document: LeagueCommandStoredDocument | null, path: string, data: Record<string, unknown>): FirestoreWrite {
  return {
    update: store.document(path, data),
    currentDocument: document?.updateTime ? { updateTime: document.updateTime } : { exists: false },
  };
}

export function deleteWrite(store: LeagueCommandStore, document: LeagueCommandStoredDocument, path: string): FirestoreWrite {
  return {
    delete: store.document(path, {}).name,
    currentDocument: document.updateTime ? { updateTime: document.updateTime } : { exists: true },
  };
}

export function receiptRecord(receipt: LeagueCommandReceipt) {
  return {
    command_id: receipt.commandId,
    command_type: receipt.commandType,
    actor_user_id: receipt.actorUserId,
    league_id: receipt.leagueId,
    season_id: receipt.seasonId,
    status: receipt.status,
    previous_revision: receipt.previousRevision,
    resulting_revision: receipt.resultingRevision,
    audit_event_id: receipt.auditEventId ?? "",
    server_processed_at: receipt.serverProcessedAt,
    request_hash: receipt.requestHash,
    result: receipt.result,
    error: receipt.error ?? {},
  };
}

export function normalizeReceipt(document: LeagueCommandStoredDocument | null): LeagueCommandReceipt | null {
  if (!document) return null;
  const data = document.data;
  const commandType = text(data.command_type);
  if (![
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
  ].includes(commandType)) return null;
  const error = record(data.error);
  return {
    commandId: text(data.command_id),
    commandType: commandType as LeagueCommandType,
    actorUserId: text(data.actor_user_id),
    leagueId: text(data.league_id),
    seasonId: text(data.season_id),
    status: text(data.status) === "rejected" ? "rejected" : "accepted",
    previousRevision: wholeNumber(data.previous_revision),
    resultingRevision: wholeNumber(data.resulting_revision),
    auditEventId: text(data.audit_event_id) || null,
    serverProcessedAt: text(data.server_processed_at),
    requestHash: text(data.request_hash),
    result: record(data.result),
    error: Object.keys(error).length ? {
      code: text(error.code),
      message: text(error.message),
      ...(error.currentRevision === undefined ? {} : { currentRevision: wholeNumber(error.currentRevision) }),
    } : null,
  };
}
