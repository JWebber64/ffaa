import { Settings2, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { CommissionerSettingsWorkspace } from "../features/league-settings/CommissionerSettingsWorkspace";
import "./my-hq.css";

export default function LeagueManage() {
  const location = useLocation();
  const { leagueId, capabilities, canonicalWorkspace, refreshWorkspace } = useLeagueWorkspace();
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
  if (!canonicalWorkspace?.season || canonicalWorkspace.league.authorityMode !== "native") {
    return (
      <section className="my-hq my-hq-gate">
        <Settings2 aria-hidden="true" />
        <span className="hq-kicker">Commissioner workspace</span>
        <h1 className="ff-display">Native settings begin after migration</h1>
        <p>This connected league still takes its rules from the external source. Complete native migration before publishing GameHQ rules.</p>
        <Link className="hq-primary-link" to="/leagues">Review league connections</Link>
      </section>
    );
  }
  const section = location.pathname.endsWith("/settings") ? "settings" : "overview";
  return <CommissionerSettingsWorkspace workspace={canonicalWorkspace} section={section} onWorkspaceChanged={refreshWorkspace} />;
}
