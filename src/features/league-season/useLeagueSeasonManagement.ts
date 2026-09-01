import { useEffect, useState } from "react";

import { useFirebaseSession } from "../../lib/useFirebaseSession";
import {
  subscribeToLeagueSeasonManagement,
  type FranchiseClaim,
  type ManagerMembership,
  type PublishedLeagueSeasonRecord,
} from "./leagueSeasonPersistence";

export type LeagueSeasonManagementState = {
  status: "idle" | "loading" | "ready" | "error";
  currentUserId: string;
  record: PublishedLeagueSeasonRecord | null;
  claims: FranchiseClaim[];
  membership: ManagerMembership | null;
  message: string;
};

function managementErrorMessage(error: Error) {
  if (/permission|insufficient/i.test(error.message)) {
    return "League management permissions are not available in this environment; the saved draft remains read-only.";
  }
  if (/network|offline|unavailable/i.test(error.message)) {
    return "League management is temporarily offline; the saved draft remains available.";
  }
  return error.message || "League management could not be loaded.";
}

export function useLeagueSeasonManagement(leagueId: string) {
  const session = useFirebaseSession();
  const [state, setState] = useState<LeagueSeasonManagementState>({
    status: leagueId ? "loading" : "idle",
    currentUserId: "",
    record: null,
    claims: [],
    membership: null,
    message: leagueId ? "Loading the published league season." : "Connect or select a league first.",
  });

  useEffect(() => {
    if (!leagueId) {
      setState({
        status: "idle",
        currentUserId: "",
        record: null,
        claims: [],
        membership: null,
        message: "Connect or select a league first.",
      });
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setState({
      status: "loading",
      currentUserId: "",
      record: null,
      claims: [],
      membership: null,
      message: "Loading the published league season.",
    });

    void subscribeToLeagueSeasonManagement(
      leagueId,
      (snapshot) => {
        if (disposed) return;
        setState({
          status: "ready",
          ...snapshot,
          message: snapshot.record
            ? "Published league season is live."
            : "The saved draft has not been published as a league season yet.",
        });
      },
      (error) => {
        if (disposed) return;
        setState((current) => ({
          ...current,
          status: "error",
          message: managementErrorMessage(error),
        }));
      },
    ).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    }).catch((error) => {
      if (disposed) return;
      setState({
        status: "error",
        currentUserId: "",
        record: null,
        claims: [],
        membership: null,
        message: error instanceof Error ? managementErrorMessage(error) : "League management could not be loaded.",
      });
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [leagueId, session?.user.uid]);

  return state;
}
