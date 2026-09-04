import { Activity, CircleDollarSign, ExternalLink, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { UniversalSelect } from "../../../../ui/UniversalSelect";
import { coverageForSeason, coverageStatusLabel } from "../../coverage/historyCoverage";
import type { HistoricalTransactionAsset, Manager, SeasonFranchise } from "../../domain/types";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber } from "../format";
import { groupTransactionAssetsByRecipient } from "../transactionPresentation";
import { DraftIntelligencePanel } from "../draft/DraftIntelligencePanel";
import { PlayerProfileButton } from "../../../player-profile/PlayerProfileProvider";

const TRANSACTION_PAGE_SIZE = 100;

function transactionAssetLabel(asset: HistoricalTransactionAsset) {
  if (asset.assetType === "faab") return `$${formatNumber(asset.faabAmount, 0)} FAAB`;
  if (asset.assetType === "draft_pick") return asset.playerName || `${asset.draftSeason} round ${asset.draftRound} pick`;
  return asset.playerName || asset.providerPlayerId || "Unknown player";
}

function franchiseDisplayName(
  franchiseId: string | null,
  franchiseById: ReadonlyMap<string, SeasonFranchise>,
  managerById: ReadonlyMap<string, Manager>,
  fallback: string,
) {
  if (!franchiseId) return fallback;
  const franchise = franchiseById.get(franchiseId);
  if (!franchise) return fallback;
  return (franchise.managerId ? managerById.get(franchise.managerId)?.displayName : "") || franchise.teamName || fallback;
}

function TradeAssetFlow({
  assets,
  franchiseById,
  managerById,
}: {
  assets: HistoricalTransactionAsset[];
  franchiseById: ReadonlyMap<string, SeasonFranchise>;
  managerById: ReadonlyMap<string, Manager>;
}) {
  const recipientGroups = groupTransactionAssetsByRecipient(assets);
  if (!recipientGroups.length) return <div className="history-transaction-assets"><span>Trade details unavailable</span></div>;
  return (
    <div className="history-trade-flow" aria-label="Assets received by each manager">
      {recipientGroups.map((group) => {
        const recipient = franchiseDisplayName(group.recipientFranchiseId, franchiseById, managerById, "Unknown recipient");
        return (
          <section className="history-trade-receipt" aria-label={`${recipient} receives`} key={group.recipientFranchiseId ?? "unassigned"}>
            <div className="history-trade-recipient"><strong>{recipient}</strong><span>receives</span></div>
            <div className="history-trade-assets">
              {group.assets.map((asset) => (
                <div className="history-trade-asset" key={asset.id}>
                  <strong>{transactionAssetLabel(asset)}</strong>
                  <small>from {franchiseDisplayName(asset.fromFranchiseId, franchiseById, managerById, "League pool")}</small>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function settingRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function settingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function DraftHistoryPage() {
  const snapshot = useLeagueHistorySnapshot();
  const { leagueId = snapshot.league.currentExternalLeagueId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAuctionPicks = snapshot.draftPicks.some((pick) => pick.auctionPrice != null);
  const requestedView = searchParams.get("view");
  const activeView = requestedView === "ledger" || requestedView === "intelligence"
    ? requestedView
    : hasAuctionPicks ? "intelligence" : "ledger";
  const seasonFilter = searchParams.get("season") || "all";
  const managerFilter = searchParams.get("manager") || "all";
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("recorded");
  const setUrlFilter = (key: "view" | "season" | "manager", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all" || (key === "view" && value === "intelligence")) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const moveDraftViewFocus = (event: KeyboardEvent<HTMLButtonElement>, current: "intelligence" | "ledger") => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? "intelligence"
      : event.key === "End"
        ? "ledger"
        : current === "intelligence" ? "ledger" : "intelligence";
    setUrlFilter("view", next);
    requestAnimationFrame(() => document.getElementById(`draft-view-${next}`)?.focus());
  };
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const drafts = [...snapshot.drafts]
    .filter((draft) => seasonFilter === "all" || seasonById.get(draft.leagueSeasonId)?.season === Number(seasonFilter))
    .sort((left, right) => (seasonById.get(right.leagueSeasonId)?.season ?? 0) - (seasonById.get(left.leagueSeasonId)?.season ?? 0));
  const seasons = [...new Set(snapshot.drafts.map((draft) => seasonById.get(draft.leagueSeasonId)?.season).filter((season): season is number => season != null))].sort((a, b) => b - a);
  const managerOptions = snapshot.managers.filter((manager) => snapshot.franchises.some((franchise) => franchise.managerId === manager.id));
  const normalizedQuery = query.trim().toLowerCase();
  return (
    <main className="history-content">
      <section className="history-page-heading history-page-heading-row">
        <div><span>Draft foundation</span><h2>Historical drafts</h2><p>Snake drafts and supplemental auction workbooks share one verified ledger. Missing sale order and partial source records remain explicitly labeled.</p></div>
        <div className="history-filter-bar history-draft-toolbar">
          <label><span>Season</span><UniversalSelect value={seasonFilter} onValueChange={(value) => setUrlFilter("season", value)}><option value="all">All time</option>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</UniversalSelect></label>
          <label><span>Manager</span><UniversalSelect value={managerFilter} onValueChange={(value) => setUrlFilter("manager", value)}><option value="all">All managers</option>{managerOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName}</option>)}</UniversalSelect></label>
          {activeView === "ledger" ? <><label className="history-draft-search"><span>Find a player</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or team" /></label>
          <label><span>Sort</span><UniversalSelect value={sortMode} onValueChange={setSortMode}><option value="recorded">Recorded order</option><option value="price">Price high to low</option><option value="player">Player A–Z</option><option value="manager">Manager A–Z</option></UniversalSelect></label></> : null}
        </div>
      </section>
      <div className="history-draft-view-tabs" role="tablist" aria-label="Draft history views">
        <button id="draft-view-intelligence" type="button" role="tab" tabIndex={activeView === "intelligence" ? 0 : -1} aria-selected={activeView === "intelligence"} aria-controls="draft-intelligence-panel" className={activeView === "intelligence" ? "is-active" : ""} onClick={() => setUrlFilter("view", "intelligence")} onKeyDown={(event) => moveDraftViewFocus(event, "intelligence")}>Intelligence</button>
        <button id="draft-view-ledger" type="button" role="tab" tabIndex={activeView === "ledger" ? 0 : -1} aria-selected={activeView === "ledger"} aria-controls="draft-ledger-panel" className={activeView === "ledger" ? "is-active" : ""} onClick={() => setUrlFilter("view", "ledger")} onKeyDown={(event) => moveDraftViewFocus(event, "ledger")}>Ledger</button>
      </div>
      {activeView === "intelligence" ? <div id="draft-intelligence-panel" role="tabpanel"><DraftIntelligencePanel leagueId={leagueId} snapshot={snapshot} seasonFilter={seasonFilter} managerFilter={managerFilter} /></div> : null}
      {activeView === "ledger" ? <section id="draft-ledger-panel" role="tabpanel" className="history-draft-list">{drafts.map((draft) => {
        const season = seasonById.get(draft.leagueSeasonId);
        const allPicks = snapshot.draftPicks.filter((pick) => pick.draftId === draft.id);
        const filteredPicks = allPicks.filter((pick) => {
          const franchise = pick.franchiseId ? franchiseById.get(pick.franchiseId) : null;
          const manager = franchise?.managerId ? managerById.get(franchise.managerId) : null;
          const managerMatches = managerFilter === "all" || franchise?.managerId === managerFilter;
          const queryMatches = !normalizedQuery || [pick.playerName, pick.providerPlayerId, pick.position, pick.nflTeam, franchise?.teamName, manager?.displayName]
            .some((value) => value?.toLowerCase().includes(normalizedQuery));
          return managerMatches && queryMatches;
        }).sort((left, right) => {
          const leftFranchise = left.franchiseId ? franchiseById.get(left.franchiseId) : null;
          const rightFranchise = right.franchiseId ? franchiseById.get(right.franchiseId) : null;
          const leftManager = leftFranchise?.managerId ? managerById.get(leftFranchise.managerId)?.displayName ?? "" : "";
          const rightManager = rightFranchise?.managerId ? managerById.get(rightFranchise.managerId)?.displayName ?? "" : "";
          if (sortMode === "price") return (right.auctionPrice ?? -1) - (left.auctionPrice ?? -1) || left.playerName.localeCompare(right.playerName);
          if (sortMode === "player") return left.playerName.localeCompare(right.playerName);
          if (sortMode === "manager") return leftManager.localeCompare(rightManager) || left.playerName.localeCompare(right.playerName);
          if (left.pickNumber != null && right.pickNumber != null) return left.pickNumber - right.pickNumber;
          if (left.pickNumber != null) return -1;
          if (right.pickNumber != null) return 1;
          return left.playerName.localeCompare(right.playerName);
        });
        const auctionPicks = allPicks.filter((pick) => pick.auctionPrice != null);
        const biggest = [...auctionPicks].sort((a, b) => (b.auctionPrice ?? 0) - (a.auctionPrice ?? 0))[0];
        const ledger = settingRecord(draft.settings.auctionLedger);
        const sourceUrl = typeof ledger.url === "string" ? ledger.url : "";
        const sourceLabel = typeof ledger.label === "string" ? ledger.label : "";
        const coverage = coverageForSeason(snapshot, draft.leagueSeasonId)?.domains.drafts ?? null;
        const recordedSales = coverage?.observed ?? settingNumber(ledger.recordedSales) ?? allPicks.length;
        const expectedRosterSpots = coverage?.expected ?? settingNumber(ledger.expectedRosterSpots);
        const recordedSpend = coverage?.recordedSpend ?? settingNumber(ledger.recordedSpend);
        const expectedBudget = coverage?.expectedSpend ?? settingNumber(ledger.expectedBudget);
        const sourceComplete = coverage?.status === "complete";
        const orderKnown = coverage?.orderKnown ?? ledger.orderKnown !== false;
        const coverageLabel = coverageStatusLabel(coverage?.status ?? "unknown");
        const totalSpend = auctionPicks.reduce((sum, pick) => sum + (pick.auctionPrice ?? 0), 0);
        const positionTotals = auctionPicks.reduce<Record<string, number>>((totals, pick) => {
          const position = pick.position || "Other";
          totals[position] = (totals[position] ?? 0) + (pick.auctionPrice ?? 0);
          return totals;
        }, {});
        return <article className="history-panel history-draft-panel" key={draft.id}>
          <header><div><span>{season?.season} draft</span><h2>{draft.draftType || "Imported"} · {allPicks.length} picks</h2></div><ScrollText /></header>
          <div className="history-draft-summary"><div><span>Ledger status</span><strong>{coverageLabel}</strong></div><div><span>{draft.draftType === "auction" ? "Recorded spend" : "Budget"}</span><strong>{draft.draftType === "auction" ? `$${formatNumber(recordedSpend ?? totalSpend, 0)}` : draft.budget == null ? "—" : `$${formatNumber(draft.budget, 0)}`}</strong></div><div><span>Recorded picks</span><strong>{recordedSales}{expectedRosterSpots == null ? "" : ` / ${expectedRosterSpots}`}</strong></div><div><span>Largest buy</span><strong>{biggest ? `${biggest.playerName} · $${formatNumber(biggest.auctionPrice, 0)}` : "Unavailable"}</strong></div></div>
          {sourceUrl ? <div className="history-draft-source"><div><strong>{sourceComplete ? "Verified source ledger" : coverageLabel}</strong><span>{recordedSales} recorded sales{expectedRosterSpots == null ? "" : ` of ${expectedRosterSpots}`}{recordedSpend == null ? "" : ` · $${formatNumber(recordedSpend, 0)}`}{expectedBudget == null ? "" : ` of $${formatNumber(expectedBudget, 0)}`}{orderKnown ? "" : " · nomination order unavailable"}</span></div><a className="history-text-link" href={sourceUrl} target="_blank" rel="noreferrer">Open {sourceLabel || "source workbook"} <ExternalLink size={13} /></a></div> : null}
          {auctionPicks.length ? <div className="history-position-spend" aria-label="Auction spend by position">{Object.entries(positionTotals).sort(([left], [right]) => ["QB", "RB", "WR", "TE", "K", "DEF"].indexOf(left) - ["QB", "RB", "WR", "TE", "K", "DEF"].indexOf(right)).map(([position, spend]) => <span key={position}><small>{position}</small><strong>${formatNumber(spend, 0)}</strong></span>)}</div> : null}
          <div className="history-draft-table-heading"><span>{filteredPicks.length === allPicks.length ? `${allPicks.length} recorded picks` : `${filteredPicks.length} of ${allPicks.length} picks`}</span>{!orderKnown ? <small>“Recorded order” falls back to player name because nomination order is unavailable.</small> : null}</div>
          <div className="history-table-wrap history-draft-table-wrap">
            <table className="history-table history-draft-table"><thead><tr><th>Player</th><th>Pos / NFL</th><th>Manager</th><th>Franchise</th><th>Price</th><th>Order</th></tr></thead><tbody>{filteredPicks.map((pick) => {
              const franchise = pick.franchiseId ? franchiseById.get(pick.franchiseId) : null;
              const manager = franchise?.managerId ? managerById.get(franchise.managerId) : null;
              return <tr key={pick.id}><td><PlayerProfileButton player={{ playerId: pick.providerPlayerId, playerName: pick.playerName, position: pick.position, nflTeam: pick.nflTeam }}><strong>{pick.playerName || pick.providerPlayerId}</strong>{pick.isKeeper ? <small>Keeper</small> : null}</PlayerProfileButton></td><td>{pick.position || "—"}<small>{pick.nflTeam || "NFL team unavailable"}</small></td><td>{manager?.displayName ?? franchise?.historicalUsername ?? "Unknown"}</td><td>{franchise?.teamName ?? "Unknown"}</td><td className="history-price-cell">{pick.auctionPrice == null ? "—" : `$${formatNumber(pick.auctionPrice, 0)}`}</td><td title={pick.pickNumber == null ? "Nomination order unavailable" : undefined}>{pick.pickNumber == null ? "—" : `#${pick.pickNumber}`}</td></tr>;
            })}</tbody></table>
            {!filteredPicks.length ? <div className="history-draft-empty">No draft picks match these filters.</div> : null}
          </div>
          {season ? <Link className="history-text-link" to={`../seasons/${season.season}`}>Open season archive</Link> : null}
        </article>;
      })}</section> : null}
      {activeView === "ledger" && !drafts.length ? <div className="history-empty">No normalized draft records are available for this season.</div> : null}
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
    const map = new Map<string, HistoricalTransactionAsset[]>();
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
        const season = seasonById.get(transaction.leagueSeasonId);
        const isTrade = transaction.transactionType === "trade";
        const franchiseIds = isTrade ? [] : [...new Set(assets.flatMap((asset) => [asset.fromFranchiseId, asset.toFranchiseId].filter((id): id is string => Boolean(id))))];
        const managers = franchiseIds.map((id) => franchiseDisplayName(id, franchiseById, managerById, "Unknown manager"));
        return <article key={transaction.id}>
          <div className="history-transaction-type">{isTrade ? <Activity /> : <CircleDollarSign />}<span>{transaction.transactionType.replace(/_/g, " ")}</span><small>{season?.season} · Week {transaction.week ?? "—"}</small></div>
          <div className="history-transaction-body">{isTrade
            ? <TradeAssetFlow assets={assets} franchiseById={franchiseById} managerById={managerById} />
            : <><strong>{[...new Set(managers)].join(" · ") || "League transaction"}</strong><div className="history-transaction-assets">{assets.map((asset) => <span key={asset.id}>{transactionAssetLabel(asset)}</span>)}</div></>}
          </div>
          <div className="history-transaction-meta"><span>{transaction.status}</span>{transaction.faabBid == null ? null : <strong>${formatNumber(transaction.faabBid, 0)} bid</strong>}<small>{transaction.occurredAt ? new Date(transaction.occurredAt).toLocaleDateString() : "Date unavailable"}</small></div>
        </article>;
      })}</section>
      {rows.length ? <div className="history-load-more" aria-live="polite"><span>Showing {visibleRows.length} of {rows.length} completed transactions</span>{visibleRows.length < rows.length ? <button type="button" onClick={() => setVisibleCount((count) => count + TRANSACTION_PAGE_SIZE)}>Show 100 more</button> : null}</div> : null}
      {!rows.length ? <div className="history-empty">No transactions match this filter.</div> : null}
    </main>
  );
}
