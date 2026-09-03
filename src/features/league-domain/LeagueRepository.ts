import type { CanonicalLeagueWorkspace, League } from "./types";

export type LeagueRouteResolution =
  | {
      status: "canonical";
      requestedId: string;
      canonicalLeagueId: string;
      legacyExternalLeagueId: string;
      league: League;
    }
  | {
      status: "legacy";
      requestedId: string;
      canonicalLeagueId: "";
      legacyExternalLeagueId: string;
      league: null;
    }
  | {
      status: "unavailable";
      requestedId: string;
      canonicalLeagueId: "";
      legacyExternalLeagueId: "";
      league: null;
    };

export interface LeagueRepository {
  resolveRouteId(routeId: string): Promise<LeagueRouteResolution>;
  getWorkspace(leagueId: string): Promise<CanonicalLeagueWorkspace | null>;
}
