import { useOutletContext } from "react-router-dom";
import type { LeagueHistorySnapshot } from "../domain/types";

export function useLeagueHistorySnapshot() {
  return useOutletContext<LeagueHistorySnapshot>();
}
