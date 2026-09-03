import { useSearchParams } from "react-router-dom";

import { NativeLineupWorkspace } from "../features/native-lineup/NativeLineupWorkspace";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import MyHQ from "./MyHQ";

function weekNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(22, parsed)) : 1;
}

export default function LeagueTeam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canonicalWorkspace, refreshWorkspace } = useLeagueWorkspace();
  const week = weekNumber(searchParams.get("week"));
  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) {
    return <NativeLineupWorkspace workspace={canonicalWorkspace} initialWeek={week} onWeekChange={(nextWeek) => { const next = new URLSearchParams(searchParams); next.set("week", String(nextWeek)); setSearchParams(next); }} onWorkspaceChanged={refreshWorkspace} />;
  }
  return <MyHQ />;
}
