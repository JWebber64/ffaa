import { createFirestoreLeagueCommandStore } from "./store";
import { runDueNativeWaivers } from "./nativeWaiverScheduler";

interface ApiRequest { method?: string; headers: Record<string, string | string[] | undefined>; }
interface ApiResponse { setHeader(name: string, value: string): void; status(code: number): ApiResponse; json(value: unknown): void; }
function header(request: ApiRequest, name: string) { const value = request.headers[name] ?? request.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] : value; }

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") { response.status(405).json({ ok: false, error: "method_not_allowed" }); return; }
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || header(request, "authorization") !== `Bearer ${secret}`) { response.status(401).json({ ok: false, error: "cron_authorization_required" }); return; }
  try {
    const results = await runDueNativeWaivers(createFirestoreLeagueCommandStore(header(request, "x-vercel-oidc-token")));
    response.status(results.some((entry) => entry.status === "failed") ? 207 : 200).json({ ok: !results.some((entry) => entry.status === "failed"), processed: results.filter((entry) => entry.status === "processed").length, results });
  } catch (error) {
    console.error("[waiver-cron]", error); response.status(500).json({ ok: false, error: error instanceof Error ? error.message : "waiver_cron_failed" });
  }
}
