import { Navigate } from "react-router-dom";

import { NativeLeaguePulseWorkspace } from "../features/native-pulse/NativeLeaguePulseWorkspace";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";

export default function LeaguePulse() {
  const { leagueId, canonicalWorkspace } = useLeagueWorkspace();
  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) return <NativeLeaguePulseWorkspace workspace={canonicalWorkspace} />;
  return <Navigate to={`/league/${encodeURIComponent(leagueId)}/history`} replace />;
}
