import { ArrowRight, CalendarDays, Crown, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { calculateAllManagerCareers } from "../../analytics";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber, formatRecord } from "../format";

export function HistoryPage() {
  const snapshot = useLeagueHistorySnapshot();
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const titleBySeason = new Map(snapshot.playoffMatches
    .filter((match) => match.bracketType === "winners" && match.placement === 1)
    .map((match) => [match.leagueSeasonId, match]));
  return (
    <main className="history-content">
      <section className="history-page-heading"><span>League museum</span><h2>History timeline</h2><p>Chronological events are generated only from imported seasons and linked source results.</p></section>
      <section className="history-timeline">
        {snapshot.seasons.map((season) => {
          const title = titleBySeason.get(season.id);
          const championFranchise = title?.winnerFranchiseId ? franchiseById.get(title.winnerFranchiseId) : null;
          const champion = championFranchise?.managerId ? managerById.get(championFranchise.managerId) : null;
          return <article key={season.id}>
            <div className="history-timeline-year"><strong>{season.season}</strong><span>{season.status.replace(/_/g, " ")}</span></div>
            <div className="history-timeline-line"><span /></div>
            <div className="history-timeline-event">
              <span><CalendarDays size={15} /> League season</span><h3>{season.totalRosters}-team season</h3><p>{champion ? `${champion.displayName} won the championship as ${championFranchise?.teamName}.` : "No completed championship result is available from Sleeper for this season."}</p>
              <div>{champion ? <Link to={`../managers/${champion.id}`}>Champion <ArrowRight size={13} /></Link> : null}<Link to={`../seasons/${season.season}`}>Season archive <ArrowRight size={13} /></Link></div>
            </div>
          </article>;
        })}
      </section>
    </main>
  );
}

export function ChampionsPage() {
  const snapshot = useLeagueHistorySnapshot();
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const championships = snapshot.playoffMatches
    .filter((match) => match.bracketType === "winners" && match.placement === 1 && match.winnerFranchiseId)
    .sort((left, right) => (seasonById.get(right.leagueSeasonId)?.season ?? 0) - (seasonById.get(left.leagueSeasonId)?.season ?? 0));
  const careers = calculateAllManagerCareers(snapshot).sort((left, right) =>
    right.championships - left.championships || right.championshipAppearances - left.championshipAppearances);

  return (
    <main className="history-content">
      <section className="history-page-heading"><span>The title ledger</span><h2>Championship history</h2><p>Every champion and runner-up is tied to the original Sleeper playoff bracket and stored matchup.</p></section>
      <section className="history-champion-grid">
        {championships.map((title) => {
          const season = seasonById.get(title.leagueSeasonId);
          const championFranchise = title.winnerFranchiseId ? franchiseById.get(title.winnerFranchiseId) : null;
          const runnerUpFranchise = title.loserFranchiseId ? franchiseById.get(title.loserFranchiseId) : null;
          const champion = championFranchise?.managerId ? managerById.get(championFranchise.managerId) : null;
          const runnerUp = runnerUpFranchise?.managerId ? managerById.get(runnerUpFranchise.managerId) : null;
          const matchup = snapshot.matchups.find((row) => row.leagueSeasonId === title.leagueSeasonId && row.isChampionship
            && [row.franchiseAId, row.franchiseBId].includes(title.winnerFranchiseId ?? ""));
          const championScore = matchup && title.winnerFranchiseId === matchup.franchiseAId ? matchup.scoreA : matchup?.scoreB;
          const runnerUpScore = matchup && title.loserFranchiseId === matchup.franchiseAId ? matchup.scoreA : matchup?.scoreB;
          return <article key={title.id}>
            <div className="history-champion-year"><span>{season?.season}</span><Crown /></div>
            <div><small>Champion</small><h3>{champion?.displayName ?? championFranchise?.teamName ?? "Unknown"}</h3><p>{championFranchise?.teamName}</p></div>
            <div className="history-title-score"><strong>{championScore == null ? "—" : formatNumber(championScore)}</strong><span>–</span><strong>{runnerUpScore == null ? "—" : formatNumber(runnerUpScore)}</strong></div>
            <div><small>Runner-up</small><strong>{runnerUp?.displayName ?? runnerUpFranchise?.teamName ?? "Unknown"}</strong><p>{runnerUpFranchise ? formatRecord(runnerUpFranchise.wins, runnerUpFranchise.losses, runnerUpFranchise.ties) : ""}</p></div>
            <Link to={`../../seasons/${season?.season}`}>Open {season?.season} season <ArrowRight size={14} /></Link>
          </article>;
        })}
      </section>
      {!championships.length ? <div className="history-empty">Sleeper did not return a completed championship bracket for the imported seasons.</div> : null}

      <section className="history-panel">
        <header><div><span>Championship leaders</span><h2>Title table</h2></div><Trophy /></header>
        <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Manager</th><th>Titles</th><th>Finals</th><th>Finals win %</th><th>Seasons</th></tr></thead><tbody>
          {careers.map((career) => <tr key={career.manager.id}><td><Link to={`../../managers/${career.manager.id}`}>{career.manager.displayName}</Link></td><td>{career.championships}</td><td>{career.championshipAppearances}</td><td>{career.championshipAppearances ? `${((career.championships / career.championshipAppearances) * 100).toFixed(1)}%` : "—"}</td><td>{career.seasonsPlayed}</td></tr>)}
        </tbody></table></div>
      </section>
    </main>
  );
}
