import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { loadSleeperPlayerDirectory } from "../../data/sleeperPlayerDirectory";
import {
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../league-hq/sleeperConnections";
import { loadMyHQ, type MyHQData } from "../my-hq/myHQ";
import { useLeagueSeasonManagement } from "../league-season/useLeagueSeasonManagement";
import {
  LeagueWorkspaceContext,
  type LeagueWorkspaceTeamState,
  type LeagueWorkspaceValue,
} from "./leagueWorkspaceState";

function snapshotChanged(connection: SleeperLeagueConnectionSummary, data: MyHQData) {
  return connection.managerTeamName !== data.teamName
    || connection.managerRecord !== data.record
    || connection.managerStanding !== data.standing
    || connection.currentWeek !== data.week
    || connection.opponentName !== data.opponentName
    || connection.leagueOwnerProviderUserId !== data.leagueOwnerProviderUserId;
}

export function LeagueWorkspaceProvider({ children }: { children: ReactNode }) {
  const { leagueId: routeLeagueId = "" } = useParams();
  const navigate = useNavigate();
  const {
    connections,
    activeLeagueId,
    rememberConnection,
    setActiveLeagueId,
  } = useSleeperLeagueConnections();
  const leagueId = routeLeagueId || activeLeagueId;
  const connection = connections.find((candidate) => candidate.leagueId === leagueId) ?? null;
  const management = useLeagueSeasonManagement(leagueId);
  const scoring = connection?.auctionSettings?.scoring ?? "halfPpr";
  const players = useMemo(() => buildCurrentToolPlayers(scoring), [scoring]);
  const [teamState, setTeamState] = useState<LeagueWorkspaceTeamState>({
    status: connection ? "loading" : "idle",
    data: null,
    error: "",
  });
  const managerProviderUserId = connection?.managerProviderUserId ?? "";
  const connectionRef = useRef(connection);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    if (!leagueId || !connections.some((candidate) => candidate.leagueId === leagueId)) return;
    if (activeLeagueId !== leagueId) setActiveLeagueId(leagueId);
  }, [activeLeagueId, connections, leagueId, setActiveLeagueId]);

  useEffect(() => {
    const currentConnection = connectionRef.current;
    if (!currentConnection || currentConnection.leagueId !== leagueId) {
      setTeamState({ status: "idle", data: null, error: "" });
      return;
    }

    const controller = new AbortController();
    setTeamState({ status: "loading", data: null, error: "" });
    void loadSleeperPlayerDirectory()
      .catch(() => [])
      .then((sleeperRows) => loadMyHQ(
        currentConnection,
        sleeperRows.length ? buildCurrentToolPlayers(scoring, [], {}, sleeperRows) : players,
        controller.signal,
        sleeperRows,
      ))
      .then((data) => {
        setTeamState({ status: "ready", data, error: "" });
        if (snapshotChanged(currentConnection, data)) {
          rememberConnection({
            ...currentConnection,
            managerTeamName: data.teamName,
            managerRecord: data.record,
            managerStanding: data.standing,
            currentWeek: data.week,
            opponentName: data.opponentName,
            ...(data.leagueOwnerProviderUserId
              ? { leagueOwnerProviderUserId: data.leagueOwnerProviderUserId }
              : {}),
            teamSnapshotAt: new Date().toISOString(),
          });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTeamState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "The active team could not be loaded.",
        });
      });

    return () => controller.abort();
  }, [connection?.leagueId, leagueId, managerProviderUserId, players, rememberConnection, scoring]);

  const value = useMemo<LeagueWorkspaceValue>(() => ({
    leagueId,
    connection,
    connections,
    teamState,
    capabilities: {
      canManage: Boolean(
        (management.record && management.record.commissionerUserId === management.currentUserId)
        || (connection?.managerProviderUserId
          && connection.managerProviderUserId === connection.leagueOwnerProviderUserId),
      ),
      source: management.record && management.record.commissionerUserId === management.currentUserId
        ? "gamehq"
        : connection?.managerProviderUserId
          && connection.managerProviderUserId === connection.leagueOwnerProviderUserId
          ? "sleeper"
          : null,
      status: management.status === "idle" || management.status === "loading" ? "loading" : "ready",
    },
    switchLeague: (nextLeagueId: string) => {
      if (!connections.some((candidate) => candidate.leagueId === nextLeagueId)) return;
      setActiveLeagueId(nextLeagueId);
      navigate(`/league/${encodeURIComponent(nextLeagueId)}/team`);
    },
  }), [connection, connections, leagueId, management.currentUserId, management.record, management.status, navigate, setActiveLeagueId, teamState]);

  return <LeagueWorkspaceContext.Provider value={value}>{children}</LeagueWorkspaceContext.Provider>;
}
