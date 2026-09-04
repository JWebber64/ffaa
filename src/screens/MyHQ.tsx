import { Activity, AlertTriangle, CheckCircle2, Clock3, History, ShieldAlert, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ToolPlayer, ToolScoring } from "../data/toolPlayerData";
import { PlayerProfileButton } from "../features/player-profile/PlayerProfileProvider";
import { calculateHeadToHead, calculateManagerCareer } from "../features/league-history/analytics";
import { useLeagueHistory } from "../features/league-history/useLeagueHistory";
import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { ManagerIdentityForm } from "../features/league-workspace/ManagerIdentityForm";
import type { MyHQData } from "../features/my-hq/myHQ";
import { PositionBadge } from "../ui/PositionBadge";
import "./my-hq.css";

function formatScore(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FF";
}

function formatPlayerProjection(player: ToolPlayer | null) {
  return player?.weeklyProjectedPoints === null || player?.weeklyProjectedPoints === undefined
    ? "—"
    : player.weeklyProjectedPoints.toFixed(1);
}

function TeamRosterRow({ player, slot, scoring, bench = false }: { player: ToolPlayer | null; slot: string; scoring: ToolScoring; bench?: boolean }) {
  const detail = player
    ? [player.team || "FA", player.byeWeek ? `Bye ${player.byeWeek}` : "", player.injuryStatus || ""].filter(Boolean).join(" · ")
    : "No player assigned";
  return (
    <div className={`hq-roster-row ${bench ? "is-bench" : ""}`} role="row">
      <div role="cell"><span className="hq-roster-mobile-label">Slot</span><PositionBadge className="hq-position" position={slot}>{slot.replace(/_/g, " ")}</PositionBadge></div>
      <div className="hq-roster-player" role="cell">
        <span className="hq-roster-mobile-label">Player</span>
        <PlayerProfileButton player={player} scoring={scoring} className="hq-roster-profile">
          <strong>{player?.name ?? "Open slot"}</strong>
          <small>{detail}</small>
        </PlayerProfileButton>
      </div>
      <div className="hq-roster-status" role="cell">
        <span className="hq-roster-mobile-label">Status</span>
        {player?.injuryStatus || (player?.status && player.status !== "Active" ? player.status : "Active")}
      </div>
      <div className="hq-roster-points" role="cell">
        <span className="hq-roster-mobile-label">Projection</span>
        <strong>{formatPlayerProjection(player)}</strong><small> PTS</small>
      </div>
    </div>
  );
}

function TeamRoster({ data, scoring }: { data: MyHQData; scoring: ToolScoring }) {
  return (
    <section className="hq-roster" aria-labelledby="hq-roster-title">
      <header className="hq-roster-heading">
        <div><span>Active roster</span><h2 id="hq-roster-title">Starters</h2></div>
        <Link to={`/league/${encodeURIComponent(data.leagueId)}/team/matchup`}>View matchup</Link>
      </header>
      <div className="hq-roster-table" role="table" aria-label={`${data.teamName} roster`}>
        <div className="hq-roster-columns" role="row">
          <span role="columnheader">Slot</span><span role="columnheader">Player</span><span role="columnheader">Status</span><span role="columnheader">Week projection</span>
        </div>
        <div role="rowgroup">
          {data.starterLineup.map((entry, index) => <TeamRosterRow key={`${entry.slot}-${entry.player?.id ?? index}`} player={entry.player} slot={entry.slot} scoring={scoring} />)}
        </div>
        <div className="hq-roster-divider"><span>Bench</span><small>{data.bench.length} players</small></div>
        <div role="rowgroup">
          {data.bench.map((player, index) => <TeamRosterRow key={player.id} player={player} slot={`BN${index + 1}`} scoring={scoring} bench />)}
        </div>
      </div>
      <footer>{data.projectionNote}</footer>
    </section>
  );
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
        <Link to={`/league/${connection.leagueId}/manage`}>Open league management</Link>
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
      <Link to={`/league/${connection.leagueId}/history/managers${manager ? `/${manager.id}` : ""}`}>Explore league history</Link>
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
        <Link className="hq-primary-link" to="/leagues">Connect leagues</Link>
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
          : <Link className="hq-primary-link" to="/leagues">Review league connection</Link>}
      </div>
    );
  }

  const data = state.data!;
  return (
    <div className="my-hq">
      <header className="hq-team-bar">
        <div className="hq-team-identity">
          <span className="hq-team-mark" aria-hidden="true">{initials(data.teamName)}</span>
          <div>
            <span className="hq-kicker">My team · {data.week ? `Week ${data.week}` : "Preseason"}</span>
            <h1>{data.teamName}</h1>
            <p>{data.leagueName} · {data.record} · {data.standing} of {data.totalTeams}</p>
          </div>
        </div>
        <Link className="hq-team-matchup" to={`/league/${encodeURIComponent(data.leagueId)}/team/matchup`}>
          <span>{data.week ? `Week ${data.week}` : "Next"} vs {data.opponentName}</span>
          <strong>{formatScore(data.teamScore)} <i>–</i> {formatScore(data.opponentScore)}</strong>
          <small>Week {data.week || 1} projection {data.teamProjectedPoints?.toFixed(1) ?? "—"}–{data.opponentProjectedPoints?.toFixed(1) ?? "—"}</small>
        </Link>
      </header>

      <TeamRoster data={data} scoring={connection.auctionSettings?.scoring ?? "halfPpr"} />

      <section className="hq-section hq-decisions">
        <div className="hq-section-heading"><div><span>Decision queue</span><h2>What needs your attention</h2></div><Clock3 aria-hidden="true" /></div>
        <div className="hq-decision-list">
          {data.decisions.map((decision) => (
            <article key={decision.id} className={`hq-decision is-${decision.urgency}`}>
              {decision.urgency === "clear" ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
              <div><span>{decision.urgency === "now" ? "Act now" : decision.urgency === "watch" ? "Watch" : "Lineup check"}</span><h3>{decision.title}</h3><p>{decision.detail}</p><small className="hq-decision-evidence">{decision.evidence}</small></div>
              {decision.actionTo.startsWith("http")
                ? <a href={decision.actionTo} target="_blank" rel="noreferrer">{decision.actionLabel}</a>
                : <Link to={decision.actionTo}>{decision.actionLabel}</Link>}
            </article>
          ))}
        </div>
      </section>

      <div className="hq-two-column">
        <section className="hq-section">
          <div className="hq-section-heading"><div><span>Roster health</span><h2>Starter watch</h2></div><Users aria-hidden="true" /></div>
          {data.alerts.length ? <div className="hq-alert-list">{data.alerts.map((alert) => (
            <article key={alert.id}><PositionBadge position={alert.position} /><div><strong>{alert.name}</strong><small>{alert.team} · {alert.reason}</small></div><b>{alert.projectedPointsPerGame?.toFixed(1) ?? "—"}<small>season PPG</small></b></article>
          ))}</div> : <div className="hq-empty"><CheckCircle2 aria-hidden="true" /><strong>No stored starter alerts</strong><p>No current-week bye or injury designation appears in the connected data. Confirm final statuses before lock.</p></div>}
        </section>

        <section className="hq-section">
          <div className="hq-section-heading"><div><span>League pulse</span><h2>What is moving</h2></div><Activity aria-hidden="true" /></div>
          <div className="hq-pulse-feature"><Swords aria-hidden="true" /><div><span>Closest live margin</span><strong>{data.closestMatchup}</strong></div></div>
          {data.recentActivity.length ? <ul className="hq-activity-list">{data.recentActivity.map((activity, index) => <li key={`${activity}-${index}`}>{activity}</li>)}</ul> : <div className="hq-empty compact"><p>No completed transactions are available for this Sleeper week.</p></div>}
        </section>
      </div>

      <HistoryMemory connection={connection} week={data} />

      <section className="hq-tool-row" aria-label="Recommended next tools">
        <div><Sparkles aria-hidden="true" /><span>Keep working</span><h2>Turn the signal into an answer</h2></div>
        <Link to="/tools/player-compare">Compare players</Link>
        <Link to="/stats">Research matchups</Link>
        <Link to={`/league/${connection.leagueId}/history`}>Open history <Trophy aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
