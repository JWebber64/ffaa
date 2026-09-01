import { History, Medal, RefreshCw, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Button } from "../../../../ui/Button";
import {
  buildStandingsThroughWeek,
  buildWeeklyMatchups,
  getCompletedWeekOptions,
  getDefaultCompletedWeek,
  getWeekNeighbors,
} from "../../analytics/weeklyWorkspace";
import { useLeagueWeek } from "../../useLeagueWeek";
import { formatNumber } from "../format";
import { useLeagueHistorySnapshot } from "../historyContext";
import { DecisionLab } from "../week/DecisionLab";
import { WeekHeader } from "../week/WeekHeader";
import { WeeklyAwards } from "../week/WeeklyAwards";
import { WeeklyScoreboard } from "../week/WeeklyScoreboard";
import { WeeklyStandings } from "../week/WeeklyStandings";

export function WeekPage() {
  const snapshot = useLeagueHistorySnapshot();
  const { leagueId = snapshot.league.currentExternalLeagueId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useMemo(() => getCompletedWeekOptions(snapshot), [snapshot]);
  const fallback = useMemo(() => getDefaultCompletedWeek(snapshot), [snapshot]);
  const requestedSeason = Number(searchParams.get("season"));
  const requestedWeek = Number(searchParams.get("week"));
  const selected = options.find((option) => option.season === requestedSeason && option.week === requestedWeek) ?? fallback;
  useEffect(() => {
    if (!selected) return;
    if (requestedSeason === selected.season && requestedWeek === selected.week) return;
    setSearchParams({ season: String(selected.season), week: String(selected.week) }, { replace: true });
  }, [requestedSeason, requestedWeek, selected, setSearchParams]);

  const selectedSeason = snapshot.seasons.find((season) => season.season === selected?.season) ?? null;
  const weekState = useLeagueWeek(snapshot, selected?.season ?? null, selected?.week ?? null);
  const matchups = useMemo(() => selectedSeason && selected
    ? buildWeeklyMatchups(snapshot, selectedSeason, selected.week)
    : [], [selected, selectedSeason, snapshot]);
  const standings = useMemo(() => selectedSeason && selected
    ? buildStandingsThroughWeek(snapshot, selectedSeason, selected.week)
    : [], [selected, selectedSeason, snapshot]);
  const neighbors = selected ? getWeekNeighbors(snapshot, selected.season, selected.week) : { previous: null, next: null };

  if (!selected || !selectedSeason) {
    return (
      <main className="history-content">
        <div className="history-week-empty history-week-empty-page">
          <History size={28} aria-hidden="true" />
          <strong>No completed league weeks are available</strong>
          <span>Preseason placeholders and incomplete matchups are excluded from the weekly workspace.</span>
          <Link className="history-action-link" to={`/league/${leagueId}/history/seasons`}>Open season archive</Link>
        </div>
      </main>
    );
  }

  const chooseSeason = (season: number) => {
    const latest = options.filter((option) => option.season === season).at(-1);
    if (latest) setSearchParams({ season: String(latest.season), week: String(latest.week) });
  };
  const chooseWeek = (week: number) => setSearchParams({ season: String(selected.season), week: String(week) });
  const payload = weekState.data?.season === selected.season && weekState.data.week === selected.week ? weekState.data : null;

  return (
    <main className="history-content history-week-page">
      <WeekHeader
        leagueId={leagueId}
        leagueName={snapshot.league.name}
        loading={weekState.status === "loading"}
        next={neighbors.next}
        onSeasonChange={chooseSeason}
        onWeekChange={chooseWeek}
        options={options}
        previous={neighbors.previous}
        season={selected.season}
        source={payload?.source ?? "Sleeper source"}
        status={payload?.status ?? "loading"}
        week={selected.week}
      />

      {weekState.status === "error" ? (
        <section className="history-week-notice" data-status="error" role="alert">
          <div><strong>Weekly data could not be loaded</strong><span>{weekState.error}</span></div>
          <Button onClick={weekState.refresh} size="sm"><RefreshCw size={14} aria-hidden="true" /> Try again</Button>
        </section>
      ) : null}
      {weekState.status === "loading" && !payload ? (
        <section className="history-week-loading" aria-busy="true" aria-label="Loading weekly lineups and awards">
          <span /><span /><span />
        </section>
      ) : null}
      {payload?.status === "empty" ? (
        <section className="history-week-empty">
          <strong>No completed data for this week</strong>
          <span>This view will not use zero-point preseason placeholders as historical results.</span>
        </section>
      ) : null}
      {payload?.status === "partial" ? (
        <section className="history-week-notice" data-status="partial">
          <strong>Partial weekly source data</strong>
          <span>Available facts are shown, but lineup analytics may be unavailable for affected managers.</span>
        </section>
      ) : null}

      {payload && payload.status !== "empty" ? (
        <>
          <WeeklyScoreboard leagueId={leagueId} matchups={matchups} />
          <WeeklyAwards awards={payload.awards} leagueId={leagueId} matchups={matchups} snapshot={snapshot} />
          <DecisionLab leagueId={leagueId} matchups={matchups} payload={payload} season={selectedSeason} snapshot={snapshot} />
          <section className="history-week-section" aria-labelledby="week-moments-title">
            <header className="history-week-section-heading">
              <div><span>Permanent League History</span><h2 id="week-moments-title">Week records &amp; moments</h2></div>
              <Sparkles size={20} aria-hidden="true" />
            </header>
            {payload.moments.length ? (
              <div className="history-week-moments">
                {payload.moments.map((moment) => (
                  <article key={moment.sourceKey || moment.id}>
                    <span>{moment.momentType.replace(/_/g, " ")}</span>
                    <h3>{moment.title}</h3>
                    <p>{moment.description}</p>
                    <footer><small>GameHQ derived · {moment.calculationVersion}</small>{moment.newValue == null ? null : <strong>{formatNumber(moment.newValue, 2)}</strong>}</footer>
                  </article>
                ))}
              </div>
            ) : <div className="history-week-empty"><strong>No permanent moments triggered</strong><span>This completed week did not cross a configured factual milestone.</span></div>}
          </section>
          <WeeklyStandings leagueId={leagueId} standings={standings} />
        </>
      ) : null}

      <nav className="history-week-footer-nav" aria-label="League week destinations">
        {neighbors.previous ? <Link to={`/league/${leagueId}/history/week?season=${neighbors.previous.season}&week=${neighbors.previous.week}`}>Previous completed week</Link> : <span aria-disabled="true">Previous completed week</span>}
        {neighbors.next ? <Link to={`/league/${leagueId}/history/week?season=${neighbors.next.season}&week=${neighbors.next.week}`}>Next completed week</Link> : <span aria-disabled="true">Next completed week</span>}
        <Link to={`/league/${leagueId}/history/seasons`}><History size={14} aria-hidden="true" /> Season archive</Link>
        <Link to={`/league/${leagueId}/history/records`}><Medal size={14} aria-hidden="true" /> Records</Link>
        <Link to={`/league/${leagueId}/history/h2h`}><Swords size={14} aria-hidden="true" /> H2H matrix</Link>
      </nav>
    </main>
  );
}
