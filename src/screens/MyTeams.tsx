import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  Plus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isPermanentFirebaseSession, upgradeFirebaseSessionWithGoogle } from "../lib/authSession";
import { useFirebaseSession } from "../lib/useFirebaseSession";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import { ManagerIdentityForm } from "../features/league-workspace/ManagerIdentityForm";
import { useMyTeamsPortfolio, type PortfolioTeam } from "../features/my-hq/useMyTeamsPortfolio";
import "./my-teams.css";

function snapshotAgeLabel(value: string | undefined) {
  if (!value) return "Waiting for first refresh";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Team snapshot saved";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

type Exposure = { id: string; name: string; reason: string; leagues: string[] };

function buildPortfolioExposures(teams: PortfolioTeam[]) {
  const exposures = new Map<string, Exposure>();
  for (const team of teams) {
    if (team.state.status !== "ready") continue;
    for (const alert of team.state.data.alerts) {
      const current = exposures.get(alert.id) ?? {
        id: alert.id,
        name: alert.name,
        reason: alert.reason,
        leagues: [],
      };
      if (!current.leagues.includes(team.connection.leagueName)) current.leagues.push(team.connection.leagueName);
      exposures.set(alert.id, current);
    }
  }
  return [...exposures.values()]
    .filter((exposure) => exposure.leagues.length > 1)
    .sort((left, right) => right.leagues.length - left.leagues.length || left.name.localeCompare(right.name));
}

function AccountSyncControl() {
  const session = useFirebaseSession();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  if (isPermanentFirebaseSession(session)) {
    return (
      <div className="portfolio-account-sync is-synced">
        <Cloud aria-hidden="true" />
        <span><strong>Synced across devices</strong><small>{session.user.email || session.user.displayName || "GameHQ account"}</small></span>
      </div>
    );
  }
  const connect = async () => {
    setStatus("loading");
    try {
      await upgradeFirebaseSessionWithGoogle();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div className="portfolio-account-sync">
      <CloudOff aria-hidden="true" />
      <span><strong>Saved on this device</strong><small>{status === "error" ? "Account sync could not start" : "Sign in to keep teams on every device"}</small></span>
      <button type="button" onClick={connect} disabled={status === "loading"}>{status === "loading" ? "Signing in…" : "Sync teams"}</button>
    </div>
  );
}

function PortfolioTeamRow({ team, activeLeagueId }: { team: PortfolioTeam; activeLeagueId: string }) {
  const { connection, state, decision } = team;
  const needsIdentity = state.status === "identity";
  const data = state.status === "ready" ? state.data : null;
  const teamName = needsIdentity
    ? "Manager identity needed"
    : data?.teamName || connection.managerTeamName || connection.managerDisplayName || "My team";
  const isActive = connection.leagueId === activeLeagueId;
  const openPath = `/league/${encodeURIComponent(connection.leagueId)}/team`;

  return (
    <article className={`${isActive ? "is-active " : ""}is-${state.status}`}>
      <div className="my-team-identity">
        <span aria-hidden="true">{teamName.slice(0, 2).toUpperCase()}</span>
        <div><small>{connection.leagueName}</small><h2>{teamName}</h2><p>{connection.season} · {connection.totalRosters || "—"} teams · {connection.status.replace(/_/g, " ")}</p></div>
      </div>

      <dl>
        <div><dt>Record</dt><dd>{data?.record || connection.managerRecord || "—"}</dd></div>
        <div><dt>Standing</dt><dd>{data?.standing || connection.managerStanding ? `${data?.standing || connection.managerStanding} of ${data?.totalTeams || connection.totalRosters}` : "—"}</dd></div>
        <div><dt>Matchup</dt><dd>{data?.opponentName || connection.opponentName || (needsIdentity ? "Identify team" : "Not set")}</dd></div>
      </dl>

      <div className={`my-team-decision is-${decision?.urgency ?? state.status}`}>
        {state.status === "loading" ? <LoaderCircle className="is-spinning" aria-hidden="true" />
          : state.status === "error" || needsIdentity ? <AlertTriangle aria-hidden="true" />
          : decision?.urgency === "clear" ? <CheckCircle2 aria-hidden="true" />
          : <BellRing aria-hidden="true" />}
        <span>
          <strong>{state.status === "loading" ? "Refreshing team"
            : state.status === "error" ? "Refresh needs attention"
            : needsIdentity ? "Connect your Sleeper roster"
            : decision?.title || "Weekly review ready"}</strong>
          <small>{state.status === "error" ? state.error
            : needsIdentity ? "Enter your username below"
            : decision?.evidence || snapshotAgeLabel(data?.loadedAt || connection.teamSnapshotAt)}</small>
        </span>
      </div>

      <Link to={openPath}>Open team</Link>

      {needsIdentity ? (
        <div className="my-team-identity-claim">
          <ManagerIdentityForm connection={connection} compact />
        </div>
      ) : null}
    </article>
  );
}

export default function MyTeams() {
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const teams = useMyTeamsPortfolio();
  const exposures = useMemo(() => buildPortfolioExposures(teams), [teams]);
  const actionableTeams = teams.filter((team) => (
    team.state.status === "identity"
    || team.state.status === "error"
    || team.decision?.urgency === "now"
    || team.decision?.urgency === "watch"
  ));
  const readyCount = teams.filter((team) => team.state.status === "ready").length;

  if (!connections.length) {
    return (
      <section className="my-teams-empty">
        <Users aria-hidden="true" />
        <span>My teams</span>
        <h1 className="ff-display">Connect your first fantasy team</h1>
        <p>Use a Sleeper username or league ID to bring the manager, roster, matchup, league, and completed history into one workspace.</p>
        <Link to="/leagues"><Plus aria-hidden="true" /> Connect leagues</Link>
      </section>
    );
  }

  return (
    <div className="my-teams-page">
      <header className="my-teams-heading">
        <div><span>Weekly command center</span><h1 className="ff-display">My teams</h1><p>Every connected team, sorted by what needs attention first.</p></div>
        <Link to="/leagues"><Plus aria-hidden="true" /> Manage leagues</Link>
      </header>

      <section className="portfolio-command" aria-labelledby="portfolio-command-title">
        <div className="portfolio-command-summary">
          <div><span>Portfolio</span><h2 id="portfolio-command-title">{actionableTeams.length ? `${actionableTeams.length} teams need a look` : "No urgent team flags"}</h2><p>{readyCount} of {teams.length} teams refreshed from current Sleeper roster data.</p></div>
          <div className="portfolio-command-counts">
            <span><strong>{teams.filter((team) => team.decision?.urgency === "now" || team.state.status === "identity" || team.state.status === "error").length}</strong>Act now</span>
            <span><strong>{teams.filter((team) => team.decision?.urgency === "watch").length}</strong>Watch</span>
            <span><strong>{teams.filter((team) => team.decision?.urgency === "clear").length}</strong>Clear</span>
          </div>
        </div>

        <div className="portfolio-notifications">
          <div className="portfolio-notification-heading"><BellRing aria-hidden="true" /><span><strong>Decision queue</strong><small>Highest-impact item from each team</small></span></div>
          {actionableTeams.length ? (
            <ul>
              {actionableTeams.slice(0, 6).map((team) => (
                <li key={team.connection.leagueId}>
                  <span>{team.connection.leagueName}</span>
                  <strong>{team.state.status === "identity" ? "Identify your manager roster"
                    : team.state.status === "error" ? team.state.error
                    : team.decision?.title}</strong>
                  <Link to={`/league/${encodeURIComponent(team.connection.leagueId)}/team`}>Review</Link>
                </li>
              ))}
            </ul>
          ) : <p className="portfolio-all-clear"><CheckCircle2 aria-hidden="true" /> Current roster snapshots show no urgent lineup flags.</p>}
        </div>

        {exposures.length ? (
          <div className="portfolio-exposure">
            <AlertTriangle aria-hidden="true" />
            <div><span>Cross-league exposure</span><strong>{exposures[0]!.name} needs attention in {exposures[0]!.leagues.length} leagues</strong><small>{exposures[0]!.reason} · {exposures[0]!.leagues.join(", ")}</small></div>
          </div>
        ) : null}

        <AccountSyncControl />
      </section>

      <section className="my-teams-list" aria-label="Connected fantasy teams">
        {teams.map((team) => <PortfolioTeamRow key={team.connection.leagueId} team={team} activeLeagueId={activeLeagueId} />)}
      </section>
    </div>
  );
}
