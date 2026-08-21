import { ArrowDown, ArrowUp, Minus, TableProperties } from "lucide-react";
import { Link } from "react-router-dom";

import type { WeekStanding } from "../../analytics/weeklyWorkspace";
import { formatNumber, formatRecord } from "../format";

function Movement({ value }: { value: number | null }) {
  if (value == null || value === 0) return <span className="is-flat"><Minus size={12} aria-hidden="true" /> {value == null ? "First table" : "No change"}</span>;
  return value > 0
    ? <span className="is-up"><ArrowUp size={12} aria-hidden="true" /> {value}</span>
    : <span className="is-down"><ArrowDown size={12} aria-hidden="true" /> {Math.abs(value)}</span>;
}

export function WeeklyStandings({ leagueId, standings }: { leagueId: string; standings: WeekStanding[] }) {
  return (
    <section className="history-week-section" aria-labelledby="weekly-standings-title">
      <header className="history-week-section-heading">
        <div><span>Reconstructed through this week</span><h2 id="weekly-standings-title">Cumulative standings</h2></div>
        <TableProperties size={20} aria-hidden="true" />
      </header>
      <div className="history-week-standings" role="table" aria-label="Standings through selected week">
        <div className="history-week-standings-head" role="row">
          <span role="columnheader">Rank</span><span role="columnheader">Manager</span><span role="columnheader">Record</span><span role="columnheader">PF</span><span role="columnheader">PA</span><span role="columnheader">Movement</span>
        </div>
        {standings.map((row) => (
          <div role="row" key={row.franchise.id}>
            <strong role="cell">{row.rank}</strong>
            <div role="cell">{row.manager ? <Link to={`/league/${leagueId}/managers/${row.manager.id}`}>{row.manager.displayName}</Link> : <span>{row.franchise.historicalUsername || "Unassigned"}</span>}<small>{row.franchise.teamName}</small></div>
            <span role="cell">{formatRecord(row.wins, row.losses, row.ties)}</span>
            <span role="cell">{formatNumber(row.pointsFor, 2)}</span>
            <span role="cell">{formatNumber(row.pointsAgainst, 2)}</span>
            <span role="cell"><Movement value={row.rankMovement} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}
