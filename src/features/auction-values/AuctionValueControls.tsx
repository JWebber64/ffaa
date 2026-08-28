import { Info, Search } from "lucide-react";

import { NumericInput } from "@/ui/NumericInput";
import { PositionToggle } from "@/ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";

import { formatLabel } from "./auctionValueData";
import type { AuctionValueMode, ScoringFormat } from "./auctionValueTypes";

const AUCTION_POSITION_OPTIONS = DEFAULT_POSITION_TOGGLE_OPTIONS;

const SCORING_FORMATS: readonly ScoringFormat[] = ["standard", "half_ppr", "ppr"];

type Props = {
  scoringFormat: ScoringFormat;
  budget: number;
  leagueSize: number;
  position: string;
  query: string;
  comparableOnly: boolean;
  valueMode: AuctionValueMode;
  includeMarketInConsensus: boolean;
  onScoringFormatChange: (value: ScoringFormat) => void;
  onBudgetChange: (value: number) => void;
  onLeagueSizeChange: (value: number) => void;
  onPositionChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onComparableOnlyChange: (value: boolean) => void;
  onValueModeChange: (value: AuctionValueMode) => void;
  onIncludeMarketChange: (value: boolean) => void;
};

export function AuctionValueControls(props: Props) {
  return (
    <section className="auction-control-panel" aria-labelledby="auction-controls-title">
      <div className="auction-control-heading">
        <div>
          <span className="auction-kicker">Draft setup</span>
          <h2 id="auction-controls-title">Set the board</h2>
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
      </div>

      <div className="auction-control-grid">
        <div className="auction-field auction-static-setting" aria-label="Season 2026">
          <span>Season</span>
          <strong>2026</strong>
        </div>
        <label className="auction-field">
          <span>League size</span>
          <NumericInput aria-label="League size" className="ffaa-control" min={4} max={32} step={1} value={props.leagueSize} onChange={(event) => props.onLeagueSizeChange(Number(event.target.value) || 12)} />
        </label>
        <label className="auction-field">
          <span>Team budget</span>
          <span className="auction-money-field"><b aria-hidden="true">$</b><NumericInput aria-label="Team auction budget" className="ffaa-control" min={50} max={1000} step={1} value={props.budget} onChange={(event) => props.onBudgetChange(Number(event.target.value) || 200)} /></span>
        </label>
        <label className="auction-field auction-search-field">
          <span>Player search</span>
          <span><Search size={16} aria-hidden="true" /><input aria-label="Search players" className="ffaa-control" type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Player, team, or position" /></span>
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
      <p className="auction-control-note"><Info size={14} aria-hidden="true" /> Values stay within their published scoring format; Standard, Half PPR, and Full PPR are never estimated from one another.</p>
    </section>
  );
}
