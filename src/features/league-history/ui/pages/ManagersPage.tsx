import { ArrowLeft, Crown, Medal, Swords, Trophy, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  calculateAllManagerCareers,
  calculateGoatRankings,
  calculateHeadToHead,
  calculateManagerCareer,
} from "../../analytics";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber, formatPercentage, formatRecord, ordinal } from "../format";
import { ManagerDraftDNASummary } from "../draft/ManagerDraftDNASummary";

export function ManagersPage() {
  const snapshot = useLeagueHistorySnapshot();
  const goatByManager = new Map(calculateGoatRankings(snapshot).map((row) => [row.managerId, row]));
  const careers = calculateAllManagerCareers(snapshot).sort((left, right) =>
    (goatByManager.get(left.manager.id)?.rank ?? Number.MAX_SAFE_INTEGER)
    - (goatByManager.get(right.manager.id)?.rank ?? Number.MAX_SAFE_INTEGER));
  return (
    <main className="history-content">
      <section className="history-page-heading">
        <span>Permanent identities</span><h2>Manager careers</h2>
        <p>Career results stay with the Sleeper user ID even when usernames and franchise names change.</p>
      </section>
      <section className="history-manager-grid">
        {careers.map((career) => {
          const goat = goatByManager.get(career.manager.id);
          const currentTeam = career.franchises[0]?.teamName;
          return (
            <Link to={career.manager.id} className="history-manager-card" key={career.manager.id}>
              <div className="history-manager-avatar">
                {career.manager.avatarUrl ? <img src={career.manager.avatarUrl} alt="" /> : <UserRound aria-hidden="true" />}
                {goat?.rank === 1 ? <span><Crown size={12} /></span> : null}
              </div>
              <div><small>GOAT #{goat?.rank ?? "—"}</small><h3>{career.manager.displayName}</h3><p>{currentTeam || "Historical manager"}</p></div>
              <dl>
                <div><dt>Record</dt><dd>{formatRecord(career.wins, career.losses, career.ties)}</dd></div>
                <div><dt>Titles</dt><dd>{career.championships}</dd></div>
                <div><dt>Seasons</dt><dd>{career.seasonsPlayed}</dd></div>
              </dl>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

export function ManagerProfilePage() {
  const snapshot = useLeagueHistorySnapshot();
  const { managerId = "", leagueId = snapshot.league.currentExternalLeagueId } = useParams();
  const career = calculateManagerCareer(snapshot, managerId);
  const goat = calculateGoatRankings(snapshot).find((row) => row.managerId === managerId);
  if (!career) return <main className="history-content"><div className="history-empty">Manager not found.</div></main>;
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const franchiseIds = new Set(career.franchises.map((franchise) => franchise.id));
  const rivalries = snapshot.managers
    .filter((manager) => manager.id !== managerId)
    .map((manager) => calculateHeadToHead(snapshot, managerId, manager.id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.meetings.length));
  const nemesis = [...rivalries].sort((left, right) => (left.winsA - left.winsB) - (right.winsA - right.winsB))[0];
  const favorite = [...rivalries].sort((left, right) => (right.winsA - right.winsB) - (left.winsA - left.winsB))[0];
  const mostPlayed = [...rivalries].sort((left, right) => right.meetings.length - left.meetings.length)[0];
  const closest = [...rivalries].sort((left, right) => Math.abs(left.winsA - left.winsB) - Math.abs(right.winsA - right.winsB))[0];
  const draftPicks = snapshot.draftPicks.filter((pick) => pick.franchiseId && franchiseIds.has(pick.franchiseId));
  const transactionAssets = snapshot.transactionAssets.filter((asset) =>
    (asset.fromFranchiseId && franchiseIds.has(asset.fromFranchiseId))
    || (asset.toFranchiseId && franchiseIds.has(asset.toFranchiseId)));

  return (
    <main className="history-content">
      <Link className="history-back" to="../managers"><ArrowLeft size={14} /> All managers</Link>
      <section className="history-profile-hero">
        <div className="history-profile-avatar">
          {career.manager.avatarUrl ? <img src={career.manager.avatarUrl} alt="" /> : <UserRound />}
        </div>
        <div><span>GOAT rank #{goat?.rank ?? "—"}</span><h2>{career.manager.displayName}</h2><p>{career.franchises[0]?.teamName || "Historical manager"} · {career.seasonsPlayed} seasons</p></div>
        <div className="history-profile-record"><strong>{formatRecord(career.wins, career.losses, career.ties)}</strong><span>{formatPercentage(career.winPercentage)} career</span></div>
      </section>

      <section className="history-stat-grid">
        <article><span>Championships</span><strong>{career.championships}</strong><small>{career.championshipAppearances} finals</small></article>
        <article><span>Playoffs</span><strong>{formatRecord(career.playoffWins, career.playoffLosses)}</strong><small>{career.playoffAppearances} appearances</small></article>
        <article><span>Career points</span><strong>{formatNumber(career.pointsFor)}</strong><small>{formatNumber(career.pointDifferential)} differential</small></article>
        <article><span>Average finish</span><strong>{ordinal(career.averageFinish == null ? null : Math.round(career.averageFinish))}</strong><small>Best: {ordinal(career.bestFinish)}</small></article>
        <article><span>Longest win streak</span><strong>{career.longestWinningStreak}</strong><small>Longest skid: {career.longestLosingStreak}</small></article>
        <article><span>Weekly ceiling</span><strong>{formatNumber(career.highestWeeklyScore)}</strong><small>Low: {formatNumber(career.lowestWeeklyScore)}</small></article>
      </section>

      <section className="history-section-grid">
        <article className="history-panel history-panel-wide">
          <header><div><span>Season history</span><h2>Franchise ledger</h2></div><Medal /></header>
          <div className="history-table-wrap"><table className="history-table">
            <thead><tr><th>Season</th><th>Franchise</th><th>Record</th><th>PF</th><th>PA</th><th>Finish</th></tr></thead>
            <tbody>{career.franchises.map((franchise) => {
              const season = seasonById.get(franchise.leagueSeasonId);
              const finishLabel = season?.status === "complete"
                ? franchise.playoffFinish || ordinal(franchise.finalRank ?? franchise.regularSeasonRank)
                : "In season";
              return <tr key={franchise.id}><td><Link to={`../seasons/${season?.season}`}>{season?.season}</Link></td><td>{franchise.teamName}</td><td>{formatRecord(franchise.wins, franchise.losses, franchise.ties)}</td><td>{formatNumber(franchise.pointsFor)}</td><td>{formatNumber(franchise.pointsAgainst)}</td><td>{finishLabel}</td></tr>;
            })}</tbody>
          </table></div>
        </article>

        <article className="history-panel">
          <header><div><span>Rivalries</span><h2>Career opponents</h2></div><Swords /></header>
          <div className="history-rivalry-facts">
            <div><span>Nemesis</span><strong>{nemesis?.managerB.displayName ?? "—"}</strong><small>Worst deterministic W-L differential</small></div>
            <div><span>Favorite opponent</span><strong>{favorite?.managerB.displayName ?? "—"}</strong><small>Best deterministic W-L differential</small></div>
            <div><span>Most played</span><strong>{mostPlayed?.managerB.displayName ?? "—"}</strong><small>{mostPlayed?.meetings.length ?? 0} meetings</small></div>
            <div><span>Closest rivalry</span><strong>{closest?.managerB.displayName ?? "—"}</strong><small>{closest ? `${closest.winsA}-${closest.winsB}-${closest.ties}` : "No meetings"}</small></div>
          </div>
          {mostPlayed ? <Link className="history-text-link" to={`../rivalries/${managerId}/${mostPlayed.managerB.id}`}>Open rivalry</Link> : null}
        </article>
      </section>

      <section className="history-section-grid">
        <article className="history-panel"><header><div><span>Trophy case</span><h2>Career honors</h2></div><Trophy /></header><div className="history-trophy-row"><strong>{career.championships}</strong><span>Championships</span><strong>{career.regularSeasonTitles}</strong><span>Regular-season titles</span></div></article>
        <article className="history-panel"><header><div><span>Historical activity</span><h2>Draft DNA</h2></div><Crown /></header><ManagerDraftDNASummary leagueId={leagueId} managerId={managerId} snapshot={snapshot} /><p>{draftPicks.length} stored draft picks · {transactionAssets.length} stored transaction assets.</p><div className="history-inline-links"><Link to="../drafts">Draft archive</Link><Link to="../transactions">Transaction archive</Link></div></article>
      </section>
    </main>
  );
}
