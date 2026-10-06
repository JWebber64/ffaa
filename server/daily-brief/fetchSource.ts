export type SourceReader = (url: string, limit?: number, headers?: Record<string, string>) => Promise<{ text: string; updatedAt: string | null }>;
export function sourceReader(fetchImpl: typeof fetch = fetch): SourceReader {
  const cache = new Map<string, Promise<{ text: string; updatedAt: string | null }>>();
  return (url, limit = 8_000_000, headers = {}) => {
    const key = JSON.stringify([url, limit, headers]);
    let pending = cache.get(key);
    if (!pending) {
      pending = (async () => {
        const response = await fetchImpl(url, { headers: { Accept: "application/json,text/csv", ...headers }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error("Source returned HTTP " + response.status);
        if (Number(response.headers.get("content-length") ?? 0) > limit) throw new Error("Source exceeds size limit");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Empty source response");
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
            if (size > limit) throw new Error("Source exceeds size limit"); chunks.push(value); }
        } finally { await reader.cancel(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const modified = response.headers.get("last-modified");
        return { text: new TextDecoder().decode(bytes), updatedAt: modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null };
      })();
      cache.set(key, pending);
    }
    return pending;
  };
}
export async function boundedMap<T, U>(items: T[], operation: (item: T) => Promise<U>, concurrency = 6) {
  const results: PromiseSettledResult<U>[] = new Array(items.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) { const i = index++; if (i >= items.length) return;
      try { results[i] = { status: "fulfilled", value: await operation(items[i]!) }; }
      catch (reason) { results[i] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value); return Number.isFinite(number) ? number : null;
}
export function csvRecords(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if (char === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("Invalid CSV response");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift()?.map(key => key.replace(/^\uFEFF/, "")) ?? [];
  return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] ?? ""])));
}
