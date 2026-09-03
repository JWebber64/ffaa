import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import type { NativeTradeAsset, NativeTradeOffer, NativeTradeReceipt } from "../league-domain/types";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : 0; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []; }

function normalizeAssets(value: unknown): NativeTradeAsset[] {
  if (!Array.isArray(value)) return [];
  return value.map(record).flatMap((row) => {
    const type = text(row.type); const id = text(row.id);
    if (!id || !["player", "draft_pick", "faab", "salary", "contract", "keeper_right", "conditional"].includes(type)) return [];
    return [{ type: type as NativeTradeAsset["type"], id, amount: row.amount === null || row.amount === undefined ? null : numberValue(row.amount), metadata: record(row.metadata) }];
  });
}

export function normalizeTradeOffer(value: unknown): NativeTradeOffer | null {
  const data = record(value); const id = text(data.id); const status = text(data.status);
  if (!id || !["sent", "countered", "rejected", "expired", "accepted_pending_review", "review_rejected", "completed"].includes(status)) return null;
  return {
    id, fromFranchiseId: text(data.from_franchise_id), toFranchiseId: text(data.to_franchise_id), actorUserId: text(data.actor_user_id),
    week: Math.max(1, numberValue(data.week)), settingsVersionId: text(data.settings_version_id), offeredAssets: normalizeAssets(data.offered_assets), requestedAssets: normalizeAssets(data.requested_assets),
    message: text(data.message), status: status as NativeTradeOffer["status"], reviewPolicy: text(data.review_policy), reviewEndsAt: text(data.review_ends_at), votes: Object.fromEntries(Object.entries(record(data.votes)).map(([key, entry]) => [key, text(entry)])),
    rosterEffects: record(data.roster_effects), counterOfOfferId: text(data.counter_of_offer_id), counteredByOfferId: text(data.countered_by_offer_id), acceptedAt: text(data.accepted_at), acceptedBy: text(data.accepted_by), reviewedAt: text(data.reviewed_at), reviewedBy: text(data.reviewed_by),
    commissionerInvolvement: strings(data.commissioner_involvement), rosterTransactionId: text(data.roster_transaction_id), reversalTransactionId: text(data.reversal_transaction_id), expiresAt: text(data.expires_at), sentAt: text(data.sent_at), revision: Math.max(1, numberValue(data.revision)),
  };
}

export function normalizeTradeReceipt(value: unknown): NativeTradeReceipt | null {
  const data = record(value); const id = text(data.id); if (!id) return null;
  return {
    id, offerId: text(data.offer_id), fromFranchiseId: text(data.from_franchise_id), toFranchiseId: text(data.to_franchise_id), offeredAssets: normalizeAssets(data.offered_assets), requestedAssets: normalizeAssets(data.requested_assets), sentAt: text(data.sent_at), acceptedAt: text(data.accepted_at), processedAt: text(data.processed_at), reviewPolicy: text(data.review_policy), votes: Object.fromEntries(Object.entries(record(data.votes)).map(([key, entry]) => [key, text(entry)])), commissionerInvolvement: strings(data.commissioner_involvement), rosterEffects: record(data.roster_effects), capEffects: record(data.cap_effects), settingsVersionId: text(data.settings_version_id), processingResult: text(data.processing_result), rosterTransactionId: text(data.roster_transaction_id), reversalTransactionId: text(data.reversal_transaction_id),
  };
}

type Handlers<T> = { value: (value: T) => void; error: (error: Error) => void };
function errorValue(value: unknown) { return value instanceof Error ? value : new Error(String(value)); }

export function subscribeTradeOffers(leagueId: string, seasonId: string, handlers: Handlers<NativeTradeOffer[]>): Unsubscribe {
  return onSnapshot(collection(firestore, "leagues", leagueId, "seasons", seasonId, "tradeOffers"), (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeTradeOffer(entry.data())).filter((entry): entry is NativeTradeOffer => Boolean(entry)).sort((left, right) => right.sentAt.localeCompare(left.sentAt))), (error) => handlers.error(errorValue(error)));
}

export function subscribeTradeReceipts(leagueId: string, seasonId: string, handlers: Handlers<NativeTradeReceipt[]>): Unsubscribe {
  return onSnapshot(collection(firestore, "leagues", leagueId, "seasons", seasonId, "tradeReceipts"), (snapshot) => handlers.value(snapshot.docs.map((entry) => normalizeTradeReceipt(entry.data())).filter((entry): entry is NativeTradeReceipt => Boolean(entry)).sort((left, right) => right.processedAt.localeCompare(left.processedAt))), (error) => handlers.error(errorValue(error)));
}
