import { useEffect, useState } from "react";

import {
  subscribeToLeagueWeekLineups,
  subscribeToLeagueWeekSettings,
  type LeagueWeekSettings,
  type SavedLeagueLineup,
} from "./leagueSeasonPersistence";

export type LeagueWeekLineupsState = {
  status: "idle" | "loading" | "ready" | "error";
  lineups: SavedLeagueLineup[];
  settings: LeagueWeekSettings | null;
  message: string;
};

function lineupErrorMessage(error: Error) {
  if (/permission|insufficient/i.test(error.message)) return "Weekly lineup permissions are not available in this environment.";
  if (/network|offline|unavailable/i.test(error.message)) return "Weekly lineups are temporarily offline.";
  return error.message || "Weekly lineups could not be loaded.";
}

export function useLeagueWeekLineups(leagueId: string, week: number, enabled = true, seasonRevision = 0) {
  const [state, setState] = useState<LeagueWeekLineupsState>({
    status: enabled && leagueId ? "loading" : "idle",
    lineups: [],
    settings: null,
    message: enabled && leagueId ? "Loading saved weekly lineups." : "Weekly lineups are not available yet.",
  });

  useEffect(() => {
    if (!enabled || !leagueId) {
      setState({ status: "idle", lineups: [], settings: null, message: "Weekly lineups are not available yet." });
      return;
    }

    let disposed = false;
    let stopLineups: (() => void) | undefined;
    let stopSettings: (() => void) | undefined;
    let lineups: SavedLeagueLineup[] = [];
    let settings: LeagueWeekSettings | null = null;
    let lineupsLoaded = false;
    let settingsLoaded = false;
    setState({ status: "loading", lineups: [], settings: null, message: "Loading saved weekly lineups." });

    const emit = () => {
      if (disposed || !lineupsLoaded || !settingsLoaded) return;
      const currentLineups = seasonRevision > 0
        ? lineups.filter((lineup) => lineup.seasonRevision === seasonRevision)
        : lineups;
      setState({
        status: "ready",
        lineups: currentLineups,
        settings,
        message: currentLineups.length ? "Saved manager lineups loaded." : "No current manager lineups have been saved for this week.",
      });
    };
    const fail = (error: unknown) => {
      if (disposed) return;
      const normalized = error instanceof Error ? error : new Error(String(error));
      setState({ status: "error", lineups: [], settings: null, message: lineupErrorMessage(normalized) });
    };

    void Promise.all([
      subscribeToLeagueWeekLineups(leagueId, week, (nextLineups) => {
        lineups = nextLineups;
        lineupsLoaded = true;
        emit();
      }, fail),
      subscribeToLeagueWeekSettings(leagueId, week, (nextSettings) => {
        settings = nextSettings;
        settingsLoaded = true;
        emit();
      }, fail),
    ]).then(([lineupStop, settingsStop]) => {
      if (disposed) {
        lineupStop();
        settingsStop();
      } else {
        stopLineups = lineupStop;
        stopSettings = settingsStop;
      }
    }).catch(fail);

    return () => {
      disposed = true;
      stopLineups?.();
      stopSettings?.();
    };
  }, [enabled, leagueId, seasonRevision, week]);

  return state;
}
