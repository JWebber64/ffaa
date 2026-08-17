import { ArrowLeft, ArrowRight, CalendarDays, Crown, ScrollText, Trophy } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber, formatRecord, ordinal } from "../format";

export function SeasonsPage() {
  const snapshot = useLeagueHistorySnapshot();
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  return (
    <main className="history-content">
      <section className="history-page-heading"><span>Permanent archives</span><h2>League seasons</h2><p>Every year has its own standings, schedule, playoffs, draft, and transaction ledger.</p></section>
      <section className="history-archive-grid">{snapshot.seasons.map((season) => {
        const title = snapshot.playoffMatches.find((match) => match.leagueSeasonId === season.id && match.bracketType === "winners" && match.placement === 1);
        const franchise = title?.winnerFranchiseId ? franchiseById.get(title.winnerFranchiseId) : null;
        const champion = franchise?.managerId ? managerById.get(franchise.managerId) : null;
        const matchups = snapshot.matchups.filter((matchup) => matchup.leagueSeasonId === season.id && matchup.isComplete).length;
        const transactions = snapshot.transactions.filter((transaction) => transaction.leagueSeasonId === season.id).length;
        return <Link className="history-archive-card" to={String(season.season)} key={season.id}>
          <div><span>{season.status.replace(/_/g, " ")}</span><strong>{season.season}</strong></div>
          <h3>{champion ? `${champion.displayName} won the title` : "Championship unavailable"}</h3><p>{franchise?.teamName || `${season.totalRosters} franchises`}</p>
          <dl><div><dt>Matchups</dt><dd>{matchups}</dd></div><div><dt>Transactions</dt><dd>{transactions}</dd></div><div><dt>Drafts</dt><dd>{snapshot.drafts.filter((draft) => draft.leagueSeasonId === season.id).length}</dd></div></dl>
          <span className="history-action-link">Open season <ArrowRight size={14} /></span>
        </Link>;
      })}</section>
    </main>
  );
}

export function SeasonArchivePage() {
  const snapshot = useLeagueHistorySnapshot();
  const { season: seasonParam = "" } = useParams();
  const season = snapshot.seasons.find((row) => row.season === Number(seasonParam));
  if (!season) return <main className="history-content"><div className="history-empty">Season not found.</div></main>;
  const franchises = snapshot.franchises.filter((franchise) => franchise.leagueSeasonId === season.id)
    .sort((left, right) => (left.finalRank ?? left.regularSeasonRank ?? 99) - (right.finalRank ?? right.regularSeasonRank ?? 99));
  const franchiseById = new Map(franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const matchups = snapshot.matchups.filter((matchup) => matchup.leagueSeasonId === season.id && matchup.isComplete)
    .sort((left, right) => left.week - right.week || left.providerMatchupId.localeCompare(right.providerMatchupId));
  const title = snapshot.playoffMatches.find((match) => match.leagueSeasonId === season.id && match.bracketType === "winners" && match.placement === 1);
  const championFranchise = title?.winnerFranchiseId ? franchiseById.get(title.winnerFranchiseId) : null;
  const champion = championFranchise?.managerId ? managerById.get(championFranchise.managerId) : null;
  const drafts = snapshot.drafts.filter((draft) => draft.leagueSeasonId === season.id);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const draftPicks = snapshot.draftPicks.filter((pick) => draftIds.has(pick.draftId)).sort((a, b) => a.pickNumber - b.pickNumber);
  const transactions = snapshot.transactions.filter((transaction) => transaction.leagueSeasonId === season.id)
    .sort((left, right) => (Date.parse(right.occurredAt ?? "") || 0) - (Date.parse(left.occurredAt ?? "") || 0));
  const seasonIndex = snapshot.seasons.findIndex((row) => row.id === season.id);
  const newer = snapshot.seasons[seasonIndex - 1];
  const older = snapshot.seasons[seasonIndex + 1];

  return (
    <main className="history-content">
      <Link className="history-back" to="../seasons"><ArrowLeft size={14} /> All seasons</Link>
      <section className="history-season-hero">
        <div><span>Season archive</span><h2>{season.season}</h2><p>{season.totalRosters} franchises · {season.status.replace(/_/g, " ")}</p></div>
        <div><Crown /><span>Champion</span><strong>{champion?.displayName ?? "Unavailable"}</strong><small>{championFranchise?.teamName}</small></div>
      </section>

      <section className="history-panel">
        <header><div><span>Final table</span><h2>{season.season} standings</h2></div><Trophy /></header>
        <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Finish</th><th>Manager / franchise</th><th>Record</th><th>PF</th><th>PA</th><th>Playoffs</th></tr></thead><tbody>{franchises.map((franchise) => {
          const manager = franchise.managerId ? managerById.get(franchise.managerId) : null;
          return <tr key={franchise.id}><td>{ordinal(franchise.finalRank ?? franchise.regularSeasonRank)}</td><td>{manager ? <Link to={`../managers/${manager.id}`}>{manager.displayName}</Link> : "Unassigned"}<small>{franchise.teamName}</small></td><td>{formatRecord(franchise.wins, franchise.losses, franchise.ties)}</td><td>{formatNumber(franchise.pointsFor)}</td><td>{formatNumber(franchise.pointsAgainst)}</td><td>{franchise.playoffFinish || "—"}</td></tr>;
        })}</tbody></table></div>
      </section>

      <section className="history-panel">
        <header><div><span>Weekly results</span><h2>Schedule & playoffs</h2></div><CalendarDays /></header>
        <div className="history-matchup-grid">{matchups.map((matchup) => {
          const left = franchiseById.get(matchup.franchiseAId);
          const right = franchiseById.get(matchup.franchiseBId);
          return <article key={matchup.id} className={matchup.isChampionship ? "is-title" : matchup.isPlayoff ? "is-playoff" : ""}>
            <div><span>Week {matchup.week}</span>{matchup.isChampionship ? <small>Championship</small> : matchup.isPlayoff ? <small>Playoffs</small> : null}</div>
            <p><span>{left?.teamName ?? "Unknown"}</span><strong>{formatNumber(matchup.scoreA)}</strong></p>
            <p><span>{right?.teamName ?? "Unknown"}</span><strong>{formatNumber(matchup.scoreB)}</strong></p>
          </article>;
        })}</div>
      </section>

      <section className="history-section-grid">
        <article className="history-panel history-panel-wide">
          <header><div><span>Draft archive</span><h2>{drafts[0]?.draftType || "Sleeper"} draft</h2></div><ScrollText /></header>
          {draftPicks.length ? <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Pick</th><th>Player</th><th>Franchise</th><th>Position</th><th>Price</th></tr></thead><tbody>{draftPicks.slice(0, 60).map((pick) => <tr key={pick.id}><td>{pick.pickNumber}</td><td>{pick.playerName || pick.providerPlayerId}</td><td>{pick.franchiseId ? franchiseById.get(pick.franchiseId)?.teamName : "—"}</td><td>{pick.position || "—"}</td><td>{pick.auctionPrice == null ? "—" : `$${formatNumber(pick.auctionPrice, 0)}`}</td></tr>)}</tbody></table></div> : <div className="history-empty">No draft picks were exposed for this season.</div>}
        </article>
        <article className="history-panel">
          <header><div><span>Transaction ledger</span><h2>{transactions.length} stored events</h2></div><span className="history-count">{transactions.length}</span></header>
          <div className="history-transaction-mini">{transactions.slice(0, 12).map((transaction) => <div key={transaction.id}><strong>{transaction.transactionType.replace(/_/g, " ")}</strong><span>Week {transaction.week ?? "—"}</span><small>{transaction.faabBid == null ? transaction.status : `$${formatNumber(transaction.faabBid, 0)} FAAB`}</small></div>)}</div>
          <Link className="history-text-link" to="../transactions">Open transaction history <ArrowRight size={14} /></Link>
        </article>
      </section>

      <nav className="history-season-pagination" aria-label="Adjacent seasons">
        {older ? <Link to={`../seasons/${older.season}`}><ArrowLeft size={14} /> {older.season}</Link> : <span />}
        {newer ? <Link to={`../seasons/${newer.season}`}>{newer.season} <ArrowRight size={14} /></Link> : <span />}
      </nav>
    </main>
  );
}
