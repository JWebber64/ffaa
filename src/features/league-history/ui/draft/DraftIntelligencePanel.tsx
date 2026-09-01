import { useMemo, useState } from "react";

import { buildDraftIntelligence } from "../../analytics/draftIntelligence";
import type { DraftReceipt } from "../../analytics/draftIntelligenceTypes";
import { coverageForSeason, coverageStatusLabel } from "../../coverage/historyCoverage";
import type { LeagueHistorySnapshot } from "../../domain/types";
import { useLeagueHistoryWeeks } from "../../useLeagueHistoryWeeks";
import { formatNumber, ordinal } from "../format";

type ReceiptSort = "player" | "manager" | "price" | "startedPoints" | "efficiency" | "percentile";

function percent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function sortValue(receipt: DraftReceipt, sort: ReceiptSort) {
  if (sort === "player") return receipt.playerName;
  if (sort === "manager") return receipt.managerName;
  if (sort === "price") return receipt.price ?? -1;
  if (sort === "startedPoints") return receipt.startedPoints;
  if (sort === "percentile") return receipt.comparablePercentile ?? -1;
  return receipt.pointsPerDollar ?? -1;
}

function compareReceipts(left: DraftReceipt, right: DraftReceipt, sort: ReceiptSort, direction: "asc" | "desc") {
  const leftValue = sortValue(left, sort);
  const rightValue = sortValue(right, sort);
  const result = typeof leftValue === "string" && typeof rightValue === "string"
    ? leftValue.localeCompare(rightValue)
    : Number(leftValue) - Number(rightValue);
  return (direction === "asc" ? result : -result) || left.playerName.localeCompare(right.playerName);
}

function ReceiptSortButton({
  id,
  label,
  sort,
  direction,
  onChange,
}: {
  id: ReceiptSort;
  label: string;
  sort: ReceiptSort;
  direction: "asc" | "desc";
  onChange: (id: ReceiptSort) => void;
}) {
  const active = sort === id;
  return <button type="button" onClick={() => onChange(id)}>{label}{active ? direction === "asc" ? " ↑" : " ↓" : ""}</button>;
}

function ManagerDNA({ dna }: { dna: ReturnType<typeof buildDraftIntelligence>["managers"][number] }) {
  return (
    <section className="draft-dna" aria-labelledby="draft-dna-title">
      <header><div><span>Manager Draft DNA</span><h3 id="draft-dna-title">{dna.managerName}</h3></div><small>{dna.provisional ? "Provisional among recorded purchases" : "Complete recorded source"}</small></header>
      <dl className="draft-dna-facts">
        <div><dt>Recorded spend</dt><dd>${formatNumber(dna.totalSpend, 0)}</dd></div>
        <div><dt>Top-three concentration</dt><dd>{percent(dna.topThreeSpendShare)}</dd></div>
        <div><dt>Observed starter pts / $</dt><dd>{dna.pointsPerDollar == null ? "—" : formatNumber(dna.pointsPerDollar, 2)}</dd></div>
        <div><dt>Receipts measured</dt><dd>{dna.eligibleReceipts} / {dna.purchases}</dd></div>
      </dl>
      <div className="draft-dna-distributions">
        <section aria-label="Position spend">
          <h4>Position spend</h4>
          {dna.positionSpend.map((row) => <div key={row.id}><span>{row.label}</span><i><b style={{ width: `${row.spendShare * 100}%` }} /></i><strong>${formatNumber(row.spend, 0)} · {percent(row.spendShare)}</strong></div>)}
        </section>
        <section aria-label="Price bands">
          <h4>Budget-relative price bands</h4>
          {dna.priceBands.map((row) => <div key={row.id}><span>{row.label}</span><i><b style={{ width: `${row.spendShare * 100}%` }} /></i><strong>{row.purchases} buys · ${formatNumber(row.spend, 0)}</strong></div>)}
        </section>
      </div>
      {dna.repeatTargets.length ? <div className="draft-dna-repeat"><strong>Repeat targets</strong><span>{dna.repeatTargets.map((target) => `${target.playerName} (${target.seasons.join(", ")})`).join(" · ")}</span></div> : null}
    </section>
  );
}

export function DraftIntelligencePanel({
  leagueId,
  snapshot,
  seasonFilter,
  managerFilter,
}: {
  leagueId: string;
  snapshot: LeagueHistorySnapshot;
  seasonFilter: string;
  managerFilter: string;
}) {
  const hydrated = useLeagueHistoryWeeks(leagueId, snapshot);
  const [sort, setSort] = useState<ReceiptSort>("efficiency");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const intelligence = useMemo(() => buildDraftIntelligence(hydrated.data, {
    season: seasonFilter === "all" ? null : Number(seasonFilter),
    managerId: managerFilter === "all" ? null : managerFilter,
  }), [hydrated.data, managerFilter, seasonFilter]);
  const selectedManager = managerFilter === "all" ? null : intelligence.managers.find((manager) => manager.managerId === managerFilter) ?? null;
  const sortedReceipts = useMemo(
    () => [...intelligence.receipts].sort((left, right) => compareReceipts(left, right, sort, direction)),
    [direction, intelligence.receipts, sort],
  );
  const totalSpend = intelligence.receipts.reduce((sum, receipt) => sum + (receipt.price ?? 0), 0);
  const measuredReceipts = intelligence.receipts.filter((receipt) => receipt.pointsPerDollar != null).length;
  const selectedSeasonId = seasonFilter === "all"
    ? null
    : snapshot.seasons.find((season) => season.season === Number(seasonFilter))?.id ?? null;
  const selectedCoverage = selectedSeasonId ? coverageForSeason(hydrated.data, selectedSeasonId)?.domains.drafts ?? null : null;
  const changeSort = (next: ReceiptSort) => {
    if (next === sort) setDirection((current) => current === "desc" ? "asc" : "desc");
    else {
      setSort(next);
      setDirection(next === "player" || next === "manager" ? "asc" : "desc");
    }
  };

  if (hydrated.status === "loading") {
    return <section className="draft-intelligence-state" aria-busy="true"><strong>Building observed draft receipts…</strong><span>Loading weekly roster and player evidence.</span></section>;
  }
  if (!intelligence.receipts.length && !intelligence.keepers.length) {
    return <section className="draft-intelligence-state"><strong>No supported auction receipt yet</strong><span>This selection has no priced, linked auction purchases. Missing data is not treated as zero performance.</span></section>;
  }

  return (
    <section className="draft-intelligence" aria-label="Auction Draft Intelligence">
      <header className={`draft-intelligence-evidence ${intelligence.provisional ? "is-provisional" : ""}`}>
        <div><span>Evidence</span><strong>{selectedCoverage ? coverageStatusLabel(selectedCoverage.status) : intelligence.provisional ? "Provisional among recorded purchases" : "Complete recorded source"}</strong></div>
        <p>{seasonFilter === "all" ? `${intelligence.availableSeasons.length} recorded seasons` : `${seasonFilter} season`} · observed Weeks {intelligence.observationStartWeek ?? "—"}–{intelligence.observationEndWeek ?? "—"}. Receipts count only weeks when the player appears on the drafting franchise.</p>
        {hydrated.status === "error" ? <small role="status">Weekly evidence could not be refreshed: {hydrated.error}</small> : null}
      </header>

      <dl className="draft-intelligence-summary">
        <div><dt>Recorded spend</dt><dd>${formatNumber(totalSpend, 0)}</dd></div>
        <div><dt>Measured receipts</dt><dd>{measuredReceipts} / {intelligence.receipts.length}</dd></div>
        <div><dt>Observed window</dt><dd>{intelligence.observationStartWeek == null ? "Unavailable" : `Weeks ${intelligence.observationStartWeek}–${intelligence.observationEndWeek}`}</dd></div>
        <div><dt>Keepers separated</dt><dd>{intelligence.keepers.length}</dd></div>
      </dl>

      {selectedManager ? <ManagerDNA dna={selectedManager} /> : (
        <section className="draft-manager-comparison" aria-labelledby="draft-manager-comparison-title">
          <header><div><span>Manager Draft DNA</span><h3 id="draft-manager-comparison-title">Recorded construction</h3></div><small>{intelligence.provisional ? "Provisional among recorded purchases" : "Complete recorded source"}</small></header>
          <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Manager</th><th>Purchases</th><th>Spend</th><th>Top 3 share</th><th>Starter pts / $</th><th>Evidence</th></tr></thead><tbody>{intelligence.managers.map((manager) => <tr key={manager.id}><td><strong>{manager.managerName}</strong><small>{manager.seasons.join(", ")}</small></td><td>{manager.purchases}</td><td>${formatNumber(manager.totalSpend, 0)}</td><td>{percent(manager.topThreeSpendShare)}</td><td>{manager.pointsPerDollar == null ? "—" : formatNumber(manager.pointsPerDollar, 2)}</td><td>{manager.provisional ? "Provisional" : `${manager.eligibleReceipts}/${manager.purchases} measured`}</td></tr>)}</tbody></table></div>
        </section>
      )}

      <section className="draft-receipts" aria-labelledby="draft-receipts-title">
        <header><div><span>Purchase outcomes</span><h3 id="draft-receipts-title">Draft Receipts</h3></div><small>Percentiles require at least three same-season, same-position, same-band receipts.</small></header>
        <div className="history-table-wrap draft-receipts-table-wrap">
          <table className="history-table draft-receipts-table">
            <thead><tr>
              <th aria-sort={sort === "player" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="player" label="Player" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th aria-sort={sort === "manager" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="manager" label="Manager" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th aria-sort={sort === "price" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="price" label="Paid" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th>Observed weeks</th>
              <th aria-sort={sort === "startedPoints" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="startedPoints" label="Started pts" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th aria-sort={sort === "efficiency" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="efficiency" label="Pts / $" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th aria-sort={sort === "percentile" ? direction === "asc" ? "ascending" : "descending" : "none"}><ReceiptSortButton id="percentile" label="Comparable" sort={sort} direction={direction} onChange={changeSort} /></th>
              <th>Evidence</th>
            </tr></thead>
            <tbody>{sortedReceipts.map((receipt) => <tr key={receipt.id}>
              <td data-label="Player"><strong>{receipt.playerName}</strong><small>{receipt.position} · {receipt.nflTeam || "NFL team unavailable"}</small></td>
              <td data-label="Manager">{receipt.managerName}<small>{receipt.franchiseName}</small></td>
              <td data-label="Paid">{receipt.price == null ? "—" : `$${formatNumber(receipt.price, 0)}`}<small>{receipt.priceBand.label}</small></td>
              <td data-label="Observed weeks">{receipt.observedRosterWeeks}<small>{receipt.starterWeeks} starts</small></td>
              <td data-label="Started points">{receipt.observedRosterWeeks ? formatNumber(receipt.startedPoints, 1) : "—"}</td>
              <td data-label="Points per dollar">{receipt.pointsPerDollar == null ? "—" : formatNumber(receipt.pointsPerDollar, 2)}</td>
              <td data-label="Comparable">{ordinal(receipt.comparablePercentile)}<small>{receipt.comparableCount ? `${receipt.comparableCount} comparable` : "Sample below 3"}</small></td>
              <td data-label="Evidence">{receipt.exclusions.length ? "Unavailable" : receipt.provisional ? "Provisional" : "Measured"}<small>{receipt.exclusions.join(", ").replace(/-/g, " ")}</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      {intelligence.keepers.length ? <section className="draft-keepers"><strong>{intelligence.keepers.length} keepers shown separately</strong><span>{intelligence.keepers.map((keeper) => `${keeper.playerName} · ${keeper.managerName}`).join(" · ")}</span><small>Keeper prices do not enter auction efficiency comparisons because retention rules vary by season.</small></section> : null}
    </section>
  );
}
