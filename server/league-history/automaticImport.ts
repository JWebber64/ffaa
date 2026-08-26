import sleeperPlayers from "../../src/data/players-2026-sleeper.json";
import { SleeperApiClient } from "../../src/features/league-history/provider/sleeperClient";
import { mapSleeperHistory, type PlayerReference } from "../../src/features/league-history/provider/sleeperMapper";
import {
  buildFirestoreLeagueHistoryBundle,
  FIRESTORE_HISTORY_COLLECTION,
  FIRESTORE_SNAPSHOT_COLLECTION,
  FIRESTORE_WEEK_COLLECTION,
  type FirestoreLeagueHistoryBundle,
} from "../../src/features/league-history/persistence/firestoreLeagueHistoryModel";
import type { LeagueHistoryImportResponse } from "../../shared/leagueHistoryImportProtocol";
import {
  commitFirestoreWrites,
  findLeagueHistoryByRouteId,
  firestoreDocument,
  firestoreObject,
  getFirestoreDocument,
  listFirestoreDocumentNames,
  type FirestoreDocument,
  type FirestoreWrite,
} from "./firestoreRest";
import {
  runAutomaticLeagueHistoryImportWorkflow,
  type AutomaticImportDependencies,
} from "./importWorkflow";

const IMPORT_JOB_COLLECTION = "leagueHistoryImports";
const IMPORT_LOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_AUTOMATIC_SEASONS = 20;

interface SleeperPlayerRow {
  playerId: string;
  name: string;
  pos?: string | null;
  team?: string | null;
}

interface ImportJob {
  status?: string;
  startedAt?: string;
  updatedAt?: string;
  message?: string;
  historyId?: string;
  counts?: Record<string, number>;
}

function documentId(document: FirestoreDocument) {
  return document.name.split("/").at(-1) ?? "";
}

function historyResponse(leagueId: string, document: FirestoreDocument): LeagueHistoryImportResponse {
  const value = firestoreObject(document) ?? {};
  return {
    status: "ready",
    leagueId,
    historyId: documentId(document),
    message: "League History is ready.",
    ...(value.counts && typeof value.counts === "object"
      ? { counts: value.counts as Record<string, number> }
      : {}),
  };
}

async function findExistingHistory(leagueId: string) {
  const direct = await getFirestoreDocument(`${FIRESTORE_HISTORY_COLLECTION}/${leagueId}`);
  if (direct) return historyResponse(leagueId, direct);
  const alias = await findLeagueHistoryByRouteId(leagueId);
  return alias ? historyResponse(leagueId, alias) : null;
}

function isFreshRunningJob(job: ImportJob | null) {
  if (job?.status !== "importing") return false;
  const startedAt = Date.parse(job.startedAt ?? "");
  return Number.isFinite(startedAt) && Date.now() - startedAt < IMPORT_LOCK_WINDOW_MS;
}

async function acquireImportLock(leagueId: string) {
  const path = `${IMPORT_JOB_COLLECTION}/${leagueId}`;
  const existing = await getFirestoreDocument(path);
  const job = firestoreObject(existing) as ImportJob | null;
  if (isFreshRunningJob(job)) return false;
  const now = new Date().toISOString();
  const write: FirestoreWrite = {
    update: firestoreDocument(path, {
      leagueId,
      status: "importing",
      startedAt: now,
      updatedAt: now,
      message: "Reading and normalizing Sleeper history.",
    }),
    currentDocument: existing?.updateTime
      ? { updateTime: existing.updateTime }
      : { exists: false },
  };
  try {
    await commitFirestoreWrites([write]);
    return true;
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 400 || status === 409) return false;
    throw error;
  }
}

function playerReferences() {
  const rows = sleeperPlayers as SleeperPlayerRow[];
  return new Map<string, PlayerReference>(rows.map((player) => [player.playerId, {
    name: player.name || player.playerId,
    position: player.pos ?? "",
    team: player.team ?? "",
  }]));
}

function updateWrite(path: string, data: unknown): FirestoreWrite {
  return { update: firestoreDocument(path, data as Record<string, unknown>) };
}

async function persistBundle(leagueId: string, bundle: FirestoreLeagueHistoryBundle) {
  const rootPath = `${FIRESTORE_HISTORY_COLLECTION}/${bundle.historyId}`;
  const chunksPath = `${rootPath}/${FIRESTORE_SNAPSHOT_COLLECTION}`;
  const weeksPath = `${rootPath}/${FIRESTORE_WEEK_COLLECTION}`;
  const jobPath = `${IMPORT_JOB_COLLECTION}/${leagueId}`;
  const [existingChunks, existingWeeks] = await Promise.all([
    listFirestoreDocumentNames(chunksPath),
    listFirestoreDocumentNames(weeksPath),
  ]);
  const desiredChunkNames = new Set(bundle.chunks.map((entry) => firestoreDocument(`${chunksPath}/${entry.id}`, {}).name));
  const desiredWeekNames = new Set(bundle.weeks.map((entry) => firestoreDocument(`${weeksPath}/${entry.id}`, {}).name));
  const dataWrites: FirestoreWrite[] = [
    ...bundle.chunks.map((entry) => updateWrite(`${chunksPath}/${entry.id}`, entry.data)),
    ...bundle.weeks.map((entry) => updateWrite(`${weeksPath}/${entry.id}`, entry.data)),
    ...existingChunks.filter((name) => !desiredChunkNames.has(name)).map((name): FirestoreWrite => ({ delete: name })),
    ...existingWeeks.filter((name) => !desiredWeekNames.has(name)).map((name): FirestoreWrite => ({ delete: name })),
  ];
  await commitFirestoreWrites(dataWrites);
  const now = new Date().toISOString();
  await commitFirestoreWrites([
    {
      update: firestoreDocument(rootPath, bundle.root as unknown as Record<string, unknown>),
      currentDocument: { exists: false },
    },
    updateWrite(jobPath, {
      leagueId,
      historyId: bundle.historyId,
      status: "ready",
      startedAt: now,
      updatedAt: now,
      message: "League History is ready.",
      counts: bundle.root.counts,
    }),
  ]);
}

async function importSleeperLeagueHistory(leagueId: string): Promise<LeagueHistoryImportResponse> {
  const history = await new SleeperApiClient({ maxChainLength: MAX_AUTOMATIC_SEASONS }).loadHistory(leagueId);
  const payload = mapSleeperHistory(history, playerReferences());
  const bundle = buildFirestoreLeagueHistoryBundle(payload);
  try {
    await persistBundle(leagueId, bundle);
  } catch (error) {
    const existing = await findExistingHistory(leagueId);
    if (existing) return existing;
    throw error;
  }
  return {
    status: "ready",
    leagueId,
    historyId: bundle.historyId,
    message: "League History was imported automatically.",
    counts: bundle.root.counts,
  };
}

async function recordImportFailure(leagueId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Automatic League History import failed.";
  const now = new Date().toISOString();
  await commitFirestoreWrites([updateWrite(`${IMPORT_JOB_COLLECTION}/${leagueId}`, {
    leagueId,
    status: "error",
    startedAt: now,
    updatedAt: now,
    message,
  })]).catch(() => undefined);
}

const defaultDependencies: AutomaticImportDependencies = {
  findExisting: findExistingHistory,
  acquireLock: acquireImportLock,
  importLeague: importSleeperLeagueHistory,
  recordFailure: recordImportFailure,
};

export async function runAutomaticLeagueHistoryImport(
  leagueId: string,
  dependencies: AutomaticImportDependencies = defaultDependencies,
) {
  return runAutomaticLeagueHistoryImportWorkflow(leagueId, dependencies);
}

export async function getAutomaticLeagueHistoryImportStatus(leagueId: string) {
  const existing = await findExistingHistory(leagueId);
  if (existing) return existing;
  const jobDocument = await getFirestoreDocument(`${IMPORT_JOB_COLLECTION}/${leagueId}`);
  const job = firestoreObject(jobDocument) as ImportJob | null;
  if (isFreshRunningJob(job)) {
    return {
      status: "importing" as const,
      leagueId,
      message: job?.message || "League History is being imported.",
    };
  }
  return {
    status: "error" as const,
    leagueId,
    message: job?.message || "League History has not been imported yet.",
  };
}
