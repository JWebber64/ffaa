import { Settings2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import LeagueHQ from "./LeagueHQ";
import "./my-hq.css";

export default function LeagueManage() {
  const { leagueId, capabilities } = useLeagueWorkspace();
  if (capabilities.status === "loading") {
    return (
      <section className="my-hq my-hq-gate" aria-busy="true">
        <Settings2 aria-hidden="true" />
        <span className="hq-kicker">League management</span>
        <h1 className="ff-display">Checking commissioner access…</h1>
        <p>GameHQ is confirming your account and connected Sleeper identity.</p>
      </section>
    );
  }
  if (!capabilities.canManage) {
    return (
      <section className="my-hq my-hq-gate is-error">
        <ShieldAlert aria-hidden="true" />
        <span className="hq-kicker">Commissioner only</span>
        <h1 className="ff-display">League management is not available</h1>
        <p>Management stays separate from weekly manager work. Connect the Sleeper commissioner identity or use the GameHQ account that published this league season.</p>
        <div className="hq-gate-actions">
          <Link className="hq-primary-link" to="/leagues">Review connections</Link>
          <Link to={`/league/${encodeURIComponent(leagueId)}/team`}>Return to team</Link>
        </div>
      </section>
    );
  }
  return <LeagueHQ />;
}
