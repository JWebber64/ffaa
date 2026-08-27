import { ArrowLeft, LockKeyhole } from "lucide-react";
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
        <div><span>Step 2 · Choose game</span><h2 id="mode-selector-title">How should football reveal it?</h2></div>
        <p>The mode changes the presentation only. The same seed and participants always reproduce the same order.</p>
      </header>
      <div className="mode-card-grid" role="group" aria-label="Draft order reveal game">
        {DRAFT_ORDER_MODES.map((mode) => (
          <button
            type="button"
            className={`mode-card ${selectedMode === mode ? "is-selected" : ""}`}
            aria-pressed={selectedMode === mode}
            onClick={() => onSelect(mode)}
            key={mode}
          >
            <span className="mode-card-art"><ModeArtwork mode={mode} /></span>
            <span className="mode-card-copy"><small>{MODE_REVEAL_STYLES[mode]}</small><strong>{MODE_LABELS[mode]}</strong><span>{MODE_DESCRIPTIONS[mode]}</span></span>
            <i>{selectedMode === mode ? "Selected" : "Select game"}</i>
          </button>
        ))}
      </div>
      <footer className="showdown-panel-actions">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Edit managers</Button>
        <Button onClick={onLock} isLoading={busy}><LockKeyhole size={16} aria-hidden="true" /> Lock order</Button>
      </footer>
    </section>
  );
}

