import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Link } from "react-router-dom";

import { UniversalSelect } from "../../../../ui/UniversalSelect";
import type { CompletedWeekOption } from "../../analytics/weeklyWorkspace";

export function WeekHeader({
  leagueId,
  leagueName,
  season,
  week,
  status,
  source,
  loading,
  options,
  previous,
  next,
  onSeasonChange,
  onWeekChange,
}: {
  leagueId: string;
  leagueName: string;
  season: number;
  week: number;
  status: string;
  source: string;
  loading: boolean;
  options: CompletedWeekOption[];
  previous: CompletedWeekOption | null;
  next: CompletedWeekOption | null;
  onSeasonChange: (season: number) => void;
  onWeekChange: (week: number) => void;
}) {
  const seasons = [...new Set(options.map((option) => option.season))].sort((left, right) => right - left);
  const weeks = options.filter((option) => option.season === season).map((option) => option.week).sort((left, right) => left - right);
  const weekUrl = (option: CompletedWeekOption) => `/league/${leagueId}/history/week?season=${option.season}&week=${option.week}`;
  return (
    <section className="history-week-hero" aria-labelledby="history-week-title">
      <div className="history-week-hero-copy">
        <span className="history-kicker"><CalendarDays size={14} aria-hidden="true" /> This Week</span>
        <h2 id="history-week-title">{leagueName} · {season} Week {week}</h2>
        <div className="history-week-badges" aria-live="polite">
          <span data-status={status}>{loading ? "Loading week" : status}</span>
          <span><Database size={13} aria-hidden="true" /> {source}</span>
          <span>GameHQ derived lineup analytics</span>
        </div>
      </div>
      <div className="history-week-controls">
        <div className="history-week-selectors">
          <label>
            <span>Season</span>
            <UniversalSelect aria-label="Select season" onValueChange={(value) => onSeasonChange(Number(value))} value={String(season)}>
              {seasons.map((value) => <option key={value} value={value}>{value}</option>)}
            </UniversalSelect>
          </label>
          <label>
            <span>Week</span>
            <UniversalSelect aria-label="Select completed week" onValueChange={(value) => onWeekChange(Number(value))} value={String(week)}>
              {weeks.map((value) => <option key={value} value={value}>Week {value}</option>)}
            </UniversalSelect>
          </label>
        </div>
        <div className="history-week-stepper" aria-label="Completed week navigation">
          {previous ? <Link to={weekUrl(previous)}><ChevronLeft size={15} aria-hidden="true" /> Previous</Link> : <span aria-disabled="true"><ChevronLeft size={15} aria-hidden="true" /> Previous</span>}
          {next ? <Link to={weekUrl(next)}>Next <ChevronRight size={15} aria-hidden="true" /></Link> : <span aria-disabled="true">Next <ChevronRight size={15} aria-hidden="true" /></span>}
        </div>
        <div className="history-week-primary-links">
          <Link to={`/league/${leagueId}`}><ArrowLeft size={14} aria-hidden="true" /> League Home</Link>
          <Link to={`/league/${leagueId}/history/seasons`}>Season archive</Link>
        </div>
      </div>
    </section>
  );
}
