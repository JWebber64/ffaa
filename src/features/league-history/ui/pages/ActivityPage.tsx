import { Activity, ArrowRight, CircleDollarSign, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { UniversalSelect } from "../../../../ui/UniversalSelect";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber } from "../format";

const TRANSACTION_PAGE_SIZE = 100;

export function DraftHistoryPage() {
  const snapshot = useLeagueHistorySnapshot();
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const drafts = [...snapshot.drafts].sort((left, right) =>
    (seasonById.get(right.leagueSeasonId)?.season ?? 0) - (seasonById.get(left.leagueSeasonId)?.season ?? 0));
  return (
    <main className="history-content">
      <section className="history-page-heading"><span>Draft foundation</span><h2>Historical drafts</h2><p>Snake and auction picks share one normalized draft ledger; auction price appears only when Sleeper supplied it.</p></section>
      <section className="history-draft-list">{drafts.map((draft) => {
        const season = seasonById.get(draft.leagueSeasonId);
        const picks = snapshot.draftPicks.filter((pick) => pick.draftId === draft.id).sort((a, b) => a.pickNumber - b.pickNumber);
        const biggest = [...picks].filter((pick) => pick.auctionPrice != null).sort((a, b) => (b.auctionPrice ?? 0) - (a.auctionPrice ?? 0))[0];
        return <article className="history-panel" key={draft.id}>
          <header><div><span>{season?.season} draft</span><h2>{draft.draftType || "Sleeper"} · {picks.length} picks</h2></div><ScrollText /></header>
          <div className="history-draft-summary"><div><span>Status</span><strong>{draft.status.replace(/_/g, " ")}</strong></div><div><span>Budget</span><strong>{draft.budget == null ? "—" : `$${formatNumber(draft.budget, 0)}`}</strong></div><div><span>Rounds</span><strong>{draft.rounds ?? "—"}</strong></div><div><span>Largest buy</span><strong>{biggest ? `${biggest.playerName} · $${formatNumber(biggest.auctionPrice, 0)}` : "Unavailable"}</strong></div></div>
          <div className="history-pick-strip">{picks.slice(0, 16).map((pick) => <div key={pick.id}><small>#{pick.pickNumber}</small><strong>{pick.playerName || pick.providerPlayerId}</strong><span>{pick.franchiseId ? franchiseById.get(pick.franchiseId)?.teamName : "Unknown"}{pick.auctionPrice == null ? "" : ` · $${formatNumber(pick.auctionPrice, 0)}`}</span></div>)}</div>
          {season ? <Link className="history-text-link" to={`../seasons/${season.season}`}>Open season archive <ArrowRight size={14} /></Link> : null}
        </article>;
      })}</section>
      {!drafts.length ? <div className="history-empty">No Sleeper draft records were available in the imported season chain.</div> : null}
    </main>
  );
}

export function TransactionHistoryPage({ defaultType = "all" }: { defaultType?: "all" | "trade" | "waiver" }) {
  const snapshot = useLeagueHistorySnapshot();
  const seasons = snapshot.seasons.map((season) => season.season).sort((a, b) => b - a);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState(defaultType);
  const [visibleCount, setVisibleCount] = useState(TRANSACTION_PAGE_SIZE);
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const assetsByTransaction = useMemo(() => {
    const map = new Map<string, typeof snapshot.transactionAssets>();
    for (const asset of snapshot.transactionAssets) map.set(asset.transactionId, [...(map.get(asset.transactionId) ?? []), asset]);
    return map;
  }, [snapshot.transactionAssets]);
  const rows = snapshot.transactions.filter((transaction) => {
    const season = seasonById.get(transaction.leagueSeasonId)?.season;
    const seasonMatches = seasonFilter === "all" || season === Number(seasonFilter);
    const typeMatches = typeFilter === "all" || (typeFilter === "trade" ? transaction.transactionType === "trade" : ["waiver", "free_agent"].includes(transaction.transactionType));
    return seasonMatches && typeMatches;
  }).sort((left, right) => (Date.parse(right.occurredAt ?? "") || 0) - (Date.parse(left.occurredAt ?? "") || 0));
  const visibleRows = rows.slice(0, visibleCount);
  const changeSeason = (value: string) => {
    setSeasonFilter(value);
    setVisibleCount(TRANSACTION_PAGE_SIZE);
  };
  const changeType = (value: typeof typeFilter) => {
    setTypeFilter(value);
    setVisibleCount(TRANSACTION_PAGE_SIZE);
  };

  return (
    <main className="history-content">
      <section className="history-page-heading history-page-heading-row">
        <div><span>Normalized asset ledger</span><h2>Transactions, trades & waivers</h2><p>Multi-team trades can contain players, FAAB, and draft picks without forcing a two-manager model.</p></div>
        <div className="history-filter-bar"><label><span>Season</span><UniversalSelect value={seasonFilter} onValueChange={changeSeason}><option value="all">All time</option>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</UniversalSelect></label><div className="history-segment">{(["all", "trade", "waiver"] as const).map((type) => <button type="button" key={type} onClick={() => changeType(type)} className={typeFilter === type ? "is-active" : ""}>{type}</button>)}</div></div>
      </section>
      <section className="history-transaction-list">{visibleRows.map((transaction) => {
        const assets = assetsByTransaction.get(transaction.id) ?? [];
        const franchiseIds = new Set(assets.flatMap((asset) => [asset.fromFranchiseId, asset.toFranchiseId].filter((id): id is string => Boolean(id))));
        const managers = [...franchiseIds].map((id) => franchiseById.get(id)).flatMap((franchise) => franchise?.managerId ? [managerById.get(franchise.managerId)?.displayName ?? franchise.teamName] : franchise ? [franchise.teamName] : []);
        const season = seasonById.get(transaction.leagueSeasonId);
        return <article key={transaction.id}>
          <div className="history-transaction-type">{transaction.transactionType === "trade" ? <Activity /> : <CircleDollarSign />}<span>{transaction.transactionType.replace(/_/g, " ")}</span><small>{season?.season} · Week {transaction.week ?? "—"}</small></div>
          <div className="history-transaction-body"><strong>{[...new Set(managers)].join(" · ") || "League transaction"}</strong><div>{assets.map((asset) => <span key={asset.id}>{asset.assetType === "faab" ? `$${formatNumber(asset.faabAmount, 0)} FAAB` : asset.playerName || `${asset.draftSeason} R${asset.draftRound}`}</span>)}</div></div>
          <div className="history-transaction-meta"><span>{transaction.status}</span>{transaction.faabBid == null ? null : <strong>${formatNumber(transaction.faabBid, 0)} bid</strong>}<small>{transaction.occurredAt ? new Date(transaction.occurredAt).toLocaleDateString() : "Date unavailable"}</small></div>
        </article>;
      })}</section>
      {rows.length ? <div className="history-load-more" aria-live="polite"><span>Showing {visibleRows.length} of {rows.length} completed transactions</span>{visibleRows.length < rows.length ? <button type="button" onClick={() => setVisibleCount((count) => count + TRANSACTION_PAGE_SIZE)}>Show 100 more</button> : null}</div> : null}
      {!rows.length ? <div className="history-empty">No transactions match this filter.</div> : null}
    </main>
  );
}
