import { Printer, X } from "lucide-react";
import { Link } from "react-router-dom";
import { UniversalSelect } from "@/ui/UniversalSelect";

import { formatLabel } from "./auctionValueData";
import type { AuctionValueMode, AuctionValueSource, ScoringFormat } from "./auctionValueTypes";

type Props = {
  open: boolean;
  isPrintRoute: boolean;
  scoringFormat: ScoringFormat;
  leagueSize: number;
  budget: number;
  position: string;
  sources: readonly AuctionValueSource[];
  rowLimit: number | "all";
  valueMode: AuctionValueMode;
  showConsensusColumns: boolean;
  density: "compact" | "comfortable";
  orientation: "portrait" | "landscape";
  inkFriendly: boolean;
  includeNotes: boolean;
  printHref: string;
  onClose: () => void;
  onRowLimitChange: (value: number | "all") => void;
  onValueModeChange: (value: AuctionValueMode) => void;
  onConsensusColumnsChange: (value: boolean) => void;
  onDensityChange: (value: "compact" | "comfortable") => void;
  onOrientationChange: (value: "portrait" | "landscape") => void;
  onInkFriendlyChange: (value: boolean) => void;
  onIncludeNotesChange: (value: boolean) => void;
};

export function PrintSettingsPanel(props: Props) {
  if (!props.open) return null;

  return (
    <section className="auction-print-settings" aria-labelledby="auction-print-settings-title">
      <header>
        <div><span className="auction-kicker">Printable state</span><h2 id="auction-print-settings-title">Print settings</h2></div>
        <button aria-label="Close print settings" onClick={props.onClose} type="button"><X aria-hidden="true" /></button>
      </header>
      <div className="auction-print-summary">
        <span>{formatLabel(props.scoringFormat)}</span><span>{props.leagueSize} teams</span><span>${props.budget}</span><span>{props.position === "ALL" ? "All positions" : props.position}</span>
        <span>{props.sources.length} source{props.sources.length === 1 ? "" : "s"}</span>
      </div>
      <div className="auction-print-grid">
        <label><span>Rows</span><UniversalSelect aria-label="Print rows" className="ffaa-control" value={props.rowLimit} onValueChange={(value) => props.onRowLimitChange(value === "all" ? "all" : Number(value))}><option value="50">Top 50</option><option value="100">Top 100</option><option value="150">Top 150</option><option value="200">Top 200</option><option value="all">All</option></UniversalSelect></label>
        <label><span>Values</span><UniversalSelect aria-label="Print values" className="ffaa-control" value={props.valueMode} onValueChange={(value) => props.onValueModeChange(value as AuctionValueMode)}><option value="raw">Raw values</option><option value="normalized">Normalized values</option></UniversalSelect></label>
        <label><span>Row density</span><UniversalSelect aria-label="Print row density" className="ffaa-control" value={props.density} onValueChange={(value) => props.onDensityChange(value as "compact" | "comfortable")}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></UniversalSelect></label>
        <label><span>Page orientation</span><UniversalSelect aria-label="Print page orientation" className="ffaa-control" value={props.orientation} onValueChange={(value) => props.onOrientationChange(value as "portrait" | "landscape")}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></UniversalSelect></label>
        <label className="auction-print-check"><input type="checkbox" checked={props.showConsensusColumns} onChange={(event) => props.onConsensusColumnsChange(event.target.checked)} /><span>Consensus columns</span></label>
        <label className="auction-print-check"><input type="checkbox" checked={props.inkFriendly} onChange={(event) => props.onInkFriendlyChange(event.target.checked)} /><span>Ink-friendly mode</span></label>
        <label className="auction-print-check"><input type="checkbox" checked={props.includeNotes} onChange={(event) => props.onIncludeNotesChange(event.target.checked)} /><span>Blank notes column</span></label>
      </div>
      <div className="auction-print-source-list"><strong>Selected sources</strong><span>{props.sources.map((source) => source.name).join(" · ") || "No sources selected"}</span></div>
      <footer>
        {props.isPrintRoute ? (
          <button className="auction-print-primary" type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Open browser print dialog</button>
        ) : (
          <Link className="auction-print-primary" to={props.printHref}><Printer size={16} aria-hidden="true" /> Open printable comparison</Link>
        )}
        <small>Choose “Save as PDF” in your browser’s print destination to create a PDF.</small>
      </footer>
    </section>
  );
}
