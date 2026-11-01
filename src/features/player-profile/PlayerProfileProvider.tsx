import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { StatsPlayerDrawer } from "@/components/stats/StatsPlayerDrawer";
import type { ToolScoring } from "@/data/toolPlayerData";
import { normalizeToolName, normalizeToolPosition } from "@/data/toolPlayerData";
import { NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import { loadWeeklyPlayerStats, type WeeklyPlayerSummary } from "@/data/weeklyPlayerStats";
import {
  buildPlayerProfileDetail,
  type PlayerProfileCandidate,
} from "@/features/player-profile/playerProfileData";
import { PlayerProfileContext } from "@/features/player-profile/playerProfileContext";
import "@/features/player-profile/player-profile.css";

type Selection = { player: PlayerProfileCandidate; scoring: ToolScoring };
type HistoryState = { selection: Selection; summary?: WeeklyPlayerSummary | null; error?: string };

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const openPlayerProfile = useCallback((player: PlayerProfileCandidate, scoring: ToolScoring = "halfPpr") => {
    setSelection({ player, scoring });
  }, []);
  const closePlayerProfile = useCallback(() => setSelection(null), []);
  const value = useMemo(() => ({ openPlayerProfile, closePlayerProfile }), [closePlayerProfile, openPlayerProfile]);
  const history = historyState?.selection === selection ? historyState : null;
  const detail = useMemo(
    () => selection ? buildPlayerProfileDetail(selection.player, selection.scoring, history?.summary) : null,
    [selection, history?.summary],
  );
  const historyId = detail?.id ?? "";
  const historyPlayerId = selection?.player.summary?.playerId ?? "";
  const historySleeperId = detail?.sleeperId ?? "";
  const historyName = detail?.name ?? "";
  const historyPosition = detail?.position ?? "";
  const historyScoring = selection?.scoring ?? "halfPpr";

  useEffect(() => {
    if (!selection || historyPosition === "DEF") return;
    const controller = new AbortController();
    loadWeeklyPlayerStats({ seasons: [NFLVERSE_CAREER_LATEST_SEASON], seasonType: "REG", scoring: historyScoring, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.unavailableSeasons.includes(NFLVERSE_CAREER_LATEST_SEASON)) throw new Error(`${NFLVERSE_CAREER_LATEST_SEASON} season stats could not be loaded. Try again.`);
        const ids = new Set([historyId, historyPlayerId, historySleeperId].filter(Boolean));
        const summary = result.summaries.find((row) => ids.has(row.playerId)
          || (normalizeToolName(row.playerName) === normalizeToolName(historyName) && normalizeToolPosition(row.position) === normalizeToolPosition(historyPosition))) ?? null;
        setHistoryState({ selection, summary });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setHistoryState({ selection, error: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [selection, historyAttempt, historyId, historyPlayerId, historySleeperId, historyName, historyPosition, historyScoring]);

  function retryHistory() {
    setHistoryState(null);
    setHistoryAttempt((attempt) => attempt + 1);
  }

  return (
    <PlayerProfileContext.Provider value={value}>
      {children}
      <StatsPlayerDrawer player={detail} onClose={closePlayerProfile} overviewStatus={selection && historyPosition !== "DEF" ? {
        loading: !history,
        error: history?.error ?? null,
        onRetry: retryHistory,
      } : undefined} />
    </PlayerProfileContext.Provider>
  );
}
type PlayerProfileButtonProps = {
  player: PlayerProfileCandidate | null | undefined;
  scoring?: ToolScoring;
  children?: ReactNode;
  className?: string;
  stopPropagation?: boolean;
  title?: string;
};

export function PlayerProfileButton({
  player,
  scoring = "halfPpr",
  children,
  className = "",
  stopPropagation = true,
  title,
}: PlayerProfileButtonProps) {
  const { openPlayerProfile } = useContext(PlayerProfileContext);
  if (!player) return <>{children}</>;
  const name = String(player.name ?? player.playerName ?? "player");

  function open(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) event.stopPropagation();
    openPlayerProfile(player!, scoring);
  }

  return (
    <button
      type="button"
      className={`player-profile-trigger ${className}`.trim()}
      data-player-profile-trigger="true"
      aria-haspopup="dialog"
      title={title ?? `Open ${name} player profile`}
      onClick={open}
    >
      {children ?? name}
    </button>
  );
}
