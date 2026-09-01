import { useEffect, useState } from "react";
import { subscribeToSharedOfflineDraft } from "../offline-draft/offlineDraftSync";
import {
  OFFLINE_DRAFT_STORAGE_KEY,
  parseLeagueSeasonDraft,
  type LeagueSeasonDraft,
} from "./leagueSeasonModel";

export type LeagueSeasonDraftState =
  | { status: "idle" | "loading" | "empty"; season: null; message: string; currentUserId: string; draftOwnerUserId: string; isDraftOwner: boolean }
  | { status: "ready"; season: LeagueSeasonDraft; message: string; currentUserId: string; draftOwnerUserId: string; isDraftOwner: boolean }
  | { status: "error"; season: null; message: string; currentUserId: string; draftOwnerUserId: string; isDraftOwner: boolean };

function localDraft(leagueId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return parseLeagueSeasonDraft(JSON.parse(raw), { leagueId, source: "local" });
  } catch {
    return null;
  }
}

export function useLeagueSeasonDraft(leagueId: string) {
  const [state, setState] = useState<LeagueSeasonDraftState>({
    status: leagueId ? "loading" : "idle",
    season: null,
    message: leagueId ? "Loading the saved league draft." : "Connect or select a league first.",
    currentUserId: "",
    draftOwnerUserId: "",
    isDraftOwner: false,
  });

  useEffect(() => {
    if (!leagueId) {
      setState({ status: "idle", season: null, message: "Connect or select a league first.", currentUserId: "", draftOwnerUserId: "", isDraftOwner: false });
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setState({ status: "loading", season: null, message: "Loading the saved league draft.", currentUserId: "", draftOwnerUserId: "", isDraftOwner: false });

    void subscribeToSharedOfflineDraft(
      leagueId,
      ({ currentUserId, record }) => {
        if (disposed) return;
        const draftOwnerUserId = record?.ownerUserId ?? "";
        const isDraftOwner = Boolean(draftOwnerUserId && draftOwnerUserId === currentUserId);
        if (record) {
          const season = parseLeagueSeasonDraft(record.payload, {
            leagueId,
            source: "shared",
            revision: record.revision,
            updatedAt: record.updatedAt,
          });
          if (season) {
            setState({ status: "ready", season, message: "Live from the league's saved draft.", currentUserId, draftOwnerUserId, isDraftOwner });
            return;
          }
        }

        const fallback = localDraft(leagueId);
        if (fallback) {
          setState({
            status: "ready",
            season: fallback,
            message: record
              ? "The shared copy was invalid, so this device's saved draft is shown."
              : "This device's saved draft is shown until a shared league copy is available.",
            currentUserId,
            draftOwnerUserId,
            isDraftOwner,
          });
        } else {
          setState({ status: "empty", season: null, message: "No saved draft was found for the active league.", currentUserId, draftOwnerUserId, isDraftOwner });
        }
      },
      () => {
        if (disposed) return;
        const fallback = localDraft(leagueId);
        if (fallback) {
          setState({
            status: "ready",
            season: fallback,
            message: "Shared sync is unavailable; showing this device's saved draft.",
            currentUserId: "",
            draftOwnerUserId: "",
            isDraftOwner: false,
          });
        } else {
          setState({ status: "error", season: null, message: "The shared draft could not be loaded.", currentUserId: "", draftOwnerUserId: "", isDraftOwner: false });
        }
      },
    ).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    }).catch(() => {
      if (disposed) return;
      const fallback = localDraft(leagueId);
      setState(fallback
        ? { status: "ready", season: fallback, message: "Shared sync is unavailable; showing this device's saved draft.", currentUserId: "", draftOwnerUserId: "", isDraftOwner: false }
        : { status: "error", season: null, message: "The shared draft could not be loaded.", currentUserId: "", draftOwnerUserId: "", isDraftOwner: false });
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [leagueId]);

  return state;
}
