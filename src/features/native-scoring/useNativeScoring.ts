import { useEffect, useState } from "react";

import type { NativeScoringWeek, SeasonTeam } from "../league-domain/types";
import { listNativeDraftTeams } from "../native-draft/nativeDraft";
import { subscribeNativeScoringWeek } from "./nativeScoring";

export type NativeScoringState = {
  status: "loading" | "ready" | "error";
  message: string;
  teams: SeasonTeam[];
  scoringWeek: NativeScoringWeek | null;
};

export function useNativeScoring(leagueId: string, seasonId: string, week: number): NativeScoringState {
  const [state, setState] = useState<NativeScoringState>({ status: "loading", message: "Loading replayable live scoring…", teams: [], scoringWeek: null });
  useEffect(() => {
    let active = true;
    setState({ status: "loading", message: "Loading replayable live scoring…", teams: [], scoringWeek: null });
    void listNativeDraftTeams(leagueId, seasonId).then((teams) => {
      if (active) setState((current) => ({ ...current, status: "ready", message: "Live scoring is synchronized.", teams }));
    }).catch((error) => {
      if (active) setState((current) => ({ ...current, status: "error", message: error instanceof Error ? error.message : "Native teams could not be loaded." }));
    });
    const unsubscribe = subscribeNativeScoringWeek(leagueId, seasonId, week,
      (scoringWeek) => active && setState((current) => ({ ...current, scoringWeek })),
      (error) => active && setState((current) => ({ ...current, status: "error", message: error.message })));
    return () => { active = false; unsubscribe(); };
  }, [leagueId, seasonId, week]);
  return state;
}
