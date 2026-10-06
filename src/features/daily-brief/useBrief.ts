import { useEffect, useState } from "react";
import { z } from "zod";
import { editionSchema, dateSchema } from "./model";
const responseSchema = z.object({ edition: editionSchema.nullable(), archive: z.array(editionSchema.pick({ date: true, generatedAt: true, status: true, revision: true })).max(60), expectedDate: dateSchema });
type State = { key: string; data: z.infer<typeof responseSchema> | null; error: string };
export function useBrief(endpoint: string, date: string) {
  const [attempt, setAttempt] = useState(0), [saved, setSaved] = useState<State>({ key: "", data: null, error: "" });
  const url = endpoint + (date ? "?date=" + encodeURIComponent(date) : ""), key = url + ":" + attempt;
  useEffect(() => {
    if (date) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setAttempt(value => value + 1);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [date]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Daily brief could not load. Retry or check back after the next scheduled edition.");
      const data = responseSchema.parse(await response.json());
      if (!controller.signal.aborted) setSaved({ key, data, error: "" });
    }).catch(error => { if (!controller.signal.aborted) setSaved({ key, data: null, error: error instanceof Error ? error.message : "Daily brief is unavailable." }); });
    return () => controller.abort();
  }, [url, key]);
  return { data: saved.key === key ? saved.data : null, error: saved.key === key ? saved.error : "",
    loading: saved.key !== key, retry: () => setAttempt(value => value + 1) };
}
