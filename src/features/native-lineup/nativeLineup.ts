import { collection, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import type { LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { firestore } from "../../lib/firebase";
import type { NativeLineupWeek, NativeLineupWeekPlayer, NativeWeeklyLineup } from "../league-domain/types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : [];
}

function normalizePlayer(value: unknown): NativeLineupWeekPlayer | null {
  const data = record(value);
  const playerId = text(data.player_id);
  const position = text(data.position);
  const gameStatus = text(data.game_status);
  const availability = text(data.availability);
  if (!playerId || !["QB", "RB", "WR", "TE", "K", "DST"].includes(position)) return null;
  if (!["scheduled", "in_progress", "postponed", "canceled", "final"].includes(gameStatus) || !["active", "questionable", "doubtful", "inactive", "out", "ir"].includes(availability)) return null;
  return {
    playerId,
    position: position as NativeLineupWeekPlayer["position"],
    nflTeam: text(data.nfl_team),
    gameId: text(data.game_id),
    originalScheduledStartAt: text(data.original_scheduled_start_at),
    scheduledStartAt: text(data.scheduled_start_at),
    actualStartedAt: text(data.actual_started_at),
    gameStatus: gameStatus as NativeLineupWeekPlayer["gameStatus"],
    availability: availability as NativeLineupWeekPlayer["availability"],
    projectedPoints: numberValue(data.projected_points),
  };
}

export function normalizeNativeLineupWeek(value: unknown, leagueId: string, seasonId: string, week: number): NativeLineupWeek | null {
  const data = record(value);
  if (text(data.league_id) !== leagueId || text(data.season_id) !== seasonId || numberValue(data.week) !== week) return null;
  const lockOverrides = Object.fromEntries(Object.entries(record(data.lock_overrides)).flatMap(([playerId, overrideValue]) => {
    const override = record(overrideValue);
    const reopenedUntil = text(override.reopened_until);
    return reopenedUntil ? [[playerId, { reopenedUntil, reason: text(override.reason), actorUserId: text(override.actor_user_id) }]] : [];
  }));
  return {
    id: text(data.id) || `week-${week}`,
    leagueId,
    seasonId,
    week,
    settingsVersionId: text(data.settings_version_id),
    timezone: text(data.timezone) || "UTC",
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    players: (Array.isArray(data.players) ? data.players : []).map(normalizePlayer).filter((player): player is NativeLineupWeekPlayer => Boolean(player)),
    lockOverrides,
    updatedAt: text(data.updated_at),
  };
}

export function normalizeNativeWeeklyLineup(value: unknown, leagueId: string, seasonId: string): NativeWeeklyLineup | null {
  const data = record(value);
  const id = text(data.id);
  const franchiseId = text(data.franchise_id);
  if (!id || !franchiseId || text(data.league_id) !== leagueId || text(data.season_id) !== seasonId) return null;
  return {
    id,
    leagueId,
    seasonId,
    franchiseId,
    week: Math.max(1, Math.round(numberValue(data.week, 1))),
    settingsVersionId: text(data.settings_version_id),
    seasonRevision: Math.max(1, Math.round(numberValue(data.season_revision, 1))),
    rosterRevision: Math.max(1, Math.round(numberValue(data.roster_revision, 1))),
    lineupWeekRevision: Math.max(1, Math.round(numberValue(data.lineup_week_revision, 1))),
    assignments: Object.fromEntries(Object.entries(record(data.assignments)).flatMap(([slot, playerId]) => text(playerId) ? [[slot, text(playerId)]] : [])),
    orderedFallbackPlayerIds: strings(data.ordered_fallback_player_ids),
    selectionMode: text(data.selection_mode) === "best_ball" ? "best_ball" : "manual",
    automaticSubstitutions: (Array.isArray(data.automatic_substitutions) ? data.automatic_substitutions : []).flatMap((value) => {
      const row = record(value);
      return text(row.slot) && text(row.from) && text(row.to) ? [{ slot: text(row.slot), from: text(row.from), to: text(row.to) }] : [];
    }),
    revision: Math.max(1, Math.round(numberValue(data.revision, 1))),
    updatedAt: text(data.updated_at),
  };
}

export function subscribeNativeLineupWeek(leagueId: string, seasonId: string, week: number, onValue: (value: NativeLineupWeek | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(firestore, "leagues", leagueId, "seasons", seasonId, "lineupWeeks", `week-${week}`),
    (snapshot) => onValue(snapshot.exists() ? normalizeNativeLineupWeek(snapshot.data(), leagueId, seasonId, week) : null),
    (error) => onError(error instanceof Error ? error : new Error(String(error))),
  );
}

export function subscribeNativeWeeklyLineups(leagueId: string, seasonId: string, onValue: (value: NativeWeeklyLineup[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore, "leagues", leagueId, "seasons", seasonId, "lineups"),
    (snapshot) => onValue(snapshot.docs.map((entry) => normalizeNativeWeeklyLineup(entry.data(), leagueId, seasonId)).filter((entry): entry is NativeWeeklyLineup => Boolean(entry))),
    (error) => onError(error instanceof Error ? error : new Error(String(error))),
  );
}

export type NativePlayerLock = { locked: boolean; lockAt: string; reason: string; reopened: boolean };

export function getNativePlayerLock(player: NativeLineupWeekPlayer, week: NativeLineupWeek, settings: LeagueSettingsV1, now = Date.now()): NativePlayerLock {
  const override = week.lockOverrides[player.playerId];
  const reopenedUntil = Date.parse(override?.reopenedUntil ?? "");
  if (Number.isFinite(reopenedUntil) && reopenedUntil > now) return { locked: false, lockAt: override!.reopenedUntil, reason: `Emergency reopening: ${override!.reason}`, reopened: true };
  if (player.gameStatus === "canceled") {
    return settings.lineup.canceledGamePolicy === "lock"
      ? { locked: true, lockAt: player.scheduledStartAt, reason: "Canceled-game policy keeps this player locked.", reopened: false }
      : { locked: false, lockAt: "", reason: "Canceled-game policy leaves this player unlocked.", reopened: false };
  }
  const firstGameAt = week.players.map((entry) => Date.parse(entry.originalScheduledStartAt || entry.scheduledStartAt)).filter(Number.isFinite).sort((left, right) => left - right)[0] ?? Number.NaN;
  const policy = settings.lineup.lateSwap ? settings.lineup.lockPolicy : "first_game";
  if (policy === "first_game") {
    return { locked: Number.isFinite(firstGameAt) && now >= firstGameAt, lockAt: Number.isFinite(firstGameAt) ? new Date(firstGameAt).toISOString() : "", reason: "Every lineup locks when the first game begins.", reopened: false };
  }
  if (policy === "actual_start" || player.gameStatus === "postponed" && settings.lineup.postponedGamePolicy === "unlock_until_actual") {
    const actual = Date.parse(player.actualStartedAt);
    const locked = Number.isFinite(actual) && now >= actual || ["in_progress", "final"].includes(player.gameStatus);
    return { locked, lockAt: Number.isFinite(actual) ? new Date(actual).toISOString() : "", reason: locked ? "The game has actually started." : "Editable until the game actually starts.", reopened: false };
  }
  const source = player.gameStatus === "postponed" && settings.lineup.postponedGamePolicy === "original_start" ? player.originalScheduledStartAt : player.scheduledStartAt;
  const start = Date.parse(source);
  const locked = Number.isFinite(start) && now >= start;
  return { locked, lockAt: Number.isFinite(start) ? new Date(start).toISOString() : "", reason: locked ? "Scheduled lock time has passed." : "Editable until scheduled kickoff.", reopened: false };
}
