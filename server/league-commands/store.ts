import {
  commitFirestoreWritesAtomically,
  firestoreDocument,
  firestoreObject,
  getFirestoreDocument,
  listFirestoreDocuments,
  type FirestoreDocument,
  type FirestoreWrite,
} from "../league-history/firestoreRest";

export type LeagueCommandStoredDocument = {
  path: string;
  data: Record<string, unknown>;
  updateTime: string | null;
};

export interface LeagueCommandStore {
  get(path: string): Promise<LeagueCommandStoredDocument | null>;
  list(path: string): Promise<LeagueCommandStoredDocument[]>;
  commit(writes: FirestoreWrite[]): Promise<void>;
  document(path: string, data: Record<string, unknown>): FirestoreDocument;
}

function stored(path: string, document: FirestoreDocument): LeagueCommandStoredDocument {
  return {
    path,
    data: firestoreObject(document) ?? {},
    updateTime: document.updateTime ?? null,
  };
}

export function createFirestoreLeagueCommandStore(oidcToken?: string): LeagueCommandStore {
  return {
    async get(path) {
      const document = await getFirestoreDocument(path, oidcToken);
      return document ? stored(path, document) : null;
    },
    async list(path) {
      const documents = await listFirestoreDocuments(path, oidcToken);
      return documents.map((document) => stored(document.name, document));
    },
    async commit(writes) {
      await commitFirestoreWritesAtomically(writes, oidcToken);
    },
    document(path, data) {
      return firestoreDocument(path, data);
    },
  };
}
