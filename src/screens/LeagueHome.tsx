import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  History,
  ListChecks,
  Settings2,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppStateScreen } from "../components/AppStateScreen";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import "./league-home.css";

function valueOrFallback(value: string | number | null | undefined, fallback: string) {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export default function LeagueHome() {
  const {
    authority,
    canonicalWorkspace,
    capabilities,
    connection,
    dataLeagueId,
    leagueId,
    routeState,
    teamState,
  } = useLeagueWorkspace();

  if (routeState.status === "loading") {
    return <AppStateScreen title="Loading league home" message={routeState.message} />;
  }
  if (routeState.status === "error") {
    return <AppStateScreen title="League unavailable" message={routeState.message} />;
  }

  const league = canonicalWorkspace?.league ?? null;
  const season = canonicalWorkspace?.season ?? null;
  const base = `/league/${encodeURIComponent(leagueId)}`;
  const displayName = league?.name || connection?.leagueName || (dataLeagueId ? "Connected league" : `League ${leagueId}`);
  const teamName = teamState.status === "ready"
    ? teamState.data.teamName
    : connection?.managerTeamName || connection?.managerDisplayName || "No GameHQ team assignment";
  const authorityDetail = authority?.source === "gamehq"
    ? "GameHQ memberships and role grants control every league write."
    : "Sleeper data is connected for reading and never grants GameHQ write access.";

  return (
    <main className="native-league-home">
      <header className="native-league-home__hero">
        <div>
          <span>League home</span>
          <h1>{displayName}</h1>
          <p>{authorityDetail}</p>
        </div>
      </header>

      {!canonicalWorkspace ? (
        <section className="native-league-home__notice" aria-labelledby="legacy-league-title">
          <CircleAlert aria-hidden="true" />
          <div>
            <h2 id="legacy-league-title">Compatibility route</h2>
            <p>This Sleeper league has not been assigned a permanent GameHQ league ID. Existing history stays readable, while league-owned writes remain unavailable until a native mapping is created.</p>
          </div>
          <Link to={`/leagues?league=${encodeURIComponent(dataLeagueId)}`}>Open league setup</Link>
        </section>
      ) : null}

      <section className="native-league-home__status" aria-labelledby="league-status-heading">
        <header><span>Current state</span><h2 id="league-status-heading">League operations</h2></header>
        <dl>
          <div><dt>GameHQ league ID</dt><dd>{league?.id ?? "Not mapped"}</dd></div>
          <div><dt>Season</dt><dd>{season ? `${season.year} · ${season.phase.replace(/_/gu, " ")}` : "Setup required"}</dd></div>
          <div><dt>League status</dt><dd>{league?.status ?? "Connected read-only"}</dd></div>
          <div><dt>Your team</dt><dd>{teamState.status === "loading" ? "Loading team context" : teamName}</dd></div>
          <div><dt>Role access</dt><dd>{authority?.roles.length ? authority.roles.join(", ").replace(/_/gu, " ") : "No active GameHQ role"}</dd></div>
          <div><dt>External source</dt><dd>{connection ? `Sleeper · ${connection.season}` : dataLeagueId ? `Sleeper · ${dataLeagueId}` : "None"}</dd></div>
        </dl>
      </section>

      <section className="native-league-home__actions" aria-labelledby="league-actions-heading">
        <header><span>Workspace</span><h2 id="league-actions-heading">Continue in this league</h2></header>
        <div>
          <Link to={`${base}/team`}><Users aria-hidden="true" /><span><strong>Team</strong><small>Roster, lineup, and manager context</small></span></Link>
          <Link to={`${base}/matchup`}><CalendarDays aria-hidden="true" /><span><strong>Matchup</strong><small>Current head-to-head view</small></span></Link>
          <Link to={`${base}/players`}><ListChecks aria-hidden="true" /><span><strong>Players</strong><small>League-aware player pool</small></span></Link>
          <Link to={`${base}/history`}><History aria-hidden="true" /><span><strong>History</strong><small>Imported seasons and records</small></span></Link>
          {capabilities.canManage ? <Link to={`${base}/commissioner`}><Settings2 aria-hidden="true" /><span><strong>Commissioner</strong><small>GameHQ-controlled league management</small></span></Link> : null}
        </div>
      </section>

      <footer className="native-league-home__footer">
        <CheckCircle2 aria-hidden="true" />
        <p>Route identity: <strong>{valueOrFallback(league?.id, "legacy compatibility")}</strong>. External league IDs remain provider mappings and are never used as native GameHQ identity.</p>
      </footer>
    </main>
  );
}
