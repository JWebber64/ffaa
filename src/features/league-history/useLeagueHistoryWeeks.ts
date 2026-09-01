import { useEffect, useState } from "react";

import { buildLeagueHistoryCoverage } from "./coverage/historyCoverage";
import type { LeagueHistorySnapshot } from "./domain/types";
import { loadLeagueHistoryWeeks } from "./persistence/firebaseLeagueHistory";

type HydratedHistoryState = {
  status: "loading" | "ready" | "error";
  data: LeagueHistorySnapshot;
  error: string;
};

function withCoverage(snapshot: LeagueHistorySnapshot) {
  return {
    ...snapshot,
    coverage: buildLeagueHistoryCoverage(
      snapshot,
      snapshot.coverage?.generatedAt ?? snapshot.league.updatedAt,
    ),
  };
}

export function useLeagueHistoryWeeks(routeId: string, snapshot: LeagueHistorySnapshot) {
  const alreadyHydrated = snapshot.weeklyResults.length > 0 || snapshot.weeklyPlayerResults.length > 0;
  const [state, setState] = useState<HydratedHistoryState>(() => ({
    status: alreadyHydrated ? "ready" : "loading",
    data: alreadyHydrated ? withCoverage(snapshot) : snapshot,
    error: "",
  }));

  useEffect(() => {
    let active = true;
    if (snapshot.weeklyResults.length > 0 || snapshot.weeklyPlayerResults.length > 0 || !snapshot.seasons.length) {
      setState({ status: "ready", data: withCoverage(snapshot), error: "" });
      return () => { active = false; };
    }
    setState({ status: "loading", data: snapshot, error: "" });
    void loadLeagueHistoryWeeks(routeId).then((weeks) => {
      if (!active) return;
      setState({
        status: "ready",
        data: withCoverage({ ...snapshot, ...weeks }),
        error: "",
      });
    }).catch((error: unknown) => {
      if (!active) return;
      setState({
        status: "error",
        data: snapshot,
        error: error instanceof Error ? error.message : "Weekly history could not be loaded.",
      });
    });
    return () => { active = false; };
  }, [routeId, snapshot]);

  return state;
}


