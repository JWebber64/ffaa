import { useEffect, useMemo, useState } from "react";

import { buildCurrentToolPlayers } from "@/data/toolPlayerData";
import type { ToolPlayer, ToolScoring } from "@/data/toolPlayerData";
import type { LoadPlayerPoolOptions } from "@/data/loadPlayerPool";
import { loadWeeklyPlayerStats } from "@/data/weeklyPlayerStats";
import type { WeeklyPlayerStatsResult } from "@/data/weeklyPlayerStats";
import { loadSleeperPlayerDirectory } from "@/data/sleeperPlayerDirectory";

interface ToolDataState {
  players: ToolPlayer[];
  weeklyData: WeeklyPlayerStatsResult | null;
  loading: boolean;
  error: string | null;
}

export function useToolData(
  scoring: ToolScoring,
  valueOptions: Omit<LoadPlayerPoolOptions, "scoring"> = {},
  enabled = true,
): ToolDataState {
  const { budget, rosterSize, rosterSlots, teamCount } = valueOptions;
  const resolvedValueOptions = useMemo<Omit<LoadPlayerPoolOptions, "scoring">>(
    () => ({
      ...(typeof budget === "number" ? { budget } : {}),
      ...(typeof rosterSize === "number" ? { rosterSize } : {}),
      ...(rosterSlots?.length ? { rosterSlots } : {}),
      ...(typeof teamCount === "number" ? { teamCount } : {}),
    }),
    [budget, rosterSize, rosterSlots, teamCount],
  );
  const draftPlayers = useMemo(
    () => buildCurrentToolPlayers(scoring, [], resolvedValueOptions),
    [resolvedValueOptions, scoring],
  );
  const [weeklyData, setWeeklyData] = useState<WeeklyPlayerStatsResult | null>(null);
  const [players, setPlayers] = useState<ToolPlayer[]>(draftPlayers);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPlayers(draftPlayers);
    setWeeklyData(null);
    setLoading(enabled);
    setError(null);

    if (!enabled) return () => controller.abort();

    const sleeperDirectory = loadSleeperPlayerDirectory().catch(() => []);

    loadWeeklyPlayerStats({
      seasons: [2025],
      seasonType: "REG",
      scoring,
      weekStart: 1,
      weekEnd: 18,
      signal: controller.signal,
    })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        const sleeperRows = await sleeperDirectory;
        if (controller.signal.aborted) return;
        setWeeklyData(result);
        setPlayers(buildCurrentToolPlayers(scoring, result.summaries, resolvedValueOptions, sleeperRows));
        if (result.unavailableSeasons.includes(2025)) {
          setError("2025 weekly results are temporarily unavailable; draft projections remain usable.");
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [draftPlayers, enabled, resolvedValueOptions, scoring]);

  return { players, weeklyData, loading, error };
}
