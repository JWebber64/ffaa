import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from "lucide-react";

import { sourceCompatibility } from "./auctionValueData";
import type { AuctionValueSource, ScoringFormat } from "./auctionValueTypes";

type Props = {
  sources: readonly AuctionValueSource[];
  hiddenSourceIds: readonly string[];
  scoringFormat: ScoringFormat;
  leagueSize: number;
  onMove: (sourceId: string, direction: -1 | 1) => void;
  onRemove: (sourceId: string) => void;
  onToggleVisibility: (sourceId: string) => void;
  onClear: () => void;
};

export function SelectedSourcesBar(props: Props) {
  return (
    <div className="auction-selected-sources" aria-label="Selected comparison sources">
      <div className="auction-selected-summary">
        <span>Selected sources</span>
        <strong>{props.sources.length}</strong>
        {props.sources.length ? <button type="button" onClick={props.onClear}>Clear all</button> : null}
      </div>
      <div className="auction-selected-scroll">
        {props.sources.map((source, index) => {
          const hidden = props.hiddenSourceIds.includes(source.id);
          const compatibility = sourceCompatibility(source, props.scoringFormat, props.leagueSize);
          return (
            <div className={`auction-selected-chip ${compatibility.compatible ? "" : "has-warning"}`} key={source.id}>
              <div>
                <strong>{source.shortName}</strong>
                <span>{compatibility.compatible ? "Consensus compatible" : compatibility.reasons[0] ?? "Displayed with warning"}</span>
              </div>
              <span className="auction-selected-chip-actions">
                <button aria-label={`Move ${source.name} left`} disabled={index === 0} onClick={() => props.onMove(source.id, -1)} type="button"><ChevronLeft aria-hidden="true" /></button>
                <button aria-label={`Move ${source.name} right`} disabled={index === props.sources.length - 1} onClick={() => props.onMove(source.id, 1)} type="button"><ChevronRight aria-hidden="true" /></button>
                <button aria-label={`${hidden ? "Show" : "Hide"} ${source.name} column`} aria-pressed={hidden} onClick={() => props.onToggleVisibility(source.id)} type="button">{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                <button aria-label={`Remove ${source.name} from comparison`} onClick={() => props.onRemove(source.id)} type="button"><X aria-hidden="true" /></button>
              </span>
            </div>
          );
        })}
        {!props.sources.length ? <p>Select two or more imported sources from the directory to compare values.</p> : null}
      </div>
    </div>
  );
}
