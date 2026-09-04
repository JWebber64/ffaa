import { ExternalLink, Plus, Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { PlayerProfileButton } from "@/features/player-profile/PlayerProfileProvider";

import { PositionBadge } from "../../ui/PositionBadge";
import type { AuctionPlayerValue, AuctionValueMode, AuctionValueSource, ScoringFormat } from "./auctionValueTypes";

type SheetRow = AuctionPlayerValue & { normalizedValue: number };
type SheetSort = "rank" | "player" | "position" | "raw" | "normalized";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function sortRows(rows: readonly SheetRow[], sort: SheetSort) {
  return [...rows].sort((left, right) => {
    if (sort === "player") return left.playerName.localeCompare(right.playerName);
    if (sort === "position") return left.position.localeCompare(right.position) || right.rawValue - left.rawValue;
    if (sort === "raw") return right.rawValue - left.rawValue || left.playerName.localeCompare(right.playerName);
    if (sort === "normalized") return right.normalizedValue - left.normalizedValue || left.playerName.localeCompare(right.playerName);
    return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
  });
}

type Props = {
  source: AuctionValueSource;
  rows: readonly SheetRow[];
  scoringFormat: ScoringFormat;
  position: string;
  valueMode: AuctionValueMode;
  selected: boolean;
  printHref: string;
  rowLimit: number | "all";
  onAddToCompare: () => void;
};

export function SourceSheet(props: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetSort = (searchParams.get("sheetSort") ?? "rank") as SheetSort;
  const sortedRows = sortRows(props.rows, sheetSort);
  const visibleRows = props.rowLimit === "all" ? sortedRows : sortedRows.slice(0, props.rowLimit);

  const updateSort = (sort: SheetSort) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (sort === "rank") next.delete("sheetSort");
      else next.set("sheetSort", sort);
      return next;
    }, { replace: true });
  };

  return (
    <section className="auction-source-sheet" aria-labelledby="source-sheet-title">
      <header className="auction-sheet-header">
        <div>
          <span className="auction-kicker">Imported source sheet</span>
          <h2 id="source-sheet-title">{props.source.name}</h2>
          <p>{props.source.notes}</p>
        </div>
        <div className="auction-sheet-actions">
          <button type="button" disabled={props.selected} onClick={props.onAddToCompare}><Plus size={15} aria-hidden="true" /> {props.selected ? "Added to Compare" : "Add to Compare"}</button>
          <Link to={props.printHref}><Printer size={15} aria-hidden="true" /> Print</Link>
          <a href={props.source.sourceUrl} target="_blank" rel="noreferrer">Visit Original <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <dl className="auction-sheet-metadata">
        <div><dt>Season</dt><dd>{props.source.season ?? "—"}</dd></div>
        <div><dt>Format</dt><dd>{props.scoringFormat === "standard" ? "Standard" : props.scoringFormat === "half_ppr" ? "Half PPR" : "Full PPR"}</dd></div>
        <div><dt>League size</dt><dd>{props.source.defaultLeagueSize ? `${props.source.defaultLeagueSize} teams` : "Not stated"}</dd></div>
        <div><dt>Budget</dt><dd>{props.source.sourceBudget ? `$${props.source.sourceBudget}` : "Not stated"}</dd></div>
        <div><dt>Source type</dt><dd>{props.source.sourceType.replace(/_/g, " ")}</dd></div>
        <div><dt>Source update</dt><dd>{props.source.sourceUpdatedAt ?? "Not stated"}</dd></div>
        <div><dt>FFAA import</dt><dd>{props.source.importedAt?.slice(0, 10) ?? "—"}</dd></div>
        <div><dt>Imported players</dt><dd>{props.source.importedPlayerCount?.toLocaleString() ?? 0}</dd></div>
      </dl>
      {props.source.rosterAssumptions ? <p className="auction-sheet-assumptions"><strong>Assumptions:</strong> {props.source.rosterAssumptions}</p> : null}

      {!props.rows.length ? (
        <div className="auction-empty-state" role="status"><h3>This format is unavailable</h3><p>{props.source.name} does not have imported {props.scoringFormat === "half_ppr" ? "Half PPR" : props.scoringFormat === "ppr" ? "Full PPR" : "Standard"} values.</p></div>
      ) : (
        <div className="auction-table-region auction-sheet-table-region" role="region" aria-label={`${props.source.name} auction values`} tabIndex={0}>
          <table className="auction-source-sheet-table">
            <thead><tr>
              <th scope="col"><button type="button" onClick={() => updateSort("rank")}>Rank</button><span className="auction-print-sort-label" aria-hidden="true">Rank</span></th>
              <th className="auction-player-column" scope="col"><button type="button" onClick={() => updateSort("player")}>Player</button><span className="auction-print-sort-label" aria-hidden="true">Player</span></th>
              <th scope="col"><button type="button" onClick={() => updateSort("position")}>Position</button><span className="auction-print-sort-label" aria-hidden="true">Position</span></th>
              <th scope="col">NFL</th><th scope="col">Bye</th>
              <th scope="col"><button type="button" onClick={() => updateSort("raw")}>Raw value</button><span className="auction-print-sort-label" aria-hidden="true">Raw value</span></th>
              <th scope="col"><button type="button" onClick={() => updateSort("normalized")}>Normalized value</button><span className="auction-print-sort-label" aria-hidden="true">Normalized value</span></th>
            </tr></thead>
            <tbody>{visibleRows.map((row, index) => <tr key={`${row.sourceId}-${row.playerId}`}>
              <td>{row.rank ?? index + 1}</td>
              <th className="auction-player-column" scope="row"><PlayerProfileButton player={{ playerId: row.playerId, playerName: row.playerName, position: row.position, nflTeam: row.nflTeam, byeWeek: row.byeWeek }} scoring={props.scoringFormat === "half_ppr" ? "halfPpr" : props.scoringFormat}><strong>{row.playerName}</strong><small>{row.position} · {row.nflTeam ?? "FA"}</small></PlayerProfileButton></th>
              <td><PositionBadge className="auction-position-chip" position={row.position} /></td>
              <td>{row.nflTeam ?? "—"}</td><td>{row.byeWeek ?? "—"}</td>
              <td>{currency.format(row.rawValue)}</td><td className={props.valueMode === "normalized" ? "auction-consensus-cell" : ""}>{currency.format(row.normalizedValue)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
