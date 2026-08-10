import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Database, X } from "lucide-react";

import { TeamMark } from "@/components/player/TeamMark";

export interface StatsPlayerMetric {
  label: string;
  value: string;
  helper?: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface StatsPlayerWeek {
  id: string;
  season: number;
  week: number;
  team: string;
  opponent: string;
  fantasyPoints: number;
  carries: number;
  targets: number;
  receptions: number;
  totalYards: number;
  totalTouchdowns: number;
}

export interface StatsPlayerSource {
  name: string;
  detail: string;
  updatedAt?: string;
}

export interface StatsPlayerDetail {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent?: string;
  status?: string;
  summary: string;
  overviewMetrics: StatsPlayerMetric[];
  usageMetrics: StatsPlayerMetric[];
  weeks: StatsPlayerWeek[];
  sources: StatsPlayerSource[];
}

interface StatsPlayerDrawerProps {
  player: StatsPlayerDetail | null;
  onClose: () => void;
}

const DRAWER_TABS = [
  { value: "overview", label: "Overview" },
  { value: "game-log", label: "Game log" },
  { value: "sources", label: "Sources" },
] as const;

type DrawerTab = (typeof DRAWER_TABS)[number]["value"];

function MetricGrid({ metrics }: { metrics: StatsPlayerMetric[] }) {
  return (
    <div className="stats-drawer-metric-grid">
      {metrics.map((metric) => (
        <div className={`stats-drawer-metric is-${metric.tone ?? "neutral"}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.helper ? <small>{metric.helper}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function StatsPlayerDrawer({ player, onClose }: StatsPlayerDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playerId = player?.id ?? null;

  useEffect(() => {
    if (!playerId) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, playerId]);

  useEffect(() => {
    setTab("overview");
  }, [playerId]);

  function moveTab(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = DRAWER_TABS.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + DRAWER_TABS.length) % DRAWER_TABS.length
          : (currentIndex + 1) % DRAWER_TABS.length;
    const nextTab = DRAWER_TABS[nextIndex] ?? DRAWER_TABS[0];
    setTab(nextTab.value);
    requestAnimationFrame(() => document.getElementById(`stats-player-tab-${nextTab.value}`)?.focus());
  }

  if (!player) return null;

  return (
    <div className="stats-drawer-root">
      <button
        type="button"
        className="stats-drawer-backdrop"
        aria-label="Close player details"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="stats-player-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-player-drawer-title"
      >
        <header className="stats-drawer-header">
          <div className="stats-drawer-player">
            <TeamMark team={player.team} size="sm" />
            <div>
              <div className="stats-drawer-kicker">
                <span>{player.position}</span>
                <span>{player.team || "FA"}</span>
                {player.opponent ? <span>vs {player.opponent}</span> : null}
              </div>
              <h2 id="stats-player-drawer-title">{player.name}</h2>
              <p>{player.summary}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="stats-drawer-close"
            aria-label="Close player details"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="stats-drawer-tabs" role="tablist" aria-label="Player details">
          {DRAWER_TABS.map((item, index) => (
            <button
              id={`stats-player-tab-${item.value}`}
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              aria-controls={`stats-player-panel-${item.value}`}
              tabIndex={tab === item.value ? 0 : -1}
              className={tab === item.value ? "is-active" : ""}
              onClick={() => setTab(item.value)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          id={`stats-player-panel-${tab}`}
          className="stats-drawer-body"
          role="tabpanel"
          aria-labelledby={`stats-player-tab-${tab}`}
        >
          {tab === "overview" ? (
            <>
              <section aria-labelledby="stats-overview-heading">
                <h3 id="stats-overview-heading">Fantasy outlook</h3>
                <MetricGrid metrics={player.overviewMetrics} />
              </section>
              <section aria-labelledby="stats-usage-heading">
                <h3 id="stats-usage-heading">Opportunity and efficiency</h3>
                <MetricGrid metrics={player.usageMetrics} />
              </section>
            </>
          ) : null}

          {tab === "game-log" ? (
            <section aria-labelledby="stats-game-log-heading">
              <div className="stats-drawer-section-head">
                <h3 id="stats-game-log-heading">Recent games</h3>
                <span>{player.weeks.length} games</span>
              </div>
              {player.weeks.length ? (
                <div className="stats-drawer-table-shell">
                  <table className="stats-drawer-table">
                    <thead>
                      <tr>
                        <th scope="col">Week</th>
                        <th scope="col">Opp</th>
                        <th scope="col">FPTS</th>
                        <th scope="col">Car</th>
                        <th scope="col">Tgt</th>
                        <th scope="col">Rec</th>
                        <th scope="col">Yds</th>
                        <th scope="col">TD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {player.weeks.map((week) => (
                        <tr key={week.id}>
                          <td>{week.season} · {week.week}</td>
                          <td>{week.opponent || "—"}</td>
                          <td>{week.fantasyPoints.toFixed(1)}</td>
                          <td>{week.carries}</td>
                          <td>{week.targets}</td>
                          <td>{week.receptions}</td>
                          <td>{Math.round(week.totalYards)}</td>
                          <td>{week.totalTouchdowns}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="stats-drawer-empty">No weekly game log is available for this player.</p>
              )}
            </section>
          ) : null}

          {tab === "sources" ? (
            <section aria-labelledby="stats-sources-heading">
              <div className="stats-drawer-section-head">
                <h3 id="stats-sources-heading">Data sources</h3>
                <span>Free-source transparency</span>
              </div>
              <div className="stats-drawer-source-list">
                {player.sources.map((source) => (
                  <article key={source.name}>
                    <Database size={17} aria-hidden="true" />
                    <div>
                      <strong>{source.name}</strong>
                      <p>{source.detail}</p>
                      {source.updatedAt ? <small>Updated {source.updatedAt}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
