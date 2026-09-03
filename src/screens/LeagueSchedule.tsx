import { NativeScheduleWorkspace } from "../features/native-competition/NativeScheduleWorkspace";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import LeagueMatchups from "./LeagueMatchups";

export default function LeagueSchedule() {
  const { canonicalWorkspace, refreshWorkspace } = useLeagueWorkspace();
  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) {
    return <NativeScheduleWorkspace workspace={canonicalWorkspace} onWorkspaceChanged={refreshWorkspace} />;
  }
  return <LeagueMatchups />;
}
