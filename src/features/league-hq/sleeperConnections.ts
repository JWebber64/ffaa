import { useCallback, useSyncExternalStore } from "react";

import type { AuctionScoring } from "../../data/playerValues";

const CONNECTIONS_KEY = "ffaa.sleeperLeagueConnections.v1";
const ACTIVE_LEAGUE_KEY = "ffaa.activeSleeperLeague.v1";
export const MAX_SLEEPER_LEAGUE_CONNECTIONS = 12;

const storeListeners = new Set<() => void>();
let observedConnectionsRaw: string | null | undefined;
let observedConnections: SleeperLeagueConnectionSummary[] = [];
let storageListenerAttached = false;

export interface SleeperLeagueAuctionSettings {
  scoring: AuctionScoring;
  scoringLabel: string;
  teamCount: number;
  budget: number;
  budgetSource: "sleeper-draft" | "gamehq-default";
  rosterSize: number;
  rosterSlots: Array<{ slot: string; count: number }>;
}

export interface SleeperLeagueConnectionSummary {
  leagueId: string;
  leagueName: string;
  season: string;
  status: string;
  totalRosters: number;
  sourceUrl: string;
  lastUsedAt: string;
  /** League artwork returned by Sleeper. This is not the signed-in manager avatar. */
  avatarUrl?: string;
  managerProviderUserId?: string;
  managerDisplayName?: string;
  managerAvatarUrl?: string;
  managerTeamName?: string;
  leagueOwnerProviderUserId?: string;
  managerRecord?: string;
  managerStanding?: number;
  currentWeek?: number;
  opponentName?: string;
  teamSnapshotAt?: string;
  auctionSettings?: SleeperLeagueAuctionSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function parseAuctionSettings(value: unknown): SleeperLeagueAuctionSettings | undefined {
  if (!isRecord(value)) return undefined;
  const scoring = value.scoring === "standard" || value.scoring === "halfPpr" || value.scoring === "ppr"
    ? value.scoring
    : null;
  const teamCount = positiveInteger(value.teamCount);
  const budget = positiveInteger(value.budget);
  const rosterSlots = Array.isArray(value.rosterSlots)
    ? value.rosterSlots.flatMap((slot): SleeperLeagueAuctionSettings["rosterSlots"] => {
        if (!isRecord(slot)) return [];
        const name = String(slot.slot ?? "").trim().toUpperCase();
        const count = positiveInteger(slot.count);
        return name && count ? [{ slot: name, count }] : [];
      })
    : [];
  const rosterSize = positiveInteger(value.rosterSize) || rosterSlots.reduce(
    (sum, slot) => String(slot.slot).toUpperCase() === "IR" ? sum : sum + Number(slot.count),
    0,
  );
  if (!scoring || !teamCount || !budget || !rosterSize || !rosterSlots.length) return undefined;
  return {
    scoring,
    scoringLabel: String(value.scoringLabel ?? (scoring === "ppr" ? "Full PPR" : scoring === "halfPpr" ? "Half PPR" : "Standard")),
    teamCount,
    budget,
    budgetSource: value.budgetSource === "sleeper-draft" ? "sleeper-draft" : "gamehq-default",
    rosterSize,
    rosterSlots,
  };
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

      const auctionSettings = parseAuctionSettings(entry.auctionSettings);
      return [{
        leagueId,
        leagueName: String(entry.leagueName ?? `League ${leagueId}`),
        season: String(entry.season ?? ""),
        status: String(entry.status ?? ""),
        totalRosters: Math.max(0, Number(entry.totalRosters) || 0),
        sourceUrl: String(entry.sourceUrl ?? `https://sleeper.com/leagues/${leagueId}`),
        lastUsedAt: String(entry.lastUsedAt ?? ""),
        ...(String(entry.avatarUrl ?? "").trim() ? { avatarUrl: String(entry.avatarUrl).trim() } : {}),
        ...(String(entry.managerProviderUserId ?? "").trim()
          ? { managerProviderUserId: String(entry.managerProviderUserId).trim() }
          : {}),
        ...(String(entry.managerDisplayName ?? "").trim()
          ? { managerDisplayName: String(entry.managerDisplayName).trim() }
          : {}),
        ...(String(entry.managerAvatarUrl ?? "").trim()
          ? { managerAvatarUrl: String(entry.managerAvatarUrl).trim() }
          : {}),
        ...(String(entry.managerTeamName ?? "").trim()
          ? { managerTeamName: String(entry.managerTeamName).trim() }
          : {}),
        ...(String(entry.leagueOwnerProviderUserId ?? "").trim()
          ? { leagueOwnerProviderUserId: String(entry.leagueOwnerProviderUserId).trim() }
          : {}),
        ...(String(entry.managerRecord ?? "").trim()
          ? { managerRecord: String(entry.managerRecord).trim() }
          : {}),
        ...(positiveInteger(entry.managerStanding)
          ? { managerStanding: positiveInteger(entry.managerStanding) }
          : {}),
        ...(Number.isFinite(Number(entry.currentWeek)) && Number(entry.currentWeek) >= 0
          ? { currentWeek: Math.round(Number(entry.currentWeek)) }
          : {}),
        ...(String(entry.opponentName ?? "").trim()
          ? { opponentName: String(entry.opponentName).trim() }
          : {}),
        ...(String(entry.teamSnapshotAt ?? "").trim()
          ? { teamSnapshotAt: String(entry.teamSnapshotAt).trim() }
          : {}),
        ...(auctionSettings ? { auctionSettings } : {}),
      }];
    });
  } catch {
    return [];
  }
}

export function auctionSettingsSummary(settings: SleeperLeagueAuctionSettings) {
  const roster = settings.rosterSlots
    .map((entry) => `${entry.count} ${String(entry.slot).toUpperCase()}`)
    .join(", ");
  return `${settings.teamCount} teams · ${settings.scoringLabel} · $${settings.budget} budget · roster ${roster}`;
}

export function mergeSleeperLeagueConnection(
  connections: SleeperLeagueConnectionSummary[],
  connection: SleeperLeagueConnectionSummary,
): SleeperLeagueConnectionSummary[] {
  const existing = connections.find((item) => item.leagueId === connection.leagueId);
  const auctionSettings = connection.auctionSettings ?? existing?.auctionSettings;
  const merged: SleeperLeagueConnectionSummary = {
    ...existing,
    ...connection,
    ...(auctionSettings ? { auctionSettings } : {}),
  };
  return [
    merged,
    ...connections.filter((item) => item.leagueId !== connection.leagueId),
  ]
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    .slice(0, MAX_SLEEPER_LEAGUE_CONNECTIONS);
}

export function mergeSleeperLeagueConnections(
  connections: SleeperLeagueConnectionSummary[],
  additions: SleeperLeagueConnectionSummary[],
) {
  return additions.reduce<SleeperLeagueConnectionSummary[]>(
    (current, addition) => mergeSleeperLeagueConnection(current, addition),
    connections,
  );
}

export function mergeSyncedSleeperLeagueConnections(
  localConnections: SleeperLeagueConnectionSummary[],
  remoteConnections: SleeperLeagueConnectionSummary[],
) {
  const byLeagueId = new Map<string, SleeperLeagueConnectionSummary>();
  for (const connection of [...localConnections, ...remoteConnections]) {
    const current = byLeagueId.get(connection.leagueId);
    if (!current) {
      byLeagueId.set(connection.leagueId, connection);
      continue;
    }
    const newer = connection.lastUsedAt.localeCompare(current.lastUsedAt) >= 0 ? connection : current;
    const older = newer === connection ? current : connection;
    byLeagueId.set(
      connection.leagueId,
      mergeSleeperLeagueConnection([older], newer)[0]!,
    );
  }
  return [...byLeagueId.values()]
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    .slice(0, MAX_SLEEPER_LEAGUE_CONNECTIONS);
}

function readConnectionsSnapshot() {
  if (typeof window === "undefined") return observedConnections;
  const raw = window.localStorage.getItem(CONNECTIONS_KEY);
  if (raw !== observedConnectionsRaw) {
    observedConnectionsRaw = raw;
    observedConnections = parseSleeperLeagueConnections(raw);
  }
  return observedConnections;
}

function readActiveLeagueSnapshot() {
  if (typeof window === "undefined") return "";
  const saved = window.localStorage.getItem(ACTIVE_LEAGUE_KEY)?.trim() ?? "";
  const connections = readConnectionsSnapshot();
  return connections.some((connection) => connection.leagueId === saved)
    ? saved
    : connections[0]?.leagueId ?? "";
}

function emitStoreChange() {
  for (const listener of storeListeners) listener();
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== CONNECTIONS_KEY && event.key !== ACTIVE_LEAGUE_KEY && event.key !== null) return;
  observedConnectionsRaw = undefined;
  emitStoreChange();
}

function subscribeToStore(listener: () => void) {
  storeListeners.add(listener);
  if (typeof window !== "undefined" && !storageListenerAttached) {
    window.addEventListener("storage", handleStorageChange);
    storageListenerAttached = true;
  }
  return () => {
    storeListeners.delete(listener);
  };
}

export function replaceSleeperLeagueConnections(connections: SleeperLeagueConnectionSummary[]) {
  if (typeof window === "undefined") return;
  const normalized = parseSleeperLeagueConnections(JSON.stringify(connections));
  window.localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(normalized));
  observedConnectionsRaw = undefined;
  emitStoreChange();
}

export function replaceActiveSleeperLeague(leagueId: string) {
  if (typeof window === "undefined") return;
  if (leagueId) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
  else window.localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  emitStoreChange();
}

export function useSleeperLeagueConnections() {
  const connections = useSyncExternalStore(subscribeToStore, readConnectionsSnapshot, () => observedConnections);
  const activeLeagueId = useSyncExternalStore(subscribeToStore, readActiveLeagueSnapshot, () => "");

  const rememberConnection = useCallback((connection: SleeperLeagueConnectionSummary) => {
    replaceSleeperLeagueConnections(mergeSleeperLeagueConnection(readConnectionsSnapshot(), connection));
  }, []);

  const rememberConnections = useCallback((additions: SleeperLeagueConnectionSummary[]) => {
    if (!additions.length) return;
    replaceSleeperLeagueConnections(mergeSleeperLeagueConnections(readConnectionsSnapshot(), additions));
  }, []);

  const forgetConnection = useCallback((leagueId: string) => {
    const previousActiveLeagueId = readActiveLeagueSnapshot();
    const next = readConnectionsSnapshot().filter((connection) => connection.leagueId !== leagueId);
    replaceSleeperLeagueConnections(next);
    if (previousActiveLeagueId === leagueId || !next.some((connection) => connection.leagueId === previousActiveLeagueId)) {
      replaceActiveSleeperLeague(next[0]?.leagueId ?? "");
    }
  }, []);

  const setActiveLeagueId = useCallback((leagueId: string) => {
    if (leagueId && !/^\d{10,}$/.test(leagueId)) return;
    replaceActiveSleeperLeague(leagueId);
  }, []);

  return {
    connections,
    activeLeagueId,
    rememberConnection,
    rememberConnections,
    forgetConnection,
    setActiveLeagueId,
  };
}
