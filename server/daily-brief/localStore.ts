import { mkdir, readFile, writeFile, rename, open, unlink, stat, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { editionSchema, type BriefEdition, type BriefSummary } from "../../src/features/daily-brief/model.js";
import type { BriefStore } from "./pipeline.js";
export function localBriefStore(directory = ".local/daily-brief"): BriefStore {
  const root = resolve(directory);
  async function read(date: string) {
    try { return editionSchema.parse(JSON.parse(await readFile(join(root, date + ".json"), "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  return {
    read,
    async archive() {
      await mkdir(root, { recursive: true }); const summaries: BriefSummary[] = [];
      for (const name of (await readdir(root)).filter(name => /^20\d{2}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse().slice(0, 60)) {
        const edition = await read(name.slice(0, 10)); if (edition) summaries.push({ date: edition.date, generatedAt: edition.generatedAt, status: edition.status, revision: edition.revision });
      }
      return summaries;
    },
    async publish(edition: BriefEdition) {
      await mkdir(root, { recursive: true }); const previous = await read(edition.date);
      if (previous?.revision === edition.revision) return "unchanged";
      if (previous?.status === "complete" && edition.status === "partial") return "retained";
      await mkdir(join(root, "revisions"), { recursive: true });
      await writeFile(join(root, "revisions", edition.date + "-" + edition.revision + ".json"), JSON.stringify(edition), { flag: "wx" }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
      const temporary = join(root, randomUUID() + ".pending");
      await writeFile(temporary, JSON.stringify(edition));
      await rename(temporary, join(root, edition.date + ".json")); return "published";
    },
    async withLock(operation) {
      await mkdir(root, { recursive: true }); const lockPath = join(root, "ingest.lock");
      try { const saved = await stat(lockPath); if (Date.now() - saved.mtimeMs > 600000) await unlink(lockPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      let lock;
      try { lock = await open(lockPath, "wx"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return null; throw error; }
      try { return await operation(); } finally { await lock.close(); await unlink(lockPath).catch(() => undefined); }
    },
  };
}
