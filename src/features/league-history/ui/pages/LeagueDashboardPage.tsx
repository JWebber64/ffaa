import { Crown, Medal, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { calculateAllManagerCareers, calculateGoatRankings } from "../../analytics";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber, formatRecord } from "../format";

export function LeagueDashboardPage() {
  const snapshot = useLeagueHistorySnapshot();
  const careers = calculateAllManagerCareers(snapshot);
  const goat = calculateGoatRankings(snapshot);
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const latestTitle = snapshot.playoffMatches
    .filter((match) => match.bracketType === "winners" && match.placement === 1 && match.winnerFranchiseId)
    .sort((left, right) => {
      const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season.season]));
      return (seasonById.get(right.leagueSeasonId) ?? 0) - (seasonById.get(left.leagueSeasonId) ?? 0);
    })[0];
  const championFranchise = latestTitle?.winnerFranchiseId ? franchiseById.get(latestTitle.winnerFranchiseId) : null;
  const champion = championFranchise?.managerId ? managerById.get(championFranchise.managerId) : null;
  const allTimeLeader = [...careers].sort((left, right) => right.wins - left.wins)[0];
  const scoringLeader = [...careers].sort((left, right) => right.pointsFor - left.pointsFor)[0];
  const leagueId = snapshot.league.currentExternalLeagueId;

  return (
    <main className="history-content">
      <section className="history-scoreboard">
        <article className="history-feature-card">
          <span><Crown size={16} /> Defending champion</span>
          <strong>{champion?.displayName ?? "Not available"}</strong>
          <p>{championFranchise?.teamName || "Sleeper has not exposed a completed championship result."}</p>
          {champion ? <Link className="history-text-link" to={`managers/${champion.id}`}>View career</Link> : null}
        </article>
        <article><span>Seasons</span><strong>{snapshot.seasons.length}</strong><small>Normalized archives</small></article>
        <article><span>Managers</span><strong>{snapshot.managers.length}</strong><small>Permanent identities</small></article>
        <article><span>Matchups</span><strong>{snapshot.matchups.filter((row) => row.isComplete).length}</strong><small>Complete games</small></article>
      </section>

      <section className="history-section-grid">
        <article className="history-panel history-panel-wide">
          <header><div><span>League leaders</span><h2>The all-time board</h2></div><Trophy aria-hidden="true" /></header>
          <div className="history-leader-strip">
            <div><Medal size={17} /><span>GOAT rank</span><strong>{goat[0]?.career.manager.displayName ?? "—"}</strong><small>{formatNumber(goat[0]?.score ?? null)} points</small></div>
            <div><Users size={17} /><span>Career wins</span><strong>{allTimeLeader?.manager.displayName ?? "—"}</strong><small>{allTimeLeader ? formatRecord(allTimeLeader.wins, allTimeLeader.losses, allTimeLeader.ties) : "—"}</small></div>
            <div><Trophy size={17} /><span>Career scoring</span><strong>{scoringLeader?.manager.displayName ?? "—"}</strong><small>{formatNumber(scoringLeader?.pointsFor ?? null)} points</small></div>
          </div>
          <Link className="history-text-link" to="leaderboards">Open leaderboards</Link>
        </article>

        <article className="history-panel">
          <header><div><span>Rivalries</span><h2>Every meeting matters</h2></div><Swords aria-hidden="true" /></header>
          <p>Compare permanent manager identities across renamed teams and every imported season.</p>
          <Link className="history-action-link" to="h2h">Open H2H matrix</Link>
        </article>
      </section>

      <section className="history-panel">
        <header><div><span>Season archive</span><h2>Every imported year</h2></div><span className="history-count">{snapshot.seasons.length}</span></header>
        <div className="history-season-rail">
          {snapshot.seasons.map((season) => (
            <Link to={`seasons/${season.season}`} key={season.id}>
              <strong>{season.season}</strong><span>{season.status.replace(/_/g, " ")}</span><small>{season.totalRosters} franchises</small>
            </Link>
          ))}
        </div>
        <Link className="history-text-link" to={`/league/${leagueId}/history/seasons`}>Browse the full archive</Link>
      </section>
    </main>
  );
}
