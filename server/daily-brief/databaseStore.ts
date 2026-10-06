import { randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { editionSchema, type BriefEdition, type BriefSummary } from "../../src/features/daily-brief/model.js";
import type { BriefStore } from "./pipeline.js";
export type StoredDocument = { data: Record<string, unknown>; updateTime: string };
export type AtomicWrite = { path: string; data: Record<string, unknown> | null; expected: string | null };
export interface BriefDatabase {
  get(path: string): Promise<StoredDocument | null>;
  commit(writes: AtomicWrite[]): Promise<void>;
}
const summary = (edition: BriefEdition): BriefSummary => ({ date: edition.date, generatedAt: edition.generatedAt, status: edition.status, revision: edition.revision });
function pack(edition: BriefEdition) {
  const payload = gzipSync(Buffer.from(JSON.stringify(edition))).toString("base64");
  if (payload.length > 900000) throw new Error("Edition exceeds durable storage limit");
  return { payload, codec: "gzip-base64-v1" };
}
function unpack(document: StoredDocument | null): BriefEdition | null {
  if (!document) return null;
  if (document.data.codec !== "gzip-base64-v1" || typeof document.data.payload !== "string") throw new Error("Invalid edition storage");
  return editionSchema.parse(JSON.parse(gunzipSync(Buffer.from(document.data.payload, "base64"), { maxOutputLength: 12000000 }).toString("utf8")));
}
function archive(document: StoredDocument | null): BriefSummary[] {
  if (!document) return [];
  const parsed: unknown = JSON.parse(String(document.data.summaries ?? "[]"));
  if (!Array.isArray(parsed)) throw new Error("Invalid archive");
  return parsed as BriefSummary[];
}
export function databaseBriefStore(db: BriefDatabase, collection: string): BriefStore {
  const indexPath = collection + "/archive", lockPath = collection + "/scheduler";
  return {
    async read(date) { return unpack(await db.get(collection + "/" + date)); },
    async archive() { return archive(await db.get(indexPath)); },
    async publish(edition) {
      const path = collection + "/" + edition.date, revisionPath = collection + "/" + edition.date + "/revisions/" + edition.revision;
      const [saved, index, revision] = await Promise.all([db.get(path), db.get(indexPath), db.get(revisionPath)]);
      const previous = unpack(saved);
      if (previous?.revision === edition.revision) return "unchanged";
      if (previous?.status === "complete" && edition.status === "partial") return "retained";
      const selected = unpack(revision) ?? edition, payload = pack(selected);
      const summaries = [summary(selected), ...archive(index).filter(row => row.date !== edition.date)].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 60);
      await db.commit([
        ...(!revision ? [{ path: revisionPath, data: payload, expected: null }] : []),
        { path, data: payload, expected: saved?.updateTime ?? null },
        { path: indexPath, data: { summaries: JSON.stringify(summaries) }, expected: index?.updateTime ?? null },
      ]);
      return "published";
    },
    async withLock(operation) {
      const token = randomUUID(), saved = await db.get(lockPath);
      if (Number(saved?.data.expiresAt ?? 0) > Date.now()) return null;
      try { await db.commit([{ path: lockPath, data: { token, expiresAt: Date.now() + 600000 }, expected: saved?.updateTime ?? null }]); }
      catch (error) {
        const current = await db.get(lockPath);
        if (Number(current?.data.expiresAt ?? 0) > Date.now() && current?.data.token !== token) return null;
        throw error;
      }
      try { return await operation(); }
      finally { const current = await db.get(lockPath); if (current?.data.token === token) await db.commit([{ path: lockPath, data: null, expected: current.updateTime }]); }
    },
  };
}
