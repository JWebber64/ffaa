import { useCallback, useState } from "react";

const CONNECTIONS_KEY = "ffaa.sleeperLeagueConnections.v1";
const MAX_CONNECTIONS = 12;

export interface SleeperLeagueConnectionSummary {
  leagueId: string;
  leagueName: string;
  season: string;
  status: string;
  totalRosters: number;
  sourceUrl: string;
  lastUsedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function parseSleeperLeagueConnections(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): SleeperLeagueConnectionSummary[] => {
      if (!isRecord(entry)) return [];
      const leagueId = String(entry.leagueId ?? "").trim();
      if (!/^\d{10,}$/.test(leagueId)) return [];

      return [{
        leagueId,
        leagueName: String(entry.leagueName ?? `League ${leagueId}`),
        season: String(entry.season ?? ""),
        status: String(entry.status ?? ""),
        totalRosters: Math.max(0, Number(entry.totalRosters) || 0),
        sourceUrl: String(entry.sourceUrl ?? `https://sleeper.com/leagues/${leagueId}`),
        lastUsedAt: String(entry.lastUsedAt ?? ""),
      }];
    });
  } catch {
    return [];
  }
}

export function mergeSleeperLeagueConnection(
  connections: SleeperLeagueConnectionSummary[],
  connection: SleeperLeagueConnectionSummary,
) {
  return [
    connection,
    ...connections.filter((item) => item.leagueId !== connection.leagueId),
  ]
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    .slice(0, MAX_CONNECTIONS);
}

function loadConnections() {
  if (typeof window === "undefined") return [];
  return parseSleeperLeagueConnections(window.localStorage.getItem(CONNECTIONS_KEY));
}

function persistConnections(connections: SleeperLeagueConnectionSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections));
}

export function useSleeperLeagueConnections() {
  const [connections, setConnections] = useState<SleeperLeagueConnectionSummary[]>(loadConnections);

  const rememberConnection = useCallback((connection: SleeperLeagueConnectionSummary) => {
    setConnections((current) => {
      const next = mergeSleeperLeagueConnection(current, connection);
      persistConnections(next);
      return next;
    });
  }, []);

  const forgetConnection = useCallback((leagueId: string) => {
    setConnections((current) => {
      const next = current.filter((connection) => connection.leagueId !== leagueId);
      persistConnections(next);
      return next;
    });
  }, []);

  return { connections, rememberConnection, forgetConnection };
}
