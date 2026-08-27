import { ExternalLink, FileText, Plus, Printer, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { sourceCompatibility, sourceFreshness } from "./auctionValueData";
import type { AuctionValueSource, ScoringFormat } from "./auctionValueTypes";

function typeLabel(source: AuctionValueSource) {
  const labels: Record<AuctionValueSource["sourceType"], string> = {
    expert_projection: "Expert Value",
    market_aav: "Market AAV",
    custom_calculator: "Calculator",
    community_sheet: "Community Sheet",
    external_sheet: "External Sheet",
    archive: "Archived",
  };
  return labels[source.sourceType];
}

function accessLabel(source: AuctionValueSource) {
  if (source.access === "registration_required") return "Registration Required";
  if (source.access === "partial") return "Partial Preview";
  if (source.access === "paid") return "Paid Access";
  if (source.access === "unavailable") return "Unavailable";
  return null;
}

function formatShortLabel(format: ScoringFormat) {
  if (format === "standard") return "STD";
  if (format === "half_ppr") return "HALF";
  return "PPR";
}

type Props = {
  sources: readonly AuctionValueSource[];
  selectedSourceIds: readonly string[];
  scoringFormat: ScoringFormat;
  leagueSize: number;
  comparableOnly: boolean;
  query: string;
  onSearchChange: (value: string) => void;
  onToggleSource: (sourceId: string) => void;
  sheetSearch: string;
};

export function SourceDirectory(props: Props) {
  return (
    <section className="auction-directory" aria-labelledby="source-directory-title">
      <div className="auction-section-heading">
        <div>
          <span className="auction-kicker">Public resource registry</span>
          <h2 id="source-directory-title">Source directory</h2>
          <p>Imported boards stay inside FFAA. Calculators, restricted tools, and unverified sheets remain clearly external.</p>
        </div>
        <label className="auction-directory-search">
          <span className="sr-only">Search auction value sources</span>
          <Search size={16} aria-hidden="true" />
          <input className="ffaa-control" type="search" value={props.query} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Search sources" />
        </label>
      </div>

      <div className="auction-directory-header" aria-hidden="true">
        <span>Source</span><span>Coverage and status</span><span>Import</span><span>Actions</span>
      </div>
      <div className="auction-directory-list" role="list">
        {props.sources.map((source) => {
          const selected = props.selectedSourceIds.includes(source.id);
          const compatibility = sourceCompatibility(source, props.scoringFormat, props.leagueSize);
          const unavailableForFormat = !source.formats.includes(props.scoringFormat);
          const selectionDisabled = !source.comparisonReady || unavailableForFormat || (props.comparableOnly && !compatibility.compatible);
          const access = accessLabel(source);
          const freshness = sourceFreshness(source);
          const query = new URLSearchParams(props.sheetSearch);
          query.set("format", props.scoringFormat);
          query.set("sources", source.id);
          const sheetHref = `/auction-values/source/${source.id}?${query.toString()}`;
          const printQuery = new URLSearchParams(query);
          printQuery.set("sheet", source.id);
          printQuery.set("orientation", "portrait");

          return (
            <article className={`auction-source-row ${selected ? "is-selected" : ""}`} key={source.id} role="listitem">
              <div className="auction-source-identity">
                <span className="auction-source-mark" aria-hidden="true">{source.shortName.slice(0, 12)}</span>
                <div><h3>{source.name}</h3><a href={source.sourceUrl} target="_blank" rel="noreferrer">Original source <ExternalLink size={12} aria-hidden="true" /></a></div>
              </div>
              <div className="auction-source-coverage">
                <div className="auction-source-badges">
                  <span className={`auction-status-badge type-${source.sourceType}`}>{typeLabel(source)}</span>
                  {source.comparisonReady ? <span className="auction-status-badge is-ready">Comparison Ready</span> : null}
                  {source.externalOnly && source.access !== "unavailable" ? <span className="auction-status-badge">External Sheet</span> : null}
                  {access ? <span className={`auction-status-badge access-${source.access}`}>{access}</span> : null}
                  {freshness === "stale" ? <span className="auction-status-badge is-warning">Stale</span> : null}
                  {freshness === "archived" ? <span className="auction-status-badge is-warning">Archived</span> : null}
                </div>
                <div className="auction-format-badges">
                  {source.formats.length ? source.formats.map((format) => <span className={format === props.scoringFormat ? "is-current" : ""} key={format}>{formatShortLabel(format)}</span>) : <span>FORMAT NOT VERIFIED</span>}
                </div>
                <p>{source.notes}</p>
                {source.rosterAssumptions ? <small>{source.rosterAssumptions}</small> : null}
                {selectionDisabled && source.comparisonReady ? <small className="auction-compatibility-note">{compatibility.reasons[0]}</small> : null}
              </div>
              <dl className="auction-source-import">
                <div><dt>Players</dt><dd>{source.importedPlayerCount?.toLocaleString() ?? 0}</dd></div>
                <div><dt>Source update</dt><dd>{source.sourceUpdatedAt ?? "Not stated"}</dd></div>
                <div><dt>FFAA import</dt><dd>{source.importedAt?.slice(0, 10) ?? "Not imported"}</dd></div>
                <div><dt>Original budget</dt><dd>{source.sourceBudget ? `$${source.sourceBudget}` : "Not stated"}</dd></div>
              </dl>
              <div className="auction-source-actions">
                {source.printableInsideFFAA ? <Link className="auction-action-link" to={sheetHref}><FileText size={14} aria-hidden="true" /> View Sheet</Link> : null}
                {source.comparisonReady ? selected ? (
                  <button className="auction-action-button is-remove" type="button" onClick={() => props.onToggleSource(source.id)}><X size={14} aria-hidden="true" /> Remove</button>
                ) : (
                  <button className="auction-action-button" type="button" disabled={selectionDisabled} title={selectionDisabled ? compatibility.reasons.join(" ") : undefined} onClick={() => props.onToggleSource(source.id)}><Plus size={14} aria-hidden="true" /> Add to Compare</button>
                ) : null}
                {source.printableInsideFFAA ? <Link className="auction-action-link" to={`/auction-values/print?${printQuery.toString()}`}><Printer size={14} aria-hidden="true" /> Print</Link> : null}
                {source.access !== "unavailable" ? <a className="auction-action-link" href={source.sourceUrl} target="_blank" rel="noreferrer">Visit Original <ExternalLink size={13} aria-hidden="true" /></a> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!props.sources.length ? (
        <div className="auction-empty-state" role="status">
          <h3>No sources match these filters</h3>
          <p>Try clearing the source search or viewing all dates and source types.</p>
        </div>
      ) : null}
    </section>
  );
}
