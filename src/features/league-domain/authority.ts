import type {
  ExternalConnection,
  League,
  LeagueAuthority,
  LeagueAuthorityLabel,
  LeagueAuthorityMode,
  LeagueMembership,
  LeagueRole,
  RoleGrant,
} from "./types";

export const LEAGUE_PERMISSIONS = {
  manageLeague: "league.manage",
  manageSettings: "settings.manage",
  manageTeams: "teams.manage",
  saveLineup: "lineup.save",
  overrideLineup: "lineup.override",
  viewAudit: "audit.view",
} as const;

const ROLE_PERMISSIONS: Record<LeagueRole, string[]> = {
  commissioner: Object.values(LEAGUE_PERMISSIONS),
  co_commissioner: Object.values(LEAGUE_PERMISSIONS),
  team_owner: [LEAGUE_PERMISSIONS.saveLineup],
  co_manager: [LEAGUE_PERMISSIONS.saveLineup],
  moderator: [],
  scheduler: [],
  treasurer: [],
  historian: [LEAGUE_PERMISSIONS.viewAudit],
  read_only_guest: [],
};

export function leagueRoleGrantIsActive(grant: RoleGrant, now = new Date()) {
  if (grant.revokedAt) return false;
  const effectiveAt = Date.parse(grant.effectiveAt);
  if (Number.isFinite(effectiveAt) && effectiveAt > now.getTime()) return false;
  if (!grant.expiresAt) return true;
  const expiresAt = Date.parse(grant.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt > now.getTime();
}

export function authorityLabel(mode: LeagueAuthorityMode): LeagueAuthorityLabel {
  if (mode === "native") return "Native GameHQ League — read/write";
  if (mode === "migration_preview") return "Migration Preview";
  if (mode === "mirror") return "Mirror Mode";
  return "Connected Sleeper League — read-only";
}

export function resolveLeagueAuthority(input: {
  league: League;
  membership: LeagueMembership | null;
  roleGrants: RoleGrant[];
  connection: ExternalConnection | null;
  now?: Date;
}): LeagueAuthority {
  const now = input.now ?? new Date();
  const membershipActive = input.membership?.status === "active";
  const activeGrants = membershipActive
    ? input.roleGrants.filter((grant) => grant.leagueId === input.league.id && leagueRoleGrantIsActive(grant, now))
    : [];
  const permissions = Array.from(new Set(activeGrants.flatMap((grant) => [
    ...(ROLE_PERMISSIONS[grant.role] ?? []),
    ...grant.permissions,
  ]))).sort();
  const roles = Array.from(new Set(activeGrants.map((grant) => grant.role)));
  const providerReadOnly = input.league.authorityMode === "connected_read_only";

  return {
    label: authorityLabel(input.league.authorityMode),
    mode: input.league.authorityMode,
    canRead: true,
    canManage: !providerReadOnly && permissions.includes(LEAGUE_PERMISSIONS.manageLeague),
    canSaveLineup: !providerReadOnly && permissions.includes(LEAGUE_PERMISSIONS.saveLineup),
    permissions,
    roles,
    source: providerReadOnly && input.connection ? "external" : "gamehq",
  };
}
