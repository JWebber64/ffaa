import { createHash, randomBytes } from "node:crypto";

import type { FirestoreWrite } from "../league-history/firestoreRest";
import type {
  LeagueCommand,
  LeagueCommandReceipt,
  LeagueInvitationRole,
} from "../../shared/leagueCommandProtocol";
import { parseLeagueSettings } from "../../shared/leagueSettings";
import { isGamehqLeagueId } from "../../src/features/league-domain/types";
import {
  auditPath,
  commandPath,
  createOnlyWrite,
  grantPath,
  invitationPath,
  LeagueCommandFailure,
  membershipPath,
  normalizeReceipt,
  receiptRecord,
  replaceWrite,
  stringList,
  text,
  wholeNumber,
} from "./commandSupport";
import type { LeagueCommandStore, LeagueCommandStoredDocument } from "./store";
import { reconcileSeasonTeams } from "./teamProvisioning";

type MembershipCommandType =
  | "provision_season_teams"
  | "create_league_invitation"
  | "accept_league_invitation"
  | "revoke_league_invitation"
  | "remove_league_member";

const INVITATION_ROLES = new Set<LeagueInvitationRole>(["team_owner", "co_manager", "co_commissioner"]);

function roleActive(document: LeagueCommandStoredDocument, processedAt: string) {
  if (text(document.data.revoked_at)) return false;
  const effectiveAt = Date.parse(text(document.data.effective_at));
  if (Number.isFinite(effectiveAt) && effectiveAt > Date.parse(processedAt)) return false;
  const expiresAt = Date.parse(text(document.data.expires_at));
  return !Number.isFinite(expiresAt) || expiresAt > Date.parse(processedAt);
}

async function activeRoleDocuments(store: LeagueCommandStore, leagueId: string, userId: string, processedAt: string) {
  const membership = await store.get(membershipPath(leagueId, userId));
  if (!membership || text(membership.data.status) !== "active") return { membership, grants: [] };
  const grants = (await Promise.all(stringList(membership.data.role_grant_ids).map((grantId) => store.get(grantPath(leagueId, grantId)))))
    .filter((grant): grant is LeagueCommandStoredDocument => Boolean(grant))
    .filter((grant) => text(grant.data.user_id) === userId && roleActive(grant, processedAt));
  return { membership, grants };
}

async function nativeSeasonState(input: {
  command: LeagueCommand<MembershipCommandType>;
  store: LeagueCommandStore;
}) {
  const { command, store } = input;
  if (!isGamehqLeagueId(command.leagueId)) throw new LeagueCommandFailure("invalid_league_id", "Manage people through a canonical GameHQ league.");
  if (!isGamehqLeagueId(command.seasonId)) throw new LeagueCommandFailure("invalid_season_id", "The active GameHQ season is invalid.");
  const [league, season] = await Promise.all([
    store.get(`leagues/${command.leagueId}`),
    store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}`),
  ]);
  if (!league) throw new LeagueCommandFailure("league_not_found", "The GameHQ league no longer exists.", 404);
  if (text(league.data.authority_mode) !== "native") throw new LeagueCommandFailure("native_membership_required", "This league must complete native migration before GameHQ can manage its members.", 409);
  if (!season || text(season.data.league_id) !== command.leagueId) throw new LeagueCommandFailure("season_not_found", "The active GameHQ season no longer exists.", 404);
  if (text(league.data.current_season_id) !== command.seasonId) throw new LeagueCommandFailure("season_changed", "The active season changed. Refresh before managing people.", 409);
  const revision = Math.max(1, wholeNumber(season.data.revision, 1));
  if (command.expectedRevision !== revision) {
    throw new LeagueCommandFailure("stale_revision", `League membership changed after you opened it. The current revision is ${revision}.`, 409, revision);
  }
  return { league, season, revision };
}

async function managerState(input: {
  command: LeagueCommand<MembershipCommandType>;
  actorUserId: string;
  processedAt: string;
  store: LeagueCommandStore;
}) {
  const state = await nativeSeasonState(input);
  const access = await activeRoleDocuments(input.store, input.command.leagueId, input.actorUserId, input.processedAt);
  const roles = new Set(access.grants.map((grant) => text(grant.data.role)));
  if (!roles.has("commissioner") && !roles.has("co_commissioner")) {
    throw new LeagueCommandFailure("permission_denied", "A current GameHQ commissioner role is required to manage league access.", 403);
  }
  return { ...state, managerRoles: roles };
}

async function activeSettings(store: LeagueCommandStore, leagueId: string, season: LeagueCommandStoredDocument) {
  const settingsVersionId = text(season.data.settings_version_id);
  if (!settingsVersionId) throw new LeagueCommandFailure("settings_required", "Publish valid league rules before assigning teams.", 409);
  const version = await store.get(`leagues/${leagueId}/settingsVersions/${settingsVersionId}`);
  if (!version || text(version.data.status) !== "published") throw new LeagueCommandFailure("active_settings_missing", "The active published rules are unavailable. No membership changed.", 409);
  const parsed = parseLeagueSettings(version.data.settings);
  if (parsed.issues.length) throw new LeagueCommandFailure("invalid_settings", "The active rules are invalid. Repair the rulebook before assigning teams.", 409);
  return { settingsVersionId, settings: parsed.settings };
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
      throw new LeagueCommandFailure("stale_revision", `League membership changed while your command was processing. The current revision is ${latestRevision}.`, 409, latestRevision);
    }
    throw error;
  }
  return null;
}

function updatedSeasonWrite(store: LeagueCommandStore, season: LeagueCommandStoredDocument, leagueId: string, seasonId: string, revision: number, processedAt: string) {
  return replaceWrite(store, season, `leagues/${leagueId}/seasons/${seasonId}`, {
    ...season.data,
    revision,
    updated_at: processedAt,
  });
}

function auditRecord(input: {
  command: LeagueCommand<MembershipCommandType>;
  actorUserId: string;
  processedAt: string;
  auditEventId: string;
  previousRevision: number;
  resultingRevision: number;
  action: string;
  target: { type: string; id: string };
  before: unknown;
  after: unknown;
  materialDifferences: unknown;
  publicSummary: string;
  settingsVersionId: string;
}) {
  return {
    schema_version: 1,
    id: input.auditEventId,
    league_id: input.command.leagueId,
    season_id: input.command.seasonId,
    actor_user_id: input.actorUserId,
    action: input.action,
    target: input.target,
    timestamp: input.processedAt,
    previous_revision: input.previousRevision,
    resulting_revision: input.resultingRevision,
    before: input.before,
    after: input.after,
    material_differences: input.materialDifferences,
    reason: input.command.reason,
    settings_version_id: input.settingsVersionId,
    command_id: input.command.commandId,
    transaction_id: "",
    public_summary: input.publicSummary,
    private_metadata: {},
    reversal_of_audit_event_id: "",
  };
}

function buildReceipt(input: {
  command: LeagueCommand<MembershipCommandType>;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  previousRevision: number;
  resultingRevision: number;
  result: Record<string, unknown>;
}) {
  const auditEventId = `audit-${input.command.commandId}`;
  const receipt: LeagueCommandReceipt = {
    commandId: input.command.commandId,
    commandType: input.command.commandType,
    actorUserId: input.actorUserId,
    leagueId: input.command.leagueId,
    seasonId: input.command.seasonId,
    status: "accepted",
    previousRevision: input.previousRevision,
    resultingRevision: input.resultingRevision,
    auditEventId,
    serverProcessedAt: input.processedAt,
    requestHash: input.requestHash,
    result: input.result,
    error: null,
  };
  return { auditEventId, receipt };
}

function cleanEmail(value: unknown) {
  return text(value).toLowerCase().slice(0, 254);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function invitationGrantId(userId: string, role: LeagueInvitationRole, franchiseId: string) {
  return role === "co_commissioner"
    ? `${userId}__co_commissioner`
    : `${userId}__${role}__${franchiseId}`;
}

function invitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function executeProvisionSeasonTeams(input: {
  command: LeagueCommand<"provision_season_teams">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { season, revision } = await managerState({ command, actorUserId, processedAt, store });
  const { settingsVersionId, settings } = await activeSettings(store, command.leagueId, season);
  const changes = await reconcileSeasonTeams({ store, leagueId: command.leagueId, seasonId: command.seasonId, settings, actorUserId, commandId: command.commandId, processedAt });
  if (!changes.writes.length) throw new LeagueCommandFailure("teams_already_provisioned", "Team slots already match the published league size.", 409, revision);
  const nextRevision = revision + 1;
  const { receipt, auditEventId } = buildReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: revision, resultingRevision: nextRevision, result: changes });
  const writes = [
    ...changes.writes,
    updatedSeasonWrite(store, season, command.leagueId, command.seasonId, nextRevision, processedAt),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({
      command,
      actorUserId,
      processedAt,
      auditEventId,
      previousRevision: revision,
      resultingRevision: nextRevision,
      action: "season_teams_provisioned",
      target: { type: "season", id: command.seasonId },
      before: {},
      after: { team_count: changes.activeCount },
      materialDifferences: changes,
      publicSummary: `${changes.activeCount} team slots are ready for manager assignment.`,
      settingsVersionId,
    })),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

export async function executeCreateLeagueInvitation(input: {
  command: LeagueCommand<"create_league_invitation">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { season, revision, managerRoles } = await managerState({ command, actorUserId, processedAt, store });
  const { settingsVersionId, settings } = await activeSettings(store, command.leagueId, season);
  const email = cleanEmail(command.payload.email);
  const displayName = text(command.payload.displayName).replace(/\s+/gu, " ").slice(0, 80);
  const role = text(command.payload.role) as LeagueInvitationRole;
  const franchiseId = text(command.payload.franchiseId);
  const expiresInDays = wholeNumber(command.payload.expiresInDays, 7);
  if (!validEmail(email)) throw new LeagueCommandFailure("invalid_invitation_email", "Enter the manager's valid sign-in email.");
  if (displayName.length < 2) throw new LeagueCommandFailure("invalid_invitation_name", "Enter the manager's name.");
  if (!INVITATION_ROLES.has(role)) throw new LeagueCommandFailure("invalid_invitation_role", "Choose a supported manager role.");
  if (expiresInDays < 1 || expiresInDays > 30) throw new LeagueCommandFailure("invalid_invitation_expiry", "Invitations may remain open for 1 to 30 days.");
  if (role === "co_commissioner" && !managerRoles.has("commissioner")) {
    throw new LeagueCommandFailure("permission_denied", "Only the primary commissioner can appoint a co-commissioner.", 403);
  }
  if (role === "co_manager" && !settings.allowMultipleManagersPerTeam) {
    throw new LeagueCommandFailure("co_managers_disabled", "Published league rules do not allow multiple managers on one team.", 409);
  }
  if (role !== "co_commissioner") {
    if (!franchiseId) throw new LeagueCommandFailure("franchise_required", "Choose the team this manager will control.");
    const team = await store.get(`leagues/${command.leagueId}/seasons/${command.seasonId}/seasonTeams/${franchiseId}`);
    if (!team || text(team.data.status) === "retired") throw new LeagueCommandFailure("team_not_found", "That active team is no longer available.", 404);
  } else if (franchiseId) {
    throw new LeagueCommandFailure("invalid_role_scope", "Co-commissioner access applies to the league, not one team.");
  }

  const [grants, invitations] = await Promise.all([
    store.list(`leagues/${command.leagueId}/roleGrants`),
    store.list(`leagues/${command.leagueId}/invitations`),
  ]);
  const pendingForEmail = invitations.some((invitation) => text(invitation.data.status) === "pending" && cleanEmail(invitation.data.email) === email);
  if (pendingForEmail) throw new LeagueCommandFailure("invitation_exists", "That email already has a pending invitation. Revoke it before creating another.", 409);
  if (role === "team_owner") {
    const hasOwner = grants.some((grant) => text(grant.data.role) === "team_owner" && text(grant.data.franchise_id) === franchiseId && roleActive(grant, processedAt));
    if (hasOwner) throw new LeagueCommandFailure("team_owner_exists", "Remove the current team owner before inviting a replacement.", 409);
  }

  const invitationId = `invite-${command.commandId}`;
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.parse(processedAt) + expiresInDays * 86_400_000).toISOString();
  const nextRevision = revision + 1;
  const { receipt, auditEventId } = buildReceipt({
    command,
    actorUserId,
    requestHash,
    processedAt,
    previousRevision: revision,
    resultingRevision: nextRevision,
    result: { invitationId, token, email, displayName, role, franchiseId, expiresAt },
  });
  const writes = [
    createOnlyWrite(store, invitationPath(command.leagueId, invitationId), {
      schema_version: 1,
      id: invitationId,
      league_id: command.leagueId,
      season_id: command.seasonId,
      email,
      display_name: displayName,
      role,
      franchise_id: franchiseId,
      status: "pending",
      token_hash: invitationTokenHash(token),
      created_by: actorUserId,
      created_at: processedAt,
      expires_at: expiresAt,
      accepted_by: "",
      accepted_at: "",
      revoked_by: "",
      revoked_at: "",
      revision: 1,
    }),
    updatedSeasonWrite(store, season, command.leagueId, command.seasonId, nextRevision, processedAt),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({
      command,
      actorUserId,
      processedAt,
      auditEventId,
      previousRevision: revision,
      resultingRevision: nextRevision,
      action: "league_invitation_created",
      target: { type: "invitation", id: invitationId },
      before: {},
      after: { role, franchise_id: franchiseId, status: "pending" },
      materialDifferences: { access_invited: true },
      publicSummary: `${displayName} was invited as ${role.replace(/_/gu, " ")}.`,
      settingsVersionId,
    })),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

export async function executeAcceptLeagueInvitation(input: {
  command: LeagueCommand<"accept_league_invitation">;
  actorUserId: string;
  actorEmail?: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { season, revision } = await nativeSeasonState({ command, store });
  const { settingsVersionId, settings } = await activeSettings(store, command.leagueId, season);
  const invitationId = text(command.payload.invitationId);
  const token = text(command.payload.token);
  if (!invitationId.startsWith("invite-") || invitationId.includes("/") || token.length < 20) {
    throw new LeagueCommandFailure("invalid_invitation", "This invitation link is incomplete.");
  }
  const invitation = await store.get(invitationPath(command.leagueId, invitationId));
  if (!invitation || text(invitation.data.season_id) !== command.seasonId) throw new LeagueCommandFailure("invitation_not_found", "This league invitation is no longer available.", 404);
  if (text(invitation.data.status) !== "pending") throw new LeagueCommandFailure("invitation_closed", "This league invitation has already been used or revoked.", 409);
  if (Date.parse(text(invitation.data.expires_at)) <= Date.parse(processedAt)) throw new LeagueCommandFailure("invitation_expired", "This league invitation has expired.", 410);
  if (invitationTokenHash(token) !== text(invitation.data.token_hash)) throw new LeagueCommandFailure("invalid_invitation", "This invitation token is not valid.", 403);
  const invitedEmail = cleanEmail(invitation.data.email);
  const actorEmail = cleanEmail(input.actorEmail);
  if (!actorEmail || actorEmail !== invitedEmail) {
    throw new LeagueCommandFailure("invitation_email_mismatch", `Sign in with ${invitedEmail} to accept this invitation.`, 403);
  }
  const role = text(invitation.data.role) as LeagueInvitationRole;
  const franchiseId = text(invitation.data.franchise_id);
  if (!INVITATION_ROLES.has(role)) throw new LeagueCommandFailure("invalid_invitation_role", "This invitation has an unsupported role.", 409);
  if (role === "co_manager" && !settings.allowMultipleManagersPerTeam) throw new LeagueCommandFailure("co_managers_disabled", "Published league rules no longer allow co-managers.", 409);

  const [membership, allGrants] = await Promise.all([
    store.get(membershipPath(command.leagueId, actorUserId)),
    store.list(`leagues/${command.leagueId}/roleGrants`),
  ]);
  const actorTeamGrants = allGrants.filter((grant) => text(grant.data.user_id) === actorUserId && ["team_owner", "co_manager"].includes(text(grant.data.role)) && roleActive(grant, processedAt));
  if (role !== "co_commissioner" && !settings.allowMultipleTeamsPerUser && actorTeamGrants.some((grant) => text(grant.data.franchise_id) !== franchiseId)) {
    throw new LeagueCommandFailure("multiple_teams_disabled", "Published league rules allow each manager to control only one team.", 409);
  }
  if (role === "team_owner" && allGrants.some((grant) => text(grant.data.role) === "team_owner" && text(grant.data.franchise_id) === franchiseId && text(grant.data.user_id) !== actorUserId && roleActive(grant, processedAt))) {
    throw new LeagueCommandFailure("team_owner_exists", "Another manager accepted ownership of this team first.", 409);
  }
  const grantId = invitationGrantId(actorUserId, role, franchiseId);
  const existingGrant = await store.get(grantPath(command.leagueId, grantId));
  const nextRevision = revision + 1;
  const membershipGrantIds = Array.from(new Set([...stringList(membership?.data.role_grant_ids), grantId]));
  const displayName = text(invitation.data.display_name) || invitedEmail;
  const { receipt, auditEventId } = buildReceipt({
    command,
    actorUserId,
    requestHash,
    processedAt,
    previousRevision: revision,
    resultingRevision: nextRevision,
    result: { invitationId, role, franchiseId, membershipStatus: "active", grantId },
  });
  const grantRecord = {
    schema_version: 1,
    id: grantId,
    league_id: command.leagueId,
    user_id: actorUserId,
    role,
    franchise_id: franchiseId,
    permissions: [],
    effective_at: processedAt,
    expires_at: "",
    granted_by: text(invitation.data.created_by),
    revoked_at: "",
    revision: Math.max(0, wholeNumber(existingGrant?.data.revision)) + 1,
  };
  const membershipRecord = {
    schema_version: 1,
    league_id: command.leagueId,
    user_id: actorUserId,
    status: "active",
    joined_at: text(membership?.data.joined_at) || processedAt,
    revision: Math.max(0, wholeNumber(membership?.data.revision)) + 1,
    role_grant_ids: membershipGrantIds,
    display_name: displayName,
    email: invitedEmail,
  };
  const writes = [
    replaceWrite(store, invitation, invitationPath(command.leagueId, invitationId), {
      ...invitation.data,
      status: "accepted",
      accepted_by: actorUserId,
      accepted_at: processedAt,
      revision: wholeNumber(invitation.data.revision, 1) + 1,
    }),
    replaceWrite(store, membership, membershipPath(command.leagueId, actorUserId), membershipRecord),
    replaceWrite(store, existingGrant, grantPath(command.leagueId, grantId), grantRecord),
    updatedSeasonWrite(store, season, command.leagueId, command.seasonId, nextRevision, processedAt),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({
      command,
      actorUserId,
      processedAt,
      auditEventId,
      previousRevision: revision,
      resultingRevision: nextRevision,
      action: "league_invitation_accepted",
      target: { type: "membership", id: actorUserId },
      before: { status: text(membership?.data.status) },
      after: { status: "active", role, franchise_id: franchiseId },
      materialDifferences: { access_granted: true },
      publicSummary: `${displayName} joined as ${role.replace(/_/gu, " ")}.`,
      settingsVersionId,
    })),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

export async function executeRevokeLeagueInvitation(input: {
  command: LeagueCommand<"revoke_league_invitation">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { season, revision } = await managerState({ command, actorUserId, processedAt, store });
  const { settingsVersionId } = await activeSettings(store, command.leagueId, season);
  const invitationId = text(command.payload.invitationId);
  const invitation = invitationId && !invitationId.includes("/") ? await store.get(invitationPath(command.leagueId, invitationId)) : null;
  if (!invitation || text(invitation.data.status) !== "pending") throw new LeagueCommandFailure("invitation_closed", "That pending invitation is no longer available.", 409);
  const nextRevision = revision + 1;
  const { receipt, auditEventId } = buildReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: revision, resultingRevision: nextRevision, result: { invitationId, status: "revoked" } });
  const writes = [
    replaceWrite(store, invitation, invitationPath(command.leagueId, invitationId), {
      ...invitation.data,
      status: "revoked",
      revoked_by: actorUserId,
      revoked_at: processedAt,
      revision: wholeNumber(invitation.data.revision, 1) + 1,
    }),
    updatedSeasonWrite(store, season, command.leagueId, command.seasonId, nextRevision, processedAt),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({
      command,
      actorUserId,
      processedAt,
      auditEventId,
      previousRevision: revision,
      resultingRevision: nextRevision,
      action: "league_invitation_revoked",
      target: { type: "invitation", id: invitationId },
      before: { status: "pending" },
      after: { status: "revoked" },
      materialDifferences: { access_invited: false },
      publicSummary: `The invitation for ${text(invitation.data.display_name) || cleanEmail(invitation.data.email)} was revoked.`,
      settingsVersionId,
    })),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}

export async function executeRemoveLeagueMember(input: {
  command: LeagueCommand<"remove_league_member">;
  actorUserId: string;
  requestHash: string;
  processedAt: string;
  store: LeagueCommandStore;
}): Promise<LeagueCommandReceipt> {
  const { command, actorUserId, requestHash, processedAt, store } = input;
  const { season, revision, managerRoles } = await managerState({ command, actorUserId, processedAt, store });
  const { settingsVersionId } = await activeSettings(store, command.leagueId, season);
  const targetUserId = text(command.payload.userId);
  if (!targetUserId || targetUserId.includes("/")) throw new LeagueCommandFailure("invalid_member", "Choose a valid league member.");
  if (command.reason.trim().length < 5) throw new LeagueCommandFailure("reason_required", "Enter a clear audit reason before removing league access.");
  if (targetUserId === actorUserId) throw new LeagueCommandFailure("self_removal_denied", "Commissioners cannot remove their own active access here.", 409);
  const target = await activeRoleDocuments(store, command.leagueId, targetUserId, processedAt);
  if (!target.membership || text(target.membership.data.status) !== "active") throw new LeagueCommandFailure("member_not_found", "That active league member is no longer available.", 404);
  const targetRoles = new Set(target.grants.map((grant) => text(grant.data.role)));
  if (targetRoles.has("commissioner")) throw new LeagueCommandFailure("commissioner_removal_denied", "The primary commissioner must transfer ownership before leaving the league.", 409);
  if (targetRoles.has("co_commissioner") && !managerRoles.has("commissioner")) {
    throw new LeagueCommandFailure("permission_denied", "Only the primary commissioner can remove a co-commissioner.", 403);
  }
  const nextRevision = revision + 1;
  const displayName = text(target.membership.data.display_name) || text(target.membership.data.email) || "A league member";
  const { receipt, auditEventId } = buildReceipt({ command, actorUserId, requestHash, processedAt, previousRevision: revision, resultingRevision: nextRevision, result: { userId: targetUserId, status: "removed", revokedGrantCount: target.grants.length } });
  const writes: FirestoreWrite[] = [
    replaceWrite(store, target.membership, membershipPath(command.leagueId, targetUserId), {
      ...target.membership.data,
      status: "removed",
      revision: wholeNumber(target.membership.data.revision, 1) + 1,
      removed_at: processedAt,
      removed_by: actorUserId,
    }),
    ...target.grants.map((grant) => replaceWrite(store, grant, grantPath(command.leagueId, text(grant.data.id)), {
      ...grant.data,
      revoked_at: processedAt,
      revision: wholeNumber(grant.data.revision, 1) + 1,
    })),
    updatedSeasonWrite(store, season, command.leagueId, command.seasonId, nextRevision, processedAt),
    createOnlyWrite(store, auditPath(command.leagueId, auditEventId), auditRecord({
      command,
      actorUserId,
      processedAt,
      auditEventId,
      previousRevision: revision,
      resultingRevision: nextRevision,
      action: "league_member_removed",
      target: { type: "membership", id: targetUserId },
      before: { status: "active", roles: [...targetRoles] },
      after: { status: "removed", roles: [] },
      materialDifferences: { revoked_grant_count: target.grants.length },
      publicSummary: `${displayName} was removed from active league access.`,
      settingsVersionId,
    })),
    createOnlyWrite(store, commandPath(command.leagueId, command.commandId), receiptRecord(receipt)),
  ];
  const winner = await commitWithRevisionGuard({ store, writes, leagueId: command.leagueId, seasonId: command.seasonId, previousRevision: revision, commandId: command.commandId, requestHash, actorUserId });
  return winner ?? receipt;
}
