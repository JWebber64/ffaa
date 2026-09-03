import { createContext, useContext } from "react";

export type LeaguePlayerSheetRequest = {
  playerId: string;
  currentWeek?: number;
  leagueState?: "free_agent" | "on_waivers" | "owned" | "locked" | "ineligible" | "protected" | "trade_block" | "drafted" | "available";
  ownership?: string;
  rosterFit?: string;
  actionLabel?: string;
  actionTo?: string;
};

export type PlayerSheetContextValue = { openPlayer: (request: LeaguePlayerSheetRequest) => void; closePlayer: () => void };
export const PlayerSheetContext = createContext<PlayerSheetContextValue | null>(null);

export function useLeaguePlayerSheet() {
  const value = useContext(PlayerSheetContext);
  return value ?? { openPlayer: () => {}, closePlayer: () => {} };
}
