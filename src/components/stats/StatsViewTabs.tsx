import type { KeyboardEvent } from "react";
import { STATS_VIEW_OPTIONS } from "./statsViewOptions";
import type { StatsView } from "./statsViewOptions";

interface StatsViewTabsProps {
  value: StatsView;
  onChange: (view: StatsView) => void;
}

export function StatsViewTabs({ value, onChange }: StatsViewTabsProps) {
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = STATS_VIEW_OPTIONS.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft"
            ? (currentIndex - 1 + STATS_VIEW_OPTIONS.length) % STATS_VIEW_OPTIONS.length
            : (currentIndex + 1) % STATS_VIEW_OPTIONS.length;
    const nextView = STATS_VIEW_OPTIONS[nextIndex] ?? STATS_VIEW_OPTIONS[0];
    onChange(nextView.value);
    document.getElementById(`stats-view-${nextView.value}`)?.focus();
  }

  return (
    <div className="stats-view-tabs" role="tablist" aria-label="Stats views">
      {STATS_VIEW_OPTIONS.map((option, index) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            id={`stats-view-${option.value}`}
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`stats-panel-${option.value}`}
            tabIndex={active ? 0 : -1}
            className={active ? "is-active" : ""}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
