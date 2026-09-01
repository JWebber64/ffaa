import { createContext, useContext } from "react";

import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";
import type { MyHQData } from "../my-hq/myHQ";

export type LeagueWorkspaceTeamState =
  | { status: "idle" | "loading"; data: null; error: "" }
  | { status: "ready"; data: MyHQData; error: "" }
  | { status: "error"; data: null; error: string };

export type LeagueWorkspaceValue = {
  leagueId: string;
  connection: SleeperLeagueConnectionSummary | null;
  connections: SleeperLeagueConnectionSummary[];
  teamState: LeagueWorkspaceTeamState;
  capabilities: {
    canManage: boolean;
    source: "gamehq" | "sleeper" | null;
    status: "loading" | "ready";
  };
  switchLeague: (leagueId: string) => void;
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
