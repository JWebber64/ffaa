import { useEffect, useState } from "react";

import { parseLeagueSettings, type LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { getSettingsVersion } from "../league-domain/firebaseLeagueRepository";
import type { NativeWaiverClaim, NativeWaiverPlayerState, NativeWaiverReceipt, NativeWaiverState, NativeWaiverTeamState, SeasonTeam } from "../league-domain/types";
import { listNativeDraftTeams } from "../native-draft/nativeDraft";
import { subscribeWaiverClaims, subscribeWaiverPlayers, subscribeWaiverReceipts, subscribeWaiverState, subscribeWaiverTeams } from "./nativeWaivers";

export type NativeWaiverWorkspaceState = {
  status: "loading" | "ready" | "error";
  message: string;
  settings: LeagueSettingsV1 | null;
  teams: SeasonTeam[];
  waiverState: NativeWaiverState | null;
  players: NativeWaiverPlayerState[];
  teamStates: NativeWaiverTeamState[];
  claims: NativeWaiverClaim[];
  receipts: NativeWaiverReceipt[];
};

const EMPTY: NativeWaiverWorkspaceState = { status: "loading", message: "Loading the native player market…", settings: null, teams: [], waiverState: null, players: [], teamStates: [], claims: [], receipts: [] };

export function useNativeWaivers(leagueId: string, seasonId: string, settingsVersionId: string, viewerUserId: string, canReviewAll: boolean) {
  const [state, setState] = useState<NativeWaiverWorkspaceState>(EMPTY);
  useEffect(() => {
    let active = true; setState(EMPTY);
    const fail = (error: Error) => active && setState((current) => ({ ...current, status: "error", message: error.message }));
    void Promise.all([listNativeDraftTeams(leagueId, seasonId), getSettingsVersion(leagueId, settingsVersionId)]).then(([teams, version]) => {
      if (!active) return;
      const parsed = parseLeagueSettings(version?.settings);
      setState((current) => parsed.settings ? ({ ...current, status: "ready", message: "Player acquisition state is synchronized.", teams, settings: parsed.settings }) : ({ ...current, status: "error", message: parsed.issues[0]?.message ?? "Published waiver rules could not be loaded." }));
    }).catch((error) => fail(error instanceof Error ? error : new Error(String(error))));
    const subscriptions = [
      subscribeWaiverState(leagueId, seasonId, { value: (waiverState) => active && setState((current) => ({ ...current, waiverState })), error: fail }),
      subscribeWaiverPlayers(leagueId, seasonId, { value: (players) => active && setState((current) => ({ ...current, players })), error: fail }),
      subscribeWaiverTeams(leagueId, seasonId, { value: (teamStates) => active && setState((current) => ({ ...current, teamStates })), error: fail }),
      subscribeWaiverClaims(leagueId, seasonId, viewerUserId, canReviewAll, { value: (claims) => active && setState((current) => ({ ...current, claims })), error: fail }),
      subscribeWaiverReceipts(leagueId, seasonId, { value: (receipts) => active && setState((current) => ({ ...current, receipts })), error: fail }),
    ];
    return () => { active = false; subscriptions.forEach((unsubscribe) => unsubscribe()); };
  }, [canReviewAll, leagueId, seasonId, settingsVersionId, viewerUserId]);
  return state;
}
