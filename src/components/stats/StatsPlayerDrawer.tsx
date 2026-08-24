import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertCircle, Database, LoaderCircle, RotateCw, X } from "lucide-react";

import { TeamMark } from "@/components/player/TeamMark";
import {
  loadPlayerCareerStats,
} from "@/data/playerCareerStats";
import type {
  PlayerCareerScoringMode,
  PlayerCareerSeason,
  PlayerCareerStatsResult,
} from "@/data/playerCareerStats";
import "@/components/stats/StatsPlayerDrawer.css";

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
  career: {
    playerId?: string;
    playerName: string;
    position: string;
    scoring: PlayerCareerScoringMode;
  };
}

interface StatsPlayerDrawerProps {
  player: StatsPlayerDetail | null;
  onClose: () => void;
}

const DRAWER_TABS = [
  { value: "overview", label: "Overview" },
  { value: "career", label: "Career" },
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

type CareerColumn = {
  id: string;
  label: string;
  value: (season: PlayerCareerSeason) => string;
  align?: "left" | "right";
};

function formatCareerNumber(value: number, decimals = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function careerColumns(position: string): CareerColumn[] {
  const common: CareerColumn[] = [
    { id: "season", label: "Season", value: (row) => String(row.season), align: "left" },
    { id: "team", label: "Team", value: (row) => row.team || "—", align: "left" },
    { id: "games", label: "G", value: (row) => formatCareerNumber(row.games) },
  ];
  const scoring: CareerColumn[] = [
    { id: "fantasyPoints", label: "FPTS", value: (row) => formatCareerNumber(row.fantasyPoints, 1) },
    {
      id: "fantasyPointsPerGame",
      label: "FPG",
      value: (row) => row.fantasyPointsPerGame === null
        ? "—"
        : formatCareerNumber(row.fantasyPointsPerGame, 1),
    },
  ];

  if (position === "QB") {
    return [...common,
      { id: "completions", label: "Cmp", value: (row) => formatCareerNumber(row.completions) },
      { id: "passingAttempts", label: "Att", value: (row) => formatCareerNumber(row.passingAttempts) },
      { id: "passingYards", label: "Pass Yds", value: (row) => formatCareerNumber(row.passingYards) },
      { id: "passingTouchdowns", label: "Pass TD", value: (row) => formatCareerNumber(row.passingTouchdowns) },
      { id: "interceptions", label: "INT", value: (row) => formatCareerNumber(row.interceptions) },
      { id: "rushingYards", label: "Rush Yds", value: (row) => formatCareerNumber(row.rushingYards) },
      { id: "rushingTouchdowns", label: "Rush TD", value: (row) => formatCareerNumber(row.rushingTouchdowns) },
      ...scoring,
    ];
  }

  if (position === "K") {
    return [...common,
      { id: "fieldGoalsMade", label: "FG", value: (row) => formatCareerNumber(row.fieldGoalsMade) },
      { id: "fieldGoalsAttempted", label: "FGA", value: (row) => formatCareerNumber(row.fieldGoalsAttempted) },
      {
        id: "fieldGoalPercentage",
        label: "FG%",
        value: (row) => row.fieldGoalPercentage === null
          ? "—"
          : `${formatCareerNumber(row.fieldGoalPercentage * 100, 1)}%`,
      },
      { id: "extraPointsMade", label: "XP", value: (row) => formatCareerNumber(row.extraPointsMade) },
      { id: "extraPointsAttempted", label: "XPA", value: (row) => formatCareerNumber(row.extraPointsAttempted) },
      ...scoring,
    ];
  }

  const receiving: CareerColumn[] = [
    { id: "targets", label: "Tgt", value: (row) => formatCareerNumber(row.targets) },
    { id: "receptions", label: "Rec", value: (row) => formatCareerNumber(row.receptions) },
    { id: "receivingYards", label: "Rec Yds", value: (row) => formatCareerNumber(row.receivingYards) },
    { id: "receivingTouchdowns", label: "Rec TD", value: (row) => formatCareerNumber(row.receivingTouchdowns) },
  ];
  const rushing: CareerColumn[] = [
    { id: "carries", label: "Car", value: (row) => formatCareerNumber(row.carries) },
    { id: "rushingYards", label: "Rush Yds", value: (row) => formatCareerNumber(row.rushingYards) },
    { id: "rushingTouchdowns", label: "Rush TD", value: (row) => formatCareerNumber(row.rushingTouchdowns) },
  ];
  return position === "RB"
    ? [...common, ...rushing, ...receiving, ...scoring]
    : [...common, ...receiving, ...rushing, ...scoring];
}

function CareerPanel({
  player,
  result,
  loading,
  error,
  onRetry,
}: {
  player: StatsPlayerDetail;
  result: PlayerCareerStatsResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (player.position === "DEF") {
    return (
      <p className="stats-drawer-empty">
        Career player totals are not available for team D/ST entries.
      </p>
    );
  }

  if (loading && !result) {
    return (
      <div className="stats-career-status" role="status" aria-live="polite">
        <LoaderCircle size={20} className="stats-career-spinner" aria-hidden="true" />
        <div>
          <strong>Loading full NFL career</strong>
          <span>Checking every nflverse season back to 1999…</span>
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="stats-career-status is-error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        <div>
          <strong>Career stats are temporarily unavailable</strong>
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            <RotateCw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const seasons = result?.seasons ?? [];
  if (!seasons.length) {
    return (
      <p className="stats-drawer-empty">
        No NFL regular-season stats are available for this player yet.
      </p>
    );
  }

  const games = seasons.reduce((sum, season) => sum + season.games, 0);
  const fantasyPoints = seasons.reduce((sum, season) => sum + season.fantasyPoints, 0);
  const columns = careerColumns(player.position);
  const scoringLabel = player.career.scoring === "halfPpr"
    ? "Half PPR"
    : player.career.scoring.toUpperCase();

  return (
    <>
      <dl className="stats-career-summary">
        <div><dt>Seasons played</dt><dd>{seasons.length}</dd></div>
        <div><dt>Games</dt><dd>{games.toLocaleString()}</dd></div>
        <div><dt>Career FPTS</dt><dd>{formatCareerNumber(fantasyPoints, 1)}</dd></div>
        <div><dt>Career FPG</dt><dd>{games ? formatCareerNumber(fantasyPoints / games, 1) : "—"}</dd></div>
      </dl>

      {result?.unavailableSeasons.length ? (
        <div className="stats-career-notice" role="status">
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {result.unavailableSeasons.length} source season{result.unavailableSeasons.length === 1 ? "" : "s"} could not be checked. The rows below include every available season.
          </span>
        </div>
      ) : null}

      <p className="stats-career-context">
        Regular-season totals · {scoringLabel} fantasy scoring · Team is the most recent club listed for that season.
      </p>
      <div className="stats-drawer-table-shell stats-career-table-shell">
        <table className="stats-drawer-table stats-career-table">
          <caption className="sr-only">
            {player.name} NFL regular-season statistics by year
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" className={column.align === "left" ? "is-left" : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={`${season.playerId}-${season.season}`}>
                {columns.map((column) => (
                  <td key={column.id} className={column.align === "left" ? "is-left" : undefined}>
                    {column.value(season)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="stats-career-coverage">
        nflverse player summaries cover {result?.coverageStart}–{result?.coverageEnd}. Seasons are shown newest first.
      </p>
    </>
  );
}

export function StatsPlayerDrawer({ player, onClose }: StatsPlayerDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [careerResult, setCareerResult] = useState<PlayerCareerStatsResult | null>(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const [careerError, setCareerError] = useState<string | null>(null);
  const [careerAttempt, setCareerAttempt] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playerId = player?.id ?? null;
  const careerRequestKey = player
    ? `${player.id}|${player.career.playerId ?? player.career.playerName}|${player.career.scoring}`
    : null;

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

  useEffect(() => {
    setCareerResult(null);
    setCareerError(null);
    setCareerLoading(false);
    setCareerAttempt(0);
  }, [careerRequestKey]);

  useEffect(() => {
    if (tab !== "career" || !player || player.position === "DEF") return;
    const controller = new AbortController();
    setCareerLoading(true);
    setCareerError(null);
    loadPlayerCareerStats({
      ...player.career,
      signal: controller.signal,
    })
      .then(setCareerResult)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCareerError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCareerLoading(false);
      });
    return () => controller.abort();
  }, [careerAttempt, player, tab]);

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

          {tab === "career" ? (
            <section aria-labelledby="stats-career-heading">
              <div className="stats-drawer-section-head">
                <h3 id="stats-career-heading">NFL career by season</h3>
                <span>{careerResult?.seasons.length ? `${careerResult.seasons.length} seasons` : "Regular season"}</span>
              </div>
              <CareerPanel
                player={player}
                result={careerResult}
                loading={careerLoading}
                error={careerError}
                onRetry={() => setCareerAttempt((attempt) => attempt + 1)}
              />
            </section>
          ) : null}

          {tab === "game-log" ? (
            <section aria-labelledby="stats-game-log-heading">
              <div className="stats-drawer-section-head">
                <h3 id="stats-game-log-heading">
                  {player.weeks[0]
                    ? `${player.weeks[0].season} regular-season game log`
                    : "Season game log"}
                </h3>
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
