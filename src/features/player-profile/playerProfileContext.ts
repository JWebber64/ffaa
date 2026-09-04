import { createContext } from "react";

import type { ToolScoring } from "@/data/toolPlayerData";
import type { PlayerProfileCandidate } from "@/features/player-profile/playerProfileData";

export type PlayerProfileContextValue = {
  openPlayerProfile: (player: PlayerProfileCandidate, scoring?: ToolScoring, trigger?: HTMLElement | null) => void;
  closePlayerProfile: () => void;
};

export const PlayerProfileContext = createContext<PlayerProfileContextValue>({
  openPlayerProfile: () => undefined,
  closePlayerProfile: () => undefined,
});
