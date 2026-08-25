import { useCallback, useEffect, useState } from "react";
import type { LeagueHistorySnapshot } from "./domain/types";
import { loadLeagueHistory } from "./persistence/firebaseLeagueHistory";

type LeagueHistoryState = {
  status: "loading" | "ready" | "error";
  data: LeagueHistorySnapshot | null;
  error: string;
};

export function useLeagueHistory(routeId: string) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<LeagueHistoryState>({ status: "loading", data: null, error: "" });
  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null, error: "" });
    void loadLeagueHistory(routeId, { refresh: refreshKey > 0 }).then((data) => {
      if (active) setState({ status: "ready", data, error: "" });
    }).catch((error: unknown) => {
      if (active) setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "League history could not be loaded.",
      });
    });
    return () => { active = false; };
  }, [routeId, refreshKey]);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  return { ...state, refresh };
}
