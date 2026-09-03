import type { FirestoreWrite } from "../league-history/firestoreRest";
import type { LeagueCommand, LeagueCommandReceipt } from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings } from "../../shared/leagueSettings";
import { buildSalaryLedgers, initializeAdvancedLeagueState, validateAdvancedLeagueState } from "../../shared/nativeAdvancedLeague";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
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

function grantActive(document: LeagueCommandStoredDocument, processedAt: string) {
  if (text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  const expiresAt = Date.parse(text(document.data.expires_at));
  return (!Number.isFinite(effectiveAt) || effectiveAt <= Date.parse(processedAt))
    && (!Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt));
}

async function requireContext(input: {
  command: LeagueCommand<"initialize_advanced_league_assets">;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}) {
  const { command, actorUserId, processedAt, store } = input;
  if (!isGamehqLeagueId(command.leagueId) || !isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_native_context", "Advanced assets require a canonical native league and season.");
  const [league, season, membership, teams] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams`),
  ]);
  if (!league || text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_league_required", "Connected-provider assets cannot be promoted by this command.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId || text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before initializing advanced assets.", 409);
  if (!["setup", "draft"].includes(text(season.data.phase))) throw new LeagueCommandFailure("advanced_initialization_locked", "Advanced assets must be initialized before the season begins.", 409);
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${revision}.`, 409, revision);
  if (!membership || text(membership.data.status) !== "active") throw new LeagueCommandFailure("permission_denied", "A current commissioner role is required.", 403);
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((id) => store.get(grantPath(command.leagueId, id)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant));
  if (!grants.some((grant) => text(grant.data.user_id) === actorUserId && ["commissioner", "co_commissioner"].includes(text(grant.data.role)) && grantActive(grant, processedAt))) throw new LeagueCommandFailure("permission_denied", "A current commissioner role is required.", 403);
  const settingsVersionId = text(command.payload.settingsVersionId);
  if (!settingsVersionId || settingsVersionId !== text(season.data.settings_version_id)) throw new LeagueCommandFailure("settings_changed", "Initialize assets from the active published settings version.", 409, revision);
  const settingsVersion = await store.get(`leagues/${command.leagueId}/settingsVersions/${settingsVersionId}`);
  if (!settingsVersion || text(settingsVersion.data.status) !== "published") throw new LeagueCommandFailure("settings_required", "Published dynasty settings are required.", 409);
  const parsed = parseLeagueSettings(settingsVersion.data.settings, text(league.data.timezone) || "UTC");
  if (parsed.issues.length || parsed.settings.leagueType !== "dynasty" || !parsed.settings.advanced.enabled) throw new LeagueCommandFailure("advanced_settings_required", "Publish a valid dynasty contract rule set before initializing assets.", 409);
  const existing = await store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/advancedLeagueState/current`);
  if (existing) throw new LeagueCommandFailure("advanced_assets_initialized", "Advanced assets are already initialized for this season.", 409, wholeNumber(existing.data.revision, 1));
  const franchiseIds = teams.filter((team) => text(team.data.status) !== "retired").map((team) => text(team.data.franchise_id)).filter(Boolean);
  if (franchiseIds.length < 2) throw new LeagueCommandFailure("season_teams_required", "Provision season teams before initializing advanced assets.", 409);
  const seasonYear = wholeNumber(season.data.year);
  const state = initializeAdvancedLeagueState({ settings: parsed.settings, seasonYear, franchiseIds });
  const issues = validateAdvancedLeagueState(parsed.settings, state);
  if (issues.length) throw new LeagueCommandFailure("advanced_state_invalid", issues[0]?.message ?? "Advanced asset initialization failed validation.", 409);
  return { league, season, revision, settingsVersionId, settings: parsed.settings, state };
}

export async function executeInitializeAdvancedLeagueAssets(input: {
  command: LeagueCommand<"initialize_advanced_league_assets">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const context = await requireContext({ command, actorUserId, processedAt, store });
  const nextRevision = context.revision + 1;
  const auditEventId = `audit-${command.commandId}`;
  const ledgers = buildSalaryLedgers(context.settings.advanced, context.state, context.state.seasonYear);
  const receipt: LeagueCommandReceipt = {
    commandId: command.commandId, commandType: command.commandType, actorUserId, leagueId: command.leagueId, seasonId: command.seasonId,
    status: "accepted", previousRevision: context.revision, resultingRevision: nextRevision, auditEventId, serverProcessedAt: processedAt, requestHash,
    result: { futurePickCount: context.state.futurePicks.length, draftPlanCount: context.state.draftPlans.length, salaryLedgerCount: ledgers.length, settingsVersionId: context.settingsVersionId }, error: null,
  };
  const base = `leagues/${command.leagueId}/seasons/${command.seasonId}`;
  const writes: FirestoreWrite[] = [
    createOnlyWrite(store, `${base}/advancedLeagueState/current`, {
      schema_version: 1, league_id: command.leagueId, season_id: command.seasonId, season_year: context.state.seasonYear,
      settings_version_id: context.settingsVersionId, revision: 1, initialized_at: processedAt, initialized_by: actorUserId,
      keeper_enabled: context.settings.keeper.enabled, contract_controls_enabled: true,
    }),
    ...context.state.futurePicks.map((pick) => createOnlyWrite(store, `${base}/futureDraftPicks/${pick.id}`, { ...pick, owner_franchise_id: pick.ownerFranchiseId, original_franchise_id: pick.originalFranchiseId, league_id: command.leagueId, season_id: command.seasonId })),
    ...context.state.draftPlans.map((plan) => createOnlyWrite(store, `${base}/advancedDraftPlans/${plan.id}`, { ...plan, league_id: command.leagueId, season_id: command.seasonId })),
    ...context.state.orphanTeams.map((row) => createOnlyWrite(store, `${base}/orphanTeamStates/${row.franchiseId}`, { ...row, league_id: command.leagueId, season_id: command.seasonId })),
    ...ledgers.map((ledger) => createOnlyWrite(store, `${base}/salaryLedgers/${ledger.franchiseId}`, { ...ledger, league_id: command.leagueId, season_id: command.seasonId, revision: 1 })),
    replaceWrite(store, context.season, `${base}`, { ...context.season.data, advanced_assets_initialized: true, advanced_assets_settings_version_id: context.settingsVersionId, revision: nextRevision, updated_at: processedAt }),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), {
      schema_version: 1, id: auditEventId, league_id: command.leagueId, season_id: command.seasonId, actor_user_id: actorUserId,
      action: "advanced_league_assets_initialized", target: { type: "advanced_league_state", id: "current" }, timestamp: processedAt,
      previous_revision: context.revision, resulting_revision: nextRevision, before: {}, after: receipt.result,
      material_differences: receipt.result, reason: command.reason, settings_version_id: context.settingsVersionId, command_id: command.commandId,
      transaction_id: "", public_summary: "Dynasty pick, cap, orphan, and draft-plan ledgers were initialized from published rules.", private_metadata: {}, reversal_of_audit_event_id: "",
    }),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  try {
    await store.commit(writes);
  } catch (error) {
    const initialized = await store.get(`${base}/advancedLeagueState/current`);
    if (initialized) throw new LeagueCommandFailure("advanced_assets_initialized", "Another command initialized the advanced ledgers first. Refresh the season.", 409, wholeNumber(initialized.data.revision, 1));
    const latest = await store.get(base);
    const latestRevision = Math.max(1, wholeNumber(latest?.data.revision, 1));
    if (latestRevision !== context.revision) throw new LeagueCommandFailure("stale_revision", `The active season revision is ${latestRevision}.`, 409, latestRevision);
    throw error;
  }
  return receipt;
}
