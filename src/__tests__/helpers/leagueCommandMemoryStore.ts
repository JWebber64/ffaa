import { firestoreDocument, firestoreObject, type FirestoreWrite } from "../../../server/league-history/firestoreRest";
import type {
  LeagueCommandStore,
  LeagueCommandStoredDocument,
} from "../../../server/league-commands/store";

type Stored = { data: Record<string, unknown>; updateTime: string };

function pathFromName(name: string) {
  const marker = "/documents/";
  const index = name.indexOf(marker);
  return index >= 0 ? name.slice(index + marker.length) : name;
}

function parentPath(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

export class LeagueCommandMemoryStore implements LeagueCommandStore {
  private readonly documents = new Map<string, Stored>();
  private revision = 0;

  seed(path: string, data: Record<string, unknown>) {
    this.documents.set(path, { data: structuredClone(data), updateTime: this.nextUpdateTime() });
  }

  read(path: string) {
    return this.documents.get(path)?.data ?? null;
  }

  paths() {
    return [...this.documents.keys()].sort();
  }

  async get(path: string): Promise<LeagueCommandStoredDocument | null> {
    const stored = this.documents.get(path);
    return stored ? { path, data: structuredClone(stored.data), updateTime: stored.updateTime } : null;
  }

  async list(path: string): Promise<LeagueCommandStoredDocument[]> {
    return [...this.documents.entries()]
      .filter(([documentPath]) => parentPath(documentPath) === path)
      .map(([documentPath, stored]) => ({
        path: documentPath,
        data: structuredClone(stored.data),
        updateTime: stored.updateTime,
      }));
  }

  async commit(writes: FirestoreWrite[]) {
    for (const write of writes) {
      const path = write.update ? pathFromName(write.update.name) : write.delete ? pathFromName(write.delete) : "";
      if (!path) continue;
      const current = this.documents.get(path);
      if (write.currentDocument?.exists === false && current) throw new Error(`ALREADY_EXISTS: ${path}`);
      if (write.currentDocument?.updateTime && current?.updateTime !== write.currentDocument.updateTime) {
        throw new Error(`FAILED_PRECONDITION: ${path}`);
      }
    }
    for (const write of writes) {
      if (write.delete) {
        this.documents.delete(pathFromName(write.delete));
        continue;
      }
      if (!write.update) continue;
      const data = firestoreObject(write.update) ?? {};
      this.documents.set(pathFromName(write.update.name), {
        data,
        updateTime: this.nextUpdateTime(),
      });
    }
  }

  document(path: string, data: Record<string, unknown>) {
    return firestoreDocument(path, data);
  }

  private nextUpdateTime() {
    this.revision += 1;
    return `2026-09-02T00:00:${String(this.revision).padStart(2, "0")}.000000Z`;
  }
}
