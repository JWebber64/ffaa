import { Activity, ArrowLeft, ArrowRight, CalendarDays, CircleDollarSign, Crown, ScrollText, Trophy } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { UniversalSelect } from "../../../../ui/UniversalSelect";
import type { HistoricalDraftPick, HistoricalMatchup } from "../../domain/types";
import { useLeagueHistorySnapshot } from "../historyContext";
import { coverageForSeason, coverageStatusLabel } from "../../coverage/historyCoverage";
import { formatNumber, formatRecord, ordinal } from "../format";
import { PlayerProfileButton } from "../../../player-profile/PlayerProfileProvider";

const ARCHIVE_SECTIONS = ["overview", "standings", "games", "auction", "activity"] as const;
type ArchiveSection = typeof ARCHIVE_SECTIONS[number];
type MatchupScope = "regular" | "playoffs";
type AuctionSort = "price-desc" | "price-asc" | "player" | "manager" | "franchise" | "position" | "recorded";

const AUCTION_SORT_LABELS: Record<AuctionSort, string> = {
  "price-desc": "Price high to low",
  "price-asc": "Price low to high",
  player: "Player A–Z",
  manager: "Manager A–Z",
  franchise: "Franchise A–Z",
  position: "Position",
  recorded: "Recorded order",
};

function isArchiveSection(value: string | null): value is ArchiveSection {
  return ARCHIVE_SECTIONS.includes(value as ArchiveSection);
}

function groupMatchupsByWeek(matchups: HistoricalMatchup[]) {
  const groups = new Map<number, HistoricalMatchup[]>();
  for (const matchup of matchups) groups.set(matchup.week, [...(groups.get(matchup.week) ?? []), matchup]);
  return [...groups.entries()].sort(([left], [right]) => left - right);
}

function recordedOrder(left: HistoricalDraftPick, right: HistoricalDraftPick) {
  if (left.pickNumber != null && right.pickNumber != null) return left.pickNumber - right.pickNumber;
  if (left.pickNumber != null) return -1;
  if (right.pickNumber != null) return 1;
  return left.playerName.localeCompare(right.playerName);
}

function settingRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function settingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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
          <span className="history-action-link">Open season</span>
        </Link>;
      })}</section>
    </main>
  );
}

export function SeasonArchivePage() {
  const snapshot = useLeagueHistorySnapshot();
  const { season: seasonParam = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [matchupScope, setMatchupScope] = useState<MatchupScope>("regular");
  const [draftQuery, setDraftQuery] = useState("");
  const [draftManager, setDraftManager] = useState("all");
  const [draftPosition, setDraftPosition] = useState("all");
  const [draftSort, setDraftSort] = useState<AuctionSort>("price-desc");
  const deferredDraftQuery = useDeferredValue(draftQuery);
  const season = snapshot.seasons.find((row) => row.season === Number(seasonParam));
  if (!season) return <main className="history-content"><div className="history-empty">Season not found.</div></main>;

  const requestedSection = searchParams.get("section");
  const activeSection: ArchiveSection = isArchiveSection(requestedSection) ? requestedSection : "overview";
  const changeSection = (nextSection: ArchiveSection) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSection === "overview") nextParams.delete("section");
    else nextParams.set("section", nextSection);
    setSearchParams(nextParams, { replace: true });
  };

  const franchises = snapshot.franchises.filter((franchise) => franchise.leagueSeasonId === season.id)
    .sort((left, right) => (left.finalRank ?? left.regularSeasonRank ?? 99) - (right.finalRank ?? right.regularSeasonRank ?? 99));
  const franchiseById = new Map(franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const managerNameForFranchise = (franchiseId: string | null) => {
    const franchise = franchiseId ? franchiseById.get(franchiseId) : null;
    return franchise?.managerId ? managerById.get(franchise.managerId)?.displayName ?? franchise.historicalUsername : franchise?.historicalUsername ?? "Unknown";
  };
  const matchups = snapshot.matchups.filter((matchup) => matchup.leagueSeasonId === season.id && matchup.isComplete)
    .sort((left, right) => left.week - right.week || left.providerMatchupId.localeCompare(right.providerMatchupId));
  const visibleMatchups = matchups.filter((matchup) => matchupScope === "playoffs" ? matchup.isPlayoff : !matchup.isPlayoff);
  const matchupWeeks = groupMatchupsByWeek(visibleMatchups);
  const title = snapshot.playoffMatches.find((match) => match.leagueSeasonId === season.id && match.bracketType === "winners" && match.placement === 1);
  const championFranchise = title?.winnerFranchiseId ? franchiseById.get(title.winnerFranchiseId) : null;
  const champion = championFranchise?.managerId ? managerById.get(championFranchise.managerId) : null;
  const drafts = snapshot.drafts.filter((draft) => draft.leagueSeasonId === season.id);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const draftPicks = snapshot.draftPicks.filter((pick) => draftIds.has(pick.draftId));
  const transactions = snapshot.transactions.filter((transaction) => transaction.leagueSeasonId === season.id)
    .sort((left, right) => (Date.parse(right.occurredAt ?? "") || 0) - (Date.parse(left.occurredAt ?? "") || 0));
  const seasonIndex = snapshot.seasons.findIndex((row) => row.id === season.id);
  const newer = snapshot.seasons[seasonIndex - 1];
  const older = snapshot.seasons[seasonIndex + 1];

  const regularSeasonLeader = [...franchises].sort((left, right) => (left.regularSeasonRank ?? 99) - (right.regularSeasonRank ?? 99))[0];
  const pointsLeader = [...franchises].sort((left, right) => right.pointsFor - left.pointsFor)[0];
  const highestScore = matchups.reduce<{ franchiseId: string; score: number; week: number } | null>((best, matchup) => {
    const candidate = matchup.scoreA >= matchup.scoreB
      ? { franchiseId: matchup.franchiseAId, score: matchup.scoreA, week: matchup.week }
      : { franchiseId: matchup.franchiseBId, score: matchup.scoreB, week: matchup.week };
    return !best || candidate.score > best.score ? candidate : best;
  }, null);
  const closestMatchup = matchups.reduce<HistoricalMatchup | null>((best, matchup) => !best || Math.abs(matchup.margin) < Math.abs(best.margin) ? matchup : best, null);

  const normalizedDraftQuery = deferredDraftQuery.trim().toLowerCase();
  const filteredDraftPicks = draftPicks.filter((pick) => {
    const franchise = pick.franchiseId ? franchiseById.get(pick.franchiseId) : null;
    const managerName = managerNameForFranchise(pick.franchiseId);
    const managerMatches = draftManager === "all" || franchise?.managerId === draftManager;
    const positionMatches = draftPosition === "all" || pick.position === draftPosition;
    const queryMatches = !normalizedDraftQuery || [pick.playerName, pick.providerPlayerId, pick.position, pick.nflTeam, franchise?.teamName, managerName]
      .some((value) => value?.toLowerCase().includes(normalizedDraftQuery));
    return managerMatches && positionMatches && queryMatches;
  }).sort((left, right) => {
    const leftFranchise = left.franchiseId ? franchiseById.get(left.franchiseId) : null;
    const rightFranchise = right.franchiseId ? franchiseById.get(right.franchiseId) : null;
    if (draftSort === "price-desc") return (right.auctionPrice ?? -1) - (left.auctionPrice ?? -1) || left.playerName.localeCompare(right.playerName);
    if (draftSort === "price-asc") return (left.auctionPrice ?? Number.POSITIVE_INFINITY) - (right.auctionPrice ?? Number.POSITIVE_INFINITY) || left.playerName.localeCompare(right.playerName);
    if (draftSort === "player") return left.playerName.localeCompare(right.playerName);
    if (draftSort === "manager") return managerNameForFranchise(left.franchiseId).localeCompare(managerNameForFranchise(right.franchiseId)) || left.playerName.localeCompare(right.playerName);
    if (draftSort === "franchise") return (leftFranchise?.teamName ?? "").localeCompare(rightFranchise?.teamName ?? "") || left.playerName.localeCompare(right.playerName);
    if (draftSort === "position") return left.position.localeCompare(right.position) || (right.auctionPrice ?? -1) - (left.auctionPrice ?? -1);
    return recordedOrder(left, right);
  });
  const managerOptions = franchises.filter((franchise) => franchise.managerId)
    .map((franchise) => ({ id: franchise.managerId!, name: managerNameForFranchise(franchise.id) }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const positionOptions = [...new Set(draftPicks.map((pick) => pick.position).filter(Boolean))].sort();
  const orderKnown = draftPicks.some((pick) => pick.pickNumber != null);
  const pricedPicks = draftPicks.filter((pick) => pick.auctionPrice != null);
  const recordedSpend = pricedPicks.reduce((sum, pick) => sum + (pick.auctionPrice ?? 0), 0);
  const largestBuy = [...pricedPicks].sort((left, right) => (right.auctionPrice ?? 0) - (left.auctionPrice ?? 0))[0];
  const positionSpend = pricedPicks.reduce<Record<string, number>>((totals, pick) => {
    const position = pick.position || "Other";
    totals[position] = (totals[position] ?? 0) + (pick.auctionPrice ?? 0);
    return totals;
  }, {});
  const auctionLedger = settingRecord(drafts[0]?.settings.auctionLedger);
  const draftCoverage = coverageForSeason(snapshot, season.id)?.domains.drafts ?? null;
  const expectedRosterSpots = draftCoverage?.expected ?? settingNumber(auctionLedger.expectedRosterSpots);
  const ledgerStatusLabel = coverageStatusLabel(draftCoverage?.status ?? "unknown");

  const tradeCount = transactions.filter((transaction) => transaction.transactionType === "trade").length;
  const waiverCount = transactions.filter((transaction) => transaction.transactionType === "waiver").length;
  const freeAgentCount = transactions.filter((transaction) => transaction.transactionType === "free_agent").length;
  const faabBids = transactions.map((transaction) => transaction.faabBid).filter((bid): bid is number => bid != null);
  const totalFaab = faabBids.reduce((sum, bid) => sum + bid, 0);
  const largestFaab = faabBids.length ? Math.max(...faabBids) : null;

  return (
    <main className="history-content history-season-archive">
      <Link className="history-back" to="../seasons"><ArrowLeft size={14} /> All seasons</Link>
      <section className="history-season-hero">
        <div><span>Season archive</span><h2>{season.season}</h2><p>{season.totalRosters} franchises · {season.status.replace(/_/g, " ")}</p></div>
        <div><Crown /><span>Champion</span><strong>{champion?.displayName ?? "Unavailable"}</strong><small>{championFranchise?.teamName}</small></div>
      </section>

      <nav className="history-season-sections" aria-label={`${season.season} season sections`}>
        {ARCHIVE_SECTIONS.map((section) => <button
          aria-current={activeSection === section ? "page" : undefined}
          className={activeSection === section ? "is-active" : ""}
          key={section}
          onClick={() => changeSection(section)}
          type="button"
        >{section}</button>)}
      </nav>

      {activeSection === "overview" ? <>
        <section className="history-page-heading"><span>Season at a glance</span><h2>{season.season} in four numbers</h2><p>The leaders and defining results from the completed season.</p></section>
        <section className="history-scoreboard history-season-highlights" aria-label={`${season.season} season highlights`}>
          <article><span>Regular-season leader</span><strong>{managerNameForFranchise(regularSeasonLeader?.id ?? null)}</strong><small>{regularSeasonLeader ? `${regularSeasonLeader.teamName} · ${formatRecord(regularSeasonLeader.wins, regularSeasonLeader.losses, regularSeasonLeader.ties)}` : "Unavailable"}</small></article>
          <article><span>Points leader</span><strong>{pointsLeader ? formatNumber(pointsLeader.pointsFor) : "—"}</strong><small>{pointsLeader ? `${managerNameForFranchise(pointsLeader.id)} · ${pointsLeader.teamName}` : "Unavailable"}</small></article>
          <article><span>Highest score</span><strong>{highestScore ? formatNumber(highestScore.score) : "—"}</strong><small>{highestScore ? `${franchiseById.get(highestScore.franchiseId)?.teamName ?? "Unknown"} · Week ${highestScore.week}` : "Unavailable"}</small></article>
          <article><span>Closest game</span><strong>{closestMatchup ? `${formatNumber(Math.abs(closestMatchup.margin))} pts` : "—"}</strong><small>{closestMatchup ? `${franchiseById.get(closestMatchup.franchiseAId)?.teamName ?? "Unknown"} vs ${franchiseById.get(closestMatchup.franchiseBId)?.teamName ?? "Unknown"} · Week ${closestMatchup.week}` : "Unavailable"}</small></article>
        </section>
        <section className="history-overview-actions" aria-label="Open season details">
          <button type="button" onClick={() => changeSection("standings")}><Trophy size={16} /><span>Final standings</span><small>{franchises.length} franchises</small></button>
          <button type="button" onClick={() => changeSection("games")}><CalendarDays size={16} /><span>Weekly games</span><small>{matchups.length} completed matchups</small></button>
          <button type="button" onClick={() => changeSection("auction")}><ScrollText size={16} /><span>Auction draft</span><small>{draftPicks.length} recorded players</small></button>
          <button type="button" onClick={() => changeSection("activity")}><Activity size={16} /><span>League activity</span><small>{transactions.length} stored events</small></button>
        </section>
      </> : null}

      {activeSection === "standings" ? <section className="history-panel">
        <header><div><span>Final table</span><h2>{season.season} standings</h2></div><Trophy /></header>
        <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Finish</th><th>Manager / franchise</th><th>Record</th><th>PF</th><th>PA</th><th>Playoffs</th></tr></thead><tbody>{franchises.map((franchise) => {
          const manager = franchise.managerId ? managerById.get(franchise.managerId) : null;
          return <tr className={franchise.id === championFranchise?.id ? "is-champion-row" : ""} key={franchise.id}><td>{ordinal(franchise.finalRank ?? franchise.regularSeasonRank)}</td><td>{manager ? <Link to={`../managers/${manager.id}`}>{manager.displayName}</Link> : "Unassigned"}<small>{franchise.teamName}</small></td><td>{formatRecord(franchise.wins, franchise.losses, franchise.ties)}</td><td>{formatNumber(franchise.pointsFor)}</td><td>{formatNumber(franchise.pointsAgainst)}</td><td>{franchise.playoffFinish || "—"}</td></tr>;
        })}</tbody></table></div>
      </section> : null}

      {activeSection === "games" ? <section className="history-panel history-games-panel">
        <header className="history-section-header"><div><span>Weekly results</span><h2>Schedule & playoffs</h2></div><div className="history-segment" aria-label="Game type"><button type="button" onClick={() => setMatchupScope("regular")} className={matchupScope === "regular" ? "is-active" : ""}>Regular season</button><button type="button" onClick={() => setMatchupScope("playoffs")} className={matchupScope === "playoffs" ? "is-active" : ""}>Playoffs</button></div></header>
        <div className="history-week-list">{matchupWeeks.map(([week, weekMatchups]) => {
          const championshipWeek = weekMatchups.some((matchup) => matchup.isChampionship);
          const playoffRound = weekMatchups.find((matchup) => matchup.playoffRound != null)?.playoffRound;
          return <section className="history-week-group" key={week}>
            <header><div><span>{championshipWeek ? "Championship" : matchupScope === "playoffs" && playoffRound != null ? `Playoff round ${playoffRound}` : "Regular season"}</span><h3>Week {week}</h3></div><small>{weekMatchups.length} {weekMatchups.length === 1 ? "game" : "games"}</small></header>
            <div className="history-matchup-grid">{weekMatchups.map((matchup) => {
              const left = franchiseById.get(matchup.franchiseAId);
              const right = franchiseById.get(matchup.franchiseBId);
              const leftWon = matchup.winnerFranchiseId === matchup.franchiseAId;
              const rightWon = matchup.winnerFranchiseId === matchup.franchiseBId;
              return <article aria-label={`${left?.teamName ?? "Unknown"} ${formatNumber(matchup.scoreA)}, ${right?.teamName ?? "Unknown"} ${formatNumber(matchup.scoreB)}`} key={matchup.id} className={matchup.isChampionship ? "is-title" : matchup.isPlayoff ? "is-playoff" : ""}>
                <div><span>{matchup.isChampionship ? "Title game" : matchup.isPlayoff ? "Playoff game" : "Final"}</span><small>{matchup.margin === 0 ? "Tie" : `${formatNumber(Math.abs(matchup.margin))}-point margin`}</small></div>
                <p className={leftWon ? "is-winner" : ""}><span>{left?.teamName ?? "Unknown"}</span><strong>{formatNumber(matchup.scoreA)}</strong></p>
                <p className={rightWon ? "is-winner" : ""}><span>{right?.teamName ?? "Unknown"}</span><strong>{formatNumber(matchup.scoreB)}</strong></p>
              </article>;
            })}</div>
          </section>;
        })}</div>
        {!matchupWeeks.length ? <div className="history-empty">No completed {matchupScope === "playoffs" ? "playoff" : "regular-season"} games were recorded.</div> : null}
      </section> : null}

      {activeSection === "auction" ? <section className="history-panel history-season-draft-panel">
        <header className="history-section-header"><div><span>Draft archive</span><h2>{drafts[0]?.draftType || "Sleeper"} draft · {draftPicks.length} players</h2></div><ScrollText /></header>
        {draftPicks.length ? <>
          <section className="history-draft-summary" aria-label="Auction summary">
            <div><span>Ledger status</span><strong>{ledgerStatusLabel}</strong></div>
            <div><span>Recorded players</span><strong>{draftPicks.length}{expectedRosterSpots == null ? "" : ` / ${expectedRosterSpots}`}</strong></div>
            <div><span>Recorded spend</span><strong>${formatNumber(recordedSpend, 0)}</strong></div>
            <div><span>Largest buy</span><strong>{largestBuy ? `${largestBuy.playerName} · $${formatNumber(largestBuy.auctionPrice, 0)}` : "Unavailable"}</strong></div>
          </section>
          <div className="history-position-spend" aria-label="Auction spend by position">{Object.entries(positionSpend).sort(([left], [right]) => ["QB", "RB", "WR", "TE", "K", "DEF"].indexOf(left) - ["QB", "RB", "WR", "TE", "K", "DEF"].indexOf(right)).map(([position, spend]) => <span key={position}><small>{position}</small><strong>${formatNumber(spend, 0)}</strong></span>)}</div>
          <div className="history-filter-bar history-season-draft-toolbar">
            <label className="history-draft-search"><span>Find a player</span><input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search player, team, or franchise" /></label>
            <label><span>Manager</span><UniversalSelect aria-label="Filter auction manager" value={draftManager} onValueChange={setDraftManager}><option value="all">All managers</option>{managerOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</UniversalSelect></label>
            <label><span>Position</span><UniversalSelect aria-label="Filter auction position" value={draftPosition} onValueChange={setDraftPosition}><option value="all">All positions</option>{positionOptions.map((position) => <option key={position} value={position}>{position}</option>)}</UniversalSelect></label>
            <label><span>Sort</span><UniversalSelect aria-label="Sort auction players" value={draftSort} onValueChange={(value) => setDraftSort(value as AuctionSort)}>{(Object.keys(AUCTION_SORT_LABELS) as AuctionSort[]).map((sort) => <option key={sort} value={sort}>{AUCTION_SORT_LABELS[sort]}</option>)}</UniversalSelect></label>
          </div>
          <div className="history-draft-table-heading"><span>{filteredDraftPicks.length === draftPicks.length ? `${draftPicks.length} recorded players` : `${filteredDraftPicks.length} of ${draftPicks.length} players`}</span>{!orderKnown ? <small>Nomination order was unavailable from the source, so the empty Pick column has been removed.</small> : null}</div>
          <div className="history-table-wrap history-draft-table-wrap history-season-draft-table-wrap">
            <table className="history-table history-draft-table"><thead><tr><th>Player</th><th>Pos / NFL</th><th>Manager</th><th>Franchise</th><th>Price</th>{orderKnown ? <th>Order</th> : null}</tr></thead><tbody>{filteredDraftPicks.map((pick) => {
              const franchise = pick.franchiseId ? franchiseById.get(pick.franchiseId) : null;
              return <tr key={pick.id}><td><PlayerProfileButton player={{ playerId: pick.providerPlayerId, playerName: pick.playerName, position: pick.position, nflTeam: pick.nflTeam }}><strong>{pick.playerName || pick.providerPlayerId}</strong>{pick.isKeeper ? <small>Keeper</small> : null}</PlayerProfileButton></td><td>{pick.position || "—"}<small>{pick.nflTeam || "NFL team unavailable"}</small></td><td>{managerNameForFranchise(pick.franchiseId)}</td><td>{franchise?.teamName ?? "Unknown"}</td><td className="history-price-cell">{pick.auctionPrice == null ? "—" : `$${formatNumber(pick.auctionPrice, 0)}`}</td>{orderKnown ? <td title={pick.pickNumber == null ? "Nomination order unavailable" : undefined}>{pick.pickNumber == null ? "—" : `#${pick.pickNumber}`}</td> : null}</tr>;
            })}</tbody></table>
            {!filteredDraftPicks.length ? <div className="history-draft-empty">No auction players match these filters.</div> : null}
          </div>
          <Link className="history-text-link" to="../drafts">Open all historical drafts</Link>
        </> : <div className="history-empty">No draft picks were exposed for this season.</div>}
      </section> : null}

      {activeSection === "activity" ? <>
        <section className="history-page-heading"><span>Transaction summary</span><h2>{transactions.length} stored events</h2><p>A useful season summary replaces the repetitive raw-event preview.</p></section>
        <section className="history-scoreboard history-activity-summary" aria-label={`${season.season} transaction summary`}>
          <article><span>Trades</span><strong>{tradeCount}</strong><small>Completed trade records</small></article>
          <article><span>Waiver claims</span><strong>{waiverCount}</strong><small>{freeAgentCount} free-agent moves</small></article>
          <article><span>FAAB spent</span><strong>${formatNumber(totalFaab, 0)}</strong><small>Across {faabBids.length} recorded bids</small></article>
          <article><span>Largest bid</span><strong>{largestFaab == null ? "—" : `$${formatNumber(largestFaab, 0)}`}</strong><small>{largestFaab == null ? "No FAAB bid recorded" : "Highest recorded claim"}</small></article>
        </section>
        <section className="history-panel history-activity-cta"><CircleDollarSign /><div><span>Complete normalized ledger</span><h2>Search every trade, waiver, and free-agent move</h2><p>The full transaction archive includes participants, assets, FAAB, status, and week.</p></div><Link className="history-text-link" to="../transactions">Open transaction history</Link></section>
      </> : null}

      <nav className="history-season-pagination" aria-label="Adjacent seasons">
        {older ? <Link to={`../seasons/${older.season}`}><ArrowLeft size={14} /> {older.season}</Link> : <span />}
        {newer ? <Link to={`../seasons/${newer.season}`}>{newer.season} <ArrowRight size={14} /></Link> : <span />}
      </nav>
    </main>
  );
}
