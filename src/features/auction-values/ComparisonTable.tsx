import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import type { AuctionComparisonRow, AuctionSortKey, AuctionValueMode, AuctionValueSource } from "./auctionValueTypes";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function money(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : currency.format(value);
}

type SortHeaderProps = {
  label: string;
  sortKey: AuctionSortKey;
  activeKey: AuctionSortKey;
  direction: "asc" | "desc";
  onSort: (key: AuctionSortKey) => void;
  title?: string;
  className?: string;
};

function SortHeader(props: SortHeaderProps) {
  const active = props.activeKey === props.sortKey;
  return (
    <th aria-sort={active ? (props.direction === "asc" ? "ascending" : "descending") : "none"} className={props.className} scope="col" title={props.title}>
      <button type="button" onClick={() => props.onSort(props.sortKey)}>
        <span>{props.label}</span>
        {active ? props.direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" />}
      </button>
      <span className="auction-print-sort-label" aria-hidden="true">{props.label}</span>
    </th>
  );
}

function sourceExtremes(row: AuctionComparisonRow, sources: readonly AuctionValueSource[]) {
  const available = sources.flatMap((source) => {
    const value = row.sourceValues[source.id]?.displayValue;
    return value === undefined ? [] : [{ sourceId: source.id, value }];
  });
  if (available.length < 2) return { highest: null, lowest: null };
  let highest = available[0]!;
  let lowest = available[0]!;
  for (const candidate of available) {
    if (candidate.value > highest.value) highest = candidate;
    if (candidate.value < lowest.value) lowest = candidate;
  }
  if (highest.value === lowest.value) return { highest: null, lowest: null };
  return { highest: highest.sourceId, lowest: lowest.sourceId };
}

type Props = {
  rows: readonly AuctionComparisonRow[];
  sources: readonly AuctionValueSource[];
  valueMode: AuctionValueMode;
  sortKey: AuctionSortKey;
  sortDirection: "asc" | "desc";
  density: "compact" | "comfortable";
  mobileView: "table" | "stacked";
  includeNotes: boolean;
  showConsensusColumns: boolean;
  onSort: (key: AuctionSortKey) => void;
};

export function ComparisonTable(props: Props) {
  if (!props.sources.length) {
    return (
      <div className="auction-empty-state" role="status">
        <h3>No source columns are visible</h3>
        <p>Select an imported source, or show a hidden source column, to build the comparison.</p>
      </div>
    );
  }

  if (!props.rows.length) {
    return (
      <div className="auction-empty-state" role="status">
        <h3>No players match this comparison</h3>
        <p>Check the scoring format, source compatibility, player search, and position filter.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`auction-table-region density-${props.density} mobile-${props.mobileView}`} role="region" aria-label="Auction value comparison table" tabIndex={0}>
        <table className="auction-comparison-table">
          <caption className="sr-only">Player auction values by selected published source with GameHQ Fair Value and market aggregates.</caption>
          <thead>
            <tr>
              <th className="auction-rank-column" scope="col">#</th>
              <SortHeader label="Player" sortKey="player" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} className="auction-player-column" />
              <SortHeader label="Pos" sortKey="position" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
              <SortHeader label="NFL" sortKey="team" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
              <th scope="col">Bye</th>
              <SortHeader label="GameHQ Fair" sortKey="gamehqFair" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="League-adjusted Fair Value. Each independent publisher receives one vote; Sleeper and FFToday products are collapsed within their publisher." className="auction-gamehq-fair-column" />
              {props.sources.map((source) => (
                <SortHeader
                  key={source.id}
                  label={source.shortName}
                  sortKey={`source:${source.id}`}
                  activeKey={props.sortKey}
                  direction={props.sortDirection}
                  onSort={props.onSort}
                  className="auction-source-value-column"
                  title={`${source.name} ${props.valueMode === "normalized" ? "normalized" : "raw"} value; original budget ${source.sourceBudget ? `$${source.sourceBudget}` : "not stated"}.`}
                />
              ))}
              {props.showConsensusColumns ? <>
                <SortHeader label="Avg" sortKey="average" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="Average of consensus-contributing selected sources." />
                <SortHeader label="Median" sortKey="median" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="Median of consensus-contributing selected sources." />
                <SortHeader label="Min" sortKey="minimum" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
                <SortHeader label="Max" sortKey="maximum" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
                <SortHeader label="Spread" sortKey="spread" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
                <SortHeader label="N" sortKey="count" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="Number of sources contributing to consensus." />
                <SortHeader label="Published" sortKey="expert" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="Median compatible published auction value." />
                <SortHeader label="Market" sortKey="market" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} title="Median compatible market AAV." />
                <SortHeader label="Fair − Market" sortKey="difference" activeKey={props.sortKey} direction={props.sortDirection} onSort={props.onSort} />
              </> : null}
              {props.includeNotes ? <th className="auction-notes-column" scope="col">Notes</th> : null}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => {
              const extremes = sourceExtremes(row, props.sources);
              return (
                <tr key={row.playerId}>
                  <td className="auction-rank-column">{index + 1}</td>
                  <th className="auction-player-column" scope="row"><strong>{row.playerName}</strong><small>{row.position} · {row.nflTeam ?? "FA"}</small></th>
                  <td><span className={`auction-position-chip pos-${row.position.toLowerCase()}`}>{row.position}</span></td>
                  <td>{row.nflTeam ?? "—"}</td>
                  <td>{row.byeWeek ?? "—"}</td>
                  <td className="auction-gamehq-fair-value" title={row.fairValuePublishers.length ? `Publishers: ${row.fairValuePublishers.join(", ")}` : undefined}>
                    <strong>{money(row.gamehqFairValue)}</strong>
                    <small>{row.fairValuePublisherCount || "—"} pub · {row.projectionSourceCount || "—"} proj · {row.publishedValueSourceCount || "—"} boards</small>
                  </td>
                  {props.sources.map((source) => {
                    const value = row.sourceValues[source.id];
                    const high = extremes.highest === source.id;
                    const low = extremes.lowest === source.id;
                    return (
                      <td className={`auction-source-value ${value?.includedInConsensus ? "is-consensus" : ""}`} key={source.id}>
                        <span>{money(value?.displayValue)}</span>
                        {high ? <small aria-label="Highest selected source value">HIGH</small> : null}
                        {low ? <small aria-label="Lowest selected source value">LOW</small> : null}
                      </td>
                    );
                  })}
                  {props.showConsensusColumns ? <>
                    <td>{money(row.average)}</td>
                    <td className="auction-consensus-cell"><strong>{money(row.median)}</strong></td>
                    <td>{money(row.minimum)}</td>
                    <td>{money(row.maximum)}</td>
                    <td>{money(row.spread)}</td>
                    <td>{row.contributingSourceCount || "—"}</td>
                    <td>{money(row.expertFairValue)}</td>
                    <td>{money(row.marketAav)}</td>
                    <td className={row.fairMarketDifference !== null && row.fairMarketDifference < 0 ? "is-negative" : ""}>{row.fairMarketDifference === null ? "—" : `${row.fairMarketDifference >= 0 ? "+" : ""}${money(row.fairMarketDifference)}`}</td>
                  </> : null}
                  {props.includeNotes ? <td className="auction-notes-column" aria-label={`Notes for ${row.playerName}`} /> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`auction-mobile-stack ${props.mobileView === "stacked" ? "is-active" : ""}`}>
        {props.rows.map((row, index) => (
          <article className="auction-mobile-player" key={row.playerId}>
            <header><span>{index + 1}</span><div><strong>{row.playerName}</strong><small>{row.position} · {row.nflTeam ?? "FA"} · Bye {row.byeWeek ?? "—"}</small></div><b>{money(row.gamehqFairValue)}</b></header>
            <dl>
              <div><dt>GameHQ Fair</dt><dd>{money(row.gamehqFairValue)}</dd></div>
              <div><dt>Inputs</dt><dd>{row.fairValuePublisherCount} pub · {row.projectionSourceCount} proj · {row.publishedValueSourceCount} boards</dd></div>
              {props.sources.map((source) => <div key={source.id}><dt>{source.shortName}</dt><dd>{money(row.sourceValues[source.id]?.displayValue)}</dd></div>)}
              <div><dt>Published value</dt><dd>{money(row.expertFairValue)}</dd></div>
              <div><dt>Market AAV</dt><dd>{money(row.marketAav)}</dd></div>
              <div><dt>Spread</dt><dd>{money(row.spread)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
