import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ChartNoAxesCombined, Database, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AnalyticsRankedBars } from "@/components/analytics/AnalyticsRankedBars";
import type { AnalyticsRankedBar } from "@/components/analytics/AnalyticsRankedBars";
import { AnalyticsScatterPlot } from "@/components/analytics/AnalyticsScatterPlot";
import type { AnalyticsScatterPoint } from "@/components/analytics/AnalyticsScatterPlot";
import { TeamMark } from "@/components/player/TeamMark";
import {
  loadAnalyticsData,
} from "@/data/analyticsData";
import type {
  AnalyticsDataResult,
  AnalyticsPlayerMetric,
  AnalyticsPosition,
  AnalyticsScoringMode,
} from "@/data/analyticsData";
import { Button } from "@/ui/Button";
import { PositionToggle } from "@/ui/PositionToggle";
import { DEFAULT_POSITION_TOGGLE_OPTIONS } from "@/ui/positionToggleOptions";
import { SelectItem, SelectWrapper } from "@/ui/SelectWrapper";

const SEASONS = [2025, 2024, 2023, 2022] as const;
const MIN_GAME_OPTIONS = [3, 5, 8] as const;
const WEEK_OPTIONS = Array.from({ length: 18 }, (_, index) => index + 1);

const POSITION_OPTIONS = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DEF"] as const;

function numberFromQuery(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function scoringFromQuery(value: string | null): AnalyticsScoringMode {
  return value === "standard" || value === "halfPpr" || value === "ppr" ? value : "halfPpr";
}

function positionFromQuery(value: string | null): AnalyticsPosition {
  return POSITION_OPTIONS.includes(value as AnalyticsPosition) ? value as AnalyticsPosition : "ALL";
}

function formatNumber(value: number, decimals = 1) {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatSigned(value: number, suffix = "") {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}${suffix}`;
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function pointsFor(
  players: AnalyticsPlayerMetric[],
  mapper: (player: AnalyticsPlayerMetric) => AnalyticsScatterPoint | null
) {
  return players.flatMap((player) => {
    const point = mapper(player);
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? [point] : [];
  });
}

export function AnalyticsLab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const season = numberFromQuery(searchParams.get("season"), 2025, 2022, 2025);
  const scoring = scoringFromQuery(searchParams.get("scoring"));
  const position = positionFromQuery(searchParams.get("position"));
  const team = searchParams.get("team")?.toUpperCase() || "ALL";
  const weekStart = numberFromQuery(searchParams.get("from"), 1, 1, 18);
  const weekEnd = numberFromQuery(searchParams.get("to"), 18, 1, 18);
  const minGames = numberFromQuery(searchParams.get("minGames"), 5, 1, 18);
  const [data, setData] = useState<AnalyticsDataResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  function updateQuery(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (
        (key === "season" && value === "2025") ||
        (key === "scoring" && value === "halfPpr") ||
        (key === "position" && value === "ALL") ||
        (key === "team" && value === "ALL") ||
        (key === "from" && value === "1") ||
        (key === "to" && value === "18") ||
        (key === "minGames" && value === "5")
      ) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAnalyticsData({ season, scoring, position, team, weekStart, weekEnd, minGames })
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(reason instanceof Error ? reason.message : "The public analytics feeds could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [minGames, position, scoring, season, team, weekEnd, weekStart]);

  const players = data?.players ?? [];
  const teams = data?.teams ?? [];
  const teamOptions = useMemo(() => {
    const availableTeams = data?.teams ?? [];
    const choices = [...new Set([...availableTeams.map((entry) => entry.team), team])]
      .filter((value) => value && value !== "ALL")
      .sort();
    return ["ALL", ...choices];
  }, [data, team]);
  const rbs = players.filter((player) => player.position === "RB");
  const receivers = players.filter((player) => player.position === "WR" || player.position === "TE");
  const quarterbacks = players.filter((player) => player.position === "QB");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedScoringLabel = scoring === "halfPpr" ? "Half PPR" : scoring.toUpperCase();

  const expectedVsActual = pointsFor(players, (player) => ({
    id: player.id,
    label: player.name,
    team: player.team,
    position: player.position,
    x: player.expectedPointsPerGame,
    y: player.actualPointsPerGame,
    size: player.opportunityPerGame,
    detail: `${formatSigned(player.actualPointsPerGame - player.expectedPointsPerGame)} actual vs expected per game`,
  }));
  const rbExpectedVsRyoe = pointsFor(
    rbs.filter((player) => player.rushAttempts >= 50 && player.rushingYardsOverExpectedRate !== null),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: player.expectedPointsPerGame,
      y: player.rushingYardsOverExpectedRate ?? 0,
      size: player.rushAttempts,
      detail: `${player.rushAttempts} carries · ${formatNumber(player.rushingYardsOverExpected ?? 0)} RYOE`,
    })
  );
  const rbVolumeVsEfficiency = pointsFor(
    rbs.filter((player) => player.rushAttempts >= 50 && player.rushingYardsOverExpectedPerAttempt !== null),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: player.carriesPerGame,
      y: player.rushingYardsOverExpectedPerAttempt ?? 0,
      size: player.expectedPointsPerGame,
      detail: `${formatNumber(player.expectedPointsPerGame)} expected ${selectedScoringLabel} PPG`,
    })
  );
  const rbBoxVsEfficiency = pointsFor(
    rbs.filter((player) => player.rushAttempts >= 50 && player.boxRate !== null && player.rushingYardsOverExpectedPerAttempt !== null),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: player.boxRate ?? 0,
      y: player.rushingYardsOverExpectedPerAttempt ?? 0,
      size: player.rushAttempts,
      detail: `${formatNumber(player.carriesPerGame)} carries per game`,
    })
  );
  const receiverShare = pointsFor(
    receivers.filter((player) => player.targetShare !== null && player.airYardsShare !== null),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: (player.targetShare ?? 0) * 100,
      y: (player.airYardsShare ?? 0) * 100,
      size: player.actualPointsPerGame,
      detail: `${formatNumber(player.actualPointsPerGame)} actual ${selectedScoringLabel} PPG`,
    })
  );
  const receiverOpportunity = pointsFor(receivers, (player) => ({
    id: player.id,
    label: player.name,
    team: player.team,
    position: player.position,
    x: player.targetsPerGame,
    y: player.expectedPointsPerGame,
    size: player.actualPointsPerGame,
    detail: `${formatSigned(player.actualPointsPerGame - player.expectedPointsPerGame)} actual vs expected per game`,
  }));
  const quarterbackAccuracy = pointsFor(
    quarterbacks.filter(
      (player) =>
        player.expectedCompletionPercentage !== null &&
        player.completionPercentageOverExpected !== null
    ),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: player.expectedCompletionPercentage ?? 0,
      y: player.completionPercentageOverExpected ?? 0,
      size: player.actualPointsPerGame,
      detail: `${formatNumber(player.expectedPointsPerGame)} expected ${selectedScoringLabel} PPG`,
    })
  );
  const quarterbackTempo = pointsFor(
    quarterbacks.filter((player) => player.timeToThrow !== null),
    (player) => ({
      id: player.id,
      label: player.name,
      team: player.team,
      position: player.position,
      x: player.timeToThrow ?? 0,
      y: player.actualPointsPerGame,
      size: player.expectedPointsPerGame,
      detail: `${formatSigned(player.actualPointsPerGame - player.expectedPointsPerGame)} actual vs expected per game`,
    })
  );
  const playerSurpluses = [...players]
    .sort((left, right) => right.actualPointsPerGame - right.expectedPointsPerGame - (left.actualPointsPerGame - left.expectedPointsPerGame))
    .slice(0, 10)
    .map<AnalyticsRankedBar>((player) => ({
      id: player.id,
      label: player.name,
      meta: `${player.position} · ${player.team}`,
      value: player.actualPointsPerGame - player.expectedPointsPerGame,
      tone: "positive",
    }));
  const teamSurpluses = [...teams]
    .sort((left, right) => right.deltaPerGame - left.deltaPerGame)
    .slice(0, 10)
    .map<AnalyticsRankedBar>((entry) => ({
      id: entry.team,
      label: entry.team,
      meta: `${formatNumber(entry.expectedPointsPerGame)} expected ${selectedScoringLabel} PPG`,
      value: entry.deltaPerGame,
      tone: "positive",
    }));

  function selectPoint(point: AnalyticsScatterPoint) {
    setSelectedPlayerId(point.id);
  }

  return (
    <section className="analytics-lab">
      <header className="analytics-hero">
        <div>
          <span className="analytics-kicker"><ChartNoAxesCombined size={15} aria-hidden="true" />Public-data visual research</span>
          <h1 className="ff-display">Analytics Lab</h1>
          <p>
            Find the story behind the table: opportunity, outcome, efficiency, and market context—using public nflverse and ffverse releases.
          </p>
          <div className="analytics-meta-line">
            <span>{season} regular season</span>
            <span>{selectedScoringLabel}</span>
            <span>Weeks {Math.min(weekStart, weekEnd)}–{Math.max(weekStart, weekEnd)}</span>
          </div>
        </div>
        <div className="analytics-hero-actions">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/stats?season=${season}&scoring=${scoring}`)}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Stats Hub
          </Button>
          <span className="analytics-public-badge"><Database size={18} aria-hidden="true" />No subscription data</span>
        </div>
      </header>

      <nav className="analytics-section-nav" aria-label="Analytics sections">
        <a href="#edges">Player edges</a>
        <a href="#running-backs">Running backs</a>
        <a href="#receivers">Receivers</a>
        <a href="#quarterbacks">Quarterbacks</a>
        <a href="#teams">Teams</a>
      </nav>

      <div className="analytics-controls" aria-label="Analytics filters">
        <div className="analytics-position-control">
          <span>Position</span>
          <PositionToggle
            ariaLabel="Filter Analytics Lab by position"
            value={position}
            options={DEFAULT_POSITION_TOGGLE_OPTIONS}
            onChange={(value) => updateQuery({ position: value })}
          />
        </div>
        <SelectWrapper label="Season" value={String(season)} onValueChange={(value) => updateQuery({ season: value })}>
          {SEASONS.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
        </SelectWrapper>
        <SelectWrapper label="Scoring" value={scoring} onValueChange={(value) => updateQuery({ scoring: value })}>
          <SelectItem value="ppr">PPR</SelectItem>
          <SelectItem value="halfPpr">Half PPR</SelectItem>
          <SelectItem value="standard">Standard</SelectItem>
        </SelectWrapper>
        <SelectWrapper label="Team" value={team} onValueChange={(value) => updateQuery({ team: value })}>
          {teamOptions.map((value) => <SelectItem key={value} value={value}>{value === "ALL" ? "All teams" : value}</SelectItem>)}
        </SelectWrapper>
        <SelectWrapper label="From week" value={String(weekStart)} onValueChange={(value) => updateQuery({ from: value })}>
          {WEEK_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>Week {value}</SelectItem>)}
        </SelectWrapper>
        <SelectWrapper label="To week" value={String(weekEnd)} onValueChange={(value) => updateQuery({ to: value })}>
          {WEEK_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>Week {value}</SelectItem>)}
        </SelectWrapper>
        <SelectWrapper label="Minimum games" value={String(minGames)} onValueChange={(value) => updateQuery({ minGames: value })}>
          {MIN_GAME_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value}+ games</SelectItem>)}
        </SelectWrapper>
      </div>

      {loading ? <div className="analytics-note"><Activity size={17} aria-hidden="true" /><span>Loading the public opportunity and Next Gen datasets…</span></div> : null}
      {error ? <div className="analytics-note is-error"><span>{error}</span></div> : null}

      {!loading && !error ? (
        <>
          <div className="analytics-summary-grid">
            <div><span>Qualified players</span><strong>{players.length}</strong><small>{minGames}+ games in the selected window</small></div>
            <div><span>Top expected scorer</span><strong>{players[0]?.name ?? "—"}</strong><small>{players[0] ? `${formatNumber(players[0].expectedPointsPerGame)} xFPTS/G` : "No data"}</small></div>
            <div><span>Selected lens</span><strong>{position === "ALL" ? "All positions" : position}</strong><small>{team === "ALL" ? "All NFL teams" : team}</small></div>
          </div>

          {selectedPlayer ? (
            <aside className="analytics-player-spotlight" aria-live="polite">
              <TeamMark team={selectedPlayer.team} size="md" />
              <div>
                <span>Pinned player</span>
                <strong>{selectedPlayer.name} <small>{selectedPlayer.position} · {selectedPlayer.team}</small></strong>
              </div>
              <dl>
                <div><dt>Actual</dt><dd>{formatNumber(selectedPlayer.actualPointsPerGame)} PPG</dd></div>
                <div><dt>Expected</dt><dd>{formatNumber(selectedPlayer.expectedPointsPerGame)} xFPTS/G</dd></div>
                <div><dt>Delta</dt><dd>{formatSigned(selectedPlayer.actualPointsPerGame - selectedPlayer.expectedPointsPerGame)}</dd></div>
              </dl>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPlayerId(null)}>Clear</Button>
            </aside>
          ) : null}

          <section id="edges" className="analytics-section">
            <div className="analytics-section-heading">
              <span><Sparkles size={18} aria-hidden="true" />Start here</span>
              <h2>Player edges</h2>
              <p>Compare the fantasy score a role should have produced with the one it actually did.</p>
            </div>
            <div className="analytics-chart-grid">
              <AnalyticsScatterPlot
                title="Expected points vs actual points"
                eyebrow="Regression radar"
                description="Points above the diagonal-style middle range have produced more than their opportunity implied; below it, opportunity has outpaced scoring."
                xLabel="Expected fantasy points per game"
                yLabel="Actual fantasy points per game"
                points={expectedVsActual}
                emptyMessage="No qualified players match these filters."
                formatX={(value) => formatNumber(value)}
                formatY={(value) => formatNumber(value)}
                selectedPointId={selectedPlayerId}
                onPointSelect={selectPoint}
              />
              <AnalyticsRankedBars
                title="Biggest point surpluses"
                eyebrow="Actual minus expected"
                description="Players currently producing furthest above their public expected fantasy-point baseline."
                rows={playerSurpluses}
                emptyMessage="No qualified players match these filters."
                formatValue={(value) => formatSigned(value)}
                selectedId={selectedPlayerId}
                onSelect={(row) => setSelectedPlayerId(row.id)}
              />
            </div>
          </section>

          {(position === "ALL" || position === "RB" || position === "FLEX") ? (
            <section id="running-backs" className="analytics-section">
              <div className="analytics-section-heading">
                <span><Activity size={18} aria-hidden="true" />NFL Next Gen Stats</span>
                <h2>Running back lab</h2>
                <p>Volume, defensive fronts, and rushing performance relative to expectation.</p>
              </div>
              <div className="analytics-chart-grid">
                <AnalyticsScatterPlot
                  title="Expected fantasy points vs RYOE%"
                  eyebrow="Volume meets efficiency"
                  description="The chart you asked for. Bubble size is total carries; only backs with 50+ carries qualify."
                  xLabel="Expected fantasy points per game"
                  yLabel="Rushing yards over expected %"
                  points={rbExpectedVsRyoe}
                  emptyMessage="No RB has enough rushing volume in this window."
                  formatX={(value) => formatNumber(value)}
                  formatY={formatPercent}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
                <AnalyticsScatterPlot
                  title="Carries per game vs RYOE / attempt"
                  eyebrow="Workhorse profile"
                  description="Separate backs who earn volume from those who create more per carry than expected."
                  xLabel="Carries per game"
                  yLabel="RYOE per attempt"
                  points={rbVolumeVsEfficiency}
                  emptyMessage="No RB has enough rushing volume in this window."
                  formatX={(value) => formatNumber(value)}
                  formatY={(value) => formatNumber(value, 2)}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
                <AnalyticsScatterPlot
                  title="Stacked boxes vs RYOE / attempt"
                  eyebrow="Front-adjusted rushing"
                  description="See which backs sustain efficiency despite seeing eight or more defenders in the box."
                  xLabel="8+ defenders in box"
                  yLabel="RYOE per attempt"
                  points={rbBoxVsEfficiency}
                  emptyMessage="No qualifying RB box-count data is available in this window."
                  formatX={formatPercent}
                  formatY={(value) => formatNumber(value, 2)}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
              </div>
            </section>
          ) : null}

          {(position === "ALL" || position === "WR" || position === "TE" || position === "FLEX") ? (
            <section id="receivers" className="analytics-section">
              <div className="analytics-section-heading">
                <span><ChartNoAxesCombined size={18} aria-hidden="true" />Opportunity profile</span>
                <h2>Receiver lab</h2>
                <p>Targets measure recurring volume; air yards expose the depth and leverage of that role.</p>
              </div>
              <div className="analytics-chart-grid">
                <AnalyticsScatterPlot
                  title="Target share vs air-yard share"
                  eyebrow="Role concentration"
                  description="Bubble size is actual fantasy scoring. Upper-right roles command both volume and high-value opportunity."
                  xLabel="Target share"
                  yLabel="Air-yard share"
                  points={receiverShare}
                  emptyMessage="No WR or TE target-share data matches these filters."
                  formatX={formatPercent}
                  formatY={formatPercent}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
                <AnalyticsScatterPlot
                  title="Targets per game vs expected points"
                  eyebrow="Opportunity engine"
                  description="Use this to find receivers whose target volume is building before their box-score output catches up."
                  xLabel="Targets per game"
                  yLabel="Expected fantasy points per game"
                  points={receiverOpportunity}
                  emptyMessage="No WR or TE opportunity data matches these filters."
                  formatX={(value) => formatNumber(value)}
                  formatY={(value) => formatNumber(value)}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
              </div>
            </section>
          ) : null}

          {(position === "ALL" || position === "QB") ? (
            <section id="quarterbacks" className="analytics-section">
              <div className="analytics-section-heading">
                <span><Activity size={18} aria-hidden="true" />NFL Next Gen Stats</span>
                <h2>Quarterback lab</h2>
                <p>Accuracy above expectation and time to throw add context that fantasy-point totals cannot show alone.</p>
              </div>
              <div className="analytics-chart-grid">
                <AnalyticsScatterPlot
                  title="Expected completion % vs CPOE"
                  eyebrow="Difficulty-adjusted accuracy"
                  description="Rightward means easier expected completions; upward means a quarterback completed more than expected."
                  xLabel="Expected completion percentage"
                  yLabel="Completion percentage over expected"
                  points={quarterbackAccuracy}
                  emptyMessage="No qualifying QB Next Gen accuracy data matches these filters."
                  formatX={formatPercent}
                  formatY={formatPercent}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
                <AnalyticsScatterPlot
                  title="Time to throw vs actual scoring"
                  eyebrow="Play style context"
                  description="Bubble size is expected fantasy points. This separates quick-game volume from extended-play production."
                  xLabel="Average time to throw (seconds)"
                  yLabel="Actual fantasy points per game"
                  points={quarterbackTempo}
                  emptyMessage="No qualifying QB time-to-throw data matches these filters."
                  formatX={(value) => formatNumber(value, 2)}
                  formatY={(value) => formatNumber(value)}
                  selectedPointId={selectedPlayerId}
                  onPointSelect={selectPoint}
                />
              </div>
            </section>
          ) : null}

          <section id="teams" className="analytics-section">
            <div className="analytics-section-heading">
              <span><Database size={18} aria-hidden="true" />Team environment</span>
              <h2>Teams above expectation</h2>
              <p>Combined QB, RB, WR, and TE fantasy production relative to expected opportunity.</p>
            </div>
            <div className="analytics-chart-grid">
              <AnalyticsRankedBars
                title="Highest team point surpluses"
                eyebrow="Actual minus expected"
                description="Select a team to narrow every player chart to that offense."
                rows={teamSurpluses}
                emptyMessage="No team data matches these filters."
                formatValue={(value) => formatSigned(value)}
                selectedId={team === "ALL" ? null : team}
                onSelect={(row) => updateQuery({ team: row.id })}
              />
            </div>
          </section>

          <footer className="analytics-attribution">
            <Database size={18} aria-hidden="true" />
            <span><strong>Sources:</strong> ffverse expected-fantasy-points releases and NFL Next Gen Stats via nflverse. Expected points are recalculated for the selected scoring format; charts update when their public source data updates.</span>
          </footer>
        </>
      ) : null}
    </section>
  );
}
