import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { loadSleeperPlayerDirectory } from "../../data/sleeperPlayerDirectory";
import {
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../league-hq/sleeperConnections";
import { loadMyHQ, type MyHQData } from "../my-hq/myHQ";
import { useLeagueSeasonManagement } from "../league-season/useLeagueSeasonManagement";
import { firebaseLeagueRepository } from "../league-domain/firebaseLeagueRepository";
import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { useFirebaseSession } from "../../lib/useFirebaseSession";
import { ensureFirebaseSession } from "../../lib/authSession";
import { replaceLeagueRouteId } from "./legacyLeagueRouteAdapter";
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
  const location = useLocation();
  const locationRef = useRef(location);
  const session = useFirebaseSession();
  const {
    connections,
    activeLeagueId,
    rememberConnection,
    setActiveLeagueId,
  } = useSleeperLeagueConnections();
  const requestedLeagueId = routeLeagueId || activeLeagueId;
  const [resolvedLeague, setResolvedLeague] = useState<{
    canonicalWorkspace: CanonicalLeagueWorkspace | null;
    canonicalLeagueId: string;
    legacyExternalLeagueId: string;
    status: "loading" | "ready" | "error";
    message: string;
  }>({
    canonicalWorkspace: null,
    canonicalLeagueId: "",
    legacyExternalLeagueId: /^\d{10,}$/u.test(requestedLeagueId) ? requestedLeagueId : "",
    status: requestedLeagueId ? "loading" : "error",
    message: requestedLeagueId ? "Resolving the GameHQ league workspace." : "Choose a league to continue.",
  });
  const leagueId = resolvedLeague.canonicalLeagueId || requestedLeagueId;
  const dataLeagueId = resolvedLeague.legacyExternalLeagueId;
  const connection = connections.find((candidate) => candidate.leagueId === dataLeagueId) ?? null;
  const management = useLeagueSeasonManagement(dataLeagueId);
  const scoring = connection?.auctionSettings?.scoring ?? "halfPpr";
  const players = useMemo(() => buildCurrentToolPlayers(scoring), [scoring]);
  const [teamState, setTeamState] = useState<LeagueWorkspaceTeamState>({
    status: connection ? "loading" : "idle",
    data: null,
    error: "",
  });
  const managerProviderUserId = connection?.managerProviderUserId ?? "";
  const sessionUserId = session?.user.uid ?? "";
  const connectionRef = useRef(connection);

  useEffect(() => {
    if (sessionUserId) return;
    void ensureFirebaseSession().catch((error: unknown) => {
      setResolvedLeague((current) => ({
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "A GameHQ session could not be started.",
      }));
    });
  }, [sessionUserId]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!requestedLeagueId || !sessionUserId) return;
    let disposed = false;
    setResolvedLeague((current) => ({
      ...current,
      canonicalWorkspace: null,
      canonicalLeagueId: "",
      legacyExternalLeagueId: /^\d{10,}$/u.test(requestedLeagueId) ? requestedLeagueId : "",
      status: "loading",
      message: "Resolving the GameHQ league workspace.",
    }));
    void firebaseLeagueRepository.resolveRouteId(requestedLeagueId)
      .then(async (resolution) => {
        if (disposed) return;
        if (resolution.status === "unavailable") {
          setResolvedLeague({
            canonicalWorkspace: null,
            canonicalLeagueId: "",
            legacyExternalLeagueId: "",
            status: "error",
            message: "This GameHQ league does not exist or is not available to this account.",
          });
          return;
        }
        if (resolution.status === "legacy") {
          setResolvedLeague({
            canonicalWorkspace: null,
            canonicalLeagueId: "",
            legacyExternalLeagueId: resolution.legacyExternalLeagueId,
            status: "ready",
            message: "Connected league route loaded in compatibility mode.",
          });
          return;
        }
        const workspace = await firebaseLeagueRepository.getWorkspace(resolution.canonicalLeagueId);
        if (disposed) return;
        setResolvedLeague({
          canonicalWorkspace: workspace,
          canonicalLeagueId: resolution.canonicalLeagueId,
          legacyExternalLeagueId: resolution.legacyExternalLeagueId,
          status: workspace ? "ready" : "error",
          message: workspace
            ? "GameHQ league workspace loaded."
            : "The league identity exists, but its workspace could not be loaded.",
        });
        if (requestedLeagueId !== resolution.canonicalLeagueId) {
          const currentLocation = locationRef.current;
          navigate({
            pathname: replaceLeagueRouteId(currentLocation.pathname, requestedLeagueId, resolution.canonicalLeagueId),
            search: currentLocation.search,
            hash: currentLocation.hash,
          }, { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (disposed) return;
        if (/^\d{10,}$/u.test(requestedLeagueId)) {
          setResolvedLeague({
            canonicalWorkspace: null,
            canonicalLeagueId: "",
            legacyExternalLeagueId: requestedLeagueId,
            status: "ready",
            message: "Connected league route loaded in compatibility mode while canonical mapping is unavailable.",
          });
          return;
        }
        setResolvedLeague({
          canonicalWorkspace: null,
          canonicalLeagueId: "",
          legacyExternalLeagueId: /^\d{10,}$/u.test(requestedLeagueId) ? requestedLeagueId : "",
          status: "error",
          message: error instanceof Error ? error.message : "The league route could not be resolved.",
        });
      });
    return () => { disposed = true; };
  }, [navigate, requestedLeagueId, sessionUserId]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    if (!dataLeagueId || !connections.some((candidate) => candidate.leagueId === dataLeagueId)) return;
    if (activeLeagueId !== dataLeagueId) setActiveLeagueId(dataLeagueId);
  }, [activeLeagueId, connections, dataLeagueId, setActiveLeagueId]);

  useEffect(() => {
    const currentConnection = connectionRef.current;
    if (!currentConnection || currentConnection.leagueId !== dataLeagueId) {
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
  }, [connection?.leagueId, dataLeagueId, managerProviderUserId, players, rememberConnection, scoring]);

  const value = useMemo<LeagueWorkspaceValue>(() => ({
    leagueId,
    routeLeagueId: requestedLeagueId,
    dataLeagueId,
    connection,
    connections,
    canonicalWorkspace: resolvedLeague.canonicalWorkspace,
    authority: resolvedLeague.canonicalWorkspace?.authority ?? null,
    routeState: {
      status: resolvedLeague.status,
      message: resolvedLeague.message,
    },
    teamState,
    capabilities: {
      canManage: resolvedLeague.canonicalWorkspace?.authority.canManage
        ?? Boolean(management.record && management.record.commissionerUserId === management.currentUserId),
      canSaveLineup: resolvedLeague.canonicalWorkspace?.authority.canSaveLineup
        ?? Boolean(management.record && management.record.commissionerUserId === management.currentUserId),
      source: (resolvedLeague.canonicalWorkspace?.authority.source === "gamehq"
        || (management.record && management.record.commissionerUserId === management.currentUserId))
        ? "gamehq"
        : null,
      status: resolvedLeague.status === "loading" || management.status === "loading" ? "loading" : "ready",
    },
    switchLeague: (nextLeagueId: string) => {
      if (!connections.some((candidate) => candidate.leagueId === nextLeagueId)) return;
      setActiveLeagueId(nextLeagueId);
      navigate(`/league/${encodeURIComponent(nextLeagueId)}/team`);
    },
  }), [connection, connections, dataLeagueId, leagueId, management.currentUserId, management.record, management.status, navigate, requestedLeagueId, resolvedLeague, setActiveLeagueId, teamState]);

  return <LeagueWorkspaceContext.Provider value={value}>{children}</LeagueWorkspaceContext.Provider>;
}
