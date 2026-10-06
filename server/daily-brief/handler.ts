import { timingSafeEqual } from "node:crypto";
import { dateSchema, previousGameDate, addDays } from "../../src/features/daily-brief/model.js";
import { runBrief, type BriefStore, type BriefProvider } from "./pipeline.js";
export async function briefResponse(request: Request, options: { store: () => BriefStore; provider: BriefProvider; secret?: string | undefined; now?: Date; fetchImpl?: typeof fetch }) {
  const url = new URL(request.url), cron = url.searchParams.get("operation") === "generate";
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
  if (cron) {
    const secret = options.secret ?? process.env.CRON_SECRET;
    const expected = Buffer.from("Bearer " + (secret ?? "")), actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return Response.json({ error: "Scheduler authorization required" }, { status: 401, headers });
  } else if (url.searchParams.get("operation") && url.searchParams.get("operation") !== "read") {
    return Response.json({ error: "Invalid operation" }, { status: 400, headers });
  }
  const now = options.now ?? new Date(), latest = previousGameDate(now);
  const parsed = dateSchema.safeParse(url.searchParams.get("date") ?? latest);
  if (!parsed.success || parsed.data > latest || parsed.data < addDays(latest, -365)) return Response.json({ error: "Invalid or unavailable game date" }, { status: 400, headers });
  try {
    const store = options.store();
    if (cron) {
      const result = await runBrief(store, options.provider, { now, date: parsed.data, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
      return Response.json({ results: result, message: result === null ? "A report run is already in progress" : undefined }, { status: result === null ? 202 : result.some(row => row.status === "failed") ? 502 : 200, headers });
    }
    const archive = await store.archive(), selected = url.searchParams.has("date") ? parsed.data : archive[0]?.date ?? latest;
    const edition = await store.read(selected);
    return Response.json({ edition, archive, expectedDate: latest }, { headers: { ...headers, "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
  } catch { return Response.json({ error: "Daily brief storage is unavailable. The previous report will remain saved." }, { status: 503, headers }); }
}
