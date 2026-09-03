import { useEffect, useState } from "react";

import { parseLeagueSettings, type LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { getSettingsVersion } from "../league-domain/firebaseLeagueRepository";
import type { NativeTradeOffer, NativeTradeReceipt, NativeWaiverPlayerState, NativeWaiverTeamState, SeasonTeam } from "../league-domain/types";
import { listNativeDraftTeams } from "../native-draft/nativeDraft";
import { subscribeWaiverPlayers, subscribeWaiverTeams } from "../native-waivers/nativeWaivers";
import { subscribeTradeOffers, subscribeTradeReceipts } from "./nativeTrades";

type TradeState = { status: "loading" | "ready" | "error"; message: string; settings: LeagueSettingsV1 | null; teams: SeasonTeam[]; players: NativeWaiverPlayerState[]; teamStates: NativeWaiverTeamState[]; offers: NativeTradeOffer[]; receipts: NativeTradeReceipt[] };
const EMPTY: TradeState = { status: "loading", message: "Loading native trades…", settings: null, teams: [], players: [], teamStates: [], offers: [], receipts: [] };

export function useNativeTrades(leagueId: string, seasonId: string, settingsVersionId: string) {
  const [state, setState] = useState<TradeState>(EMPTY);
  useEffect(() => {
    let active = true; setState(EMPTY);
    const fail = (error: Error) => active && setState((current) => ({ ...current, status: "error", message: error.message }));
    void Promise.all([listNativeDraftTeams(leagueId, seasonId), getSettingsVersion(leagueId, settingsVersionId)]).then(([teams, version]) => {
      if (!active) return; const parsed = parseLeagueSettings(version?.settings);
      setState((current) => parsed.issues.length ? { ...current, status: "error", message: parsed.issues[0]?.message ?? "Published trade rules are unavailable." } : { ...current, status: "ready", message: "Trade state is synchronized.", teams, settings: parsed.settings });
    }).catch((error) => fail(error instanceof Error ? error : new Error(String(error))));
    const subscriptions = [
      subscribeWaiverPlayers(leagueId, seasonId, { value: (players) => active && setState((current) => ({ ...current, players })), error: fail }),
      subscribeWaiverTeams(leagueId, seasonId, { value: (teamStates) => active && setState((current) => ({ ...current, teamStates })), error: fail }),
      subscribeTradeOffers(leagueId, seasonId, { value: (offers) => active && setState((current) => ({ ...current, offers })), error: fail }),
      subscribeTradeReceipts(leagueId, seasonId, { value: (receipts) => active && setState((current) => ({ ...current, receipts })), error: fail }),
    ];
    return () => { active = false; subscriptions.forEach((unsubscribe) => unsubscribe()); };
  }, [leagueId, seasonId, settingsVersionId]);
  return state;
}
