import { ArrowLeft, Play } from "lucide-react";
import { Button } from "../../ui/Button";
import { ModeArtwork } from "./ModeArtwork";
import {
  DRAFT_ORDER_MODES,
  MODE_DESCRIPTIONS,
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
            <strong>{MODE_LABELS[mode]}</strong>
            <span>{MODE_REVEAL_STYLES[mode]}</span>
          </button>
        ))}
      </div>
      <article className="mode-preview">
        <span className="mode-preview-art"><ModeArtwork mode={selectedMode} /></span>
        <div className="mode-preview-copy">
          <small>{MODE_REVEAL_STYLES[selectedMode]}</small>
          <h3>{MODE_LABELS[selectedMode]}</h3>
          <p>{MODE_DESCRIPTIONS[selectedMode]}</p>
          <span>{selectedMode === "draft-dash" ? "Best for a simultaneous, high-energy race." : selectedMode === "football-plinko" ? "Best for suspense that builds one pick at a time." : "Best for a fast stadium-style distance contest."}</span>
        </div>
      </article>
      <footer className="showdown-panel-actions">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Edit managers</Button>
        <Button onClick={onLock} isLoading={busy}><Play size={16} aria-hidden="true" /> Start Showdown</Button>
      </footer>
    </section>
  );
}
