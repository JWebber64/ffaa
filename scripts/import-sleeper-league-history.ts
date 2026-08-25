import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

import { deleteApp, initializeApp } from "firebase/app";
import { deleteUser, getAuth, signInAnonymously, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";

import { SleeperApiClient } from "../src/features/league-history/provider/sleeperClient";
import {
  mergeSpreadsheetAuctionSources,
  type SpreadsheetAuctionSource,
} from "../src/features/league-history/provider/spreadsheetAuction";
import {
  mapSleeperHistory,
  type LeagueHistoryImportPayload,
  type PlayerReference,
  type SeasonImportPayload,
} from "../src/features/league-history/provider/sleeperMapper";
import {
  assembleLeagueHistorySnapshot,
  buildFirestoreLeagueHistoryBundle,
  FIRESTORE_HISTORY_COLLECTION,
  FIRESTORE_SNAPSHOT_COLLECTION,
  FIRESTORE_WEEK_COLLECTION,
  type FirestoreLeagueHistoryRoot,
  type FirestoreSnapshotChunk,
  type FirestoreWeekDocument,
} from "../src/features/league-history/persistence/firestoreLeagueHistoryModel";

interface CachedSleeperPlayer {
  playerId: string;
  name: string;
  pos?: string | null;
  team?: string | null;
}

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function loadPlayerReferences() {
  const cachePath = resolve("src/data/players-2026-sleeper.json");
  const rows = JSON.parse(await readFile(cachePath, "utf8")) as CachedSleeperPlayer[];
  return new Map<string, PlayerReference>(rows.map((player) => [player.playerId, {
    name: player.name || player.playerId,
    position: player.pos ?? "",
    team: player.team ?? "",
  }]));
}

function payloadChunk(payload: LeagueHistoryImportPayload, season: SeasonImportPayload): LeagueHistoryImportPayload {
  return { ...payload, seasons: [season] };
}

async function writeImportChunks(payload: LeagueHistoryImportPayload, chunksDirectory: string) {
  const absoluteDirectory = resolve(chunksDirectory);
  await mkdir(absoluteDirectory, { recursive: true });
  let chunkNumber = 0;
  const writeChunk = async (label: string, season: SeasonImportPayload) => {
    chunkNumber += 1;
    const filename = `${String(chunkNumber).padStart(3, "0")}-${label}.json`;
    await writeFile(resolve(absoluteDirectory, filename), JSON.stringify(payloadChunk(payload, season)), "utf8");
  };
  for (const season of payload.seasons) {
    const foundation = {
      ...season,
      weeklyResults: [],
      transactions: [],
    };
    await writeChunk(`season-${season.season}-foundation`, foundation);
    for (let index = 0; index < season.weeklyResults.length; index += 48) {
      await writeChunk(`season-${season.season}-weekly-${String(index / 48 + 1).padStart(2, "0")}`, {
        ...foundation,
        matchups: [],
        playoffMatches: [],
        drafts: [],
        weeklyResults: season.weeklyResults.slice(index, index + 48),
      });
    }
    for (let index = 0; index < season.transactions.length; index += 75) {
      await writeChunk(`season-${season.season}-transactions-${String(index / 75 + 1).padStart(2, "0")}`, {
        ...foundation,
        matchups: [],
        playoffMatches: [],
        drafts: [],
        transactions: season.transactions.slice(index, index + 75),
      });
    }
  }
  console.log(`[league-history] wrote ${chunkNumber} resumable import chunks to ${absoluteDirectory}`);
}

function parseEnvironmentFile(contents: string) {
  const values: Record<string, string> = {};
  for (const sourceLine of contents.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function firebaseImportConfig() {
  const environmentPath = resolve(option("env-file") || ".env");
  let fileValues: Record<string, string> = {};
  try {
    fileValues = parseEnvironmentFile(await readFile(environmentPath, "utf8"));
  } catch {
    // Hosted/server environments can provide the same values directly.
  }
  const value = (key: string) => process.env[key] || fileValues[key] || "";
  const config = {
    apiKey: value("VITE_FIREBASE_API_KEY"),
    authDomain: value("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: value("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: value("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: value("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: value("VITE_FIREBASE_APP_ID"),
  };
  const missing = Object.entries(config).filter(([, entry]) => !entry).map(([key]) => key);
  if (missing.length) throw new Error(`Firebase import configuration is missing: ${missing.join(", ")}.`);
  return config;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

async function waitForTemporaryRules(uid: string) {
  if (!process.stdin.isTTY) {
    throw new Error("The guarded Firebase import requires an interactive terminal so the same one-time authenticated session can remain paused while its UID-scoped rule is deployed.");
  }
  console.log(`[league-history] authenticated one-time Firebase importer UID: ${uid}`);
  console.log("[league-history] deploy the UID-scoped temporary import rule, then press Enter to continue");
  process.stdin.resume();
  await new Promise<void>((complete) => process.stdin.once("data", () => complete()));
  process.stdin.pause();
}

type WriteOperation =
  | { type: "set"; reference: DocumentReference<DocumentData>; data: DocumentData }
  | { type: "delete"; reference: DocumentReference<DocumentData> };

async function commitOperations(database: ReturnType<typeof getFirestore>, operations: WriteOperation[]) {
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(database);
    for (const operation of operations.slice(offset, offset + 400)) {
      if (operation.type === "set") batch.set(operation.reference, operation.data);
      else batch.delete(operation.reference);
    }
    await batch.commit();
    console.log(`[league-history] committed ${Math.min(offset + 400, operations.length)}/${operations.length} Firestore writes`);
  }
}

async function importToFirestore(payload: LeagueHistoryImportPayload, routeAliases: string[]) {
  if (!process.stdin.isTTY) {
    throw new Error("The guarded Firebase import requires an interactive terminal. Use --dry-run for unattended validation.");
  }
  const config = await firebaseImportConfig();
  const app = initializeApp(config, `league-history-import-${Date.now()}`);
  let importerUser: User | null = null;
  try {
    const auth = getAuth(app);
    const credential = await signInAnonymously(auth);
    importerUser = credential.user;
    await waitForTemporaryRules(credential.user.uid);
    const database = getFirestore(app);
    const initialBundle = buildFirestoreLeagueHistoryBundle(payload, routeAliases);
    const rootReference = doc(database, FIRESTORE_HISTORY_COLLECTION, initialBundle.historyId);
    const existingRoot = await getDoc(rootReference);
    const existingAliases = existingRoot.exists()
      ? (existingRoot.data() as Partial<FirestoreLeagueHistoryRoot>).routeIds ?? []
      : [];
    const bundle = initialBundle;
    bundle.root.routeIds = [...new Set([...bundle.root.routeIds, ...existingAliases, ...routeAliases])];
    const chunkCollection = collection(rootReference, FIRESTORE_SNAPSHOT_COLLECTION);
    const weekCollection = collection(rootReference, FIRESTORE_WEEK_COLLECTION);
    const [existingChunks, existingWeeks] = await Promise.all([getDocs(chunkCollection), getDocs(weekCollection)]);
    const desiredChunkIds = new Set(bundle.chunks.map((entry) => entry.id));
    const desiredWeekIds = new Set(bundle.weeks.map((entry) => entry.id));
    const operations: WriteOperation[] = [
      { type: "set", reference: rootReference, data: bundle.root },
      ...bundle.chunks.map((entry): WriteOperation => ({
        type: "set",
        reference: doc(chunkCollection, entry.id),
        data: entry.data,
      })),
      ...bundle.weeks.map((entry): WriteOperation => ({
        type: "set",
        reference: doc(weekCollection, entry.id),
        data: entry.data,
      })),
      ...existingChunks.docs.filter((entry) => !desiredChunkIds.has(entry.id)).map((entry): WriteOperation => ({ type: "delete", reference: entry.ref })),
      ...existingWeeks.docs.filter((entry) => !desiredWeekIds.has(entry.id)).map((entry): WriteOperation => ({ type: "delete", reference: entry.ref })),
    ];
    await commitOperations(database, operations);

    const [verifiedRoot, verifiedChunks, verifiedWeeks] = await Promise.all([
      getDoc(rootReference),
      getDocs(chunkCollection),
      getDocs(weekCollection),
    ]);
    if (!verifiedRoot.exists()) throw new Error("Firestore verification failed: root document is missing.");
    const root = verifiedRoot.data() as FirestoreLeagueHistoryRoot;
    const chunks = verifiedChunks.docs.map((entry) => entry.data() as FirestoreSnapshotChunk);
    const snapshot = assembleLeagueHistorySnapshot(root, chunks);
    const weeks = verifiedWeeks.docs
      .map((entry) => ({ id: entry.id, data: entry.data() as FirestoreWeekDocument }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const expectedWeeks = [...bundle.weeks].sort((left, right) => left.id.localeCompare(right.id));
    const expectedHash = contentHash({ root: bundle.root, snapshot: bundle.snapshot, weeks: expectedWeeks });
    const actualHash = contentHash({ root, snapshot, weeks });
    if (actualHash !== expectedHash) {
      throw new Error(`Firestore verification failed: content hash mismatch (${actualHash.slice(0, 12)} != ${expectedHash.slice(0, 12)}).`);
    }
    console.log(`[league-history] Firestore import verified: ${bundle.root.counts.seasons} seasons, ${bundle.root.counts.matchups} matchups, ${bundle.root.counts.weeklyResults} weekly rosters, ${bundle.root.counts.weeklyPlayerResults} player rows`);
    console.log(`[league-history] Firestore content SHA-256: ${actualHash}`);
    return { historyId: bundle.historyId, counts: bundle.root.counts, hash: actualHash };
  } finally {
    if (importerUser) await deleteUser(importerUser).catch(() => undefined);
    await deleteApp(app);
  }
}

async function main() {
  const leagueId = option("league") || process.argv.find((argument) => /^\d{10,}$/.test(argument)) || "";
  if (!leagueId) {
    throw new Error("Usage: npm run league:history:import -- --league=<numeric Sleeper league ID> [--auction-sources=<config.json>] [--route-aliases=<legacy-id,...>] [--only-seasons=2024,2025] [--drafts-only]");
  }
  const players = await loadPlayerReferences();
  const client = new SleeperApiClient();
  console.log(`[league-history] discovering Sleeper season chain for ${leagueId}`);
  const history = await client.loadHistory(leagueId);
  let payload = mapSleeperHistory(history, players);
  console.log(`[league-history] mapped ${payload.seasons.length} seasons, ${payload.seasons.reduce((sum, season) => sum + season.matchups.length, 0)} matchups, ${payload.seasons.reduce((sum, season) => sum + season.transactions.length, 0)} transactions, ${payload.seasons.reduce((sum, season) => sum + season.drafts.reduce((draftSum, draft) => draftSum + draft.picks.length, 0), 0)} draft picks, ${payload.seasons.reduce((sum, season) => sum + season.awards.length, 0)} weekly awards, and ${payload.seasons.reduce((sum, season) => sum + season.moments.length, 0)} permanent moments`);

  const auctionSourcesPath = option("auction-sources");
  if (auctionSourcesPath) {
    const sources = JSON.parse(await readFile(resolve(auctionSourcesPath), "utf8")) as SpreadsheetAuctionSource[];
    if (!Array.isArray(sources) || !sources.length) throw new Error("--auction-sources must point to a non-empty JSON array.");
    const merged = await mergeSpreadsheetAuctionSources(payload, sources, players);
    payload = merged.payload;
    for (const validation of merged.validations) {
      console.log(`[league-history] ${validation.season} auction: ${validation.sales} sales, $${validation.spend}, ${validation.managerMatches.length} validated managers${validation.isComplete ? "" : ", partial ledger"}`);
      for (const warning of validation.warnings) console.warn(`[league-history] warning: ${warning}`);
    }
    const auctionReportPath = option("auction-report");
    if (auctionReportPath) {
      const absoluteReportPath = resolve(auctionReportPath);
      await mkdir(dirname(absoluteReportPath), { recursive: true });
      await writeFile(absoluteReportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: merged.validations }, null, 2)}\n`, "utf8");
      console.log(`[league-history] wrote auction validation report to ${absoluteReportPath}`);
    }
  }

  const selectedSeasons = option("only-seasons").split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  if (selectedSeasons.length) payload = { ...payload, seasons: payload.seasons.filter((season) => selectedSeasons.includes(season.season)) };
  if (hasFlag("drafts-only")) {
    payload = { ...payload, seasons: payload.seasons.map((season) => ({
      ...season,
      weeklyResults: [],
      matchups: [],
      playoffMatches: [],
      transactions: [],
      awards: [],
      moments: [],
    })) };
  }
  if (selectedSeasons.length || hasFlag("drafts-only")) {
    console.log(`[league-history] scoped payload to ${payload.seasons.map((season) => season.season).join(", ") || "no"} seasons${hasFlag("drafts-only") ? " and draft/franchise rows only" : ""}`);
  }

  const outputPath = option("output");
  if (outputPath) {
    const absoluteOutputPath = resolve(outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`[league-history] wrote normalized payload to ${absoluteOutputPath}`);
  }
  const chunksDirectory = option("chunks-dir");
  if (chunksDirectory) await writeImportChunks(payload, chunksDirectory);
  if (hasFlag("firestore-plan")) {
    const routeAliases = option("route-aliases").split(",").map((value) => value.trim()).filter(Boolean);
    const bundle = buildFirestoreLeagueHistoryBundle(payload, routeAliases);
    const largestChunk = Math.max(0, ...bundle.chunks.map((entry) => new TextEncoder().encode(JSON.stringify(entry.data)).length));
    const largestWeek = Math.max(0, ...bundle.weeks.map((entry) => new TextEncoder().encode(JSON.stringify(entry.data)).length));
    console.log(`[league-history] Firestore plan: ${bundle.chunks.length} snapshot chunks, ${bundle.weeks.length} week documents, largest chunk ${largestChunk} bytes, largest week ${largestWeek} bytes`);
    console.log(`[league-history] Firestore counts: ${JSON.stringify(bundle.root.counts)}`);
  }
  if (hasFlag("dry-run")) return;
  const routeAliases = option("route-aliases").split(",").map((value) => value.trim()).filter(Boolean);
  const result = await importToFirestore(payload, routeAliases);
  console.log(`[league-history] Firebase import complete: league ${result.historyId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
