import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeagueBallot, LeagueHQData } from "./leagueHQData";
import { parseLeagueHQData } from "./leagueHQData";

const DATA_KEY = "ffaa-league-hq-v2";
const BALLOT_KEY = "ffaa-league-ballot-v2";

const EMPTY_BALLOT: LeagueBallot = {
  championManagerId: "",
  lastPlaceManagerId: "",
  overUnder: {},
  savedAt: "",
};

function scopedKey(base: string, scope: string) {
  const normalizedScope = scope.trim().replace(/[^a-z0-9_-]+/gi, "-") || "local";
  return `${base}:${normalizedScope}`;
}

function loadData(starter: LeagueHQData, scope: string) {
  try {
    const raw = window.localStorage.getItem(scopedKey(DATA_KEY, scope));
    if (!raw) return starter;
    return parseLeagueHQData(raw).data ?? starter;
  } catch {
    return starter;
  }
}

function loadBallot(scope: string) {
  try {
    const raw = window.localStorage.getItem(scopedKey(BALLOT_KEY, scope));
    return raw ? ({ ...EMPTY_BALLOT, ...JSON.parse(raw) } as LeagueBallot) : EMPTY_BALLOT;
  } catch {
    return EMPTY_BALLOT;
  }
}

type LeagueHQStore = {
  scope: string;
  data: LeagueHQData;
  ballot: LeagueBallot;
};

export function useLeagueHQ(starter: LeagueHQData, scope = "local") {
  const [store, setStore] = useState<LeagueHQStore>(() => ({
    scope,
    data: loadData(starter, scope),
    ballot: loadBallot(scope),
  }));
  const activeStore = useMemo<LeagueHQStore>(() => (
    store.scope === scope
      ? store
      : { scope, data: loadData(starter, scope), ballot: loadBallot(scope) }
  ), [scope, starter, store]);

  useEffect(() => {
    if (store.scope === scope) return;
    setStore(activeStore);
  }, [activeStore, scope, store.scope]);

  const setData = useCallback<React.Dispatch<React.SetStateAction<LeagueHQData>>>((value) => {
    setStore((current) => {
      const base = current.scope === scope ? current : {
        scope,
        data: loadData(starter, scope),
        ballot: loadBallot(scope),
      };
      const data = typeof value === "function" ? value(base.data) : value;
      if (current.scope !== scope) {
        window.localStorage.setItem(scopedKey(DATA_KEY, scope), JSON.stringify(data));
        return current;
      }
      return { ...base, data };
    });
  }, [scope, starter]);

  const setBallot = useCallback<React.Dispatch<React.SetStateAction<LeagueBallot>>>((value) => {
    setStore((current) => {
      const base = current.scope === scope ? current : {
        scope,
        data: loadData(starter, scope),
        ballot: loadBallot(scope),
      };
      const ballot = typeof value === "function" ? value(base.ballot) : value;
      if (current.scope !== scope) {
        window.localStorage.setItem(scopedKey(BALLOT_KEY, scope), JSON.stringify(ballot));
        return current;
      }
      return { ...base, ballot };
    });
  }, [scope, starter]);

  useEffect(() => {
    if (store.scope !== scope) return;
    window.localStorage.setItem(scopedKey(DATA_KEY, scope), JSON.stringify(store.data));
  }, [scope, store]);

  useEffect(() => {
    if (store.scope !== scope) return;
    window.localStorage.setItem(scopedKey(BALLOT_KEY, scope), JSON.stringify(store.ballot));
  }, [scope, store]);

  return {
    data: activeStore.data,
    setData,
    ballot: activeStore.ballot,
    setBallot,
  };
}
