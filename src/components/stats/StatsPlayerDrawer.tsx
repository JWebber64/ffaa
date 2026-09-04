import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertCircle, Database, ExternalLink, LoaderCircle, Newspaper, RotateCw, X } from "lucide-react";

import { TeamMark } from "@/components/player/TeamMark";
import { loadPlayerCareerStats, NFLVERSE_CAREER_LATEST_SEASON } from "@/data/playerCareerStats";
import type { PlayerCareerScoringMode, PlayerCareerSeason, PlayerCareerStatsResult } from "@/data/playerCareerStats";
import { buildPlayerGameLog } from "@/data/playerGameLog";
import { loadPlayerNews, playerNewsSearchUrl, type PlayerNewsItem } from "@/data/playerNews";
import { normalizeToolName, normalizeToolPosition } from "@/data/toolPlayerData";
import { loadWeeklyPlayerStats } from "@/data/weeklyPlayerStats";
import { UniversalSelect } from "@/ui/UniversalSelect";
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
  completions: number;
  passingAttempts: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  rushingYards: number;
  rushingTouchdowns: number;
  receivingYards: number;
  receivingTouchdowns: number;
  fieldGoalsMade: number;
  extraPointsMade: number;
}

export interface StatsPlayerSource {
  name: string;
  detail: string;
  updatedAt?: string;
}

export interface StatsPlayerDetail {
  id: string;
  sleeperId?: string;
  headshotUrl?: string;
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
  { value: "game-log", label: "Game log" },
  { value: "career", label: "Career" },
  { value: "news", label: "News" },
  { value: "sources", label: "Sources" },
] as const;
type DrawerTab = (typeof DRAWER_TABS)[number]["value"];

function MetricGrid({ metrics }: { metrics: StatsPlayerMetric[] }) {
  return <div className="stats-drawer-metric-grid">{metrics.map((metric) => (
    <div className={`stats-drawer-metric is-${metric.tone ?? "neutral"}`} key={metric.label}>
      <span>{metric.label}</span><strong>{metric.value}</strong>{metric.helper ? <small>{metric.helper}</small> : null}
    </div>
  ))}</div>;
}

type TableColumn<T> = { id: string; label: string; value: (row: T) => string; align?: "left" | "right" };

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function careerColumns(position: string): TableColumn<PlayerCareerSeason>[] {
  const common: TableColumn<PlayerCareerSeason>[] = [
    { id: "season", label: "Season", value: (row) => String(row.season), align: "left" },
    { id: "team", label: "Team", value: (row) => row.team || "—", align: "left" },
    { id: "games", label: "G", value: (row) => formatNumber(row.games) },
  ];
  const scoring: TableColumn<PlayerCareerSeason>[] = [
    { id: "fantasyPoints", label: "FPTS", value: (row) => formatNumber(row.fantasyPoints, 1) },
    { id: "fantasyPointsPerGame", label: "FPG", value: (row) => row.fantasyPointsPerGame === null ? "—" : formatNumber(row.fantasyPointsPerGame, 1) },
  ];
  if (position === "QB") return [...common,
    { id: "completions", label: "Cmp", value: (row) => formatNumber(row.completions) },
    { id: "passingAttempts", label: "Att", value: (row) => formatNumber(row.passingAttempts) },
    { id: "passingYards", label: "Pass Yds", value: (row) => formatNumber(row.passingYards) },
    { id: "passingTouchdowns", label: "Pass TD", value: (row) => formatNumber(row.passingTouchdowns) },
    { id: "interceptions", label: "INT", value: (row) => formatNumber(row.interceptions) },
    { id: "rushingYards", label: "Rush Yds", value: (row) => formatNumber(row.rushingYards) },
    { id: "rushingTouchdowns", label: "Rush TD", value: (row) => formatNumber(row.rushingTouchdowns) }, ...scoring];
  if (position === "K") return [...common,
    { id: "fieldGoalsMade", label: "FG", value: (row) => formatNumber(row.fieldGoalsMade) },
    { id: "fieldGoalsAttempted", label: "FGA", value: (row) => formatNumber(row.fieldGoalsAttempted) },
    { id: "fieldGoalPercentage", label: "FG%", value: (row) => row.fieldGoalPercentage === null ? "—" : `${formatNumber(row.fieldGoalPercentage * 100, 1)}%` },
    { id: "extraPointsMade", label: "XP", value: (row) => formatNumber(row.extraPointsMade) },
    { id: "extraPointsAttempted", label: "XPA", value: (row) => formatNumber(row.extraPointsAttempted) }, ...scoring];
  const receiving: TableColumn<PlayerCareerSeason>[] = [
    { id: "targets", label: "Tgt", value: (row) => formatNumber(row.targets) },
    { id: "receptions", label: "Rec", value: (row) => formatNumber(row.receptions) },
    { id: "receivingYards", label: "Rec Yds", value: (row) => formatNumber(row.receivingYards) },
    { id: "receivingTouchdowns", label: "Rec TD", value: (row) => formatNumber(row.receivingTouchdowns) },
  ];
  const rushing: TableColumn<PlayerCareerSeason>[] = [
    { id: "carries", label: "Car", value: (row) => formatNumber(row.carries) },
    { id: "rushingYards", label: "Rush Yds", value: (row) => formatNumber(row.rushingYards) },
    { id: "rushingTouchdowns", label: "Rush TD", value: (row) => formatNumber(row.rushingTouchdowns) },
  ];
  return position === "RB" ? [...common, ...rushing, ...receiving, ...scoring] : [...common, ...receiving, ...rushing, ...scoring];
}

function gameLogColumns(position: string): TableColumn<StatsPlayerWeek>[] {
  const common: TableColumn<StatsPlayerWeek>[] = [
    { id: "week", label: "Week", value: (row) => String(row.week), align: "left" },
    { id: "opponent", label: "Opp", value: (row) => row.opponent || "—", align: "left" },
    { id: "fantasyPoints", label: "FPTS", value: (row) => formatNumber(row.fantasyPoints, 1) },
  ];
  if (position === "QB") return [...common,
    { id: "completions", label: "Cmp", value: (row) => formatNumber(row.completions) },
    { id: "passingAttempts", label: "Att", value: (row) => formatNumber(row.passingAttempts) },
    { id: "passingYards", label: "Pass Yds", value: (row) => formatNumber(row.passingYards) },
    { id: "passingTouchdowns", label: "Pass TD", value: (row) => formatNumber(row.passingTouchdowns) },
    { id: "interceptions", label: "INT", value: (row) => formatNumber(row.interceptions) },
    { id: "rushingYards", label: "Rush Yds", value: (row) => formatNumber(row.rushingYards) },
    { id: "rushingTouchdowns", label: "Rush TD", value: (row) => formatNumber(row.rushingTouchdowns) }];
  if (position === "K") return [...common,
    { id: "fieldGoalsMade", label: "FG", value: (row) => formatNumber(row.fieldGoalsMade) },
    { id: "extraPointsMade", label: "XP", value: (row) => formatNumber(row.extraPointsMade) }];
  return [...common,
    { id: "carries", label: "Car", value: (row) => formatNumber(row.carries) },
    { id: "rushingYards", label: "Rush Yds", value: (row) => formatNumber(row.rushingYards) },
    { id: "targets", label: "Tgt", value: (row) => formatNumber(row.targets) },
    { id: "receptions", label: "Rec", value: (row) => formatNumber(row.receptions) },
    { id: "receivingYards", label: "Rec Yds", value: (row) => formatNumber(row.receivingYards) },
    { id: "totalTouchdowns", label: "TD", value: (row) => formatNumber(row.totalTouchdowns) }];
}

function CareerPanel({ player, result, loading, error, onRetry }: {
  player: StatsPlayerDetail; result: PlayerCareerStatsResult | null; loading: boolean; error: string | null; onRetry: () => void;
}) {
  if (player.position === "DEF") return <p className="stats-drawer-empty">Career player totals are not available for team D/ST entries.</p>;
  if (loading && !result) return <div className="stats-career-status" role="status" aria-live="polite"><LoaderCircle size={20} className="stats-career-spinner" aria-hidden="true" /><div><strong>Loading full NFL career</strong><span>Checking every nflverse season back to 1999…</span></div></div>;
  if (error && !result) return <div className="stats-career-status is-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Career stats are temporarily unavailable</strong><span>{error}</span><button type="button" onClick={onRetry}><RotateCw size={14} aria-hidden="true" />Try again</button></div></div>;
  const seasons = result?.seasons ?? [];
  if (!seasons.length) return <p className="stats-drawer-empty">No NFL regular-season stats are available for this player yet.</p>;
  const games = seasons.reduce((sum, season) => sum + season.games, 0);
  const fantasyPoints = seasons.reduce((sum, season) => sum + season.fantasyPoints, 0);
  const columns = careerColumns(player.position);
  const scoringLabel = player.career.scoring === "halfPpr" ? "Half PPR" : player.career.scoring.toUpperCase();
  return <>
    <dl className="stats-career-summary"><div><dt>Seasons played</dt><dd>{seasons.length}</dd></div><div><dt>Games</dt><dd>{games.toLocaleString()}</dd></div><div><dt>Career FPTS</dt><dd>{formatNumber(fantasyPoints, 1)}</dd></div><div><dt>Career PPG</dt><dd>{games ? formatNumber(fantasyPoints / games, 1) : "—"}</dd></div></dl>
    {result?.unavailableSeasons.length ? <div className="stats-career-notice" role="status"><AlertCircle size={16} aria-hidden="true" /><span>{result.unavailableSeasons.length} source season{result.unavailableSeasons.length === 1 ? "" : "s"} could not be checked. The rows below include every available season.</span></div> : null}
    <p className="stats-career-context">Regular-season totals · {scoringLabel} fantasy scoring · Team is the most recent club listed for that season.</p>
    <div className="stats-drawer-table-shell stats-career-table-shell"><table className="stats-drawer-table stats-career-table"><caption className="sr-only">{player.name} NFL regular-season statistics by year</caption><thead><tr>{columns.map((column) => <th key={column.id} scope="col" className={column.align === "left" ? "is-left" : undefined}>{column.label}</th>)}</tr></thead><tbody>{seasons.map((season) => <tr key={`${season.playerId}-${season.season}`}>{columns.map((column) => <td key={column.id} className={column.align === "left" ? "is-left" : undefined}>{column.value(season)}</td>)}</tr>)}</tbody></table></div>
    <p className="stats-career-coverage">nflverse player summaries cover {result?.coverageStart}–{result?.coverageEnd}. Seasons are shown newest first.</p>
  </>;
}

function NewsPanel({ playerName, items, loading, error, onRetry }: {
  playerName: string; items: PlayerNewsItem[]; loading: boolean; error: string | null; onRetry: () => void;
}) {
  if (loading) return <div className="stats-career-status" role="status" aria-live="polite"><LoaderCircle size={20} className="stats-career-spinner" aria-hidden="true" /><div><strong>Loading current NFL news</strong><span>Checking ESPN headlines for an explicit player match.</span></div></div>;
  if (error) return <div className="stats-career-status is-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Player news is temporarily unavailable</strong><span>{error}</span><button type="button" onClick={onRetry}><RotateCw size={14} aria-hidden="true" />Try again</button></div></div>;
  if (!items.length) return <div className="stats-news-empty"><Newspaper size={22} aria-hidden="true" /><strong>No matching headline in the current ESPN NFL feed</strong><p>Only stories that explicitly mention {playerName} are shown. GameHQ does not guess or attach unrelated league news.</p><a href={playerNewsSearchUrl(playerName)} target="_blank" rel="noreferrer">Search ESPN for {playerName}<ExternalLink size={14} aria-hidden="true" /></a></div>;
  return <div className="stats-news-list">{items.map((item) => <article key={item.id}><div><span>{item.source}</span>{item.publishedAt ? <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString()}</time> : null}</div><a href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><ExternalLink size={15} aria-hidden="true" /></a>{item.description ? <p>{item.description}</p> : null}</article>)}</div>;
}

function careerOverviewMetric(position: string, result: PlayerCareerStatsResult | null, loading: boolean, error: string | null): StatsPlayerMetric {
  if (position === "DEF") return { label: "Career PPG", value: "—", helper: "Not available for team D/ST" };
  if (loading && !result) return { label: "Career PPG", value: "—", helper: "Loading career data" };
  if (error && !result) return { label: "Career PPG", value: "—", helper: "Career data unavailable" };
  const seasons = result?.seasons ?? [];
  const games = seasons.reduce((sum, season) => sum + season.games, 0);
  const fantasyPoints = seasons.reduce((sum, season) => sum + season.fantasyPoints, 0);
  const firstSeason = seasons[seasons.length - 1]?.season;
  const lastSeason = seasons[0]?.season;
  return {
    label: "Career PPG",
    value: games ? formatNumber(fantasyPoints / games, 1) : "—",
    helper: games
      ? firstSeason && lastSeason
        ? `${firstSeason}–${lastSeason} · ${games.toLocaleString()} games`
        : `${games.toLocaleString()} regular-season games`
      : "No regular-season games",
  };
}

function withCareerOverviewMetric(metrics: StatsPlayerMetric[], metric: StatsPlayerMetric) {
  const existingIndex = metrics.findIndex((item) => item.label === metric.label);
  if (existingIndex >= 0) return metrics.map((item, index) => index === existingIndex ? metric : item);
  const index = metrics.findIndex((item) => item.label === "Season PPG" || item.label === "Fantasy PPG");
  const next = [...metrics];
  next.splice(index >= 0 ? index + 1 : Math.min(4, next.length), 0, metric);
  return next;
}

export function StatsPlayerDrawer({ player, onClose }: StatsPlayerDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [careerState, setCareerState] = useState<{ key: string; result: PlayerCareerStatsResult } | null>(null);
  const [careerLoadingKey, setCareerLoadingKey] = useState<string | null>(null);
  const [careerErrorState, setCareerErrorState] = useState<{ key: string; message: string } | null>(null);
  const [careerAttempt, setCareerAttempt] = useState(0);
  const [gameLogSeason, setGameLogSeason] = useState(NFLVERSE_CAREER_LATEST_SEASON);
  const [gameLogRows, setGameLogRows] = useState<StatsPlayerWeek[]>([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);
  const [gameLogAttempt, setGameLogAttempt] = useState(0);
  const [newsItems, setNewsItems] = useState<PlayerNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsAttempt, setNewsAttempt] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const playerId = player?.id ?? null;
  const careerPlayerId = player?.career.playerId ?? "";
  const careerPlayerName = player?.career.playerName ?? "";
  const careerPosition = player?.career.position ?? "";
  const careerScoring = player?.career.scoring ?? "halfPpr";
  const careerRequestKey = player ? `${player.id}|${careerPlayerId || careerPlayerName}|${careerScoring}` : null;

  useEffect(() => {
    if (!playerId) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.documentElement.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKeyDown); previousFocusRef.current?.focus(); };
  }, [onClose, playerId]);

  useEffect(() => {
    setTab("overview"); setGameLogSeason(NFLVERSE_CAREER_LATEST_SEASON); setGameLogRows([]); setGameLogError(null); setGameLogAttempt(0); setNewsItems([]); setNewsError(null); setNewsAttempt(0);
  }, [playerId]);

  useEffect(() => {
    if (!careerRequestKey || !playerId || careerPosition === "DEF") return;
    const controller = new AbortController();
    setCareerLoadingKey(careerRequestKey); setCareerErrorState((current) => current?.key === careerRequestKey ? null : current);
    loadPlayerCareerStats({ ...(careerPlayerId ? { playerId: careerPlayerId } : {}), playerName: careerPlayerName, position: careerPosition, scoring: careerScoring, signal: controller.signal })
      .then((result) => setCareerState({ key: careerRequestKey, result }))
      .catch((error: unknown) => { if (!controller.signal.aborted) setCareerErrorState({ key: careerRequestKey, message: error instanceof Error ? error.message : String(error) }); })
      .finally(() => { if (!controller.signal.aborted) setCareerLoadingKey((key) => key === careerRequestKey ? null : key); });
    return () => controller.abort();
  }, [careerAttempt, careerPlayerId, careerPlayerName, careerPosition, careerRequestKey, careerScoring, playerId]);

  useEffect(() => {
    if (tab !== "game-log" || !player) return;
    const controller = new AbortController(); setGameLogLoading(true); setGameLogError(null);
    loadWeeklyPlayerStats({ seasons: [gameLogSeason], seasonType: "REG", scoring: player.career.scoring, signal: controller.signal })
      .then((result) => {
        const requestedName = normalizeToolName(player.name); const requestedPosition = normalizeToolPosition(player.position);
        const requestedIds = new Set([player.id, player.sleeperId, player.career.playerId].filter((value): value is string => Boolean(value)));
        setGameLogRows(buildPlayerGameLog(result.rows.filter((row) => requestedIds.has(row.playerId) || (normalizeToolName(row.playerName) === requestedName && normalizeToolPosition(row.position) === requestedPosition))));
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setGameLogError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!controller.signal.aborted) setGameLogLoading(false); });
    return () => controller.abort();
  }, [gameLogAttempt, gameLogSeason, player, tab]);

  useEffect(() => {
    if (tab !== "news" || !player) return;
    const controller = new AbortController(); setNewsLoading(true); setNewsError(null);
    loadPlayerNews({ playerName: player.name, signal: controller.signal }).then(setNewsItems).catch((error: unknown) => { if (!controller.signal.aborted) setNewsError(error instanceof Error ? error.message : String(error)); }).finally(() => { if (!controller.signal.aborted) setNewsLoading(false); });
    return () => controller.abort();
  }, [newsAttempt, player, tab]);

  function moveTab(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const lastIndex = DRAWER_TABS.length - 1;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? lastIndex : event.key === "ArrowLeft" ? (currentIndex - 1 + DRAWER_TABS.length) % DRAWER_TABS.length : (currentIndex + 1) % DRAWER_TABS.length;
    const nextTab = DRAWER_TABS[nextIndex] ?? DRAWER_TABS[0]; setTab(nextTab.value); requestAnimationFrame(() => document.getElementById(`stats-player-tab-${nextTab.value}`)?.focus());
  }

  if (!player) return null;
  const careerResult = careerState?.key === careerRequestKey ? careerState.result : null;
  const careerError = careerErrorState?.key === careerRequestKey ? careerErrorState.message : null;
  const careerLoading = careerLoadingKey === careerRequestKey || (
    Boolean(careerRequestKey)
    && player.position !== "DEF"
    && !careerResult
    && !careerError
  );
  const overviewMetrics = withCareerOverviewMetric(player.overviewMetrics, careerOverviewMetric(player.position, careerResult, careerLoading, careerError));
  const columns = gameLogColumns(player.position);

  return <div className="stats-drawer-root">
    <button type="button" className="stats-drawer-backdrop" aria-label="Close player details" onClick={onClose} />
    <aside ref={drawerRef} className="stats-player-drawer" role="dialog" aria-modal="true" aria-labelledby="stats-player-drawer-title">
      <header className="stats-drawer-header"><div className="stats-drawer-player">{player.headshotUrl ? <img className="stats-drawer-headshot" src={player.headshotUrl} alt="" /> : <TeamMark team={player.team} size="sm" />}<div><div className="stats-drawer-kicker"><span>{player.position}</span><span>{player.team || "FA"}</span>{player.opponent ? <span>vs {player.opponent}</span> : null}{player.status ? <span>{player.status}</span> : null}</div><h2 id="stats-player-drawer-title">{player.name}</h2><p>{player.summary}</p></div></div><button ref={closeButtonRef} type="button" className="stats-drawer-close" aria-label="Close player details" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      <div className="stats-drawer-tabs" role="tablist" aria-label="Player details">{DRAWER_TABS.map((item, index) => <button id={`stats-player-tab-${item.value}`} key={item.value} type="button" role="tab" aria-selected={tab === item.value} aria-controls={`stats-player-panel-${item.value}`} tabIndex={tab === item.value ? 0 : -1} className={tab === item.value ? "is-active" : ""} onClick={() => setTab(item.value)} onKeyDown={(event) => moveTab(event, index)}>{item.label}</button>)}</div>
      <div id={`stats-player-panel-${tab}`} className="stats-drawer-body" role="tabpanel" aria-labelledby={`stats-player-tab-${tab}`}>
        {tab === "overview" ? <><section aria-labelledby="stats-overview-heading"><h3 id="stats-overview-heading">Fantasy outlook</h3><MetricGrid metrics={overviewMetrics} /></section><section aria-labelledby="stats-usage-heading"><h3 id="stats-usage-heading">Opportunity and efficiency</h3><MetricGrid metrics={player.usageMetrics} /></section></> : null}
        {tab === "game-log" ? <section aria-labelledby="stats-game-log-heading"><div className="stats-drawer-section-head stats-game-log-head"><div><h3 id="stats-game-log-heading">Regular-season game log</h3><span>{gameLogRows.length} games</span></div><label><span className="sr-only">Game log season</span><UniversalSelect aria-label="Game log season" value={String(gameLogSeason)} onValueChange={(value) => setGameLogSeason(Number(value))}>{Array.from({ length: NFLVERSE_CAREER_LATEST_SEASON - 1999 + 1 }, (_, index) => NFLVERSE_CAREER_LATEST_SEASON - index).map((season) => <option value={season} key={season}>{season}</option>)}</UniversalSelect></label></div>
          {gameLogLoading ? <div className="stats-career-status" role="status"><LoaderCircle size={20} className="stats-career-spinner" aria-hidden="true" /><div><strong>Loading {gameLogSeason} game log</strong><span>Reading nflverse weekly player stats.</span></div></div> : gameLogError ? <div className="stats-career-status is-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Game log is temporarily unavailable</strong><span>{gameLogError}</span><button type="button" onClick={() => setGameLogAttempt((attempt) => attempt + 1)}><RotateCw size={14} aria-hidden="true" />Try again</button></div></div> : gameLogRows.length ? <><div className="stats-drawer-table-shell"><table className="stats-drawer-table"><caption className="sr-only">{player.name} {gameLogSeason} regular-season game log</caption><thead><tr>{columns.map((column) => <th key={column.id} scope="col" className={column.align === "left" ? "is-left" : undefined}>{column.label}</th>)}</tr></thead><tbody>{gameLogRows.map((week) => <tr key={week.id}>{columns.map((column) => <td key={column.id} className={column.align === "left" ? "is-left" : undefined}>{column.value(week)}</td>)}</tr>)}</tbody></table></div><p className="stats-career-coverage">nflverse regular-season weekly totals. Most recent game first.</p></> : <p className="stats-drawer-empty">No {gameLogSeason} regular-season game log is available for this player.</p>}</section> : null}
        {tab === "career" ? <section aria-labelledby="stats-career-heading"><div className="stats-drawer-section-head"><h3 id="stats-career-heading">NFL career by season</h3><span>{careerResult?.seasons.length ? `${careerResult.seasons.length} seasons` : "Regular season"}</span></div><CareerPanel player={player} result={careerResult} loading={careerLoading} error={careerError} onRetry={() => setCareerAttempt((attempt) => attempt + 1)} /></section> : null}
        {tab === "news" ? <section aria-labelledby="stats-news-heading"><div className="stats-drawer-section-head"><h3 id="stats-news-heading">Player news</h3><span>ESPN NFL headlines</span></div><NewsPanel playerName={player.name} items={newsItems} loading={newsLoading} error={newsError} onRetry={() => setNewsAttempt((attempt) => attempt + 1)} /></section> : null}
        {tab === "sources" ? <section aria-labelledby="stats-sources-heading"><div className="stats-drawer-section-head"><h3 id="stats-sources-heading">Data sources</h3><span>Free-source transparency</span></div><div className="stats-drawer-source-list">{player.sources.map((source) => <article key={source.name}><Database size={17} aria-hidden="true" /><div><strong>{source.name}</strong><p>{source.detail}</p>{source.updatedAt ? <small>Updated {source.updatedAt}</small> : null}</div></article>)}</div></section> : null}
      </div>
    </aside>
  </div>;
}
