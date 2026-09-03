import { Activity, CalendarDays, History, Settings2, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { NativeStandingsWorkspace } from "../features/native-competition/NativeStandingsWorkspace";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import "./league-overview.css";

export default function LeagueOverview() {
  const { leagueId, connection, teamState, capabilities, canonicalWorkspace, refreshWorkspace } = useLeagueWorkspace();
  const base = `/league/${encodeURIComponent(leagueId)}`;
  const data = teamState.status === "ready" ? teamState.data : null;

  if (canonicalWorkspace?.authority.mode === "native" && canonicalWorkspace.season) {
    return <NativeStandingsWorkspace workspace={canonicalWorkspace} onWorkspaceChanged={refreshWorkspace} />;
  }

  return (
    <div className="league-overview-page">
      <header>
        <div>
          <span>League</span>
          <h1 className="ff-display">{connection?.leagueName ?? "League workspace"}</h1>
          <p>Standings, every team, weekly matchups, transactions, and league history stay together here.</p>
        </div>
        {data ? (
          <dl>
            <div><dt>Your standing</dt><dd>{data.standing} of {data.totalTeams}</dd></div>
            <div><dt>Your record</dt><dd>{data.record}</dd></div>
            <div><dt>Week</dt><dd>{data.week || "Preseason"}</dd></div>
          </dl>
        ) : null}
      </header>

      {teamState.status === "error" ? (
        <p className="league-overview-notice" role="status">Current team data is unavailable: {teamState.error}</p>
      ) : null}

      <nav className="league-overview-destinations" aria-label="League destinations">
        <Link to={`${base}/teams`}><Users aria-hidden="true" /><span><strong>Teams and managers</strong><small>Review every roster and team profile</small></span></Link>
        <Link to={`${base}/matchups`}><CalendarDays aria-hidden="true" /><span><strong>All matchups</strong><small>Compare the full weekly board</small></span></Link>
        <Link to={`${base}/transactions`}><Activity aria-hidden="true" /><span><strong>Transactions</strong><small>Trades, waivers, adds, and drops</small></span></Link>
        <Link to={`${base}/history`}><History aria-hidden="true" /><span><strong>League history</strong><small>Careers, rivalries, records, and seasons</small></span></Link>
        {capabilities.canManage ? <Link to={`${base}/manage`}><Settings2 aria-hidden="true" /><span><strong>League management</strong><small>Connections, imports, rules, and commissioner work</small></span></Link> : null}
      </nav>

      <div className="league-overview-grid">
        <section>
          <div><Trophy aria-hidden="true" /><span>Current position</span></div>
          <strong>{data ? `${data.teamName} is ${data.standing} of ${data.totalTeams}` : "Open your team to refresh the current standing"}</strong>
          <p>{data ? `${data.record} entering ${data.week ? `Week ${data.week}` : data.seasonPhase}.` : "Live current-season information requires a connected Sleeper manager identity."}</p>
        </section>
        <section>
          <div><CalendarDays aria-hidden="true" /><span>League pulse</span></div>
          <strong>{data?.closestMatchup ?? "Weekly matchups are not available yet"}</strong>
          <p>{data?.recentActivity[0] ?? "Completed league activity will appear after the season begins."}</p>
        </section>
      </div>
    </div>
  );
}
