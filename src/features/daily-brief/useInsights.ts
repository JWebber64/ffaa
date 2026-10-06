import { useEffect, useState, useSyncExternalStore } from "react";
import { emptyInsights, insightsSchema, updateInsights, type BriefInsights } from "./insights";
import type { BriefEdition, LeagueBriefContext } from "./model";
import type { BriefCandidate } from "./ranking";

const cache = new Map<string, { raw: string | null; value: BriefInsights }>();
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener); window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
function read(key: string) {
  if (!key) return emptyInsights;
  try {
    const raw = localStorage.getItem(key), existing = cache.get(key);
    if (existing && existing.raw === raw) return existing.value;
    const parsed = raw ? insightsSchema.safeParse(JSON.parse(raw)) : null;
    const value = parsed?.success ? parsed.data : emptyInsights;
    cache.set(key, { raw, value }); return value;
  } catch { return emptyInsights; }
}
export function useInsights(edition: BriefEdition, context: LeagueBriefContext | null, candidates: BriefCandidate[], current: boolean) {
  const key = context?.scopeKey ? `dailyBrief.${edition.sport}.${encodeURIComponent(context.scopeKey)}.insights.v1` : "";
  const saved = useSyncExternalStore(subscribe, () => read(key), () => emptyInsights);
  const [error, setError] = useState("");
  function write(value: BriefInsights) {
    if (!key) return;
    try {
      const parsed = insightsSchema.parse(value), raw = JSON.stringify(parsed);
      if (raw === JSON.stringify(read(key))) return;
      localStorage.setItem(key, raw); cache.set(key, { raw, value: parsed }); notify(); setError("");
    } catch { setError("Brief preferences could not be saved in this browser. Check browser storage and try again."); }
  }
  useEffect(() => {
    if (!key || !context) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const latest = read(key), next = updateInsights(latest, edition, context, candidates, current);
      if (JSON.stringify(latest) === JSON.stringify(next)) return;
      try {
        const raw = JSON.stringify(insightsSchema.parse(next));
        localStorage.setItem(key, raw); cache.set(key, { raw, value: next }); notify(); setError("");
      } catch { setError("Observed results could not be saved in this browser. Check browser storage and try again."); }
    });
    return () => { active = false; };
  }, [key, saved, edition, context, candidates, current]);
  return { saved, write, error };
}
