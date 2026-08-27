import { useDeferredValue, useMemo, useState } from "react";
import { Columns3, Info, LayoutList, Printer, Rows3, TriangleAlert } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { AuctionValueControls } from "./AuctionValueControls";
import {
  AUCTION_VALUE_SOURCES,
  PLAYER_MATCH_WARNINGS,
  buildAuctionComparison,
  formatLabel,
  sortAuctionComparisonRows,
  sourceFreshness,
  sourceSheetValues,
} from "./auctionValueData";
import { ComparisonTable } from "./ComparisonTable";
import { PrintSettingsPanel } from "./PrintSettingsPanel";
import { SelectedSourcesBar } from "./SelectedSourcesBar";
import { SourceDirectory } from "./SourceDirectory";
import { SourceSheet } from "./SourceSheet";
import { useAuctionValueState } from "./useAuctionValueState";
import "./auction-values.css";

function currentPrintHref(searchParams: URLSearchParams) {
  const query = new URLSearchParams(searchParams);
  return `/auction-values/print${query.size ? `?${query.toString()}` : ""}`;
}

export default function AuctionValuesPage() {
  const state = useAuctionValueState();
  const location = useLocation();
  const params = useParams<{ sourceId?: string }>();
  const isPrintRoute = location.pathname.endsWith("/print");
  const sheetId = params.sourceId ?? state.searchParams.get("sheet") ?? undefined;
  const sourceSheet = sheetId ? AUCTION_VALUE_SOURCES.find((source) => source.id === sheetId) : undefined;
  const [printSettingsOpen, setPrintSettingsOpen] = useState(isPrintRoute);
  const deferredQuery = useDeferredValue(state.query.trim().toLowerCase());
  const deferredDirectoryQuery = useDeferredValue(state.directoryQuery.trim().toLowerCase());

  const selectedSources = state.selectedSourceIds.flatMap((id) => {
    const source = AUCTION_VALUE_SOURCES.find((entry) => entry.id === id);
    return source ? [source] : [];
  });
  const visibleSources = selectedSources.filter((source) => !state.hiddenSourceIds.includes(source.id));
  const comparisonRows = useMemo(() => buildAuctionComparison({
    selectedSourceIds: state.selectedSourceIds,
    scoringFormat: state.scoringFormat,
    leagueSize: state.leagueSize,
    selectedBudget: state.budget,
    valueMode: state.valueMode,
    includeMarketInConsensus: state.includeMarketInConsensus,
  }), [state.budget, state.includeMarketInConsensus, state.leagueSize, state.scoringFormat, state.selectedSourceIds, state.valueMode]);

  const filteredComparisonRows = useMemo(() => {
    const filtered = comparisonRows.filter((row) => {
      const positionMatches = state.position === "ALL" || row.position === state.position;
      const queryMatches = !deferredQuery || `${row.playerName} ${row.position} ${row.nflTeam ?? ""}`.toLowerCase().includes(deferredQuery);
      return positionMatches && queryMatches;
    });
    const sorted = sortAuctionComparisonRows(filtered, state.sortKey, state.sortDirection);
    return state.rowLimit === "all" ? sorted : sorted.slice(0, state.rowLimit);
  }, [comparisonRows, deferredQuery, state.position, state.rowLimit, state.sortDirection, state.sortKey]);

  const directorySources = useMemo(() => AUCTION_VALUE_SOURCES.filter((source) => {
    const queryMatches = !deferredDirectoryQuery || `${source.name} ${source.shortName} ${source.notes} ${source.sourceType}`.toLowerCase().includes(deferredDirectoryQuery);
    const typeMatches = state.sourceType === "all" || source.sourceType === state.sourceType;
    const freshness = sourceFreshness(source);
    const freshnessMatches = state.freshness === "all"
      || (state.freshness === "current" && source.category !== "archive" && source.season === 2026)
      || (state.freshness === "fresh" && freshness === "fresh")
      || (state.freshness === "stale" && (freshness === "stale" || freshness === "aging"))
      || (state.freshness === "archive" && freshness === "archived");
    return queryMatches && typeMatches && freshnessMatches;
  }), [deferredDirectoryQuery, state.freshness, state.sourceType]);

  const sheetRows = sourceSheet
    ? sourceSheetValues(sourceSheet.id, state.scoringFormat, state.budget).filter((row) => {
        const positionMatches = state.position === "ALL" || row.position === state.position;
        const queryMatches = !deferredQuery || `${row.playerName} ${row.position} ${row.nflTeam ?? ""}`.toLowerCase().includes(deferredQuery);
        return positionMatches && queryMatches;
      })
    : [];

  const printHref = currentPrintHref(state.searchParams);
  const sourcePrintHref = sourceSheet ? (() => {
    const query = new URLSearchParams(state.searchParams);
    query.set("sheet", sourceSheet.id);
    query.set("sources", sourceSheet.id);
    query.set("orientation", "portrait");
    return `/auction-values/print?${query.toString()}`;
  })() : printHref;
  const generatedDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());
  const compatibleForFormat = AUCTION_VALUE_SOURCES.filter((source) => source.comparisonReady && source.formats.includes(state.scoringFormat));

  return (
    <div className={`auction-values-page ${isPrintRoute ? "is-print-route" : ""} ${state.inkFriendly ? "is-ink-friendly" : ""}`}>
      <style media="print">{`@page { size: ${state.printOrientation}; margin: 0.45in; }`}</style>
      <header className="auction-page-header">
        <div className="auction-page-header-copy">
          <span className="auction-kicker">2026 draft research</span>
          <h1>Fantasy Football Auction Values</h1>
          <p>Build a defensible auction board from public expert values and market prices—without blending scoring formats or hiding source assumptions.</p>
          <dl className="auction-hero-stats">
            <div><dt>Selected</dt><dd>{selectedSources.length} sources</dd></div>
            <div><dt>Comparable</dt><dd>{compatibleForFormat.length} boards</dd></div>
            <div><dt>Player pool</dt><dd>{comparisonRows.length.toLocaleString()} matched</dd></div>
          </dl>
        </div>
        <div className="auction-page-actions">
          {sheetId && !isPrintRoute ? <Link to={`/auction-values?${state.searchParams.toString()}`}>Back to comparison</Link> : null}
          <button type="button" onClick={() => setPrintSettingsOpen((open) => !open)}><Printer size={16} aria-hidden="true" /> Print</button>
        </div>
      </header>

      {!isPrintRoute ? (
        <AuctionValueControls
          scoringFormat={state.scoringFormat}
          budget={state.budget}
          leagueSize={state.leagueSize}
          position={state.position}
          query={state.query}
          comparableOnly={state.comparableOnly}
          valueMode={state.valueMode}
          includeMarketInConsensus={state.includeMarketInConsensus}
          onScoringFormatChange={state.setScoringFormat}
          onBudgetChange={state.setBudget}
          onLeagueSizeChange={state.setLeagueSize}
          onPositionChange={state.setPosition}
          onQueryChange={state.setQuery}
          onComparableOnlyChange={state.setComparableOnly}
          onValueModeChange={state.setValueMode}
          onIncludeMarketChange={state.setIncludeMarketInConsensus}
        />
      ) : null}

      <PrintSettingsPanel
        open={printSettingsOpen}
        isPrintRoute={isPrintRoute}
        scoringFormat={state.scoringFormat}
        leagueSize={state.leagueSize}
        budget={state.budget}
        position={state.position}
        sources={sourceSheet ? [sourceSheet] : selectedSources}
        rowLimit={state.rowLimit}
        valueMode={state.valueMode}
        showConsensusColumns={state.showConsensusColumns}
        density={state.density}
        orientation={state.printOrientation}
        inkFriendly={state.inkFriendly}
        includeNotes={state.includeNotes}
        printHref={sourceSheet ? sourcePrintHref : printHref}
        onClose={() => setPrintSettingsOpen(false)}
        onRowLimitChange={state.setRowLimit}
        onValueModeChange={state.setValueMode}
        onConsensusColumnsChange={state.setShowConsensusColumns}
        onDensityChange={state.setDensity}
        onOrientationChange={state.setPrintOrientation}
        onInkFriendlyChange={state.setInkFriendly}
        onIncludeNotesChange={state.setIncludeNotes}
      />

      {!compatibleForFormat.length ? (
        <div className="auction-alert is-warning" role="status"><TriangleAlert size={18} aria-hidden="true" /><div><strong>No source supports {formatLabel(state.scoringFormat)}</strong><span>Choose another format or inspect external resources in the directory.</span></div></div>
      ) : null}

      {sourceSheet ? (
        <SourceSheet
          source={sourceSheet}
          rows={sheetRows}
          scoringFormat={state.scoringFormat}
          position={state.position}
          valueMode={state.valueMode}
          selected={state.selectedSourceIds.includes(sourceSheet.id)}
          printHref={sourcePrintHref}
          rowLimit={state.rowLimit}
          onAddToCompare={() => state.toggleSource(sourceSheet.id)}
        />
      ) : (
        <>
          <section className="auction-comparison-workspace" aria-labelledby="comparison-workspace-title">
            <div className="auction-section-heading auction-comparison-heading">
              <div>
                <span className="auction-kicker">Selected-source workspace</span>
                <h2 id="comparison-workspace-title">Comparison</h2>
                <p>{formatLabel(state.scoringFormat)} · {state.leagueSize} teams · ${state.budget} budget · {state.valueMode === "normalized" ? "Normalized values" : "Raw source values"}</p>
              </div>
              <div className="auction-table-tools">
                <label><span>Rows</span><select className="ffaa-control" value={state.rowLimit} onChange={(event) => state.setRowLimit(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="50">50</option><option value="100">100</option><option value="150">150</option><option value="200">200</option><option value="all">All</option></select></label>
                <button aria-pressed={state.density === "comfortable"} type="button" onClick={() => state.setDensity(state.density === "compact" ? "comfortable" : "compact")}><Rows3 size={15} aria-hidden="true" /> {state.density === "compact" ? "Comfortable" : "Compact"}</button>
                <button className="auction-mobile-view-toggle" aria-pressed={state.mobileView === "stacked"} type="button" onClick={() => state.setMobileView(state.mobileView === "table" ? "stacked" : "table")}>{state.mobileView === "table" ? <LayoutList size={15} aria-hidden="true" /> : <Columns3 size={15} aria-hidden="true" />}{state.mobileView === "table" ? "Stacked" : "Table"}</button>
                <button type="button" onClick={() => setPrintSettingsOpen(true)}><Printer size={15} aria-hidden="true" /> Print</button>
              </div>
            </div>

            {!isPrintRoute ? (
              <SelectedSourcesBar
                sources={selectedSources}
                hiddenSourceIds={state.hiddenSourceIds}
                scoringFormat={state.scoringFormat}
                leagueSize={state.leagueSize}
                onMove={state.reorderSource}
                onRemove={state.removeSource}
                onToggleVisibility={state.toggleSourceVisibility}
                onClear={state.clearSources}
              />
            ) : null}

            <div className="auction-consensus-note"><Info size={16} aria-hidden="true" /><span>Expert sources drive consensus by default. Market AAV stays separate unless explicitly enabled. Non-comparable sources may be displayed but do not enter aggregates.</span></div>
            <ComparisonTable
              rows={filteredComparisonRows}
              sources={visibleSources}
              valueMode={state.valueMode}
              sortKey={state.sortKey}
              sortDirection={state.sortDirection}
              density={state.density}
              mobileView={state.mobileView}
              includeNotes={state.includeNotes}
              showConsensusColumns={state.showConsensusColumns}
              onSort={state.setSort}
            />
          </section>

          {!isPrintRoute ? (
            <>
              <details className="auction-methodology">
                <summary><strong>How these values work</strong><span>Fair value, market price, and consensus stay separate.</span></summary>
                <div className="auction-definition-strip" aria-label="Auction value definitions">
                  <div><strong>Fair value</strong><span>Projection-based estimate of what a player should cost.</span></div>
                  <div><strong>Market price</strong><span>What comparable auction rooms are actually paying.</span></div>
                  <div><strong>Consensus</strong><span>Aggregate of compatible selected expert sources by default.</span></div>
                </div>
              </details>

              <details className="auction-source-library">
                <summary>
                  <span><span className="auction-kicker">Source library</span><strong>Browse and change sources</strong></span>
                  <span>{selectedSources.length} selected · {directorySources.length} matching</span>
                </summary>
                {PLAYER_MATCH_WARNINGS.length ? (
                  <details className="auction-match-warnings">
                    <summary><TriangleAlert size={16} aria-hidden="true" /> {PLAYER_MATCH_WARNINGS.length} imported row{PLAYER_MATCH_WARNINGS.length === 1 ? "" : "s"} need player matching review</summary>
                    <p>These rows keep explicit unmatched IDs and are never silently merged with a similarly named player.</p>
                    <ul>{PLAYER_MATCH_WARNINGS.slice(0, 12).map((warning, index) => <li key={`${warning.sourceId}-${warning.playerName}-${index}`}>{warning.sourceId}: {warning.playerName} ({warning.position}{warning.nflTeam ? `, ${warning.nflTeam}` : ""}) — {warning.reason}</li>)}</ul>
                  </details>
                ) : null}
                <SourceDirectory
                  sources={directorySources}
                  selectedSourceIds={state.selectedSourceIds}
                  scoringFormat={state.scoringFormat}
                  leagueSize={state.leagueSize}
                  comparableOnly={state.comparableOnly}
                  query={state.directoryQuery}
                  sourceType={state.sourceType}
                  freshness={state.freshness}
                  onSearchChange={state.setDirectoryQuery}
                  onSourceTypeChange={state.setSourceType}
                  onFreshnessChange={state.setFreshness}
                  onToggleSource={state.toggleSource}
                  sheetSearch={state.searchParams.toString()}
                />
              </details>
            </>
          ) : null}
        </>
      )}

      <footer className="auction-print-footer">
        <strong>Fantasy Football presented by GameHQ</strong>
        <span>2026 · {formatLabel(state.scoringFormat)} · {state.leagueSize} teams · ${state.budget} budget</span>
        <span>Sources: {(sourceSheet ? [sourceSheet] : visibleSources).map((source) => source.name).join(", ") || "None"}</span>
        <span>Generated {generatedDate}. Values labeled normalized are scaled only by selected budget; league-size and roster differences are not mathematically corrected.</span>
        <span>Attribution: {(sourceSheet ? [sourceSheet] : visibleSources).map((source) => `${source.name} — ${source.sourceUrl}`).join(" · ")}</span>
      </footer>
    </div>
  );
}
