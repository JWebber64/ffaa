import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import type {
  AuditEvent,
  LeagueInvitation,
  LeagueMembership,
  RoleGrant,
  SeasonTeam,
} from "../league-domain/types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeLeagueMembership(value: unknown, leagueId: string): LeagueMembership | null {
  const data = record(value);
  const userId = text(data.user_id);
  const status = text(data.status);
  if (!userId || text(data.league_id) !== leagueId || !["invited", "requested", "active", "suspended", "removed"].includes(status)) return null;
  return {
    leagueId,
    userId,
    status: status as LeagueMembership["status"],
    joinedAt: text(data.joined_at) || null,
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    roleGrantIds: strings(data.role_grant_ids),
    displayName: text(data.display_name),
    email: text(data.email),
  };
}

export function normalizeLeagueRoleGrant(value: unknown, leagueId: string): RoleGrant | null {
  const data = record(value);
  const id = text(data.id);
  const role = text(data.role);
  if (!id || text(data.league_id) !== leagueId || ![
    "commissioner",
    "co_commissioner",
    "team_owner",
    "co_manager",
    "moderator",
    "scheduler",
    "treasurer",
    "historian",
    "read_only_guest",
  ].includes(role)) return null;
  return {
    id,
    leagueId,
    userId: text(data.user_id),
    role: role as RoleGrant["role"],
    franchiseId: text(data.franchise_id) || null,
    permissions: strings(data.permissions),
    effectiveAt: text(data.effective_at),
    expiresAt: text(data.expires_at) || null,
    grantedBy: text(data.granted_by),
    revokedAt: text(data.revoked_at) || null,
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
  };
}

export function normalizeSeasonTeam(value: unknown, leagueId: string, seasonId: string): SeasonTeam | null {
  const data = record(value);
  const id = text(data.id);
  const franchiseId = text(data.franchise_id);
  if (!id || !franchiseId || text(data.league_id) !== leagueId || text(data.season_id) !== seasonId) return null;
  const colors = record(data.colors);
  const budget = record(data.budget);
  const cap = record(data.cap);
  return {
    id,
    leagueId,
    seasonId,
    franchiseId,
    name: text(data.name) || "Unnamed team",
    logoUrl: text(data.logo_url) || null,
    colors: { primary: text(colors.primary), secondary: text(colors.secondary) },
    divisionId: text(data.division_id) || null,
    draftPosition: numberValue(data.draft_position) || null,
    budget: Object.keys(budget).length ? {
      initial: numberValue(budget.initial),
      remaining: numberValue(budget.remaining),
      currency: text(budget.currency) || "USD",
    } : null,
    cap: Object.keys(cap).length ? {
      limit: numberValue(cap.limit),
      committed: numberValue(cap.committed),
      dead: numberValue(cap.dead),
    } : null,
    rosterRevision: Math.max(1, Math.round(numberValue(data.roster_revision, 1))),
    status: text(data.status) === "retired" ? "retired" : "active",
  };
}

export function normalizeLeagueInvitation(value: unknown, leagueId: string): LeagueInvitation | null {
  const data = record(value);
  const id = text(data.id);
  const role = text(data.role);
  const status = text(data.status);
  if (!id || text(data.league_id) !== leagueId || !["team_owner", "co_manager", "co_commissioner"].includes(role) || !["pending", "accepted", "revoked", "expired"].includes(status)) return null;
  return {
    id,
    leagueId,
    seasonId: text(data.season_id),
    email: text(data.email),
    displayName: text(data.display_name),
    role: role as LeagueInvitation["role"],
    franchiseId: text(data.franchise_id) || null,
    status: status as LeagueInvitation["status"],
    createdBy: text(data.created_by),
    createdAt: text(data.created_at),
    expiresAt: text(data.expires_at),
    acceptedBy: text(data.accepted_by) || null,
    acceptedAt: text(data.accepted_at) || null,
    revokedBy: text(data.revoked_by) || null,
    revokedAt: text(data.revoked_at) || null,
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
  };
}

function normalizeAuditEvent(value: unknown, leagueId: string): AuditEvent | null {
  const data = record(value);
  const id = text(data.id);
  if (!id || text(data.league_id) !== leagueId) return null;
  return {
    id,
    leagueId,
    seasonId: text(data.season_id),
    actorUserId: text(data.actor_user_id),
    action: text(data.action),
    target: { type: text(record(data.target).type), id: text(record(data.target).id) },
    timestamp: text(data.timestamp),
    previousRevision: numberValue(data.previous_revision),
    resultingRevision: numberValue(data.resulting_revision),
    before: data.before,
    after: data.after,
    materialDifferences: data.material_differences,
    reason: text(data.reason) || null,
    settingsVersionId: text(data.settings_version_id),
    commandId: text(data.command_id),
    transactionId: text(data.transaction_id) || null,
    publicSummary: text(data.public_summary),
    privateMetadata: Object.keys(record(data.private_metadata)).length ? record(data.private_metadata) : null,
    reversalOfAuditEventId: text(data.reversal_of_audit_event_id) || null,
  };
}

export type LeaguePeopleSnapshot = {
  teams: SeasonTeam[];
  memberships: LeagueMembership[];
  roleGrants: RoleGrant[];
  invitations: LeagueInvitation[];
  recentAuditEvents: AuditEvent[];
};

export async function loadLeaguePeople(leagueId: string, seasonId: string): Promise<LeaguePeopleSnapshot> {
  const [teams, memberships, grants, invitations, audits] = await Promise.all([
    getDocs(collection(firestore, "leagues", leagueId, "seasons", seasonId, "seasonTeams")),
    getDocs(collection(firestore, "leagues", leagueId, "memberships")),
    getDocs(collection(firestore, "leagues", leagueId, "roleGrants")),
    getDocs(collection(firestore, "leagues", leagueId, "invitations")),
    getDocs(query(collection(firestore, "leagues", leagueId, "auditEvents"), orderBy("timestamp", "desc"), limit(8))),
  ]);
  return {
    teams: teams.docs.map((document) => normalizeSeasonTeam(document.data(), leagueId, seasonId)).filter((team): team is SeasonTeam => Boolean(team)).filter((team) => team.status === "active").sort((left, right) => (left.draftPosition ?? 999) - (right.draftPosition ?? 999)),
    memberships: memberships.docs.map((document) => normalizeLeagueMembership(document.data(), leagueId)).filter((membership): membership is LeagueMembership => Boolean(membership)),
    roleGrants: grants.docs.map((document) => normalizeLeagueRoleGrant(document.data(), leagueId)).filter((grant): grant is RoleGrant => Boolean(grant)),
    invitations: invitations.docs.map((document) => normalizeLeagueInvitation(document.data(), leagueId)).filter((invitation): invitation is LeagueInvitation => Boolean(invitation)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    recentAuditEvents: audits.docs.map((document) => normalizeAuditEvent(document.data(), leagueId)).filter((event): event is AuditEvent => Boolean(event)),
  };
}
