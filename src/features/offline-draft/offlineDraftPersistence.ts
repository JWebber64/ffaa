import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureFirebaseUserId } from "../../lib/authSession";
import { firestore } from "../../lib/firebase";
import {
  normalizeOfflineDraftId,
  type OfflineDraftCloudMetadata,
  type OfflineDraftCloudRecord,
  type OfflineDraftCloudState,
} from "./offlineDraftIdentity";

const OFFLINE_DRAFT_COLLECTION = "offlineDrafts";

function nowIso() {
  return new Date().toISOString();
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordFromDocument(id: string, data: DocumentData): OfflineDraftCloudRecord | null {
  const ownerUserId = cleanOptionalText(data.owner_user_id);
  const createdAt = cleanOptionalText(data.created_at);
  const updatedAt = cleanOptionalText(data.updated_at);
  const leagueId = cleanOptionalText(data.league_id);
  const leagueName = cleanOptionalText(data.league_name);
  const season = cleanOptionalText(data.season);
  if (!ownerUserId || !createdAt || !updatedAt || !data.state || typeof data.state !== "object") {
    return null;
  }

  return {
    id,
    ownerUserId,
    state: data.state as OfflineDraftCloudState,
    ...(leagueId ? { leagueId } : {}),
    ...(leagueName ? { leagueName } : {}),
    ...(season ? { season } : {}),
    createdAt,
    updatedAt,
    version: Math.max(1, Math.round(Number(data.version) || 1)),
  };
}

function offlineDraftReference(draftId: string) {
  return doc(firestore, OFFLINE_DRAFT_COLLECTION, draftId);
}

export async function createOfflineDraftOnline(
  state: OfflineDraftCloudState,
  metadata: OfflineDraftCloudMetadata = {},
) {
  const ownerUserId = await ensureFirebaseUserId();
  const reference = doc(collection(firestore, OFFLINE_DRAFT_COLLECTION));
  const createdAt = nowIso();
  const record = {
    owner_user_id: ownerUserId,
    schema_version: 1,
    state,
    created_at: createdAt,
    updated_at: createdAt,
    version: 1,
    ...(cleanOptionalText(metadata.leagueId) ? { league_id: cleanOptionalText(metadata.leagueId) } : {}),
    ...(cleanOptionalText(metadata.leagueName) ? { league_name: cleanOptionalText(metadata.leagueName) } : {}),
    ...(cleanOptionalText(metadata.season) ? { season: cleanOptionalText(metadata.season) } : {}),
  };

  await setDoc(reference, record);
  return recordFromDocument(reference.id, record)!;
}

export async function loadOfflineDraftOnline(draftId: string) {
  const normalizedId = normalizeOfflineDraftId(draftId);
  if (!normalizedId) throw new Error("Offline Draft ID is invalid.");

  const snapshot = await getDoc(offlineDraftReference(normalizedId));
  if (!snapshot.exists()) return null;
  return recordFromDocument(snapshot.id, snapshot.data());
}

export async function loadOfflineDraftOnlineForSession(draftId: string) {
  const recordPromise = loadOfflineDraftOnline(draftId);
  const userIdPromise = ensureFirebaseUserId().catch(() => "");
  const [record, userId] = await Promise.all([recordPromise, userIdPromise]);
  if (!record) return { record: null, isOwner: false };

  return { record, isOwner: Boolean(userId && record.ownerUserId === userId) };
}

export async function saveOfflineDraftOnline(draftId: string, state: OfflineDraftCloudState) {
  const normalizedId = normalizeOfflineDraftId(draftId);
  if (!normalizedId) throw new Error("Offline Draft ID is invalid.");
  const ownerUserId = await ensureFirebaseUserId();
  const reference = offlineDraftReference(normalizedId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("This shared offline draft is no longer available.");
    const current = snapshot.data();
    if (current.owner_user_id !== ownerUserId) {
      throw new Error("This shared link is read-only on this device.");
    }

    transaction.update(reference, {
      state,
      updated_at: nowIso(),
      version: Math.max(1, Math.round(Number(current.version) || 1)) + 1,
    });
  });
}

export function subscribeToOfflineDraftOnline(
  draftId: string,
  onRecord: (record: OfflineDraftCloudRecord | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const normalizedId = normalizeOfflineDraftId(draftId);
  if (!normalizedId) {
    throw new Error("Offline Draft ID is invalid.");
  }

  return onSnapshot(
    offlineDraftReference(normalizedId),
    (snapshot) => {
      onRecord(snapshot.exists() ? recordFromDocument(snapshot.id, snapshot.data()) : null);
    },
    (error) => onError?.(error),
  );
}
