import { Link } from "react-router-dom";

import { buildDraftIntelligence } from "../../analytics/draftIntelligence";
import type { LeagueHistorySnapshot } from "../../domain/types";
import { useLeagueHistoryWeeks } from "../../useLeagueHistoryWeeks";
import { formatNumber } from "../format";

function percentage(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export function ManagerDraftDNASummary({
  leagueId,
  managerId,
  snapshot,
}: {
  leagueId: string;
  managerId: string;
  snapshot: LeagueHistorySnapshot;
}) {
  const hydrated = useLeagueHistoryWeeks(leagueId, snapshot);
  const intelligence = buildDraftIntelligence(hydrated.data, { managerId });
  const dna = intelligence.managers[0] ?? null;
  const target = `../drafts?view=intelligence&manager=${encodeURIComponent(managerId)}`;

  if (hydrated.status === "loading") {
    return <div className="draft-manager-profile-state" aria-busy="true">Loading observed draft receipts…</div>;
  }
  if (!dna) {
    return <div className="draft-manager-profile-state"><strong>No supported auction receipt yet</strong><span>Priced, manager-linked auction history is required.</span></div>;
  }

  return (
    <div className="draft-manager-profile">
      <p>{dna.provisional ? "Provisional among recorded purchases." : "Complete recorded source."} Weekly returns count only observed ownership on this franchise.</p>
      <dl>
        <div><dt>Recorded spend</dt><dd>${formatNumber(dna.totalSpend, 0)}</dd></div>
        <div><dt>Top-three share</dt><dd>{percentage(dna.topThreeSpendShare)}</dd></div>
        <div><dt>Starter pts / $</dt><dd>{dna.pointsPerDollar == null ? "—" : formatNumber(dna.pointsPerDollar, 2)}</dd></div>
        <div><dt>Measured</dt><dd>{dna.eligibleReceipts} / {dna.purchases}</dd></div>
      </dl>
      <div className="draft-manager-profile-positions">
        {dna.positionSpend.map((row) => <span key={row.id}><small>{row.label}</small><strong>${formatNumber(row.spend, 0)}</strong><em>{percentage(row.spendShare)}</em></span>)}
      </div>
      {dna.repeatTargets.length ? <small>Repeat targets: {dna.repeatTargets.map((target) => `${target.playerName} (${target.seasons.join(", ")})`).join(" · ")}</small> : null}
      {hydrated.status === "error" ? <small role="status">Weekly evidence could not be refreshed: {hydrated.error}</small> : null}
      <Link className="history-text-link" to={target}>Open filtered Draft Intelligence</Link>
    </div>
  );
}
