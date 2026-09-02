import { CheckCircle2, Info, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";

import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { PositionBadge } from "../ui/PositionBadge";
import StatsExplorer from "./StatsExplorer";
import "./league-players.css";

export default function LeaguePlayers() {
  const { leagueId, connection, teamState } = useLeagueWorkspace();
  const data = teamState.status === "ready" ? teamState.data : null;
  return (
    <div className="league-players-page">
      <div className="stats-hub-note">
        <Info aria-hidden="true" />
        <span>
          Research is scoped to <strong>{connection?.leagueName ?? "this league"}</strong> where league settings are available.
          Roster ownership is read-only, and player availability is not claimed unless it is verified from the current Sleeper roster snapshot.
        </span>
      </div>
      {data ? (
        <section className="league-player-advisor" aria-labelledby="league-player-advisor-title">
          <header>
            <div><span><CheckCircle2 aria-hidden="true" /> Verified against current rosters</span><h2 id="league-player-advisor-title">Available upgrades for {data.teamName}</h2><p>GameHQ compares scoring-adjusted season baselines and legal starter slots. Confirm weekly news before acting.</p></div>
            <small>Roster snapshot {new Date(data.loadedAt).toLocaleString()}</small>
          </header>
          {data.availableRecommendations.length ? (
            <div className="league-player-recommendations">
              <div className="league-player-recommendation-head" aria-hidden="true"><span>Available player</span><span>Roster fit</span><span>Baseline</span><span>Evidence</span></div>
              {data.availableRecommendations.slice(0, 6).map((recommendation) => (
                <article key={recommendation.id}>
                  <div><PositionBadge position={recommendation.player.position} /><strong>{recommendation.player.name}</strong><small>{recommendation.player.team || "FA"}</small></div>
                  <div><strong>{recommendation.eligibleSlots.map((slot) => slot.replace(/_/g, " ")).join(" / ")}</strong><small>{recommendation.dropPlayer ? `Compare with ${recommendation.dropPlayer.name}` : "No bench comparison available"}</small></div>
                  <div><strong>{recommendation.player.projectedPointsPerGame?.toFixed(1) ?? "—"} PPG</strong><small>{recommendation.baselineGain === null ? "No comparable drop" : `${recommendation.baselineGain >= 0 ? "+" : ""}${recommendation.baselineGain.toFixed(1)} vs suggested drop`}</small></div>
                  <div><strong>{recommendation.confidence} confidence</strong><small>{recommendation.evidence}</small></div>
                </article>
              ))}
            </div>
          ) : <div className="league-player-advisor-empty"><ListChecks aria-hidden="true" /><p>No verified season-baseline upgrade clears the current roster comparison. Use the research table below for weekly context.</p></div>}
          <footer><span>Recommendations are read-only and never submit an add/drop.</span><a href={connection?.sourceUrl ?? "https://sleeper.com/"} target="_blank" rel="noreferrer">Open this league in Sleeper</a></footer>
        </section>
      ) : teamState.status === "error" && !connection?.managerProviderUserId ? (
        <section className="league-player-advisor-empty"><Info aria-hidden="true" /><p>Identify your Sleeper roster before GameHQ labels players as available.</p><Link to="/teams">Identify my team</Link></section>
      ) : null}
      <StatsExplorer
        embeddedLeagueId={leagueId}
        {...(connection?.leagueName ? { embeddedLeagueName: connection.leagueName } : {})}
      />
    </div>
  );
}
