import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueCommand, LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import {
  normalizeLineupAssignments,
  parseLeagueSeasonDraft,
} from "../../src/features/league-season/leagueSeasonModel";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  auditPrivatePath,
  commandPath,
  createOnlyWrite,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  receiptRecord,
  record,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";
import { executeSaveNativeWeeklyLineup } from "./nativeLineupCommands";

function assignments(value: unknown) {
  const source = record(value);
  return Object.fromEntries(Object.entries(source).flatMap(([slot, playerId]) => {
    const normalizedSlot = text(slot);
    const normalizedPlayerId = text(playerId);
    return normalizedSlot && normalizedPlayerId ? [[normalizedSlot, normalizedPlayerId]] : [];
  }));
}

function changedSlots(before: Record<string, string>, after: Record<string, string>) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((slot) => before[slot] !== after[slot])
    .sort();
}

function roleActive(value: Record<string, unknown>, now: string) {
  if (text(value.revoked_at)) return false;
  const effectiveAt = Date.parse(text(value.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(now)) return false;
  const expiresAt = Date.parse(text(value.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(now);
}

async function roleDocuments(store: LeagueCommandStore, leagueId: string, actorUserId: string, processedAt: string) {
  const membership = await store.get(membershipPath(leagueId, actorUserId));
  if (!membership || text(membership.data.status) !== "active") return [];
  const grantIds = stringList(membership.data.role_grant_ids);
  return (await Promise.all(grantIds.map((grantId) => store.get(grantPath(leagueId, grantId)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant))
    .filter((grant) => text(grant.data.user_id) === actorUserId && roleActive(grant.data, processedAt));
}

function currentLineupRevision(lineup: LeagueCommandStoredDocument | null) {
  return lineup ? Math.max(1, wholeNumber(lineup.data.revision, 1)) : 0;
}

export async function executeSaveWeeklyLineup(input: {
  command: LeagueCommand<"save_weekly_lineup">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  if (!text(command.payload.legacyLeagueId)) return executeSaveNativeWeeklyLineup(input);
  if (!isGamehqLeagueId(command.leagueId)) throw new LeagueCommandFailure("invalid_league_id", "Save the lineup through a canonical GameHQ league.");
  if (!isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_season_id", "The active GameHQ season is invalid.");
  const legacyLeagueId = text(command.payload.legacyLeagueId);
  const legacyFranchiseId = text(command.payload.franchiseId);
  const week = wholeNumber(command.payload.week);
  if (!/^\d{10,}$/u.test(legacyLeagueId)) throw new LeagueCommandFailure("invalid_legacy_league", "The migrated season source is invalid.");
  if (!legacyFranchiseId || legacyFranchiseId.includes("/")) throw new LeagueCommandFailure("invalid_franchise", "Choose a valid franchise before saving.");

  const [league, season, connection, legacySeason, legacyLineup, weekSettings, seasonTeams, roles] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(`leagues/${command.leagueId}/externalConnections/sleeper`),
    store.get(`leagueSeasons/${legacyLeagueId}`),
    store.get(`leagueSeasons/${legacyLeagueId}/lineups/${legacyFranchiseId}_week-${week}`),
    store.get(`leagueSeasons/${legacyLeagueId}/weekSettings/week-${week}`),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
    roleDocuments(store, command.leagueId, actorUserId, processedAt),
  ]);
  if (!league) throw new LeagueCommandFailure("league_not_found", "The GameHQ league no longer exists.", 404);
  if (!season || text(season.data.league_id) !== command.leagueId) throw new LeagueCommandFailure("season_not_found", "The active GameHQ season no longer exists.", 404);
  if (text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before saving.", 409);
  if (!connection || text(connection.data.external_league_id) !== legacyLeagueId) throw new LeagueCommandFailure("source_mismatch", "The lineup source does not belong to this GameHQ league.", 409);
  if (!legacySeason) throw new LeagueCommandFailure("legacy_season_missing", "The published lineup source no longer exists.", 404);

  const settingsVersionId = text(season.data.settings_version_id);
  const settingsVersion = settingsVersionId
    ? await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`)
    : null;
  if (!settingsVersion || text(settingsVersion.data.status) !== "published") throw new LeagueCommandFailure("settings_unpublished", "Publish valid league settings before saving lineups.", 409);
  const activeSettings = record(settingsVersion.data.settings);
  const maxLineupWeek = wholeNumber(activeSettings.lineup_week_count);
  if (week < 1 || maxLineupWeek < 1 || week > maxLineupWeek) {
    throw new LeagueCommandFailure("invalid_week", `Choose a lineup week between 1 and ${Math.max(1, maxLineupWeek)}.`);
  }

  const seasonTeam = seasonTeams.find((candidate) => text(candidate.data.legacy_franchise_id) === legacyFranchiseId);
  const canonicalFranchiseId = text(seasonTeam?.data.franchise_id);
  if (!canonicalFranchiseId) throw new LeagueCommandFailure("franchise_not_mapped", "This franchise has not been mapped to GameHQ yet.", 409);
  const commissioner = roles.some((grant) => ["commissioner", "co_commissioner"].includes(text(grant.data.role)));
  const controlsFranchise = roles.some((grant) => (
    ["team_owner", "co_manager"].includes(text(grant.data.role))
    && text(grant.data.franchise_id) === canonicalFranchiseId
  ));
  if (!commissioner && !controlsFranchise) throw new LeagueCommandFailure("permission_denied", "Your GameHQ league role does not control this franchise.", 403);

  const currentRevision = currentLineupRevision(legacyLineup);
  if (command.expectedRevision !== currentRevision) {
    throw new LeagueCommandFailure("stale_revision", `This lineup changed after you opened it. The current revision is ${currentRevision}.`, 409, currentRevision);
  }
  const locked = Boolean(weekSettings?.data.locked);
  if (locked && !commissioner) throw new LeagueCommandFailure("lineup_locked", `Week ${week} lineups are locked by the commissioner.`, 409, currentRevision);
  const overrideReason = text(command.payload.overrideReason).replace(/\s+/gu, " ").slice(0, 240);
  if (locked && commissioner && overrideReason.length < 4) throw new LeagueCommandFailure("override_reason_required", "Enter an override reason before changing a locked lineup.");

  const sourceSeason = parseLeagueSeasonDraft(record(legacySeason.data.payload), {
    leagueId: legacyLeagueId,
    source: "published",
    revision: wholeNumber(legacySeason.data.revision, 1),
    updatedAt: text(legacySeason.data.updated_at),
  });
  const sourceFranchise = sourceSeason?.franchises.find((franchise) => franchise.id === legacyFranchiseId);
  if (!sourceSeason || !sourceFranchise) throw new LeagueCommandFailure("invalid_legacy_season", "The published roster cannot validate this lineup.", 409);
  const normalizedAssignments = normalizeLineupAssignments(sourceFranchise, sourceSeason.rosterSlots, command.payload.assignments);
  const beforeAssignments = assignments(legacyLineup?.data.assignments);
  const nextRevision = currentRevision + 1;
  const legacyLineupPath = `leagueSeasons/${legacyLeagueId}/lineups/${legacyFranchiseId}_week-${week}`;
  const legacyAuditId = `legacy-${command.commandId}`;
  const legacyAuditPath = `leagueSeasons/${legacyLeagueId}/auditEvents/${legacyAuditId}`;
  const auditEventId = `audit-${command.commandId}`;
  const nextLineup = {
    league_id: legacyLeagueId,
    franchise_id: legacyFranchiseId,
    week,
    week_key: `week-${week}`,
    season_revision: wholeNumber(legacySeason.data.revision, 1),
    assignments: normalizedAssignments,
    revision: nextRevision,
    audit_event_id: legacyAuditId,
    updated_by_user_id: actorUserId,
    created_at: text(legacyLineup?.data.created_at) || processedAt,
    updated_at: processedAt,
  };
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId,
    commandType: command.commandType,
    actorUserId,
    leagueId: command.leagueId,
    seasonId: command.seasonId,
    status: "accepted",
    previousRevision: currentRevision,
    resultingRevision: nextRevision,
    auditEventId,
    serverProcessedAt: processedAt,
    requestHash,
    result: { lineupId: `${canonicalFranchiseId}_week-${week}`, legacyLineupId: `${legacyFranchiseId}_week-${week}`, week },
    error: null,
  };
  const writes: FirestoreWrite[] = [
    replaceWrite(store, legacyLineup, legacyLineupPath, nextLineup),
    createOnlyWrite(store, legacyAuditPath, {
      league_id: legacyLeagueId,
      event_id: legacyAuditId,
      lineup_id: `${legacyFranchiseId}_week-${week}`,
      type: locked ? "lineup_override" : "lineup_saved",
      actor_user_id: actorUserId,
      franchise_id: legacyFranchiseId,
      week,
      week_key: `week-${week}`,
      season_revision: wholeNumber(legacySeason.data.revision, 1),
      before_assignments: beforeAssignments,
      after_assignments: normalizedAssignments,
      reason: overrideReason,
      created_at: processedAt,
    }),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      actor_user_id: actorUserId,
      action: locked ? "lineup_override" : "lineup_saved",
      target: { type: "lineup", id: `${canonicalFranchiseId}_week-${week}` },
      timestamp: processedAt,
      previous_revision: currentRevision,
      resulting_revision: nextRevision,
      before: beforeAssignments,
      after: normalizedAssignments,
      material_differences: { changed_slots: changedSlots(beforeAssignments, normalizedAssignments) },
      reason: overrideReason,
      settings_version_id: settingsVersionId,
      command_id: command.commandId,
      transaction_id: "",
      public_summary: `${sourceFranchise.displayName}'s Week ${week} lineup was ${locked ? "overridden" : "saved"}.`,
      private_metadata: {},
      reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, auditPrivatePath(command.leagueId, auditEventId), {
      schema_version: 1,
      id: auditEventId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      actor_user_id: actorUserId,
      command_id: command.commandId,
      transaction_id: "",
      reason: overrideReason,
      legacy_league_id: legacyLeagueId,
      legacy_franchise_id: legacyFranchiseId,
      created_at: processedAt,
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  try {
    await store.commit(writes);
  } catch (error) {
    const latest = await store.get(legacyLineupPath);
    const latestRevision = currentLineupRevision(latest);
    if (latestRevision !== currentRevision) {
      throw new LeagueCommandFailure("stale_revision", `This lineup changed while your save was processing. The current revision is ${latestRevision}.`, 409, latestRevision);
    }
    throw error;
  }
  return receipt;
}
