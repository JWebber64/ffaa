import { useCallback, useEffect, useState } from "react";

import type { LeagueHistorySnapshot, LeagueWeekPayload } from "./domain/types";
import { loadLeagueWeek } from "./persistence/firebaseLeagueHistory";

type LeagueWeekState = {
  status: "idle" | "loading" | "ready" | "error";
  data: LeagueWeekPayload | null;
  error: string;
};

export function useLeagueWeek(snapshot: LeagueHistorySnapshot, seasonNumber: number | null, week: number | null) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<LeagueWeekState>({ status: "idle", data: null, error: "" });
  const season = snapshot.seasons.find((row) => row.season === seasonNumber) ?? null;
  useEffect(() => {
    if (!season || !week) {
      setState({ status: "idle", data: null, error: "" });
      return undefined;
    }
    const controller = new AbortController();
    setState((current) => ({ status: "loading", data: current.data, error: "" }));
    void loadLeagueWeek(snapshot.league.id, season, week, {
      refresh: refreshKey > 0,
      signal: controller.signal,
    }).then((data) => {
      if (!controller.signal.aborted) setState({ status: "ready", data, error: "" });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "Weekly league data could not be loaded.",
      });
    });
    return () => controller.abort();
  }, [refreshKey, season, snapshot.league.id, week]);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  return { ...state, season, refresh };
}
