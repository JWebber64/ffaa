import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { AUCTION_VALUE_SOURCES, sourceCompatibility } from "./auctionValueData";
import type { AuctionSortKey, AuctionSourceType, AuctionValueMode, ScoringFormat } from "./auctionValueTypes";

const STORAGE_KEY = "ffaa.auctionValues.preferences.v1";

function defaultSourceIds(scoringFormat: ScoringFormat, leagueSize: number) {
  return AUCTION_VALUE_SOURCES
    .filter((source) => source.defaultSelected && sourceCompatibility(source, scoringFormat, leagueSize).compatible)
    .map((source) => source.id);
}

type PersistedPreferences = {
  scoringFormat: ScoringFormat;
  budget: number;
  leagueSize: number;
};

function numberParam(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? Math.round(parsed) : fallback;
}

function scoringParam(value: string | null, fallback: ScoringFormat): ScoringFormat {
  return value === "standard" || value === "half_ppr" || value === "ppr" ? value : fallback;
}

function readPreferences(): PersistedPreferences {
  if (typeof window === "undefined") return { scoringFormat: "ppr", budget: 200, leagueSize: 12 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PersistedPreferences> | null;
    return {
      scoringFormat: scoringParam(parsed?.scoringFormat ?? null, "ppr"),
      budget: numberParam(String(parsed?.budget ?? ""), 200, 50, 1000),
      leagueSize: numberParam(String(parsed?.leagueSize ?? ""), 12, 4, 32),
    };
  } catch {
    return { scoringFormat: "ppr", budget: 200, leagueSize: 12 };
  }
}

function listParam(value: string | null) {
  return value?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
}

export function useAuctionValueState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preferences = useMemo(() => readPreferences(), []);
  const scoringFormat = scoringParam(searchParams.get("format"), preferences.scoringFormat);
  const budget = numberParam(searchParams.get("budget"), preferences.budget, 50, 1000);
  const leagueSize = numberParam(searchParams.get("teams"), preferences.leagueSize, 4, 32);
  const selectedSourceIds = searchParams.has("sources")
    ? listParam(searchParams.get("sources"))
    : defaultSourceIds(scoringFormat, leagueSize);
  const hiddenSourceIds = listParam(searchParams.get("hidden"));
  const position = (searchParams.get("position") ?? "ALL").toUpperCase();
  const query = searchParams.get("q") ?? "";
  const directoryQuery = searchParams.get("sourceSearch") ?? "";
  const sourceType = (searchParams.get("sourceType") ?? "all") as AuctionSourceType | "all";
  const freshness = searchParams.get("freshness") ?? "current";
  const comparableOnly = searchParams.get("comparable") !== "0";
  const valueMode: AuctionValueMode = searchParams.get("values") === "raw" ? "raw" : "normalized";
  const includeMarketInConsensus = searchParams.get("marketConsensus") === "1";
  const sortKey = (searchParams.get("sort") ?? "median") as AuctionSortKey;
  const sortDirection: "asc" | "desc" = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const rowLimit: number | "all" = searchParams.get("limit") === "all" ? "all" : numberParam(searchParams.get("limit"), 100, 1, 1000);
  const density: "compact" | "comfortable" = searchParams.get("density") === "comfortable" ? "comfortable" : "compact";
  const printOrientation: "portrait" | "landscape" = searchParams.get("orientation") === "portrait" ? "portrait" : "landscape";
  const inkFriendly = searchParams.get("ink") !== "0";
  const includeNotes = searchParams.get("notes") === "1";
  const showConsensusColumns = searchParams.get("consensus") !== "0";
  const mobileView: "table" | "stacked" = searchParams.get("mobile") === "stacked" ? "stacked" : "table";

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ scoringFormat, budget, leagueSize } satisfies PersistedPreferences));
  }, [budget, leagueSize, scoringFormat]);

  function updateParam(name: string, value: string | number | null, replace = true) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
      return next;
    }, { replace });
  }

  function updateList(name: string, values: readonly string[]) {
    updateParam(name, values.length ? values.join(",") : "none");
  }

  function toggleSource(sourceId: string) {
    const next = selectedSourceIds.includes(sourceId)
      ? selectedSourceIds.filter((id) => id !== sourceId)
      : [...selectedSourceIds.filter((id) => id !== "none"), sourceId];
    updateList("sources", next);
  }

  function removeSource(sourceId: string) {
    updateList("sources", selectedSourceIds.filter((id) => id !== sourceId));
  }

  function reorderSource(sourceId: string, direction: -1 | 1) {
    const index = selectedSourceIds.indexOf(sourceId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedSourceIds.length) return;
    const next = [...selectedSourceIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateList("sources", next);
  }

  function toggleSourceVisibility(sourceId: string) {
    updateList("hidden", hiddenSourceIds.includes(sourceId)
      ? hiddenSourceIds.filter((id) => id !== sourceId)
      : [...hiddenSourceIds, sourceId]);
  }

  return {
    searchParams,
    scoringFormat,
    budget,
    leagueSize,
    selectedSourceIds: selectedSourceIds.filter((id) => id !== "none"),
    hiddenSourceIds: hiddenSourceIds.filter((id) => id !== "none"),
    position,
    query,
    directoryQuery,
    sourceType,
    freshness,
    comparableOnly,
    valueMode,
    includeMarketInConsensus,
    sortKey,
    sortDirection,
    rowLimit,
    density,
    printOrientation,
    inkFriendly,
    includeNotes,
    showConsensusColumns,
    mobileView,
    setScoringFormat: (value: ScoringFormat) => updateParam("format", value),
    setBudget: (value: number) => updateParam("budget", value),
    setLeagueSize: (value: number) => updateParam("teams", value),
    setPosition: (value: string) => updateParam("position", value === "ALL" ? null : value),
    setQuery: (value: string) => updateParam("q", value),
    setDirectoryQuery: (value: string) => updateParam("sourceSearch", value),
    setSourceType: (value: AuctionSourceType | "all") => updateParam("sourceType", value === "all" ? null : value),
    setFreshness: (value: string) => updateParam("freshness", value === "current" ? null : value),
    setComparableOnly: (value: boolean) => updateParam("comparable", value ? null : "0"),
    setValueMode: (value: AuctionValueMode) => updateParam("values", value === "normalized" ? null : value),
    setIncludeMarketInConsensus: (value: boolean) => updateParam("marketConsensus", value ? "1" : null),
    setSort: (key: AuctionSortKey) => {
      if (sortKey === key) updateParam("dir", sortDirection === "desc" ? "asc" : "desc");
      else {
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set("sort", key);
          next.set("dir", key === "player" || key === "position" || key === "team" ? "asc" : "desc");
          return next;
        }, { replace: true });
      }
    },
    setRowLimit: (value: number | "all") => updateParam("limit", value === 100 ? null : value),
    setDensity: (value: "compact" | "comfortable") => updateParam("density", value === "compact" ? null : value),
    setPrintOrientation: (value: "portrait" | "landscape") => updateParam("orientation", value === "landscape" ? null : value),
    setInkFriendly: (value: boolean) => updateParam("ink", value ? null : "0"),
    setIncludeNotes: (value: boolean) => updateParam("notes", value ? "1" : null),
    setShowConsensusColumns: (value: boolean) => updateParam("consensus", value ? null : "0"),
    setMobileView: (value: "table" | "stacked") => updateParam("mobile", value === "table" ? null : "stacked"),
    toggleSource,
    removeSource,
    reorderSource,
    toggleSourceVisibility,
    clearSources: () => updateList("sources", []),
  };
}
