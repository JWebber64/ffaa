import { useCallback, useEffect, useState } from "react";
import type { LeagueHistorySnapshot } from "./domain/types";
import { ensureLeagueHistoryImported } from "./automaticImport";
import {
  isLeagueHistoryNotImportedError,
  loadLeagueHistory,
} from "./persistence/firebaseLeagueHistory";

type LeagueHistoryState = {
  status: "loading" | "importing" | "ready" | "error";
  data: LeagueHistorySnapshot | null;
  error: string;
};

export function useLeagueHistory(routeId: string) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<LeagueHistoryState>({ status: "loading", data: null, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ status: "loading", data: null, error: "" });
    const load = async () => {
      try {
        const data = await loadLeagueHistory(routeId, { refresh: refreshKey > 0 });
        if (active) setState({ status: "ready", data, error: "" });
      } catch (error) {
        if (!isLeagueHistoryNotImportedError(error)) throw error;
        if (active) setState({ status: "importing", data: null, error: "" });
        await ensureLeagueHistoryImported(routeId, { signal: controller.signal });
        const data = await loadLeagueHistory(routeId, { refresh: true });
        if (active) setState({ status: "ready", data, error: "" });
      }
    };
    void load().catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "League history could not be loaded.",
      });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [routeId, refreshKey]);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  return { ...state, refresh };
}
