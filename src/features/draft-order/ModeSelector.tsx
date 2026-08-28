import { ArrowLeft, Play } from "lucide-react";
import { Button } from "../../ui/Button";
import { ModeArtwork } from "./ModeArtwork";
import {
  DRAFT_ORDER_MODES,
  MODE_LABELS,
  MODE_REVEAL_STYLES,
  type DraftOrderMode,
} from "./types";

export function ModeSelector({ selectedMode, onSelect, onBack, onLock, busy }: {
  selectedMode: DraftOrderMode;
  onSelect: (mode: DraftOrderMode) => void;
  onBack: () => void;
  onLock: () => void;
  busy: boolean;
}) {
  return (
    <section className="showdown-panel mode-selector-panel" aria-labelledby="mode-selector-title">
      <header className="showdown-section-heading">
        <div><span>Step 2 · Choose game</span><h2 id="mode-selector-title">Choose the main event</h2></div>
        <p>Pick a game, gather the league, and start the countdown.</p>
      </header>
      <div className="mode-picker" role="group" aria-label="Draft order game">
        {DRAFT_ORDER_MODES.map((mode) => (
          <button
            type="button"
            className={`mode-picker-option ${selectedMode === mode ? "is-selected" : ""}`}
            aria-pressed={selectedMode === mode}
            onClick={() => onSelect(mode)}
            key={mode}
          >
            <span className="mode-picker-art"><ModeArtwork mode={mode} /></span>
            <span className="mode-picker-label">
              <strong>{MODE_LABELS[mode]}</strong>
              <span>{MODE_REVEAL_STYLES[mode]}</span>
            </span>
          </button>
        ))}
      </div>
      <footer className="showdown-panel-actions">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Edit managers</Button>
        <Button onClick={onLock} isLoading={busy}><Play size={16} aria-hidden="true" /> Start Showdown</Button>
      </footer>
    </section>
  );
}
