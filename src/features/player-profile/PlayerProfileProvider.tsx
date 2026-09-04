import {
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { StatsPlayerDrawer } from "@/components/stats/StatsPlayerDrawer";
import type { ToolScoring } from "@/data/toolPlayerData";
import {
  buildPlayerProfileDetail,
  type PlayerProfileCandidate,
} from "@/features/player-profile/playerProfileData";
import { PlayerProfileContext } from "@/features/player-profile/playerProfileContext";
import "@/features/player-profile/player-profile.css";

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<{ player: PlayerProfileCandidate; scoring: ToolScoring } | null>(null);
  const openPlayerProfile = useCallback((player: PlayerProfileCandidate, scoring: ToolScoring = "halfPpr") => {
    setSelection({ player, scoring });
  }, []);
  const closePlayerProfile = useCallback(() => setSelection(null), []);
  const value = useMemo(() => ({ openPlayerProfile, closePlayerProfile }), [closePlayerProfile, openPlayerProfile]);
  const detail = useMemo(
    () => selection ? buildPlayerProfileDetail(selection.player, selection.scoring) : null,
    [selection],
  );

  return (
    <PlayerProfileContext.Provider value={value}>
      {children}
      <StatsPlayerDrawer player={detail} onClose={closePlayerProfile} />
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
