import { describe, expect, it } from "vitest";

import { resolveLeagueAuthority } from "../features/league-domain/authority";
import { externalLeagueMappingId, isGamehqLeagueId, type League } from "../features/league-domain/types";
import { replaceLeagueRouteId } from "../features/league-workspace/legacyLeagueRouteAdapter";

const league: League = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Native Test League",
  abbreviation: "NTL",
  logoUrl: null,
  colors: { primary: "", secondary: "" },
  timezone: "Asia/Taipei",
  status: "active",
  currentSeasonId: "22222222-2222-4222-8222-222222222222",
  createdBy: "commissioner-1",
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  revision: 1,
  authorityMode: "native",
  migrationState: "canonical_active",
};

describe("native league identity and route compatibility", () => {
  it("accepts GameHQ UUIDs independently from provider-specific numeric IDs", () => {
    expect(isGamehqLeagueId(league.id)).toBe(true);
    expect(isGamehqLeagueId("1385319428408774656")).toBe(false);
    expect(externalLeagueMappingId("sleeper", "1385319428408774656")).toBe("sleeper__1385319428408774656");
  });

  it("preserves the old route tail while replacing only league identity", () => {
    expect(replaceLeagueRouteId(
      "/league/1385319428408774656/history/week/7",
      "1385319428408774656",
      league.id,
    )).toBe(`/league/${league.id}/history/week/7`);
  });
});

describe("GameHQ authority", () => {
  it("uses active role grants and ignores revoked, expired, and external ownership", () => {
    const authority = resolveLeagueAuthority({
      league,
      membership: {
        leagueId: league.id,
        userId: "manager-1",
        status: "active",
        joinedAt: "2026-09-01T00:00:00.000Z",
        revision: 1,
        roleGrantIds: ["active", "revoked", "expired"],
      },
      roleGrants: [
        {
          id: "active",
          leagueId: league.id,
          userId: "manager-1",
          role: "team_owner",
          franchiseId: "franchise-1",
          permissions: [],
          effectiveAt: "2026-09-01T00:00:00.000Z",
          expiresAt: null,
          grantedBy: "commissioner-1",
          revokedAt: null,
          revision: 1,
        },
        {
          id: "revoked",
          leagueId: league.id,
          userId: "manager-1",
          role: "commissioner",
          franchiseId: null,
          permissions: [],
          effectiveAt: "2026-09-01T00:00:00.000Z",
          expiresAt: null,
          grantedBy: "commissioner-1",
          revokedAt: "2026-09-01T12:00:00.000Z",
          revision: 2,
        },
        {
          id: "expired",
          leagueId: league.id,
          userId: "manager-1",
          role: "co_commissioner",
          franchiseId: null,
          permissions: [],
          effectiveAt: "2026-08-01T00:00:00.000Z",
          expiresAt: "2026-08-31T00:00:00.000Z",
          grantedBy: "commissioner-1",
          revokedAt: null,
          revision: 1,
        },
      ],
      connection: {
        id: "sleeper",
        leagueId: league.id,
        provider: "sleeper",
        externalLeagueId: "1385319428408774656",
        mode: "mirror",
        permissions: ["owner"],
        lastSyncAt: null,
        syncStatus: "ready",
        importMetadata: { providerOwnerId: "manager-1" },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        revision: 1,
      },
      now: new Date("2026-09-02T00:00:00.000Z"),
    });
    expect(authority.roles).toEqual(["team_owner"]);
    expect(authority.canSaveLineup).toBe(true);
    expect(authority.canManage).toBe(false);
    expect(authority.source).toBe("gamehq");
  });

  it("makes connected read-only leagues non-writable even with a GameHQ grant", () => {
    const authority = resolveLeagueAuthority({
      league: { ...league, authorityMode: "connected_read_only", migrationState: "mapped_read_only" },
      membership: {
        leagueId: league.id,
        userId: "commissioner-1",
        status: "active",
        joinedAt: null,
        revision: 1,
        roleGrantIds: ["commissioner"],
      },
      roleGrants: [{
        id: "commissioner",
        leagueId: league.id,
        userId: "commissioner-1",
        role: "commissioner",
        franchiseId: null,
        permissions: [],
        effectiveAt: "2026-09-01T00:00:00.000Z",
        expiresAt: null,
        grantedBy: "commissioner-1",
        revokedAt: null,
        revision: 1,
      }],
      connection: null,
    });
    expect(authority.canManage).toBe(false);
    expect(authority.canSaveLineup).toBe(false);
    expect(authority.label).toBe("Connected Sleeper League — read-only");
  });
});
