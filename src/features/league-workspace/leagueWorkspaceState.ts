import { createContext, useContext } from "react";

import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";
import type { CanonicalLeagueWorkspace, LeagueAuthority } from "../league-domain/types";
import type { MyHQData } from "../my-hq/myHQ";

export type LeagueWorkspaceTeamState =
  | { status: "idle" | "loading"; data: null; error: "" }
  | { status: "ready"; data: MyHQData; error: "" }
  | { status: "error"; data: null; error: string };

export type LeagueWorkspaceValue = {
  leagueId: string;
  routeLeagueId: string;
  dataLeagueId: string;
  connection: SleeperLeagueConnectionSummary | null;
  connections: SleeperLeagueConnectionSummary[];
  canonicalWorkspace: CanonicalLeagueWorkspace | null;
  authority: LeagueAuthority | null;
  routeState: {
    status: "loading" | "ready" | "error";
    message: string;
  };
  teamState: LeagueWorkspaceTeamState;
  capabilities: {
    canManage: boolean;
    canSaveLineup: boolean;
    source: "gamehq" | null;
    status: "loading" | "ready";
  };
  switchLeague: (leagueId: string) => void;
  refreshWorkspace: () => void;
};

export const LeagueWorkspaceContext = createContext<LeagueWorkspaceValue | null>(null);

export function useLeagueWorkspace() {
  const value = useContext(LeagueWorkspaceContext);
  if (!value) throw new Error("useLeagueWorkspace must be used inside LeagueWorkspaceProvider.");
  return value;
}

export function useOptionalLeagueWorkspace() {
  return useContext(LeagueWorkspaceContext);
}
