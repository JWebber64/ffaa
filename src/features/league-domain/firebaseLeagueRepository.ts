import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { firebaseAuth, firestore } from "../../lib/firebase";
import { resolveLeagueAuthority } from "./authority";
import type { LeagueRepository, LeagueRouteResolution } from "./LeagueRepository";
import {
  externalLeagueMappingId,
  isGamehqLeagueId,
  type CanonicalLeagueWorkspace,
  type ExternalConnection,
  type League,
  type LeagueMembership,
  type RoleGrant,
  type Season,
  type SettingsVersion,
} from "./types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeCanonicalLeague(value: unknown, expectedId = ""): League | null {
  const data = recordValue(value);
  const id = text(data.id);
  if (!isGamehqLeagueId(id) || (expectedId && id !== expectedId)) return null;
  const colors = recordValue(data.colors);
  const authorityMode = text(data.authority_mode);
  const migrationState = text(data.migration_state);
  if (![
    "native",
    "connected_read_only",
    "migration_preview",
    "mirror",
  ].includes(authorityMode)) return null;
  if (![
    "mapped_read_only",
    "migration_preview",
    "legacy_backed_native",
    "canonical_active",
    "migration_failed",
  ].includes(migrationState)) return null;
  return {
    id,
    name: text(data.name) || "GameHQ League",
    abbreviation: text(data.abbreviation),
    logoUrl: text(data.logo_url) || null,
    colors: { primary: text(colors.primary), secondary: text(colors.secondary) },
    timezone: text(data.timezone) || "UTC",
    status: (["draft", "active", "paused", "archived"].includes(text(data.status)) ? text(data.status) : "draft") as League["status"],
    currentSeasonId: text(data.current_season_id) || null,
    createdBy: text(data.created_by),
    createdAt: text(data.created_at),
    updatedAt: text(data.updated_at),
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    authorityMode: authorityMode as League["authorityMode"],
    migrationState: migrationState as League["migrationState"],
  };
}

function normalizeSeason(value: unknown, leagueId: string, expectedId: string): Season | null {
  const data = recordValue(value);
  const id = text(data.id);
  if (!id || id !== expectedId || text(data.league_id) !== leagueId) return null;
  return {
    id,
    leagueId,
    year: Math.round(numberValue(data.year, new Date().getUTCFullYear())),
    phase: (["setup", "draft", "regular_season", "playoffs", "complete", "archived"].includes(text(data.phase)) ? text(data.phase) : "setup") as Season["phase"],
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    settingsVersionId: text(data.settings_version_id),
    draftSettingsVersionId: text(data.draft_settings_version_id),
    draftId: text(data.draft_id) || null,
    scheduleVersionId: text(data.schedule_version_id) || null,
    startAt: text(data.start_at) || null,
    endAt: text(data.end_at) || null,
    legacySourceLeagueId: text(data.legacy_source_league_id) || null,
    championFranchiseId: text(data.champion_franchise_id) || null,
    runnerUpFranchiseId: text(data.runner_up_franchise_id) || null,
  };
}

export function normalizeSettingsVersion(value: unknown, leagueId: string, expectedId = ""): SettingsVersion | null {
  const data = recordValue(value);
  const id = text(data.id);
  const status = text(data.status);
  if (!id || (expectedId && id !== expectedId) || text(data.league_id) !== leagueId || !["draft", "published", "superseded"].includes(status)) return null;
  return {
    id,
    leagueId,
    seasonId: text(data.season_id),
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    status: status as SettingsVersion["status"],
    effectiveAt: text(data.effective_at),
    settings: recordValue(data.settings),
    publishedBy: text(data.published_by) || null,
    publishedAt: text(data.published_at) || null,
    createdAt: text(data.created_at),
    updatedAt: text(data.updated_at),
  };
}

export async function getSettingsVersion(leagueId: string, settingsVersionId: string) {
  if (!leagueId || !settingsVersionId) return null;
  const snapshot = await getDoc(doc(firestore, "leagues", leagueId, "settingsVersions", settingsVersionId));
  return snapshot.exists() ? normalizeSettingsVersion(snapshot.data(), leagueId, settingsVersionId) : null;
}

export async function listSettingsVersions(leagueId: string) {
  if (!leagueId) return [];
  const snapshot = await getDocs(collection(firestore, "leagues", leagueId, "settingsVersions"));
  return snapshot.docs
    .map((document) => normalizeSettingsVersion(document.data(), leagueId, document.id))
    .filter((version): version is SettingsVersion => Boolean(version))
    .sort((left, right) => right.revision - left.revision || right.createdAt.localeCompare(left.createdAt));
}

function normalizeMembership(value: unknown, leagueId: string, userId: string): LeagueMembership | null {
  const data = recordValue(value);
  if (text(data.league_id) !== leagueId || text(data.user_id) !== userId) return null;
  const status = text(data.status);
  if (!["invited", "requested", "active", "suspended", "removed"].includes(status)) return null;
  return {
    leagueId,
    userId,
    status: status as LeagueMembership["status"],
    joinedAt: text(data.joined_at) || null,
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    roleGrantIds: stringArray(data.role_grant_ids),
    displayName: text(data.display_name),
    email: text(data.email),
  };
}

function normalizeRoleGrant(value: unknown, leagueId: string, expectedId: string): RoleGrant | null {
  const data = recordValue(value);
  const id = text(data.id);
  const role = text(data.role);
  if (id !== expectedId || text(data.league_id) !== leagueId || ![
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
    permissions: stringArray(data.permissions),
    effectiveAt: text(data.effective_at),
    expiresAt: text(data.expires_at) || null,
    grantedBy: text(data.granted_by),
    revokedAt: text(data.revoked_at) || null,
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
  };
}

function normalizeExternalConnection(value: unknown, leagueId: string): ExternalConnection | null {
  const data = recordValue(value);
  const provider = text(data.provider);
  const mode = text(data.mode);
  if (text(data.league_id) !== leagueId || !["sleeper", "yahoo", "espn", "cbs"].includes(provider) || !["read_only", "mirror", "migration_preview"].includes(mode)) return null;
  return {
    id: text(data.id),
    leagueId,
    provider: provider as ExternalConnection["provider"],
    externalLeagueId: text(data.external_league_id),
    mode: mode as ExternalConnection["mode"],
    permissions: stringArray(data.permissions),
    lastSyncAt: text(data.last_sync_at) || null,
    syncStatus: (["never", "syncing", "ready", "stale", "error"].includes(text(data.sync_status)) ? text(data.sync_status) : "never") as ExternalConnection["syncStatus"],
    importMetadata: recordValue(data.import_metadata),
    createdAt: text(data.created_at),
    updatedAt: text(data.updated_at),
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
  };
}

async function canonicalLeague(leagueId: string) {
  const snapshot = await getDoc(doc(firestore, "leagues", leagueId));
  return snapshot.exists() ? normalizeCanonicalLeague(snapshot.data(), leagueId) : null;
}

export const firebaseLeagueRepository: LeagueRepository = {
  async resolveRouteId(routeId): Promise<LeagueRouteResolution> {
    const requestedId = routeId.trim();
    if (!requestedId) return { status: "unavailable", requestedId, canonicalLeagueId: "", legacyExternalLeagueId: "", league: null };
    if (isGamehqLeagueId(requestedId)) {
      const league = await canonicalLeague(requestedId);
      if (!league) return { status: "unavailable", requestedId, canonicalLeagueId: "", legacyExternalLeagueId: "", league: null };
      const connectionSnapshot = await getDoc(doc(firestore, "leagues", league.id, "externalConnections", "sleeper"));
      const connection = connectionSnapshot.exists() ? normalizeExternalConnection(connectionSnapshot.data(), league.id) : null;
      return {
        status: "canonical",
        requestedId,
        canonicalLeagueId: league.id,
        legacyExternalLeagueId: connection?.externalLeagueId ?? "",
        league,
      };
    }

    const mappingSnapshot = await getDoc(doc(firestore, "externalLeagueMappings", externalLeagueMappingId("sleeper", requestedId)));
    if (!mappingSnapshot.exists()) {
      return { status: "legacy", requestedId, canonicalLeagueId: "", legacyExternalLeagueId: requestedId, league: null };
    }
    const mappedLeagueId = text(mappingSnapshot.data().league_id);
    const league = isGamehqLeagueId(mappedLeagueId) ? await canonicalLeague(mappedLeagueId) : null;
    if (!league) return { status: "legacy", requestedId, canonicalLeagueId: "", legacyExternalLeagueId: requestedId, league: null };
    return {
      status: "canonical",
      requestedId,
      canonicalLeagueId: league.id,
      legacyExternalLeagueId: requestedId,
      league,
    };
  },

  async getWorkspace(leagueId): Promise<CanonicalLeagueWorkspace | null> {
    const league = await canonicalLeague(leagueId);
    if (!league) return null;
    const user = firebaseAuth.currentUser;
    const permanentUserId = user && !user.isAnonymous ? user.uid : "";
    const [seasonSnapshot, connectionSnapshot, membershipSnapshot] = await Promise.all([
      league.currentSeasonId
        ? getDoc(doc(firestore, "leagues", league.id, "seasons", league.currentSeasonId))
        : Promise.resolve(null),
      getDoc(doc(firestore, "leagues", league.id, "externalConnections", "sleeper")),
      permanentUserId
        ? getDoc(doc(firestore, "leagues", league.id, "memberships", permanentUserId))
        : Promise.resolve(null),
    ]);
    const season = seasonSnapshot?.exists() ? normalizeSeason(seasonSnapshot.data(), league.id, league.currentSeasonId ?? "") : null;
    const connection = connectionSnapshot.exists() ? normalizeExternalConnection(connectionSnapshot.data(), league.id) : null;
    const membership = membershipSnapshot?.exists() ? normalizeMembership(membershipSnapshot.data(), league.id, permanentUserId) : null;
    const grants = membership
      ? (await Promise.all(membership.roleGrantIds.map(async (grantId) => {
          const snapshot = await getDoc(doc(firestore, "leagues", league.id, "roleGrants", grantId));
          return snapshot.exists() ? normalizeRoleGrant(snapshot.data(), league.id, grantId) : null;
        }))).filter((grant): grant is RoleGrant => Boolean(grant))
      : [];
    return {
      league,
      season,
      connection,
      membership,
      roleGrants: grants,
      authority: resolveLeagueAuthority({ league, membership, roleGrants: grants, connection }),
    };
  },
};
