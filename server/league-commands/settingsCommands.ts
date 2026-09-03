import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueCommand, LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings, type LeagueSettingsIssue, type LeagueSettingsV1 } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  normalizeReceipt,
  receiptRecord,
  record,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore } from "./store";
import { reconcileSeasonTeams } from "./teamProvisioning";

type SettingsCommandType = "save_settings_draft" | "publish_settings" | "restore_settings_version";

function settingsPath(leagueId: string, settingsVersionId: string) {
  return `leagues/${leagueId}/settingsVersions/${settingsVersionId}`;
}

function roleActive(value: Record<string, unknown>, now: string) {
  if (text(value.revoked_at)) return false;
  const effectiveAt = Date.parse(text(value.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(now)) return false;
  const expiresAt = Date.parse(text(value.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(now);
}

async function commissionerAccess(store: LeagueCommandStore, leagueId: string, actorUserId: string, processedAt: string) {
  const membership = await store.get(membershipPath(leagueId, actorUserId));
  if (!membership || text(membership.data.status) !== "active") return false;
  const grants = await Promise.all(stringList(membership.data.role_grant_ids).map((grantId) => store.get(grantPath(leagueId, grantId))));
  return grants.some((grant) => grant
    && text(grant.data.user_id) === actorUserId
    && ["commissioner", "co_commissioner"].includes(text(grant.data.role))
    && roleActive(grant.data, processedAt));
}

async function commandState(input: {
  command: LeagueCommand<SettingsCommandType>;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}) {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId)) throw new LeagueCommandFailure("invalid_league_id", "Manage settings through a canonical GameHQ league.");
  if (!isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_season_id", "The active GameHQ season is invalid.");
  const [league, season, canManage] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    commissionerAccess(store, command.leagueId, actorUserId, processedAt),
  ]);
  if (!league) throw new LeagueCommandFailure("league_not_found", "The GameHQ league no longer exists.", 404);
  if (text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_settings_required", "Connected league rules remain governed by their source until migration is complete.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId) throw new LeagueCommandFailure("season_not_found", "The active GameHQ season no longer exists.", 404);
  if (text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before editing rules.", 409);
  if (!["setup", "draft"].includes(text(season.data.phase))) throw new LeagueCommandFailure("midseason_settings_locked", "This release does not publish midseason rule changes without the required impact reason workflow.", 409);
  if (!canManage) throw new LeagueCommandFailure("permission_denied", "A current GameHQ commissioner role is required to change league rules.", 403);
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `League settings changed after you opened them. The current revision is ${revision}.`, 409, revision);
  return { league, season, revision };
}

function storedIssues(value: unknown): LeagueSettingsIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const issue = record(entry);
    const field = text(issue.field);
    const message = text(issue.message);
    return field && message ? [{ field, message }] : [];
  });
}

function settingsVersionRecord(input: {
  id: string;
  leagueId: string;
  seasonId: string;
  revision: number;
  status: "draft" | "published";
  settings: LeagueSettingsV1;
  issues: LeagueSettingsIssue[];
  actorUserId: string;
  processedAt: string;
}) {
  return {
    schema_version: 1,
    id: input.id,
    league_id: input.leagueId,
    season_id: input.seasonId,
    revision: input.revision,
    status: input.status,
    effective_at: input.processedAt,
    settings: input.settings,
    validation_errors: input.issues,
    published_by: input.status === "published" ? input.actorUserId : "",
    published_at: input.status === "published" ? input.processedAt : "",
    created_at: input.processedAt,
    updated_at: input.processedAt,
  };
}

async function commitWithRevisionGuard(input: {
  store: LeagueCommandStore;
  writes: FirestoreWrite[];
  leagueId: string;
  seasonId: string;
  previousRevision: number;
  commandId: string;
  requestHash: string;
  actorUserId: string;
}) {
  try {
    await input.store.commit(input.writes);
  } catch (error) {
    const winner = normalizeReceipt(await input.store.get(commandPath(input.leagueId, input.commandId)));
    if (winner?.requestHash === input.requestHash && winner.actorUserId === input.actorUserId) return winner;
    const latest = await input.store.get(`leagues/${input.leagueId}/seasons/${input.seasonId}`);
    const latestRevision = Math.max(1, wholeNumber(latest?.data.revision, 1));
    if (latestRevision !== input.previousRevision) {
      throw new LeagueCommandFailure("stale_revision", `League settings changed while your command was processing. The current revision is ${latestRevision}.`, 409, latestRevision);
    }
    throw error;
  }
  return null;
}

export async function executeSaveSettingsDraft(input: {
  command: LeagueCommand<"save_settings_draft">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { league, season, revision } = await commandState({ command, actorUserId, processedAt, store });
  const { settings, issues } = parseLeagueSettings(command.payload.settings, text(league.data.timezone) || "UTC");
  const nextRevision = revision + 1;
  const settingsVersionId = `settings-${command.commandId}`;
  const auditEventId = `audit-${command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: command.leagueId,
    seasonId: command.seasonId,
    status: "accepted",
    previousRevision: revision,
    resultingRevision: nextRevision,
    auditEventId,
    serverProcessedAt: processedAt,
    requestHash,
    result: { settingsVersionId, valid: issues.length === 0, issueCount: issues.length, issues },
    error: null,
  };
  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, settingsPath(command.leagueId, settingsVersionId), settingsVersionRecord({
      id: settingsVersionId,
      leagueId: command.leagueId,
      seasonId: command.seasonId,
      revision: nextRevision,
      status: "draft",
      settings,
      issues,
      actorUserId,
      processedAt,
    })),
    replaceWrite(store, season, `leagues/${command.leagueId}/seasons/${command.seasonId}`, {
      ...season.data,
      revision: nextRevision,
      draft_settings_version_id: settingsVersionId,
      updated_at: processedAt,
    }),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      actor_user_id: actorUserId,
      action: "settings_draft_saved",
      target: { type: "settings_version", id: settingsVersionId },
      timestamp: processedAt,
      previous_revision: revision,
      resulting_revision: nextRevision,
      before: { draft_settings_version_id: text(season.data.draft_settings_version_id) },
      after: { draft_settings_version_id: settingsVersionId, valid: issues.length === 0 },
      material_differences: { validation_issue_count: issues.length },
      reason: command.reason,
      settings_version_id: settingsVersionId,
      command_id: command.commandId,
      transaction_id: "",
      public_summary: "A new immutable league-settings draft was saved.",
      private_metadata: {},
      reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

async function publishVersion(input: {
  command: LeagueCommand<"publish_settings" | "restore_settings_version">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
  sourceVersionId: string;
  sourceStatuses: Array<"draft" | "published" | "superseded">;
  action: "settings_published" | "settings_version_restored";
}) {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { league, season, revision } = await commandState({ command, actorUserId, processedAt, store });
  const sourceVersionId = text(input.sourceVersionId);
  if (!sourceVersionId || sourceVersionId.includes("/")) throw new LeagueCommandFailure("invalid_settings_version", "Choose a valid settings version.");
  if (command.commandType === "publish_settings" && text(season.data.draft_settings_version_id) !== sourceVersionId) {
    throw new LeagueCommandFailure("draft_changed", "A newer settings draft is active. Refresh before publishing.", 409, revision);
  }
  const currentVersionId = text(season.data.settings_version_id);
  const [source, currentVersion] = await Promise.all([
    store.get(settingsPath(command.leagueId, sourceVersionId)),
    currentVersionId ? store.get(settingsPath(command.leagueId, currentVersionId)) : Promise.resolve(null),
  ]);
  if (currentVersionId && !currentVersion) throw new LeagueCommandFailure("active_settings_missing", "The season's active settings version is missing. No rules were changed.", 409, revision);
  if (!source || text(source.data.season_id) !== command.seasonId || !input.sourceStatuses.includes(text(source.data.status) as never)) {
    throw new LeagueCommandFailure("settings_version_unavailable", "That settings version is not available for this action.", 404);
  }
  if (command.commandType === "restore_settings_version" && sourceVersionId === currentVersionId) {
    throw new LeagueCommandFailure("settings_already_active", "That settings version is already active.", 409, revision);
  }
  const parsed = parseLeagueSettings(source.data.settings, text(league.data.timezone) || "UTC");
  const issues = [...storedIssues(source.data.validation_errors), ...parsed.issues]
    .filter((issue, index, all) => all.findIndex((candidate) => candidate.field === issue.field && candidate.message === issue.message) === index);
  if (issues.length) throw new LeagueCommandFailure("invalid_settings", `League settings cannot publish: ${issues[0]?.message ?? "fix the reported validation errors."}`, 422, revision);

  const teamChanges = await reconcileSeasonTeams({
    store,
    leagueId: command.leagueId,
    seasonId: command.seasonId,
    settings: parsed.settings,
    actorUserId,
    commandId: command.commandId,
    processedAt,
  });

  const nextRevision = revision + 1;
  const publishedVersionId = `settings-${command.commandId}`;
  const auditEventId = `audit-${command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: command.leagueId,
    seasonId: command.seasonId,
    status: "accepted",
    previousRevision: revision,
    resultingRevision: nextRevision,
    auditEventId,
    serverProcessedAt: processedAt,
    requestHash,
    result: {
      settingsVersionId: publishedVersionId,
      sourceVersionId,
      status: "published",
      teamCount: teamChanges.activeCount,
      createdTeamCount: teamChanges.createdCount,
      restoredTeamCount: teamChanges.restoredCount,
      retiredTeamCount: teamChanges.retiredCount,
    },
    error: null,
  };
  const writes: FirestoreWrite[] = [
    ...teamChanges.writes,
    createOnlyWrite(store, settingsPath(command.leagueId, publishedVersionId), settingsVersionRecord({
      id: publishedVersionId,
      leagueId: command.leagueId,
      seasonId: command.seasonId,
      revision: nextRevision,
      status: "published",
      settings: parsed.settings,
      issues: [],
      actorUserId,
      processedAt,
    })),
    replaceWrite(store, season, `leagues/${command.leagueId}/seasons/${command.seasonId}`, {
      ...season.data,
      revision: nextRevision,
      phase: "draft",
      settings_version_id: publishedVersionId,
      draft_settings_version_id: "",
      updated_at: processedAt,
    }),
    replaceWrite(store, league, `leagues/${command.leagueId}`, {
      ...league.data,
      status: "active",
      revision: Math.max(1, wholeNumber(league.data.revision, 1)) + 1,
      updated_at: processedAt,
    }),
    ...(currentVersion && text(currentVersion.data.status) === "published"
      ? [replaceWrite(store, currentVersion, settingsPath(command.leagueId, currentVersionId), {
          ...currentVersion.data,
          status: "superseded",
          updated_at: processedAt,
        })]
      : []),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      actor_user_id: actorUserId,
      action: input.action,
      target: { type: "settings_version", id: publishedVersionId },
      timestamp: processedAt,
      previous_revision: revision,
      resulting_revision: nextRevision,
      before: { settings_version_id: currentVersionId },
      after: { settings_version_id: publishedVersionId },
      material_differences: {
        source_settings_version_id: sourceVersionId,
        team_count: teamChanges.activeCount,
        created_team_count: teamChanges.createdCount,
        restored_team_count: teamChanges.restoredCount,
        retired_team_count: teamChanges.retiredCount,
      },
      reason: command.reason,
      settings_version_id: publishedVersionId,
      command_id: command.commandId,
      transaction_id: "",
      public_summary: input.action === "settings_version_restored" ? "A prior rules version was restored as a new publication." : "League rules were published.",
      private_metadata: {},
      reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

export function executePublishSettings(input: {
  command: LeagueCommand<"publish_settings">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  return publishVersion({ ...input, sourceVersionId: input.command.payload.draftVersionId, sourceStatuses: ["draft"], action: "settings_published" });
}

export function executeRestoreSettingsVersion(input: {
  command: LeagueCommand<"restore_settings_version">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  return publishVersion({ ...input, sourceVersionId: input.command.payload.sourceVersionId, sourceStatuses: ["published", "superseded"], action: "settings_version_restored" });
}
