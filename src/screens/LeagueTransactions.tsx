import { Navigate, useLocation, useParams } from "react-router-dom";

import { NativeTransactionsWorkspace } from "../features/native-transactions/NativeTransactionsWorkspace";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";

export default function LeagueTransactions() {
  const location = useLocation(); const { leagueId = "" } = useParams(); const { canonicalWorkspace } = useLeagueWorkspace();
  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) return <NativeTransactionsWorkspace workspace={canonicalWorkspace} />;
  return <Navigate to={`/league/${encodeURIComponent(leagueId)}/history/transactions${location.search}`} replace />;
}
