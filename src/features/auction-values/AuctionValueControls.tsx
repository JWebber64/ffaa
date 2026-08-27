import { Info, Search } from "lucide-react";

import { NumericInput } from "@/ui/NumericInput";
import { PositionToggle } from "@/ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";

import { formatLabel } from "./auctionValueData";
import type { AuctionSourceType, AuctionValueMode, ScoringFormat } from "./auctionValueTypes";

const AUCTION_POSITION_OPTIONS = DEFAULT_POSITION_TOGGLE_OPTIONS.filter((option) => option.value !== "FLEX");

const SCORING_FORMATS: readonly ScoringFormat[] = ["standard", "half_ppr", "ppr"];

type Props = {
  scoringFormat: ScoringFormat;
  budget: number;
  leagueSize: number;
  position: string;
  query: string;
  sourceType: AuctionSourceType | "all";
  freshness: string;
  comparableOnly: boolean;
  valueMode: AuctionValueMode;
  includeMarketInConsensus: boolean;
  onScoringFormatChange: (value: ScoringFormat) => void;
  onBudgetChange: (value: number) => void;
  onLeagueSizeChange: (value: number) => void;
  onPositionChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSourceTypeChange: (value: AuctionSourceType | "all") => void;
  onFreshnessChange: (value: string) => void;
  onComparableOnlyChange: (value: boolean) => void;
  onValueModeChange: (value: AuctionValueMode) => void;
  onIncludeMarketChange: (value: boolean) => void;
};

export function AuctionValueControls(props: Props) {
  return (
    <section className="auction-control-panel" aria-labelledby="auction-controls-title">
      <div className="auction-control-heading">
        <div>
          <span className="auction-kicker">League assumptions</span>
          <h2 id="auction-controls-title">Format and value controls</h2>
        </div>
        <p><Info size={15} aria-hidden="true" /> Scoring formats are never estimated from one another.</p>
      </div>

      <div className="auction-scoring-tabs" role="tablist" aria-label="Scoring format">
        {SCORING_FORMATS.map((format) => (
          <button
            aria-selected={props.scoringFormat === format}
            className={props.scoringFormat === format ? "is-active" : ""}
            key={format}
            onClick={() => props.onScoringFormatChange(format)}
            role="tab"
            type="button"
          >
            {formatLabel(format)}
          </button>
        ))}
      </div>

      <div className="auction-control-grid">
        <label className="auction-field">
          <span>Season</span>
          <select aria-label="Season" className="ffaa-control" value="2026" disabled>
            <option value="2026">2026</option>
          </select>
        </label>
        <label className="auction-field">
          <span>League size</span>
          <NumericInput aria-label="League size" min={4} max={32} step={1} value={props.leagueSize} onChange={(event) => props.onLeagueSizeChange(Number(event.target.value) || 12)} />
        </label>
        <label className="auction-field">
          <span>Team budget</span>
          <span className="auction-money-field"><b aria-hidden="true">$</b><NumericInput aria-label="Team auction budget" min={50} max={1000} step={1} value={props.budget} onChange={(event) => props.onBudgetChange(Number(event.target.value) || 200)} /></span>
        </label>
        <label className="auction-field auction-search-field">
          <span>Player search</span>
          <span><Search size={16} aria-hidden="true" /><input aria-label="Search players" className="ffaa-control" type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Player, team, or position" /></span>
        </label>
        <label className="auction-field">
          <span>Source type</span>
          <select aria-label="Source type" className="ffaa-control" value={props.sourceType} onChange={(event) => props.onSourceTypeChange(event.target.value as AuctionSourceType | "all")}>
            <option value="all">All source types</option>
            <option value="expert_projection">Expert fair value</option>
            <option value="market_aav">Market AAV</option>
            <option value="custom_calculator">Calculator</option>
            <option value="community_sheet">Community sheet</option>
            <option value="external_sheet">External sheet</option>
            <option value="archive">Archive</option>
          </select>
        </label>
        <label className="auction-field">
          <span>Data freshness</span>
          <select aria-label="Data freshness" className="ffaa-control" value={props.freshness} onChange={(event) => props.onFreshnessChange(event.target.value)}>
            <option value="current">Current season</option>
            <option value="fresh">Updated within 14 days</option>
            <option value="stale">Stale only</option>
            <option value="archive">Archive</option>
            <option value="all">All dates</option>
          </select>
        </label>
      </div>

      <div className="auction-position-row">
        <span>Position</span>
        <PositionToggle options={AUCTION_POSITION_OPTIONS} value={props.position} onChange={props.onPositionChange} ariaLabel="Filter auction values by position" />
      </div>

      <div className="auction-toggle-row">
        <label className="auction-check-control">
          <input type="checkbox" checked={props.comparableOnly} onChange={(event) => props.onComparableOnlyChange(event.target.checked)} />
          <span><strong>Comparable sources only</strong><small>Same season, scoring, QB format, and league size.</small></span>
        </label>
        <fieldset className="auction-segmented-control">
          <legend>Value display</legend>
          <button aria-pressed={props.valueMode === "raw"} type="button" onClick={() => props.onValueModeChange("raw")}>Raw</button>
          <button aria-pressed={props.valueMode === "normalized"} type="button" onClick={() => props.onValueModeChange("normalized")}>Normalized</button>
        </fieldset>
        <label className="auction-check-control">
          <input type="checkbox" checked={props.includeMarketInConsensus} onChange={(event) => props.onIncludeMarketChange(event.target.checked)} />
          <span><strong>Include market AAV in consensus</strong><small>Off by default so fair value and paid price stay distinct.</small></span>
        </label>
      </div>
    </section>
  );
}
