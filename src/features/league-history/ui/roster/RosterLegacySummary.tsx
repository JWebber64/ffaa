import { buildRosterLegacy } from "../../analytics/rosterLegacy";
import type { LeagueHistorySnapshot } from "../../domain/types";
import { useLeagueHistoryWeeks } from "../../useLeagueHistoryWeeks";
import { formatNumber } from "../format";

const STATUS_LABEL = {
  complete: "Complete recorded source",
  provisional: "Provisional evidence",
  missing: "No starter evidence",
} as const;

export function RosterLegacySummary({
  leagueId,
  managerId,
  snapshot,
  title,
  eyebrow,
  detail,
}: {
  leagueId: string;
  managerId?: string;
  snapshot: LeagueHistorySnapshot;
  title: string;
  eyebrow: string;
  detail: string;
}) {
  const hydrated = useLeagueHistoryWeeks(leagueId, snapshot);

  if (hydrated.status === "loading") {
    return (
      <section className="history-panel history-roster-legacy" aria-busy="true">
        <header><div><span>{eyebrow}</span><h2>{title}</h2></div><small>Loading weekly starter evidence…</small></header>
        <div className="history-roster-legacy-state">Reading recorded lineups across imported seasons.</div>
      </section>
    );
  }

  const legacy = buildRosterLegacy(hydrated.data, managerId);
  const statusDetail = legacy.evidenceStatus === "complete"
    ? "Every included season reports complete weekly player evidence."
    : legacy.evidenceStatus === "provisional"
      ? "Leaders use the weekly player evidence currently stored; incomplete seasons remain provisional."
      : "No recorded starter lineups are available for this scope.";

  return (
    <section className="history-panel history-roster-legacy">
      <header>
        <div><span>{eyebrow}</span><h2>{title}</h2></div>
        <small data-status={legacy.evidenceStatus}>{STATUS_LABEL[legacy.evidenceStatus]}</small>
      </header>
      <p>{detail}</p>
      {legacy.rows.length ? (
        <div className="history-table-wrap">
          <table className="history-table history-roster-legacy-table">
            <thead><tr><th>Pos</th><th>Most-started player</th><th>Recorded starts</th><th>Seasons</th><th>Starter points</th></tr></thead>
            <tbody>{legacy.rows.map((row) => (
              <tr key={`${row.position}-${row.providerPlayerId}`}>
                <td><strong>{row.position}</strong></td>
                <td><strong title={`Sleeper player ${row.providerPlayerId}`}>{row.playerName}</strong></td>
                <td>{row.starts}</td>
                <td>{row.seasons}</td>
                <td>{row.starterPoints == null ? "—" : formatNumber(row.starterPoints, 2)}<small>{row.pointSamples} scored starts</small></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <div className="history-roster-legacy-state">{statusDetail}</div>}
      <footer>
        <span>{legacy.recordedStarts} recorded starts across {legacy.recordedSeasons} {legacy.recordedSeasons === 1 ? "season" : "seasons"}.</span>
        <small>{hydrated.status === "error" ? `Weekly evidence could not be refreshed: ${hydrated.error}` : statusDetail}</small>
      </footer>
    </section>
  );
}
