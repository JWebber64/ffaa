export type LeagueStatus = "draft" | "active" | "paused" | "archived";
export type LeagueMigrationState =
  | "mapped_read_only"
  | "migration_preview"
  | "legacy_backed_native"
  | "canonical_active"
  | "migration_failed";

export type LeagueAuthorityMode = "native" | "connected_read_only" | "migration_preview" | "mirror";

export type League = {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  timezone: string;
  status: LeagueStatus;
  currentSeasonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  authorityMode: LeagueAuthorityMode;
  migrationState: LeagueMigrationState;
};

export type SeasonPhase = "setup" | "draft" | "regular_season" | "playoffs" | "complete" | "archived";

export type Season = {
  id: string;
  leagueId: string;
  year: number;
  phase: SeasonPhase;
  revision: number;
  settingsVersionId: string;
  draftSettingsVersionId: string;
  draftId: string | null;
  scheduleVersionId: string | null;
  startAt: string | null;
  endAt: string | null;
  legacySourceLeagueId: string | null;
};

export type Franchise = {
  id: string;
  leagueId: string;
  createdAt: string;
  retiredAt: string | null;
  legacyFranchiseId: string | null;
};

export type SeasonTeam = {
  id: string;
  leagueId: string;
  seasonId: string;
  franchiseId: string;
  name: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  divisionId: string | null;
  draftPosition: number | null;
  budget: { initial: number; remaining: number; currency: string } | null;
  cap: { limit: number; committed: number; dead: number } | null;
  rosterRevision: number;
  status: "active" | "retired";
};

export type LeagueMembershipStatus = "invited" | "requested" | "active" | "suspended" | "removed";

export type LeagueMembership = {
  leagueId: string;
  userId: string;
  status: LeagueMembershipStatus;
  joinedAt: string | null;
  revision: number;
  roleGrantIds: string[];
  displayName: string;
  email: string;
};

export type LeagueRole =
  | "commissioner"
  | "co_commissioner"
  | "team_owner"
  | "co_manager"
  | "moderator"
  | "scheduler"
  | "treasurer"
  | "historian"
  | "read_only_guest";

export type RoleGrant = {
  id: string;
  leagueId: string;
  userId: string;
  role: LeagueRole;
  franchiseId: string | null;
  permissions: string[];
  effectiveAt: string;
  expiresAt: string | null;
  grantedBy: string;
  revokedAt: string | null;
  revision: number;
};

export type LeagueInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type LeagueInvitationRole = "team_owner" | "co_manager" | "co_commissioner";

export type LeagueInvitation = {
  id: string;
  leagueId: string;
  seasonId: string;
  email: string;
  displayName: string;
  role: LeagueInvitationRole;
  franchiseId: string | null;
  status: LeagueInvitationStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  revision: number;
};

export type ExternalProvider = "sleeper" | "yahoo" | "espn" | "cbs";
export type ExternalConnectionMode = "read_only" | "mirror" | "migration_preview";

export type ExternalConnection = {
  id: string;
  leagueId: string;
  provider: ExternalProvider;
  externalLeagueId: string;
  mode: ExternalConnectionMode;
  permissions: string[];
  lastSyncAt: string | null;
  syncStatus: "never" | "syncing" | "ready" | "stale" | "error";
  importMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type SettingsVersion = {
  id: string;
  leagueId: string;
  seasonId: string;
  revision: number;
  status: "draft" | "published" | "superseded";
  effectiveAt: string;
  settings: Record<string, unknown>;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  leagueId: string;
  seasonId: string;
  actorUserId: string;
  action: string;
  target: { type: string; id: string };
  timestamp: string;
  previousRevision: number;
  resultingRevision: number;
  before: unknown;
  after: unknown;
  materialDifferences: unknown;
  reason: string | null;
  settingsVersionId: string;
  commandId: string;
  transactionId: string | null;
  publicSummary: string;
  privateMetadata: Record<string, unknown> | null;
  reversalOfAuditEventId: string | null;
};

export type LeagueAuthorityLabel =
  | "Native GameHQ League — read/write"
  | "Connected Sleeper League — read-only"
  | "Migration Preview"
  | "Mirror Mode";

export type LeagueAuthority = {
  label: LeagueAuthorityLabel;
  mode: LeagueAuthorityMode;
  canRead: boolean;
  canManage: boolean;
  canSaveLineup: boolean;
  permissions: string[];
  roles: LeagueRole[];
  source: "gamehq" | "external";
};

export type CanonicalLeagueWorkspace = {
  league: League;
  season: Season | null;
  connection: ExternalConnection | null;
  membership: LeagueMembership | null;
  roleGrants: RoleGrant[];
  authority: LeagueAuthority;
};

export function isGamehqLeagueId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.trim());
}

export function createGamehqLeagueId() {
  return crypto.randomUUID();
}

export function externalLeagueMappingId(provider: ExternalProvider, externalLeagueId: string) {
  return `${provider}__${encodeURIComponent(externalLeagueId.trim()).replace(/%/gu, "_")}`;
}
