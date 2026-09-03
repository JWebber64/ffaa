import { useEffect, useState } from "react";

import { parseLeagueSettings, type LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { getSettingsVersion } from "../league-domain/firebaseLeagueRepository";
import type { NativeLineupWeek, NativeWeeklyLineup, SeasonTeam } from "../league-domain/types";
import { listNativeDraftTeams } from "../native-draft/nativeDraft";
import { subscribeNativeLineupWeek, subscribeNativeWeeklyLineups } from "./nativeLineup";

export type NativeLineupState = {
  status: "loading" | "ready" | "error";
  message: string;
  teams: SeasonTeam[];
  settings: LeagueSettingsV1 | null;
  week: NativeLineupWeek | null;
  lineups: NativeWeeklyLineup[];
};

export function useNativeLineup(leagueId: string, seasonId: string, settingsVersionId: string, weekNumber: number, timezone: string): NativeLineupState {
  const [state, setState] = useState<NativeLineupState>({ status: "loading", message: "Loading authoritative lineups…", teams: [], settings: null, week: null, lineups: [] });

  useEffect(() => {
    let active = true;
    setState({ status: "loading", message: "Loading authoritative lineups…", teams: [], settings: null, week: null, lineups: [] });
    void Promise.all([listNativeDraftTeams(leagueId, seasonId), getSettingsVersion(leagueId, settingsVersionId)]).then(([teams, settingsVersion]) => {
      if (!active) return;
      const parsed = parseLeagueSettings(settingsVersion?.settings, timezone);
      if (!settingsVersion || parsed.issues.length) throw new Error("The published lineup rulebook is unavailable or invalid.");
      setState((current) => ({ ...current, status: "ready", message: "Authoritative lineup state is current.", teams, settings: parsed.settings }));
    }).catch((error) => {
      if (active) setState((current) => ({ ...current, status: "error", message: error instanceof Error ? error.message : "Native lineup data could not be loaded." }));
    });
    const fail = (error: Error) => active && setState((current) => ({ ...current, status: "error", message: error.message }));
    const unsubscribeWeek = subscribeNativeLineupWeek(leagueId, seasonId, weekNumber, (week) => active && setState((current) => ({ ...current, week })), fail);
    const unsubscribeLineups = subscribeNativeWeeklyLineups(leagueId, seasonId, (lineups) => active && setState((current) => ({ ...current, lineups })), fail);
    return () => {
      active = false;
      unsubscribeWeek();
      unsubscribeLineups();
    };
  }, [leagueId, seasonId, settingsVersionId, timezone, weekNumber]);

  return state;
}
