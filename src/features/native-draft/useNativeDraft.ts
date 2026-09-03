import { useEffect, useState } from "react";

import type { NativeDraft, SeasonTeam } from "../league-domain/types";
import { listNativeDraftTeams, subscribeNativeDraft, subscribeNativeDraftShare } from "./nativeDraft";

export type NativeDraftState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  draft: NativeDraft | null;
  teams: SeasonTeam[];
  message: string;
};

export function useNativeDraft(leagueId: string, seasonId: string, draftId: string, watchToken = "") {
  const [state, setState] = useState<NativeDraftState>({ status: draftId ? "loading" : "idle", draft: null, teams: [], message: draftId ? "Loading the authoritative draft." : "No native draft has been configured." });

  useEffect(() => {
    if (!leagueId || !seasonId) {
      setState({ status: "idle", draft: null, teams: [], message: "A native league season is required." });
      return;
    }
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setState((current) => ({ ...current, status: draftId ? "loading" : "idle", message: draftId ? "Loading the authoritative draft." : "No native draft has been configured." }));
    const onDraft = (draft: NativeDraft | null) => {
      if (disposed) return;
      setState((current) => ({ ...current, status: draft ? "ready" : "empty", draft, message: draft ? (watchToken ? "Live read-only spectator state." : "Live authoritative draft state.") : "The configured native draft was not found." }));
    };
    const onError = (error: Error) => {
      if (!disposed) setState((current) => ({ ...current, status: "error", draft: null, message: error.message }));
    };
    if (draftId) {
      unsubscribe = watchToken
        ? subscribeNativeDraftShare(watchToken, onDraft, onError)
        : subscribeNativeDraft(leagueId, seasonId, draftId, onDraft, onError);
    }
    void listNativeDraftTeams(leagueId, seasonId).then((teams) => {
      if (!disposed) setState((current) => ({ ...current, teams, ...(draftId ? {} : { status: "idle" as const, message: "No native draft has been configured." }) }));
    }).catch((error: unknown) => {
      if (!disposed) setState({ status: "error", draft: null, teams: [], message: error instanceof Error ? error.message : "Draft teams could not be loaded." });
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [draftId, leagueId, seasonId, watchToken]);

  return state;
}
