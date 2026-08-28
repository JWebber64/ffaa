import { Medal } from "lucide-react";
import { Link } from "react-router-dom";

import { buildLeagueRecordBook } from "../../analytics";
import type { LeagueRecordEntry } from "../../analytics";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber } from "../format";

function grouped(entries: LeagueRecordEntry[]) {
  const result = new Map<string, LeagueRecordEntry[]>();
  for (const entry of entries) result.set(entry.label, [...(result.get(entry.label) ?? []), entry]);
  return [...result.entries()];
}

export function RecordsPage() {
  const snapshot = useLeagueHistorySnapshot();
  const categories = buildLeagueRecordBook(snapshot);
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  return (
    <main className="history-content">
      <section className="history-page-heading"><span>League record book</span><h2>More than the record holder</h2><p>Top results link back to the permanent manager or season record that produced them.</p></section>
      {categories.map((category) => <section className="history-record-section" key={category.id}>
        <header><Medal /><div><span>{category.id.replace(/-/g, " ")}</span><h2>{category.title} records</h2></div></header>
        <div className="history-record-grid">{grouped(category.entries).map(([label, entries]) => <article className="history-record-card" key={label}>
          <div className="history-record-title"><span>{label}</span><small>Top {Math.min(entries.length, 10)}</small></div>
          <ol>{entries.slice(0, 10).map((entry) => {
            const manager = entry.managerId ? managerById.get(entry.managerId) : null;
            const season = entry.leagueSeasonId ? seasonById.get(entry.leagueSeasonId) : null;
            return <li key={entry.id}>
              <span>{manager ? <Link to={`../managers/${manager.id}`}>{manager.displayName}</Link> : entry.detail}</span>
              <strong>{formatNumber(entry.value, entry.label.includes("wins") || entry.label === "Championships" ? 0 : 2)}</strong>
              {season ? <Link className="history-record-source" to={`../seasons/${season.season}`}>{season.season}</Link> : <small>{entry.detail}</small>}
            </li>;
          })}</ol>
        </article>)}</div>
      </section>)}
    </main>
  );
}
