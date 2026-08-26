import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentReference,
} from "firebase/firestore";

import { firestore } from "../../../lib/firebase";
import type { LeagueHistorySnapshot, LeagueWeekPayload, LeagueSeason } from "../domain/types";
import {
  assembleLeagueHistorySnapshot,
  FIRESTORE_HISTORY_COLLECTION,
  FIRESTORE_LEAGUE_HISTORY_SCHEMA_VERSION,
  FIRESTORE_SNAPSHOT_COLLECTION,
  FIRESTORE_WEEK_COLLECTION,
  leagueWeekDocumentId,
  type FirestoreLeagueHistoryRoot,
  type FirestoreSnapshotChunk,
  type FirestoreWeekDocument,
} from "./firestoreLeagueHistoryModel";

const requestCache = new Map<string, Promise<LeagueHistorySnapshot>>();
const completedWeekCache = new Map<string, LeagueWeekPayload>();

export class LeagueHistoryNotImportedError extends Error {
  readonly code = "league-history/not-imported";

  constructor() {
    super("This Sleeper league has not been imported into permanent history yet.");
    this.name = "LeagueHistoryNotImportedError";
  }
}

export function isLeagueHistoryNotImportedError(error: unknown): error is LeagueHistoryNotImportedError {
  return error instanceof LeagueHistoryNotImportedError;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("League history request was cancelled.");
  error.name = "AbortError";
  throw error;
}

async function resolveHistoryReference(routeId: string) {
  const direct = doc(firestore, FIRESTORE_HISTORY_COLLECTION, routeId);
  const directSnapshot = await getDoc(direct);
  if (directSnapshot.exists()) return direct;
  const aliases = query(
    collection(firestore, FIRESTORE_HISTORY_COLLECTION),
    where("routeIds", "array-contains", routeId),
    limit(1),
  );
  const aliasSnapshot = await getDocs(aliases);
  return aliasSnapshot.empty ? null : aliasSnapshot.docs[0]?.ref ?? null;
}

function readRoot(reference: DocumentReference, value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error(`League history ${reference.id} has an invalid Firestore root document.`);
  }
  const root = value as FirestoreLeagueHistoryRoot;
  if (root.schemaVersion !== FIRESTORE_LEAGUE_HISTORY_SCHEMA_VERSION || !root.league?.id) {
    throw new Error(`League history ${reference.id} uses an unsupported Firestore schema.`);
  }
  return root;
}

async function loadSnapshot(routeId: string): Promise<LeagueHistorySnapshot> {
  const reference = await resolveHistoryReference(routeId);
  if (!reference) throw new LeagueHistoryNotImportedError();
  const [rootSnapshot, chunksSnapshot] = await Promise.all([
    getDoc(reference),
    getDocs(collection(reference, FIRESTORE_SNAPSHOT_COLLECTION)),
  ]);
  if (!rootSnapshot.exists()) throw new LeagueHistoryNotImportedError();
  const root = readRoot(reference, rootSnapshot.data());
  const chunks = chunksSnapshot.docs.map((row) => row.data() as FirestoreSnapshotChunk);
  return assembleLeagueHistorySnapshot(root, chunks);
}

export function loadLeagueHistory(routeId: string, options: { refresh?: boolean } = {}) {
  const key = routeId.trim();
  if (options.refresh) requestCache.delete(key);
  const cached = requestCache.get(key);
  if (cached) return cached;
  const pending = loadSnapshot(key).catch((error) => {
    requestCache.delete(key);
    throw error;
  });
  requestCache.set(key, pending);
  return pending;
}

export function leagueHistoryStorageConfigured() {
  return Boolean(firestore.app.options.projectId);
}

export async function loadLeagueWeek(
  leagueId: string,
  season: LeagueSeason,
  week: number,
  options: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<LeagueWeekPayload> {
  const cacheKey = `${leagueId}:${season.id}:${week}`;
  if (options.refresh) completedWeekCache.delete(cacheKey);
  const cached = completedWeekCache.get(cacheKey);
  if (cached) return cached;
  throwIfAborted(options.signal);
  const weekReference = doc(
    firestore,
    FIRESTORE_HISTORY_COLLECTION,
    leagueId,
    FIRESTORE_WEEK_COLLECTION,
    leagueWeekDocumentId(season.id, week),
  );
  const weekSnapshot = await getDoc(weekReference);
  throwIfAborted(options.signal);
  const payload: LeagueWeekPayload = weekSnapshot.exists()
    ? weekSnapshot.data() as FirestoreWeekDocument
    : {
        leagueId,
        leagueSeasonId: season.id,
        season: season.season,
        week,
        status: "empty",
        weeklyResults: [],
        weeklyPlayerResults: [],
        awards: [],
        moments: [],
        source: "Sleeper source",
      };
  if (payload.status === "complete") completedWeekCache.set(cacheKey, payload);
  return payload;
}

export function clearLeagueWeekCache(leagueId?: string) {
  if (!leagueId) {
    completedWeekCache.clear();
    return;
  }
  for (const key of completedWeekCache.keys()) {
    if (key.startsWith(`${leagueId}:`)) completedWeekCache.delete(key);
  }
}
