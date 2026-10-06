import { useState, useSyncExternalStore } from "react";
const key = "ffaa.dailyBrief.watchlist.v1", listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); window.addEventListener("storage", listener); return () => { listeners.delete(listener); window.removeEventListener("storage", listener); }; }
function snapshot() { try { return localStorage.getItem(key) ?? "[]"; } catch { return "[]"; } }
export function useBriefWatchlist() {
  const [error, setError] = useState("");
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let ids: string[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) ids = parsed.filter((value): value is string => typeof value === "string").slice(0, 200); } catch { /* Recover invalid local data without touching other stores. */ }
  return { ids, error, toggle(id: string) {
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id].slice(-200);
    try { localStorage.setItem(key, JSON.stringify(next)); setError(""); listeners.forEach(listener => listener()); }
    catch { setError("Your browser could not save this watchlist. Check its storage permissions and try again."); }
  } };
}
