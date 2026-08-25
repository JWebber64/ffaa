import { useCallback, useState } from "react";

import type { AuctionScoring } from "../../data/playerValues";

const CONNECTIONS_KEY = "ffaa.sleeperLeagueConnections.v1";
const MAX_CONNECTIONS = 12;

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
