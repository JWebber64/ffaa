import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, History, Radio, ShieldAlert, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateHeadToHead, calculateManagerCareer } from "../features/league-history/analytics";
import { useLeagueHistory } from "../features/league-history/useLeagueHistory";
import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { ManagerIdentityForm } from "../features/league-workspace/ManagerIdentityForm";
import type { MyHQData } from "../features/my-hq/myHQ";
import "./my-hq.css";

function formatScore(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

function HistoryMemory({ connection, week }: { connection: SleeperLeagueConnectionSummary; week: MyHQData }) {
  const history = useLeagueHistory(connection.leagueId);
  if (history.status === "loading") {
    return <section className="hq-memory-card is-loading"><span>League memory</span><h2>Reading normalized history…</h2></section>;
  }
  if (history.status === "error" || !history.data) {
    return (
      <section className="hq-memory-card">
        <History aria-hidden="true" />
        <div><span>League memory</span><h2>History is not available yet</h2><p>Import completed Sleeper seasons in League HQ to unlock career and rivalry context.</p></div>
        <Link to={`/league/${connection.leagueId}/manage`}>Open league management <ArrowRight aria-hidden="true" /></Link>
      </section>
    );
  }
  const manager = history.data.managers.find((candidate) => candidate.providerUserId === week.managerProviderUserId);
  const opponent = history.data.managers.find((candidate) => candidate.providerUserId === week.opponentProviderUserId);
  const career = manager ? calculateManagerCareer(history.data, manager.id) : null;
  const rivalry = manager && opponent ? calculateHeadToHead(history.data, manager.id, opponent.id) : null;
  const nextWinMark = career ? Math.ceil((career.wins + 1) / 25) * 25 : null;

  return (
    <section className="hq-memory-card">
      <div className="hq-memory-heading">
        <History aria-hidden="true" />
        <div><span>League memory</span><h2>{history.data.league.name}</h2></div>
      </div>
      {career ? (
        <div className="hq-memory-stats">
          <div><span>Career record</span><strong>{career.wins}-{career.losses}{career.ties ? `-${career.ties}` : ""}</strong><small>{(career.winPercentage * 100).toFixed(1)}% win rate</small></div>
          <div><span>Championships</span><strong>{career.championships}</strong><small>{career.playoffAppearances} playoff appearances</small></div>
          <div><span>Current opponent</span><strong>{rivalry ? `${rivalry.winsA}-${rivalry.winsB}${rivalry.ties ? `-${rivalry.ties}` : ""}` : "No stored meetings"}</strong><small>{opponent?.displayName ?? "Opponent history unavailable"}</small></div>
          <div><span>Record chase</span><strong>{nextWinMark ? `${nextWinMark - career.wins} to ${nextWinMark} wins` : "Unavailable"}</strong><small>Based only on completed imported matchups</small></div>
        </div>
      ) : <p>Your Sleeper identity is not mapped to an imported historical manager yet.</p>}
      <Link to={`/league/${connection.leagueId}/history/managers${manager ? `/${manager.id}` : ""}`}>Explore league history <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}

export default function MyHQ() {
  const { connection, teamState: state } = useLeagueWorkspace();

  if (!connection) {
    return (
      <div className="my-hq my-hq-gate">
        <span className="hq-kicker">My team</span>
        <h1 className="ff-display">Connect a league to open your team</h1>
        <p>GameHQ needs a Sleeper league and your manager identity before it can show a real roster, matchup, or decision queue.</p>
        <Link className="hq-primary-link" to="/leagues">Connect leagues <ArrowRight aria-hidden="true" /></Link>
      </div>
    );
  }

  if (state.status === "idle" || state.status === "loading") {
    return <div className="my-hq my-hq-gate" aria-busy="true"><span className="hq-kicker">My team</span><h1 className="ff-display">Reading {connection.leagueName}…</h1><p>Loading your live Sleeper roster, matchup, standings, and recent league activity.</p></div>;
  }

  if (state.status === "error") {
    return (
      <div className="my-hq my-hq-gate is-error">
        <ShieldAlert aria-hidden="true" />
        <span className="hq-kicker">Connection needs attention</span>
        <h1 className="ff-display">GameHQ cannot identify your team</h1>
        <p>{state.error}</p>
        {!connection.managerProviderUserId
          ? <ManagerIdentityForm connection={connection} />
          : <Link className="hq-primary-link" to="/leagues">Review league connection <ArrowRight aria-hidden="true" /></Link>}
      </div>
    );
  }

  const data = state.data!;
  return (
    <div className="my-hq">
      <header className="hq-hero">
        <div>
          <span className="hq-kicker">My team · {data.week ? `Week ${data.week}` : "Preseason"}</span>
          <h1 className="ff-display">{data.teamName}</h1>
          <p>{data.leagueName} · {data.record} · {data.standing} of {data.totalTeams} entering {data.week ? `Week ${data.week}` : data.seasonPhase}.</p>
        </div>
        <div className="hq-matchup-card">
          <span><Radio aria-hidden="true" /> {data.week ? "Current matchup" : "Next matchup"}</span>
          <div><strong>{data.teamName}</strong><b>{formatScore(data.teamScore)}</b></div>
          <div><strong>{data.opponentName}</strong><b>{formatScore(data.opponentScore)}</b></div>
          {data.teamBaselinePoints !== null || data.opponentBaselinePoints !== null ? <div className="hq-matchup-baseline"><span>Season baseline</span><strong>{data.teamBaselinePoints?.toFixed(1) ?? "—"}–{data.opponentBaselinePoints?.toFixed(1) ?? "—"}</strong></div> : null}
          <small>{data.projectionNote}</small>
        </div>
      </header>

      <section className="hq-section hq-decisions">
        <div className="hq-section-heading"><div><span>Decision queue</span><h2>What needs your attention</h2></div><Clock3 aria-hidden="true" /></div>
        <div className="hq-decision-list">
          {data.decisions.map((decision) => (
            <article key={decision.id} className={`hq-decision is-${decision.urgency}`}>
              {decision.urgency === "clear" ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
              <div><span>{decision.urgency === "now" ? "Act now" : decision.urgency === "watch" ? "Watch" : "Lineup check"}</span><h3>{decision.title}</h3><p>{decision.detail}</p><small className="hq-decision-evidence">{decision.evidence}</small></div>
              {decision.actionTo.startsWith("http")
                ? <a href={decision.actionTo} target="_blank" rel="noreferrer">{decision.actionLabel}<ArrowRight aria-hidden="true" /></a>
                : <Link to={decision.actionTo}>{decision.actionLabel}<ArrowRight aria-hidden="true" /></Link>}
            </article>
          ))}
        </div>
      </section>

      <div className="hq-two-column">
        <section className="hq-section">
          <div className="hq-section-heading"><div><span>Roster health</span><h2>Starter watch</h2></div><Users aria-hidden="true" /></div>
          {data.alerts.length ? <div className="hq-alert-list">{data.alerts.map((alert) => (
            <article key={alert.id}><span className={`pos-${alert.position.toLowerCase()}`}>{alert.position}</span><div><strong>{alert.name}</strong><small>{alert.team} · {alert.reason}</small></div><b>{alert.projectedPointsPerGame?.toFixed(1) ?? "—"}<small>season PPG</small></b></article>
          ))}</div> : <div className="hq-empty"><CheckCircle2 aria-hidden="true" /><strong>No stored starter alerts</strong><p>No current-week bye or injury designation appears in the connected data. Confirm final statuses before lock.</p></div>}
        </section>

        <section className="hq-section">
          <div className="hq-section-heading"><div><span>League pulse</span><h2>What is moving</h2></div><Activity aria-hidden="true" /></div>
          <div className="hq-pulse-feature"><Swords aria-hidden="true" /><div><span>Closest live margin</span><strong>{data.closestMatchup}</strong></div></div>
          {data.recentActivity.length ? <ul className="hq-activity-list">{data.recentActivity.map((activity) => <li key={activity}>{activity}</li>)}</ul> : <div className="hq-empty compact"><p>No completed transactions are available for this Sleeper week.</p></div>}
        </section>
      </div>

      <HistoryMemory connection={connection} week={data} />

      <section className="hq-tool-row" aria-label="Recommended next tools">
        <div><Sparkles aria-hidden="true" /><span>Keep working</span><h2>Turn the signal into an answer</h2></div>
        <Link to="/tools/player-compare">Compare players <ArrowRight aria-hidden="true" /></Link>
        <Link to="/stats">Research matchups <ArrowRight aria-hidden="true" /></Link>
        <Link to={`/league/${connection.leagueId}/history`}>Open history <Trophy aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
