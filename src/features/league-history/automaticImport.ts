import {
  LEAGUE_HISTORY_IMPORT_ENDPOINT,
  normalizeLeagueHistoryImportId,
  type LeagueHistoryImportResponse,
} from "../../../shared/leagueHistoryImportProtocol";

interface AutomaticImportOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

function abortableDelay(duration: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The League History import was cancelled.", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, duration);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The League History import was cancelled.", "AbortError"));
    }, { once: true });
  });
}

async function readImportResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as Partial<LeagueHistoryImportResponse> & { error?: string };
  if (!response.ok && response.status !== 202) {
    throw new Error(payload.error || payload.message || `Automatic League History import returned ${response.status}.`);
  }
  if (!payload.status || !payload.leagueId) throw new Error("Automatic League History import returned an invalid response.");
  return payload as LeagueHistoryImportResponse;
}

export async function ensureLeagueHistoryImported(leagueId: string, options: AutomaticImportOptions = {}) {
  const normalized = normalizeLeagueHistoryImportId(leagueId);
  if (!normalized) throw new Error("Enter a valid numeric Sleeper league ID.");
  const fetcher = options.fetcher ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const maxWaitMs = options.maxWaitMs ?? 300_000;
  let result = await readImportResponse(await fetcher(LEAGUE_HISTORY_IMPORT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leagueId: normalized }),
    ...(options.signal ? { signal: options.signal } : {}),
  }));
  const startedAt = Date.now();
  while (result.status === "importing" && Date.now() - startedAt < maxWaitMs) {
    await abortableDelay(pollIntervalMs, options.signal);
    const query = new URLSearchParams({ leagueId: normalized });
    result = await readImportResponse(await fetcher(
      `${LEAGUE_HISTORY_IMPORT_ENDPOINT}?${query}`,
      options.signal ? { signal: options.signal } : {},
    ));
  }
  if (result.status !== "ready") {
    throw new Error(result.message || "League History is still being imported. Try again shortly.");
  }
  return result;
}

export function startLeagueHistoryImport(leagueId: string) {
  return ensureLeagueHistoryImported(leagueId).catch((error: unknown) => {
    console.warn("[league-history] automatic import did not finish", error);
    return null;
  });
}
