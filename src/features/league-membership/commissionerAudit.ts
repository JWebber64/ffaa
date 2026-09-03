import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

import { firestore } from "../../lib/firebase";
import type { AuditEvent, RosterTransaction, RosterTransactionAsset, RosterTransactionParty } from "../league-domain/types";
import { normalizeAuditEvent } from "./leaguePeople";

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

function numberRecord(value: unknown) {
  return Object.fromEntries(Object.entries(record(value)).map(([key, entry]) => [key, numberValue(entry)]));
}

function assets(value: unknown): RosterTransactionAsset[] {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const data = record(entry);
    const type = text(data.type);
    const id = text(data.id);
    if (!id || !["player", "draft_pick", "faab", "contract", "keeper_right"].includes(type)) return [];
    return [{
      type: type as RosterTransactionAsset["type"],
      id,
      amount: data.amount == null ? null : numberValue(data.amount),
      metadata: record(data.metadata),
    }];
  }) : [];
}

function parties(value: unknown): RosterTransactionParty[] {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const data = record(entry);
    const franchiseId = text(data.franchise_id);
    return franchiseId ? [{ franchiseId, assets: assets(data.assets) }] : [];
  }) : [];
}

export function normalizeRosterTransaction(value: unknown, leagueId: string, seasonId: string): RosterTransaction | null {
  const data = record(value);
  const id = text(data.id);
  const approvalState = text(data.approval_state);
  if (!id || text(data.league_id) !== leagueId || text(data.season_id) !== seasonId || !["accepted", "pending", "rejected", "reversed"].includes(approvalState)) return null;
  return {
    id,
    leagueId,
    seasonId,
    transactionType: text(data.transaction_type),
    assetsLeaving: parties(data.assets_leaving),
    assetsEntering: parties(data.assets_entering),
    effectiveAt: text(data.effective_at),
    sourceCommandId: text(data.source_command_id),
    settingsVersionId: text(data.settings_version_id),
    actorUserId: text(data.actor_user_id),
    approvalState: approvalState as RosterTransaction["approvalState"],
    reviewState: text(data.review_state),
    beforeRosterRevisions: numberRecord(data.before_roster_revisions),
    afterRosterRevisions: numberRecord(data.after_roster_revisions),
    auditEventId: text(data.audit_event_id),
    reversalOfTransactionId: text(data.reversal_of_transaction_id) || null,
    reversedByTransactionId: text(data.reversed_by_transaction_id) || null,
  };
}

export type CommissionerAuditSnapshot = {
  events: AuditEvent[];
  transactions: RosterTransaction[];
};

export async function loadCommissionerAudit(leagueId: string, seasonId: string): Promise<CommissionerAuditSnapshot> {
  const [eventSnapshots, privateSnapshots, transactionSnapshots] = await Promise.all([
    getDocs(query(collection(firestore, "leagues", leagueId, "auditEvents"), orderBy("timestamp", "desc"), limit(100))),
    getDocs(collection(firestore, "leagues", leagueId, "auditPrivate")),
    getDocs(collection(firestore, "leagues", leagueId, "seasons", seasonId, "rosterTransactions")),
  ]);
  const privateById = new Map(privateSnapshots.docs.map((document) => [document.id, record(document.data())]));
  return {
    events: eventSnapshots.docs.map((document) => {
      const event = normalizeAuditEvent(document.data(), leagueId);
      const privateData = privateById.get(document.id);
      return event && privateData ? { ...event, privateMetadata: privateData } : event;
    }).filter((event): event is AuditEvent => Boolean(event)),
    transactions: transactionSnapshots.docs
      .map((document) => normalizeRosterTransaction(document.data(), leagueId, seasonId))
      .filter((transaction): transaction is RosterTransaction => Boolean(transaction))
      .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt)),
  };
}
