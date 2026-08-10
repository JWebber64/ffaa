import { CalendarDays, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ToolDataStatus } from "@/components/tools/ToolDataStatus";
import { ToolLayout } from "@/components/tools/ToolLayout";
import { buildDefenseVsPosition } from "@/data/defenseVsPosition";
import type { DvpPosition } from "@/data/defenseVsPosition";
import { NFL_SCHEDULE_2026 } from "@/data/nflSchedule";
import { buildScheduleStrength, scheduleMatchupTone } from "@/data/scheduleStrength";
import type { TeamScheduleStrength } from "@/data/scheduleStrength";
import type { ToolScoring } from "@/data/toolPlayerData";
import { useToolData } from "@/screens/tools/useToolData";
import { UniversalSelect } from "@/ui/UniversalSelect";

const POSITIONS: DvpPosition[] = ["QB", "RB", "WR", "TE", "K"];
const WEEK_PRESETS = [
  { label: "Full season", from: 1, to: 18 },
  { label: "Early", from: 1, to: 6 },
  { label: "Midseason", from: 7, to: 12 },
  { label: "Fantasy playoffs", from: 15, to: 17 },
] as const;

type ScheduleSort = "rank" | "team" | "index";

function parsePosition(value: string | null): DvpPosition {
  return POSITIONS.includes(value as DvpPosition) ? value as DvpPosition : "RB";
}

function parseScoring(value: string | null): ToolScoring {
  return value === "standard" || value === "halfPpr" ? value : "ppr";
}

function parseWeek(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const week = Number(value);
  return Number.isInteger(week) ? Math.max(1, Math.min(18, week)) : fallback;
}

function formatIndex(index: number | null) {
  return index === null ? "—" : Math.round(index).toString();
}

function sortedScheduleRows(rows: TeamScheduleStrength[], sort: ScheduleSort) {
  return [...rows].sort((left, right) => {
    if (sort === "team") return left.team.localeCompare(right.team);
    if (sort === "index") return (right.averageMatchupIndex ?? -1) - (left.averageMatchupIndex ?? -1);
    return left.rank - right.rank;
  });
}

export function ScheduleLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ScheduleSort>("rank");
  const position = parsePosition(searchParams.get("position"));
  const scoring = parseScoring(searchParams.get("scoring"));
  const weekStart = parseWeek(searchParams.get("from"), 1);
  const weekEnd = parseWeek(searchParams.get("to"), 18);
  const start = Math.min(weekStart, weekEnd);
  const end = Math.max(weekStart, weekEnd);
  const weeks = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const { weeklyData, loading, error } = useToolData(scoring);
  const ratings = useMemo(
    () => buildDefenseVsPosition(weeklyData?.rows ?? [], { regressionGames: 4 }),
    [weeklyData],
  );
  const scheduleRows = useMemo(
    () => buildScheduleStrength(NFL_SCHEDULE_2026, ratings, { position, weekStart: start, weekEnd: end }),
    [end, position, ratings, start],
  );
  const visibleRows = sortedScheduleRows(
    scheduleRows.filter((row) => row.team.toLowerCase().includes(search.trim().toLowerCase())),
    sort,
  );
  const mostFavorable = scheduleRows[0];
  const toughest = [...scheduleRows].sort((left, right) =>
    (left.averageMatchupIndex ?? Number.MAX_SAFE_INTEGER) -
    (right.averageMatchupIndex ?? Number.MAX_SAFE_INTEGER)
  )[0];

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }

  return (
    <ToolLayout
      eyebrow="Weekly planning"
      title="Schedule Lab"
      description="See every 2026 opponent by fantasy position, isolate any week range, and find favorable stretches without treating last season as destiny."
      methodology={
        <p>
          The 2026 NFL schedule is paired with 2025 fantasy points allowed by position. Each defense is regressed by four league-average games before schedule scores are calculated. An index above 100 is more favorable than the 2025 league average; below 100 is tougher.
        </p>
      }
    >
      <div className="tools-control-panel schedule-controls">
        <div className="tool-field">
          <span id="schedule-position-label">Position</span>
          <UniversalSelect aria-labelledby="schedule-position-label" id="schedule-position" value={position} onValueChange={(value) => updateQuery({ position: value === "RB" ? null : value })}>
            {POSITIONS.map((option) => <option data-position={option} key={option} value={option}>{option}</option>)}
          </UniversalSelect>
        </div>
        <div className="tool-field">
          <span id="schedule-scoring-label">Scoring</span>
          <UniversalSelect aria-labelledby="schedule-scoring-label" id="schedule-scoring" value={scoring} onValueChange={(value) => updateQuery({ scoring: value === "ppr" ? null : value })}>
            <option value="ppr">PPR</option>
            <option value="halfPpr">Half PPR</option>
            <option value="standard">Standard</option>
          </UniversalSelect>
        </div>
        <div className="tool-field">
          <span id="schedule-from-label">From week</span>
          <UniversalSelect aria-labelledby="schedule-from-label" id="schedule-from" value={weekStart} onValueChange={(value) => updateQuery({ from: value === "1" ? null : value })}>
            {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => <option key={week} value={week}>Week {week}</option>)}
          </UniversalSelect>
        </div>
        <div className="tool-field">
          <span id="schedule-to-label">To week</span>
          <UniversalSelect aria-labelledby="schedule-to-label" id="schedule-to" value={weekEnd} onValueChange={(value) => updateQuery({ to: value === "18" ? null : value })}>
            {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => <option key={week} value={week}>Week {week}</option>)}
          </UniversalSelect>
        </div>
        <label className="tool-field tool-search-field" htmlFor="schedule-search">
          <span>Find team</span>
          <span className="tool-input-with-icon"><Search size={15} aria-hidden="true" /><input id="schedule-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="BUF, KC, PHI…" /></span>
        </label>
      </div>

      <div className="schedule-presets" aria-label="Week range shortcuts">
        {WEEK_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.label}
            className={start === preset.from && end === preset.to ? "is-active" : ""}
            onClick={() => updateQuery({
              from: preset.from === 1 ? null : String(preset.from),
              to: preset.to === 18 ? null : String(preset.to),
            })}
          >
            {preset.label}<small>W{preset.from}–{preset.to}</small>
          </button>
        ))}
      </div>

      <ToolDataStatus loading={loading} error={error} label="2025 defense-v-position results" />

      <div className="tool-summary-grid">
        <article><span>Schedule games</span><strong>{NFL_SCHEDULE_2026.length}</strong><small>2026 regular season</small></article>
        <article><span>Most favorable</span><strong>{mostFavorable?.team ?? "—"}</strong><small>{position} · Index {formatIndex(mostFavorable?.averageMatchupIndex ?? null)}</small></article>
        <article><span>Toughest stretch</span><strong>{toughest?.team ?? "—"}</strong><small>{position} · Index {formatIndex(toughest?.averageMatchupIndex ?? null)}</small></article>
        <article><span>Selected range</span><strong>W{start}–{end}</strong><small>{end - start + 1} weeks</small></article>
      </div>

      <div className="schedule-sort-row">
        <div><CalendarDays size={17} aria-hidden="true" /><span>{visibleRows.length} team schedules</span></div>
        <div className="tool-field is-inline">
          <span id="schedule-sort-label">Sort</span>
          <UniversalSelect aria-labelledby="schedule-sort-label" id="schedule-sort" value={sort} onValueChange={(value) => setSort(value as ScheduleSort)}>
            <option value="rank">Schedule rank</option>
            <option value="index">Matchup index</option>
            <option value="team">Team A–Z</option>
          </UniversalSelect>
        </div>
      </div>

      <div className="tool-table-shell schedule-table-shell">
        <table className="tool-table schedule-table">
          <caption className="sr-only">2026 {position} strength of schedule</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Index</th><th scope="col">Easy</th><th scope="col">Tough</th>
              {weeks.map((week) => <th scope="col" key={week}>W{week}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const matchupByWeek = new Map(row.matchups.map((matchup) => [matchup.week, matchup]));
              return (
                <tr key={row.id}>
                  <td><span className="tool-rank-pill">{row.rank}</span></td>
                  <th scope="row">{row.team}</th>
                  <td><strong>{formatIndex(row.averageMatchupIndex)}</strong></td>
                  <td>{row.favorableGames}</td><td>{row.toughGames}</td>
                  {weeks.map((week) => {
                    const matchup = matchupByWeek.get(week);
                    if (!matchup) return <td className="schedule-cell is-bye" key={week}>BYE</td>;
                    const tone = scheduleMatchupTone(matchup.matchupIndex);
                    return (
                      <td className={`schedule-cell is-${tone}`} key={week} title={`Week ${week}: ${matchup.venue === "home" ? "vs" : "at"} ${matchup.opponent}; index ${formatIndex(matchup.matchupIndex)}`}>
                        <strong>{matchup.venue === "away" ? "@" : ""}{matchup.opponent}</strong>
                        <span>{formatIndex(matchup.matchupIndex)}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="schedule-legend" aria-label="Matchup index legend">
        <span className="is-favorable">105+ favorable</span><span className="is-neutral">96–104 neutral</span><span className="is-tough">95 and below tough</span>
      </div>
    </ToolLayout>
  );
}
