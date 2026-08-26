import { FIRESTORE_PROJECT_ID, getFirestoreAccessToken } from "./googleFederation";

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export interface FirestoreWrite {
  update?: FirestoreDocument;
  delete?: string;
  currentDocument?: { exists?: boolean; updateTime?: string };
}

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim();
const FIRESTORE_ORIGIN = FIRESTORE_EMULATOR_HOST
  ? `http://${FIRESTORE_EMULATOR_HOST}`
  : "https://firestore.googleapis.com";
const DOCUMENTS_ROOT = `${FIRESTORE_ORIGIN}/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;
const RESOURCE_ROOT = `projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;
const MAX_COMMIT_BYTES = 8_000_000;
const MAX_COMMIT_WRITES = 400;

function fieldsFromObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, toFirestoreValue(entry)]));
}

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value == null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    const values = value.map(toFirestoreValue);
    return { arrayValue: values.length ? { values } : {} };
  }
  if (typeof value === "object") {
    const fields = fieldsFromObject(value as Record<string, unknown>);
    return { mapValue: Object.keys(fields).length ? { fields } : {} };
  }
  return { stringValue: String(value) };
}

export function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value || "nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, entry]) => [key, fromFirestoreValue(entry)]));
}

export function firestoreDocument(path: string, data: Record<string, unknown>): FirestoreDocument {
  return { name: `${RESOURCE_ROOT}/${path}`, fields: fieldsFromObject(data) };
}

export function firestoreObject(document: FirestoreDocument | null) {
  if (!document) return null;
  return Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function authorizedFetch(url: string, init: RequestInit = {}) {
  if (FIRESTORE_EMULATOR_HOST) {
    return fetch(url, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  }
  const token = await getFirestoreAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const error = payload.error as Record<string, unknown> | undefined;
  return String(error?.message ?? `Firestore returned ${response.status}.`);
}

export async function getFirestoreDocument(path: string) {
  const response = await authorizedFetch(`${DOCUMENTS_ROOT}/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<FirestoreDocument>;
}

export async function findLeagueHistoryByRouteId(routeId: string) {
  const response = await authorizedFetch(`${DOCUMENTS_ROOT}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "leagueHistories" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "routeIds" },
            op: "ARRAY_CONTAINS",
            value: { stringValue: routeId },
          },
        },
        limit: 1,
      },
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.find((row) => row.document)?.document ?? null;
}

export async function listFirestoreDocumentNames(path: string) {
  const names: string[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await authorizedFetch(`${DOCUMENTS_ROOT}/${path}?${query}`);
    if (response.status === 404) return names;
    if (!response.ok) throw new Error(await errorMessage(response));
    const payload = await response.json() as { documents?: FirestoreDocument[]; nextPageToken?: string };
    names.push(...(payload.documents ?? []).map((document) => document.name));
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);
  return names;
}

export function splitFirestoreWrites(writes: FirestoreWrite[]) {
  const groups: FirestoreWrite[][] = [];
  let group: FirestoreWrite[] = [];
  let groupBytes = 0;
  for (const write of writes) {
    const writeBytes = Buffer.byteLength(JSON.stringify(write));
    if (group.length && (group.length >= MAX_COMMIT_WRITES || groupBytes + writeBytes > MAX_COMMIT_BYTES)) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    group.push(write);
    groupBytes += writeBytes;
  }
  if (group.length) groups.push(group);
  return groups;
}

export async function commitFirestoreWrites(writes: FirestoreWrite[]) {
  for (const group of splitFirestoreWrites(writes)) {
    const response = await authorizedFetch(`${DOCUMENTS_ROOT}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: group }),
    });
    if (!response.ok) {
      const error = new Error(await errorMessage(response)) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
  }
}
