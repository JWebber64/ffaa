import {
  doc,
  onSnapshot,
  runTransaction,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { ensureFirebaseUserId } from "../../lib/authSession";
import { firestore } from "../../lib/firebase";
import type { OfflineDraftCloudState } from "./offlineDraftIdentity";

const OFFLINE_LEAGUE_DRAFT_COLLECTION = "offlineLeagueDrafts";

export type OfflineLeagueDraftRecord = {
  leagueId: string;
  ownerUserId: string;
  state: OfflineDraftCloudState;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type OfflineLeagueDraftSnapshot = {
  currentUserId: string;
  record: OfflineLeagueDraftRecord | null;
};

export type OfflineLeagueDraftSaveResult = {
  access: "editor" | "viewer";
  record: OfflineLeagueDraftRecord;
};

function normalizeLeagueId(value: unknown) {
  const leagueId = typeof value === "string" ? value.trim() : "";
  if (!/^\d{10,}$/u.test(leagueId)) {
    throw new Error("A valid active league is required for live display sync.");
  }
  return leagueId;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function leagueDraftReference(leagueId: string) {
  return doc(firestore, OFFLINE_LEAGUE_DRAFT_COLLECTION, normalizeLeagueId(leagueId));
}

function cloneState(state: OfflineDraftCloudState): OfflineDraftCloudState {
  return JSON.parse(JSON.stringify(state)) as OfflineDraftCloudState;
}

export function normalizeOfflineLeagueDraftRecord(
  value: DocumentData | unknown,
  expectedLeagueId = "",
): OfflineLeagueDraftRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const leagueId = cleanText(data.league_id);
  const ownerUserId = cleanText(data.owner_user_id);
  const createdAt = cleanText(data.created_at);
  const updatedAt = cleanText(data.updated_at);
  const state = data.state;

  if (
    !/^\d{10,}$/u.test(leagueId)
    || (expectedLeagueId && leagueId !== expectedLeagueId)
    || !ownerUserId
    || !createdAt
    || !updatedAt
    || !state
    || typeof state !== "object"
    || Array.isArray(state)
  ) {
    return null;
  }

  const candidateState = state as Record<string, unknown>;
  if (!Array.isArray(candidateState.teams) || !candidateState.config || typeof candidateState.config !== "object") {
    return null;
  }

  return {
    leagueId,
    ownerUserId,
    state: cloneState(candidateState as OfflineDraftCloudState),
    createdAt,
    updatedAt,
    version: Math.max(1, Math.round(Number(data.version) || 1)),
  };
}

function firestoreRecord(record: OfflineLeagueDraftRecord) {
  return {
    owner_user_id: record.ownerUserId,
    schema_version: 1,
    league_id: record.leagueId,
    state: cloneState(record.state),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    version: record.version,
  };
}

export async function subscribeToOfflineLeagueDraft(
  leagueIdValue: string,
  onRecord: (snapshot: OfflineLeagueDraftSnapshot) => void,
  onError?: (error: Error) => void,
): Promise<Unsubscribe> {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const currentUserId = await ensureFirebaseUserId();

  return onSnapshot(
    leagueDraftReference(leagueId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onRecord({ currentUserId, record: null });
        return;
      }

      const record = normalizeOfflineLeagueDraftRecord(snapshot.data(), leagueId);
      if (!record) {
        onError?.(new Error("The league live display contains invalid draft data."));
        return;
      }
      onRecord({ currentUserId, record });
    },
    (error) => onError?.(error instanceof Error ? error : new Error(String(error))),
  );
}

export async function saveOfflineLeagueDraft(
  leagueIdValue: string,
  state: OfflineDraftCloudState,
): Promise<OfflineLeagueDraftSaveResult> {
  const leagueId = normalizeLeagueId(leagueIdValue);
  const currentUserId = await ensureFirebaseUserId();
  const reference = leagueDraftReference(leagueId);
  let result: OfflineLeagueDraftSaveResult | null = null;

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists()
      ? normalizeOfflineLeagueDraftRecord(snapshot.data(), leagueId)
      : null;

    if (snapshot.exists() && !existing) {
      throw new Error("The league live display contains invalid draft data.");
    }

    if (existing && existing.ownerUserId !== currentUserId) {
      result = { access: "viewer", record: existing };
      return;
    }

    const timestamp = new Date().toISOString();
    const record: OfflineLeagueDraftRecord = {
      leagueId,
      ownerUserId: currentUserId,
      state: cloneState(state),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      version: (existing?.version ?? 0) + 1,
    };
    transaction.set(reference, firestoreRecord(record));
    result = { access: "editor", record };
  });

  if (!result) throw new Error("The league live display could not be saved.");
  return result;
}
