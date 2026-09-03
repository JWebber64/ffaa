import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueCommand, LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  receiptRecord,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore } from "./store";

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function abbreviation(name: string) {
  const words = name.split(/\s+/u).filter(Boolean);
  const shortName = words.length > 1
    ? words.map((word) => word[0] ?? "").join("")
    : name.slice(0, 4);
  return shortName.slice(0, 5).toUpperCase();
}

export async function executeCreateNativeLeague(input: {
  command: LeagueCommand<"create_native_league">;
  actorUserId: string;
  actorEmail?: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const actorEmail = text(input.actorEmail).toLowerCase().slice(0, 254);
  if (!isGamehqLeagueId(command.leagueId)) throw new LeagueCommandFailure("invalid_league_id", "Native leagues require a GameHQ UUID.");
  if (!isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_season_id", "The native season ID is invalid.");
  const name = text(command.payload.name).replace(/\s+/gu, " ").slice(0, 100);
  const timezone = text(command.payload.timezone);
  const year = wholeNumber(command.payload.year);
  const currentYear = new Date(processedAt).getUTCFullYear();
  if (name.length < 2) throw new LeagueCommandFailure("invalid_league_name", "Enter a league name with at least two characters.");
  if (!validTimezone(timezone)) throw new LeagueCommandFailure("invalid_timezone", "Choose a valid IANA league timezone.");
  if (year < currentYear - 1 || year > currentYear + 2) throw new LeagueCommandFailure("invalid_season_year", "Choose a season year near the current fantasy season.");
  if (await store.get(`leagues/${command.leagueId}`)) throw new LeagueCommandFailure("league_exists", "That GameHQ league ID is already in use.", 409);

  const grantId = `${actorUserId}__commissioner`;
  const settingsVersionId = `settings-${command.commandId}`;
  const auditEventId = `audit-${command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: command.leagueId,
    seasonId: command.seasonId,
    status: "accepted",
    previousRevision: 0,
    resultingRevision: 1,
    auditEventId,
    serverProcessedAt: processedAt,
    requestHash,
    result: { leagueId: command.leagueId, seasonId: command.seasonId, authorityMode: "native" },
    error: null,
  };
  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, `leagues/${command.leagueId}`, {
      schema_version: 1,
      id: command.leagueId,
      name,
      abbreviation: abbreviation(name),
      logo_url: "",
      colors: { primary: "", secondary: "" },
      timezone,
      status: "draft",
      current_season_id: command.seasonId,
      created_by: actorUserId,
      created_at: processedAt,
      updated_at: processedAt,
      revision: 1,
      authority_mode: "native",
      migration_state: "canonical_active",
    }),
    createOnlyWrite(store, `leagues/${command.leagueId}/seasons/${command.seasonId}`, {
      schema_version: 1,
      id: command.seasonId,
      league_id: command.leagueId,
      year,
      phase: "setup",
      revision: 1,
      settings_version_id: "",
      draft_settings_version_id: settingsVersionId,
      draft_id: "",
      schedule_version_id: "",
      start_at: "",
      end_at: "",
      legacy_source_league_id: "",
      created_at: processedAt,
      updated_at: processedAt,
    }),
    createOnlyWrite(store, `leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`, {
      schema_version: 1,
      id: settingsVersionId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      revision: 1,
      status: "draft",
      effective_at: processedAt,
      settings: createRedraftLeagueSettings(timezone),
      validation_errors: [],
      published_by: "",
      published_at: "",
      created_at: processedAt,
      updated_at: processedAt,
    }),
    createOnlyWrite(store, membershipPath(command.leagueId, actorUserId), {
      schema_version: 1,
      league_id: command.leagueId,
      user_id: actorUserId,
      status: "active",
      joined_at: processedAt,
      revision: 1,
      role_grant_ids: [grantId],
      display_name: actorEmail ? actorEmail.split("@")[0] : "League commissioner",
      email: actorEmail,
    }),
    createOnlyWrite(store, grantPath(command.leagueId, grantId), {
      schema_version: 1,
      id: grantId,
      league_id: command.leagueId,
      user_id: actorUserId,
      role: "commissioner",
      franchise_id: "",
      permissions: [],
      effective_at: processedAt,
      expires_at: "",
      granted_by: actorUserId,
      revoked_at: "",
      revision: 1,
    }),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      actor_user_id: actorUserId,
      action: "native_league_created",
      target: { type: "league", id: command.leagueId },
      timestamp: processedAt,
      previous_revision: 0,
      resulting_revision: 1,
      before: {},
      after: { id: command.leagueId, name, timezone, status: "draft" },
      material_differences: { created: true },
      reason: command.reason,
      settings_version_id: settingsVersionId,
      command_id: command.commandId,
      transaction_id: "",
      public_summary: `${name} was created as a native GameHQ league.`,
      private_metadata: {},
      reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  await store.commit(writes);
  return receipt;
}
