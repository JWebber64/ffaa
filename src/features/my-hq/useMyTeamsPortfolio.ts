import { useEffect, useMemo, useRef, useState } from "react";

import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { loadSleeperPlayerDirectory } from "../../data/sleeperPlayerDirectory";
import {
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../league-hq/sleeperConnections";
import { loadMyHQ, type MyHQData, type MyHQDecision } from "./myHQ";

const PORTFOLIO_CACHE_MS = 2 * 60 * 1000;
const PORTFOLIO_FETCH_CONCURRENCY = 3;

type PortfolioTeamState =
  | { status: "identity" | "loading"; data: null; error: "" }
  | { status: "ready"; data: MyHQData; error: "" }
  | { status: "error"; data: null; error: string };

export type PortfolioTeam = {
  connection: SleeperLeagueConnectionSummary;
  state: PortfolioTeamState;
  decision: MyHQDecision | null;
};

const playerPools = new Map<string, Promise<ReturnType<typeof buildCurrentToolPlayers>>>();
const portfolioCache = new Map<string, { loadedAt: number; data: MyHQData }>();

function playersForConnection(connection: SleeperLeagueConnectionSummary) {
  const scoring = connection.auctionSettings?.scoring ?? "halfPpr";
  const existing = playerPools.get(scoring);
  if (existing) return existing;
  const players = loadSleeperPlayerDirectory()
    .then((sleeperRows) => buildCurrentToolPlayers(scoring, [], {}, sleeperRows))
    .catch((error) => {
      playerPools.delete(scoring);
      throw error;
    });
  playerPools.set(scoring, players);
  return players;
}

function cacheKey(connection: SleeperLeagueConnectionSummary) {
  return `${connection.leagueId}:${connection.managerProviderUserId ?? ""}:${connection.auctionSettings?.scoring ?? "halfPpr"}`;
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;
  const run = async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      if (item !== undefined) await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, run));
}

export function primaryPortfolioDecision(data: MyHQData | null) {
  if (!data) return null;
  return data.decisions.find((decision) => decision.urgency === "now")
    ?? data.decisions.find((decision) => decision.urgency === "watch")
    ?? data.decisions[0]
    ?? null;
}

function urgencyRank(team: PortfolioTeam) {
  if (team.state.status === "identity" || team.state.status === "error") return 0;
  if (team.state.status === "loading") return 3;
  if (team.decision?.urgency === "now") return 0;
  if (team.decision?.urgency === "watch") return 1;
  return 2;
}

export function sortPortfolioTeams(teams: PortfolioTeam[]) {
  return [...teams].sort((left, right) => (
    urgencyRank(left) - urgencyRank(right)
    || (right.state.status === "ready" ? right.state.data.week : 0)
      - (left.state.status === "ready" ? left.state.data.week : 0)
    || left.connection.leagueName.localeCompare(right.connection.leagueName)
  ));
}

function connectionWithSnapshot(connection: SleeperLeagueConnectionSummary, data: MyHQData) {
  return {
    ...connection,
    managerTeamName: data.teamName,
    managerRecord: data.record,
    managerStanding: data.standing,
    currentWeek: data.week,
    opponentName: data.opponentName,
    teamSnapshotAt: data.loadedAt,
    ...(data.leagueOwnerProviderUserId
      ? { leagueOwnerProviderUserId: data.leagueOwnerProviderUserId }
      : {}),
  };
}

export function useMyTeamsPortfolio() {
  const { connections, rememberConnection } = useSleeperLeagueConnections();
  const connectionsRef = useRef(connections);
  const [states, setStates] = useState<Record<string, PortfolioTeamState>>({});
  const loadKey = connections.map((connection) => cacheKey(connection)).join("|");

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    const currentConnections = connectionsRef.current;
    if (!currentConnections.length) {
      setStates({});
      return;
    }
    const controller = new AbortController();
    const initialStates: Record<string, PortfolioTeamState> = {};
    for (const connection of currentConnections) {
      if (!connection.managerProviderUserId) {
        initialStates[connection.leagueId] = { status: "identity", data: null, error: "" };
        continue;
      }
      const cached = portfolioCache.get(cacheKey(connection));
      initialStates[connection.leagueId] = cached && Date.now() - cached.loadedAt < PORTFOLIO_CACHE_MS
        ? { status: "ready", data: cached.data, error: "" }
        : { status: "loading", data: null, error: "" };
    }
    setStates(initialStates);

    const identifiedConnections = currentConnections.filter((connection) => connection.managerProviderUserId);
    void runWithConcurrency(identifiedConnections, PORTFOLIO_FETCH_CONCURRENCY, async (connection) => {
      const key = cacheKey(connection);
      const cached = portfolioCache.get(key);
      if (cached && Date.now() - cached.loadedAt < PORTFOLIO_CACHE_MS) return;
      try {
        const players = await playersForConnection(connection);
        const data = await loadMyHQ(connection, players, controller.signal);
        if (controller.signal.aborted) return;
        portfolioCache.set(key, { loadedAt: Date.now(), data });
        setStates((current) => ({
          ...current,
          [connection.leagueId]: { status: "ready", data, error: "" },
        }));
        rememberConnection(connectionWithSnapshot(connection, data));
      } catch (error) {
        if (controller.signal.aborted) return;
        setStates((current) => ({
          ...current,
          [connection.leagueId]: {
            status: "error",
            data: null,
            error: error instanceof Error ? error.message : "This team could not be refreshed.",
          },
        }));
      }
    });
    return () => controller.abort();
  }, [loadKey, rememberConnection]);

  return useMemo(() => sortPortfolioTeams(connections.map((connection): PortfolioTeam => {
    const state = states[connection.leagueId]
      ?? (connection.managerProviderUserId
        ? { status: "loading" as const, data: null, error: "" as const }
        : { status: "identity" as const, data: null, error: "" as const });
    return {
      connection,
      state,
      decision: state.status === "ready" ? primaryPortfolioDecision(state.data) : null,
    };
  })), [connections, states]);
}
