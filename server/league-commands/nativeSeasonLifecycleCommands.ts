import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
} from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  deriveGamehqUuid,
  grantPath,
  LeagueCommandFailure,
  membershipPath,
  receiptRecord,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";

type LifecycleCommand = LeagueCommand<"award_native_champion" | "archive_native_season" | "renew_native_league" | "export_native_league">;

function activeGrant(document: LeagueCommandStoredDocument, actorUserId: string, processedAt: string) {
  if (text(document.data.user_id) !== actorUserId || text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  const expiresAt = Date.parse(text(document.data.expires_at));
  return (!Number.isFinite(effectiveAt) || effectiveAt <= Date.parse(processedAt))
    && (!Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt));
}

async function lifecycleContext(input: { command: LifecycleCommand; actorUserId: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "Season lifecycle commands require a canonical native league and season.");
  const [league, season, membership] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_league_required", "Connected-provider leagues remain read-only.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId || text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before continuing.", 409);
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${revision}.`, 409, revision);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "A current commissioner role is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((entry): entry is LeagueCommandStoredDocument => Boolean(entry));
  if (!grants.some((grant) => ["commissioner", "co_commissioner"].includes(text(grant.data.role)) && activeGrant(grant, actorUserId, processedAt))) throw new LeagueCommandFailure("permission_denied", "A current commissioner role is required.", 403);
  return { league, season, revision };
}

function lifecycleReceipt(input: { command: LifecycleCommand; actorUserId: string; requestHash: string; processedAt: string; previousRevision: number; resultingRevision: number; auditEventId: string; result: Record<string, unknown> }): LeagueCommandReceipt {
  return {
    commandId: input.command.commandId,
    commandType: input.command.commandType,
    actorUserId: input.actorUserId,
    leagueId: input.command.leagueId,
    seasonId: input.command.seasonId,
    status: "accepted",
    previousRevision: input.previousRevision,
    resultingRevision: input.resultingRevision,
    auditEventId: input.auditEventId,
    serverProcessedAt: input.processedAt,
    requestHash: input.requestHash,
    result: input.result,
    error: null,
  };
}

function auditRecord(input: { command: LifecycleCommand; actorUserId: string; processedAt: string; previousRevision: number; resultingRevision: number; action: string; targetType: string; targetId: string; before: Record<string, unknown>; after: Record<string, unknown>; summary: string; settingsVersionId: string }) {
  const auditEventId = `audit-${input.command.commandId}`;
  return {
    auditEventId,
    data: {
      schema_version: 1,
      id: auditEventId,
      league_id: input.command.leagueId,
      season_id: input.command.seasonId,
      actor_user_id: input.actorUserId,
      action: input.action,
      target: { type: input.targetType, id: input.targetId },
      timestamp: input.processedAt,
      previous_revision: input.previousRevision,
      resulting_revision: input.resultingRevision,
      before: input.before,
      after: input.after,
      material_differences: input.after,
      reason: input.command.reason,
      settings_version_id: input.settingsVersionId,
      command_id: input.command.commandId,
      transaction_id: "",
      public_summary: input.summary,
      private_metadata: {},
      reversal_of_audit_event_id: "",
    },
  };
}

function requireReason(command: LifecycleCommand) {
  if (text(command.reason).length < 8) throw new LeagueCommandFailure("reason_required", "Explain this irreversible season lifecycle decision.");
}

export async function executeAwardNativeChampion(input: { command: LeagueCommand<"award_native_champion">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  requireReason(command);
  const context = await lifecycleContext({ command, actorUserId, processedAt, store });
  if (!["regular_season", "playoffs"].includes(text(context.season.data.phase))) throw new LeagueCommandFailure("championship_not_ready", "Complete the native draft and playoff bracket before awarding a champion.", 409);
  const base = `leagues/${command.leagueId}/seasons/${command.seasonId}`;
  const [teams, standings, bracket, existingAward] = await Promise.all([
    store.list(`${base}/seasonTeams`),
    store.get(`${base}/standings/current`),
    store.get(`${base}/playoffBrackets/current`),
    store.get(`${base}/seasonAwards/champion`),
  ]);
  if (existingAward) throw new LeagueCommandFailure("champion_already_awarded", "This season already has an authoritative champion.", 409, context.revision);
  if (!standings || wholeNumber(standings.data.revision) !== wholeNumber(command.payload.expectedStandingsRevision)) throw new LeagueCommandFailure("standings_changed", "The standings revision changed. Refresh before awarding the champion.", 409, wholeNumber(standings?.data.revision));
  if (!bracket || wholeNumber(bracket.data.revision) !== wholeNumber(command.payload.expectedBracketRevision)) throw new LeagueCommandFailure("bracket_changed", "The playoff bracket revision changed. Refresh before awarding the champion.", 409, wholeNumber(bracket?.data.revision));
  const activeFranchiseIds = new Set(teams.filter((team) => text(team.data.status) !== "retired").map((team) => text(team.data.franchise_id)).filter(Boolean));
  const championFranchiseId = text(command.payload.championFranchiseId);
  const runnerUpFranchiseId = text(command.payload.runnerUpFranchiseId);
  const qualifiers = new Set(stringList(bracket.data.qualifiers));
  if (!activeFranchiseIds.has(championFranchiseId) || !activeFranchiseIds.has(runnerUpFranchiseId) || championFranchiseId === runnerUpFranchiseId) throw new LeagueCommandFailure("invalid_championship_teams", "Choose two different active season teams.");
  if (!qualifiers.has(championFranchiseId) || !qualifiers.has(runnerUpFranchiseId)) throw new LeagueCommandFailure("invalid_championship_teams", "Champion and runner-up must come from the published playoff field.", 409);
  const nextRevision = context.revision + 1;
  const result = { championFranchiseId, runnerUpFranchiseId, standingsRevision: wholeNumber(standings.data.revision), bracketRevision: wholeNumber(bracket.data.revision), status: "awarded" };
  const audit = auditRecord({ command, actorUserId, processedAt, previousRevision: context.revision, resultingRevision: nextRevision, action: "native_champion_awarded", targetType: "season_award", targetId: "champion", before: {}, after: result, summary: "The native season champion was awarded from the published playoff field.", settingsVersionId: text(context.season.data.settings_version_id) });
  const receipt = lifecycleReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: context.revision, resultingRevision: nextRevision, auditEventId: audit.auditEventId, result });
  await store.commit([
    createOnlyWrite(store, `${base}/seasonAwards/champion`, { schema_version: 1, id: "champion", league_id: command.leagueId, season_id: command.seasonId, year: wholeNumber(context.season.data.year), champion_franchise_id: championFranchiseId, runner_up_franchise_id: runnerUpFranchiseId, standings_revision: wholeNumber(standings.data.revision), bracket_revision: wholeNumber(bracket.data.revision), settings_version_id: text(context.season.data.settings_version_id), awarded_by: actorUserId, awarded_at: processedAt, reason: command.reason, revision: 1 }),
    replaceWrite(store, context.season, base, { ...context.season.data, phase: "complete", champion_franchise_id: championFranchiseId, runner_up_franchise_id: runnerUpFranchiseId, completed_at: processedAt, revision: nextRevision, updated_at: processedAt }),
    createOnlyWrite(store, auditPath(command.leagueId, audit.auditEventId), audit.data),
    createOnlyWrite(store, `leagues/${command.leagueId}/notificationOutbox/notify-${command.commandId}`, { schema_version: 1, league_id: command.leagueId, season_id: command.seasonId, kind: "champion_awarded", status: "pending", franchise_ids: [championFranchiseId, runnerUpFranchiseId], created_at: processedAt }),
    createOnlyWrite(store, `leagues/${command.leagueId}/readModelInvalidations/invalidate-${command.commandId}`, { schema_version: 1, league_id: command.leagueId, season_id: command.seasonId, targets: ["league_home", "standings", "history", "league_pulse"], created_at: processedAt }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ]);
  return receipt;
}

const ARCHIVE_COUNT_COLLECTIONS = ["seasonTeams", "rosterTransactions", "drafts", "lineups", "scoringEvents", "waiverReceipts", "tradeReceipts", "matchupResults", "playoffBrackets"] as const;

export async function executeArchiveNativeSeason(input: { command: LeagueCommand<"archive_native_season">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  requireReason(command);
  const context = await lifecycleContext({ command, actorUserId, processedAt, store });
  if (text(context.season.data.phase) !== "complete") throw new LeagueCommandFailure("season_not_complete", "Award the champion before archiving the season.", 409);
  const base = `leagues/${command.leagueId}/seasons/${command.seasonId}`;
  const [award, ...collections] = await Promise.all([
    store.get(`${base}/seasonAwards/champion`),
    ...ARCHIVE_COUNT_COLLECTIONS.map((name) => store.list(`${base}/${name}`)),
  ]);
  const championFranchiseId = text(command.payload.championFranchiseId);
  if (!award || text(award.data.champion_franchise_id) !== championFranchiseId) throw new LeagueCommandFailure("champion_changed", "Confirm the authoritative champion before archiving.", 409);
  const nextRevision = context.revision + 1;
  const counts = Object.fromEntries(ARCHIVE_COUNT_COLLECTIONS.map((name, index) => [name, collections[index]?.length ?? 0]));
  const archiveId = command.seasonId;
  const result = { archiveId, championFranchiseId, year: wholeNumber(context.season.data.year), counts, status: "archived" };
  const audit = auditRecord({ command, actorUserId, processedAt, previousRevision: context.revision, resultingRevision: nextRevision, action: "native_season_archived", targetType: "season_archive", targetId: archiveId, before: { phase: "complete" }, after: result, summary: `The ${wholeNumber(context.season.data.year)} native season was archived permanently.`, settingsVersionId: text(context.season.data.settings_version_id) });
  const receipt = lifecycleReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: context.revision, resultingRevision: nextRevision, auditEventId: audit.auditEventId, result });
  await store.commit([
    createOnlyWrite(store, `leagues/${command.leagueId}/seasonArchives/${archiveId}`, { schema_version: 1, id: archiveId, league_id: command.leagueId, season_id: command.seasonId, year: wholeNumber(context.season.data.year), champion_franchise_id: championFranchiseId, runner_up_franchise_id: text(award.data.runner_up_franchise_id), settings_version_id: text(context.season.data.settings_version_id), standings_revision: wholeNumber(award.data.standings_revision), bracket_revision: wholeNumber(award.data.bracket_revision), counts, archived_by: actorUserId, archived_at: processedAt, revision: 1 }),
    replaceWrite(store, context.season, base, { ...context.season.data, phase: "archived", end_at: processedAt, archived_at: processedAt, revision: nextRevision, updated_at: processedAt }),
    replaceWrite(store, context.league, `leagues/${command.leagueId}`, { ...context.league.data, status: "archived", revision: Math.max(1, wholeNumber(context.league.data.revision, 1)) + 1, updated_at: processedAt }),
    createOnlyWrite(store, auditPath(command.leagueId, audit.auditEventId), audit.data),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ]);
  return receipt;
}

function renewedTeamData(document: LeagueCommandStoredDocument, leagueId: string, seasonId: string, processedAt: string, auctionBudget: number | null) {
  return {
    ...document.data,
    league_id: leagueId,
    season_id: seasonId,
    budget: auctionBudget === null ? {} : { initial: auctionBudget, remaining: auctionBudget, currency: "USD" },
    cap: {},
    roster_revision: 1,
    roster_player_ids: [],
    status: "active",
    created_at: processedAt,
    updated_at: processedAt,
  };
}

export async function executeRenewNativeLeague(input: { command: LeagueCommand<"renew_native_league">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  requireReason(command);
  const context = await lifecycleContext({ command, actorUserId, processedAt, store });
  if (text(context.season.data.phase) !== "archived") throw new LeagueCommandFailure("season_not_archived", "Archive the completed season before renewing the league.", 409);
  const previousYear = wholeNumber(context.season.data.year);
  const year = wholeNumber(command.payload.year);
  if (year !== previousYear + 1) throw new LeagueCommandFailure("invalid_renewal_year", `The next native season must be ${previousYear + 1}.`);
  const settingsVersionId = text(context.season.data.settings_version_id);
  const [settingsVersion, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!settingsVersion) throw new LeagueCommandFailure("settings_required", "The archived season has no published settings to carry forward.", 409);
  const parsed = parseLeagueSettings(settingsVersion.data.settings, text(context.league.data.timezone) || "UTC");
  if (parsed.issues.length) throw new LeagueCommandFailure("settings_invalid", "Repair the archived settings snapshot before renewing.", 409);
  const newSeasonId = deriveGamehqUuid(actorUserId, command.commandId, "renewed-season");
  const draftSettingsVersionId = `settings-${command.commandId}`;
  const auctionBudget = parsed.settings.draft.format === "auction" ? parsed.settings.draft.auctionBudget : null;
  const activeTeams = teams.filter((team) => text(team.data.status) !== "retired");
  const result = { previousSeasonId: command.seasonId, seasonId: newSeasonId, year, teamCount: activeTeams.length, draftSettingsVersionId, status: "setup" };
  const audit = auditRecord({ command, actorUserId, processedAt, previousRevision: context.revision, resultingRevision: 1, action: "native_league_renewed", targetType: "season", targetId: newSeasonId, before: { current_season_id: command.seasonId, year: previousYear }, after: result, summary: `The native league was renewed for ${year}.`, settingsVersionId });
  const receipt = lifecycleReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: context.revision, resultingRevision: 1, auditEventId: audit.auditEventId, result });
  const newBase = `leagues/${command.leagueId}/seasons/${newSeasonId}`;
  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, newBase, { schema_version: 1, id: newSeasonId, league_id: command.leagueId, year, phase: "setup", revision: 1, settings_version_id: "", draft_settings_version_id: draftSettingsVersionId, draft_id: "", schedule_version_id: "", start_at: "", end_at: "", legacy_source_league_id: "", renewed_from_season_id: command.seasonId, created_at: processedAt, updated_at: processedAt }),
    createOnlyWrite(store, `leagues/${command.leagueId}/settingsVersions/${draftSettingsVersionId}`, { schema_version: 1, id: draftSettingsVersionId, league_id: command.leagueId, season_id: newSeasonId, revision: 1, status: "draft", effective_at: processedAt, settings: parsed.settings, validation_errors: [], published_by: "", published_at: "", carried_from_settings_version_id: settingsVersionId, created_at: processedAt, updated_at: processedAt }),
    ...activeTeams.map((team) => createOnlyWrite(store, `${newBase}/seasonTeams/${text(team.data.franchise_id)}`, renewedTeamData(team, command.leagueId, newSeasonId, processedAt, auctionBudget))),
    replaceWrite(store, context.league, `leagues/${command.leagueId}`, { ...context.league.data, current_season_id: newSeasonId, status: "draft", revision: Math.max(1, wholeNumber(context.league.data.revision, 1)) + 1, updated_at: processedAt }),
    createOnlyWrite(store, auditPath(command.leagueId, audit.auditEventId), audit.data),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  try {
    await store.commit(writes);
  } catch (error) {
    const latestLeague = await store.get(`leagues/${command.leagueId}`);
    if (text(latestLeague?.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "Another commissioner renewed the league first. Refresh the workspace.", 409);
    throw error;
  }
  return receipt;
}

const LEAGUE_EXPORT_COLLECTIONS = ["franchises", "memberships", "roleGrants", "invitations", "settingsVersions", "externalConnections", "commands", "auditEvents", "auditPrivate", "pulseEvents", "pulseReactions", "pulseComments", "ruleProposals", "seasonArchives"] as const;
const SEASON_EXPORT_COLLECTIONS = ["seasonTeams", "rosterTransactions", "drafts", "lineupWeeks", "lineups", "scoringWeeks", "scoringEvents", "scoringEventRevisions", "waiverState", "playerStates", "waiverTeamStates", "waiverClaims", "waiverRuns", "waiverReceipts", "tradeOffers", "tradeReceipts", "draftPickStates", "tradeableAssets", "schedule", "scheduleVersions", "standings", "matchupResults", "matchupResultRevisions", "playoffBrackets", "playoffBracketVersions", "seasonAwards", "advancedLeagueState", "futureDraftPicks", "keeperAssignments", "playerContracts", "deadCapCharges", "salaryLedgers", "taxiAssignments", "rfaTenders", "franchiseTags", "orphanTeamStates", "compensatoryPicks", "advancedDraftPlans"] as const;
const EXPORT_CHUNK_BYTES = 600_000;

function exportedDocuments(documents: LeagueCommandStoredDocument[]) {
  return documents.map((document) => ({ path: document.path, data: document.data }));
}

function chunkText(value: string) {
  const chunks: string[] = [];
  let chunk = "";
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character);
    if (chunk && chunkBytes + characterBytes > EXPORT_CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [""];
}

export async function executeExportNativeLeague(input: { command: LeagueCommand<"export_native_league">; actorUserId: string; requestHash: string; processedAt: string; store: LeagueCommandStore }) {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await lifecycleContext({ command, actorUserId, processedAt, store });
  const base = `leagues/${command.leagueId}`;
  const seasonBase = `${base}/seasons/${command.seasonId}`;
  const [leagueCollections, seasonCollections] = await Promise.all([
    Promise.all(LEAGUE_EXPORT_COLLECTIONS.map((name) => store.list(`${base}/${name}`))),
    Promise.all(SEASON_EXPORT_COLLECTIONS.map((name) => store.list(`${seasonBase}/${name}`))),
  ]);
  const leagueData = Object.fromEntries(LEAGUE_EXPORT_COLLECTIONS.map((name, index) => [name, exportedDocuments(leagueCollections[index] ?? [])]));
  if (!command.payload.includePrivateAudit) {
    delete leagueData.invitations;
    delete leagueData.auditPrivate;
  }
  const seasonData = Object.fromEntries(SEASON_EXPORT_COLLECTIONS.map((name, index) => [name, exportedDocuments(seasonCollections[index] ?? [])]));
  const exportedAt = processedAt;
  const snapshot = JSON.stringify({ schemaVersion: 1, exportedAt, league: context.league.data, season: context.season.data, leagueCollections: leagueData, seasonCollections: seasonData });
  const chunks = chunkText(snapshot);
  if (chunks.length > 12) throw new LeagueCommandFailure("export_too_large", "This league export exceeds the synchronous safety limit. Contact support for a background export.", 413);
  const exportId = `export-${command.commandId}`;
  const counts = { leagueCollections: Object.fromEntries(Object.entries(leagueData).map(([name, values]) => [name, values.length])), seasonCollections: Object.fromEntries(Object.entries(seasonData).map(([name, values]) => [name, values.length])) };
  const result = { exportId, chunkCount: chunks.length, byteLength: Buffer.byteLength(snapshot), counts, exportedAt };
  const audit = auditRecord({ command, actorUserId, processedAt, previousRevision: context.revision, resultingRevision: context.revision, action: "native_league_export_created", targetType: "league_export", targetId: exportId, before: {}, after: { exportId, chunkCount: chunks.length, byteLength: result.byteLength }, summary: "A private native league data export was generated.", settingsVersionId: text(context.season.data.settings_version_id) });
  const receipt = lifecycleReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: context.revision, resultingRevision: context.revision, auditEventId: audit.auditEventId, result });
  await store.commit([
    createOnlyWrite(store, `${base}/leagueExports/${exportId}`, { schema_version: 1, id: exportId, league_id: command.leagueId, season_id: command.seasonId, created_by: actorUserId, created_at: processedAt, chunk_count: chunks.length, byte_length: result.byteLength, counts, include_private_audit: Boolean(command.payload.includePrivateAudit), content_type: "application/json", revision: 1 }),
    ...chunks.map((chunk, index) => createOnlyWrite(store, `${base}/leagueExports/${exportId}/chunks/${String(index).padStart(4, "0")}`, { schema_version: 1, export_id: exportId, index, content: chunk })),
    createOnlyWrite(store, auditPath(command.leagueId, audit.auditEventId), audit.data),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ]);
  return receipt;
}
