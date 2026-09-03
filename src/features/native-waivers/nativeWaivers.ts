import { collection, doc, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import type { NativeWaiverClaim, NativeWaiverPlayerState, NativeWaiverReceipt, NativeWaiverState, NativeWaiverTeamState } from "../league-domain/types";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []; }

export function normalizeWaiverState(value: unknown): NativeWaiverState {
  const data = record(value);
  return { revision: Math.max(1, Math.round(numberValue(data.revision))), playerCount: Math.max(0, Math.round(numberValue(data.player_count))), settingsVersionId: text(data.settings_version_id), nextProcessingAt: text(data.next_processing_at), lastRunId: text(data.last_run_id), updatedAt: text(data.updated_at) };
}

export function normalizeWaiverPlayer(value: unknown): NativeWaiverPlayerState | null {
  const data = record(value); const playerId = text(data.player_id); const position = text(data.position); const state = text(data.state);
  if (!playerId || !["QB", "RB", "WR", "TE", "K", "DST"].includes(position) || !["free_agent", "on_waivers", "owned", "locked", "ineligible", "protected", "trade_block"].includes(state)) return null;
  return { playerId, position: position as NativeWaiverPlayerState["position"], state: state as NativeWaiverPlayerState["state"], ownerFranchiseId: text(data.owner_franchise_id), droppedUntil: text(data.dropped_until), revision: Math.max(1, Math.round(numberValue(data.revision))) };
}

export function normalizeWaiverTeam(value: unknown): NativeWaiverTeamState | null {
  const data = record(value); const franchiseId = text(data.franchise_id); if (!franchiseId) return null;
  return { franchiseId, faabRemaining: Math.max(0, Math.round(numberValue(data.faab_remaining))), priority: Math.max(1, Math.round(numberValue(data.priority))), standingsRank: Math.max(1, Math.round(numberValue(data.standings_rank))), priorityWeek: Math.max(0, Math.round(numberValue(data.priority_week))), weeklyAcquisitions: Object.fromEntries(Object.entries(record(data.weekly_acquisitions)).map(([week, count]) => [week, Math.max(0, Math.round(numberValue(count)))])), revision: Math.max(1, Math.round(numberValue(data.revision))) };
}

export function normalizeWaiverClaim(value: unknown): NativeWaiverClaim | null {
  const data = record(value); const id = text(data.id); const status = text(data.status); if (!id || !["pending", "pending_review", "won", "failed"].includes(status)) return null;
  return { id, franchiseId: text(data.franchise_id), week: Math.max(1, Math.round(numberValue(data.week))), status: status as NativeWaiverClaim["status"], processAt: text(data.process_at), alternatives: (Array.isArray(data.alternatives) ? data.alternatives : []).map(record).map((row) => ({ addPlayerId: text(row.add_player_id), dropPlayerId: text(row.drop_player_id), bid: Math.max(0, Math.round(numberValue(row.bid))), order: Math.max(1, Math.round(numberValue(row.order))), submissionIssue: text(row.submission_issue) })), failures: strings(data.failures), createdAt: text(data.created_at) };
}

export function normalizeWaiverReceipt(value: unknown): NativeWaiverReceipt | null {
  const data = record(value); const id = text(data.id); const status = text(data.status); if (!id || !["won", "failed"].includes(status)) return null;
  return { id, runId: text(data.run_id), claimId: text(data.claim_id), franchiseId: text(data.franchise_id), status: status as NativeWaiverReceipt["status"], claimsEvaluated: Math.max(0, Math.round(numberValue(data.claims_evaluated))), winningBid: data.winning_bid === null ? null : Math.max(0, Math.round(numberValue(data.winning_bid))), nextHighestBid: data.next_highest_bid === null ? null : Math.max(0, Math.round(numberValue(data.next_highest_bid))), priorityBefore: Math.max(1, Math.round(numberValue(data.priority_before))), priorityAfter: Math.max(1, Math.round(numberValue(data.priority_after))), tiebreakerUsed: text(data.tiebreaker_used), failures: strings(data.failures), addPlayerId: text(data.add_player_id), dropPlayerId: text(data.drop_player_id), remainingFaab: Math.max(0, Math.round(numberValue(data.remaining_faab))), processedAt: text(data.processed_at) };
}

type Handlers<T> = { value: (value: T) => void; error: (error: Error) => void };
function errorValue(value: unknown) { return value instanceof Error ? value : new Error(String(value)); }

export function subscribeWaiverState(leagueId: string, seasonId: string, handlers: Handlers<NativeWaiverState | null>): Unsubscribe {
  return onSnapshot(doc(firestore, "leagues", leagueId, "seasons", seasonId, "waiverState", "current"), (snapshot) => handlers.value(snapshot.exists() ? normalizeWaiverState(snapshot.data()) : null), (error) => handlers.error(errorValue(error)));
}

export function subscribeWaiverPlayers(leagueId: string, seasonId: string, handlers: Handlers<NativeWaiverPlayerState[]>): Unsubscribe {
  return onSnapshot(collection(firestore, "leagues", leagueId, "seasons", seasonId, "playerStates"), (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeWaiverPlayer(entry.data())).filter((entry): entry is NativeWaiverPlayerState => Boolean(entry))), (error) => handlers.error(errorValue(error)));
}

export function subscribeWaiverTeams(leagueId: string, seasonId: string, handlers: Handlers<NativeWaiverTeamState[]>): Unsubscribe {
  return onSnapshot(collection(firestore, "leagues", leagueId, "seasons", seasonId, "waiverTeamStates"), (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeWaiverTeam(entry.data())).filter((entry): entry is NativeWaiverTeamState => Boolean(entry))), (error) => handlers.error(errorValue(error)));
}

export function subscribeWaiverClaims(leagueId: string, seasonId: string, viewerUserId: string, canReviewAll: boolean, handlers: Handlers<NativeWaiverClaim[]>): Unsubscribe {
  const source = canReviewAll ? collection(firestore, "leagues", leagueId, "seasons", seasonId, "waiverClaims") : query(collection(firestore, "leagues", leagueId, "seasons", seasonId, "waiverClaims"), where("actor_user_id", "==", viewerUserId));
  return onSnapshot(source, (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeWaiverClaim(entry.data())).filter((entry): entry is NativeWaiverClaim => Boolean(entry)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))), (error) => handlers.error(errorValue(error)));
}

export function subscribeWaiverReceipts(leagueId: string, seasonId: string, handlers: Handlers<NativeWaiverReceipt[]>): Unsubscribe {
  return onSnapshot(collection(firestore, "leagues", leagueId, "seasons", seasonId, "waiverReceipts"), (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeWaiverReceipt(entry.data())).filter((entry): entry is NativeWaiverReceipt => Boolean(entry)).sort((a, b) => b.processedAt.localeCompare(a.processedAt))), (error) => handlers.error(errorValue(error)));
}
