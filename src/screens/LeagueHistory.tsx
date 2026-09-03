import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import LeagueHistoryApp from "../features/league-history/ui/LeagueHistoryApp";
import { NativeHistoryWorkspace } from "../features/native-history/NativeHistoryWorkspace";

export default function LeagueHistory() {
  const { canonicalWorkspace } = useLeagueWorkspace();
  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) return <NativeHistoryWorkspace workspace={canonicalWorkspace} />;
  return <LeagueHistoryApp />;
}
