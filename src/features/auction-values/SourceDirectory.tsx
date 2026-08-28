import { useState } from "react";
import { ExternalLink, FileText, Plus, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { sourceCompatibility, sourceFreshness } from "./auctionValueData";
import type { AuctionSourceType, AuctionValueSource, ScoringFormat } from "./auctionValueTypes";

function typeLabel(source: AuctionValueSource) {
  const labels: Record<AuctionValueSource["sourceType"], string> = {
    expert_projection: "Published Value",
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
  sourceType: AuctionSourceType | "all";
  freshness: string;
  onSearchChange: (value: string) => void;
  onSourceTypeChange: (value: AuctionSourceType | "all") => void;
  onFreshnessChange: (value: string) => void;
  onToggleSource: (sourceId: string) => void;
  sheetSearch: string;
};

export function SourceDirectory(props: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleSources = showAll || props.query.trim() ? props.sources : props.sources.slice(0, 8);
  const hiddenCount = Math.max(0, props.sources.length - visibleSources.length);

  return (
    <section className="auction-directory" aria-labelledby="source-directory-title">
      <div className="auction-directory-toolbar">
        <div>
          <h2 id="source-directory-title">Choose comparison sources</h2>
          <p>Imported boards can be compared here. External calculators remain clearly labeled and open at their original source.</p>
        </div>
        <div className="auction-directory-filters">
          <label className="auction-directory-search">
            <span>Search</span>
            <span><Search size={16} aria-hidden="true" /><input aria-label="Search auction value sources" className="ffaa-control" type="search" value={props.query} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Source name" /></span>
          </label>
          <label>
            <span>Source type</span>
            <select aria-label="Source type" className="ffaa-control" value={props.sourceType} onChange={(event) => props.onSourceTypeChange(event.target.value as AuctionSourceType | "all")}>
              <option value="all">All source types</option>
              <option value="expert_projection">Published value</option>
              <option value="market_aav">Market AAV</option>
              <option value="custom_calculator">Calculator</option>
              <option value="community_sheet">Community sheet</option>
              <option value="external_sheet">External sheet</option>
              <option value="archive">Archive</option>
            </select>
          </label>
          <label>
            <span>Freshness</span>
            <select aria-label="Data freshness" className="ffaa-control" value={props.freshness} onChange={(event) => props.onFreshnessChange(event.target.value)}>
              <option value="current">Current season</option>
              <option value="fresh">Updated within 14 days</option>
              <option value="stale">Stale only</option>
              <option value="archive">Archive</option>
              <option value="all">All dates</option>
            </select>
          </label>
        </div>
      </div>

      <div className="auction-directory-header" aria-hidden="true">
        <span>Source</span><span>Coverage and status</span><span>Import</span><span>Actions</span>
      </div>
      <div className="auction-directory-list" role="list">
        {visibleSources.map((source) => {
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
                <div><dt>Original budget</dt><dd>{source.sourceBudget ? `$${source.sourceBudget}` : "Not stated"}</dd></div>
              </dl>
              <div className="auction-source-actions">
                {source.printableInsideFFAA ? <Link className="auction-action-link" to={sheetHref}><FileText size={14} aria-hidden="true" /> View Sheet</Link> : null}
                {source.comparisonReady ? selected ? (
                  <button className="auction-action-button is-remove" type="button" onClick={() => props.onToggleSource(source.id)}><X size={14} aria-hidden="true" /> Remove</button>
                ) : (
                  <button className="auction-action-button" type="button" disabled={selectionDisabled} title={selectionDisabled ? compatibility.reasons.join(" ") : undefined} onClick={() => props.onToggleSource(source.id)}><Plus size={14} aria-hidden="true" /> Add to Compare</button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {hiddenCount ? <button className="auction-directory-more" type="button" onClick={() => setShowAll(true)}>Show all {props.sources.length} sources</button> : null}
      {showAll && props.sources.length > 8 && !props.query.trim() ? <button className="auction-directory-more" type="button" onClick={() => setShowAll(false)}>Show fewer sources</button> : null}
      {!props.sources.length ? (
        <div className="auction-empty-state" role="status">
          <h3>No sources match these filters</h3>
          <p>Try clearing the source search or viewing all dates and source types.</p>
        </div>
      ) : null}
    </section>
  );
}
