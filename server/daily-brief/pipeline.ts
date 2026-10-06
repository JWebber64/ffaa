import { createHash } from "node:crypto";
import { editionSchema, previousGameDate, addDays, type BriefEdition, type BriefSummary } from "../../src/features/daily-brief/model.js";
import { sourceReader, type SourceReader } from "./fetchSource.js";
import { enrichRostership } from "./rostership.js";
export interface BriefStore {
  read(date: string): Promise<BriefEdition | null>;
  archive(): Promise<BriefSummary[]>;
  publish(edition: BriefEdition): Promise<"published" | "unchanged" | "retained">;
  withLock<T>(operation: () => Promise<T>): Promise<T | null>;
}
export type BriefProvider = (date: string, now: string, read: SourceReader) => Promise<BriefEdition>;
export function editionRevision(edition: BriefEdition) {
  return createHash("sha256").update(JSON.stringify({
    sport: edition.sport, date: edition.date, status: edition.status, games: edition.games,
    upcoming: edition.upcoming, observations: edition.observations, warnings: edition.warnings,
    rostership: edition.rostership,
  })).digest("hex").slice(0, 20);
}
export async function runBrief(store: BriefStore, provider: BriefProvider, options: { now?: Date; date?: string; fetchImpl?: typeof fetch; corrections?: boolean } = {}) {
  const now = options.now ?? new Date(), date = options.date ?? previousGameDate(now);
  const read = sourceReader(options.fetchImpl);
  return store.withLock(async () => {
    const results: Array<{ date: string; status: string }> = [];
    const dates = options.corrections === false ? [date] : [date, addDays(date, -1), addDays(date, -2)];
    for (const target of dates) {
      try {
        const saved = await store.read(target);
        const latestDate = !saved?.rostership?.some(row => row.entries.length) ? (await store.archive())[0]?.date : null;
        const previous = latestDate ? await store.read(latestDate) : saved;
        const edition = editionSchema.parse(await enrichRostership(await provider(target, now.toISOString(), read), read, previous));
        edition.revision = editionRevision(edition);
        results.push({ date: target, status: await store.publish(edition) });
      } catch (error) { console.error("[daily-brief]", target, error instanceof Error ? error.message : "Edition generation failed"); results.push({ date: target, status: "failed" }); }
    }
    return results;
  });
}
