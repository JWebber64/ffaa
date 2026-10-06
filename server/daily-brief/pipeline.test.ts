// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { briefResponse } from "./handler";
import { runBrief, type BriefProvider } from "./pipeline";
import { localBriefStore } from "./localStore";
import { databaseBriefStore, type BriefDatabase, type StoredDocument } from "./databaseStore";
import type { BriefEdition } from "../../src/features/daily-brief/model";
const fixture: BriefEdition = { version: 1, sport: "football", date: "2026-10-05", generatedAt: "2026-10-06T12:00:00Z", revision: "initial", status: "complete", games: [], upcoming: [], observations: [], sources: [], warnings: [] };
const provider: BriefProvider = async (date, now) => ({ ...fixture, date, generatedAt: now });
describe("scheduled edition persistence", () => {
  it("reports storage failures instead of treating them as concurrent runs", async () => {
    const store = databaseBriefStore({ get: async () => null, commit: async () => { throw new Error("Storage unavailable"); } }, "isolatedBriefs");
    const response = await briefResponse(new Request("https://example.com/api?operation=generate", { headers: { authorization: "Bearer secret" } }), { store: () => store, provider, secret: "secret", now: new Date(fixture.generatedAt) });
    expect(response.status).toBe(503);
  });
  it("rejects unauthorized generation before touching storage, invalid dates and other methods", async () => {
    let touched = false;
    const options = { store: () => { touched = true; return localBriefStore(); }, provider, secret: "secret", now: new Date(fixture.generatedAt) };
    expect((await briefResponse(new Request("https://example.com/api?operation=generate"), options)).status).toBe(401);
    expect(touched).toBe(false);
    expect((await briefResponse(new Request("https://example.com/api?date=2026-02-30"), options)).status).toBe(400);
    expect((await briefResponse(new Request("https://example.com/api", { method: "POST" }), options)).status).toBe(405);
  });
  it("persists editions, retries idempotently, applies corrections and preserves successful data after failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fantasy-brief-")), store = localBriefStore(directory);
    try {
      const now = new Date(fixture.generatedAt);
      expect((await runBrief(store, provider, { now, corrections: false }))?.[0]?.status).toBe("published");
      expect((await runBrief(store, provider, { now, corrections: false }))?.[0]?.status).toBe("unchanged");
      const corrected: BriefProvider = async (date, time) => ({ ...fixture, date, generatedAt: time, warnings: ["Stat correction"] });
      expect((await runBrief(store, corrected, { now, corrections: false }))?.[0]?.status).toBe("published");
      const failing: BriefProvider = async () => { throw new Error("Feed unavailable"); };
      expect((await runBrief(store, failing, { now, corrections: false }))?.[0]?.status).toBe("failed");
      expect((await store.read(fixture.date))?.warnings).toEqual(["Stat correction"]);
      expect((await store.archive())).toHaveLength(1);
      expect((await runBrief(store, async (date, time) => ({ ...fixture, date, generatedAt: time, status: "partial" }), { now, corrections: false }))?.[0]?.status).toBe("retained");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("locks concurrent runs and saves immutable durable revisions", async () => {
    const documents = new Map<string, StoredDocument>(); let revision = 0;
    const db: BriefDatabase = { get: async path => documents.get(path) ?? null, commit: async writes => {
      for (const write of writes) if ((documents.get(write.path)?.updateTime ?? null) !== write.expected) throw new Error("Conflict");
      for (const write of writes) { if (write.data === null) documents.delete(write.path); else documents.set(write.path, { data: write.data, updateTime: String(++revision) }); }
    } };
    const store = databaseBriefStore(db, "isolatedBriefs");
    await store.withLock(async () => {
      expect(await store.withLock(async () => true)).toBeNull();
      await store.publish(fixture);
      await store.publish({ ...fixture, revision: "corrected", warnings: ["Changed"] });
    });
    expect([...documents.keys()].filter(key => key.includes("/revisions/"))).toHaveLength(2);
    expect((await store.read(fixture.date))?.warnings).toEqual(["Changed"]);
    expect(await store.withLock(async () => "released")).toBe("released");
  });
});
