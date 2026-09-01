import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Cloud, CloudOff, Info, Radio } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { buildCurrentToolPlayers } from "../data/toolPlayerData";
import { LeagueSeasonHero } from "../features/league-season/LeagueSeasonHero";
import { getLeagueProjectionFreshness, projectionFreshnessSummary } from "../features/league-season/leagueProjectionFreshness";
import {
  DEFAULT_REGULAR_SEASON_WEEKS,
  buildRoundRobinSchedule,
  projectAssignedLineup,
  projectFranchiseLineup,
  toolScoring,
  type ProjectedLineup,
} from "../features/league-season/leagueSeasonModel";
import { useLeagueSeasonDraft } from "../features/league-season/useLeagueSeasonDraft";
import { useLeagueSeasonManagement } from "../features/league-season/useLeagueSeasonManagement";
import { useLeagueWeekLineups } from "../features/league-season/useLeagueWeekLineups";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import { UniversalSelect } from "../ui/UniversalSelect";
import "./league-season.css";

function clampWeek(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(DEFAULT_REGULAR_SEASON_WEEKS, Math.max(1, Math.round(parsed))) : 1;
}

function formatProjection(lineup: ProjectedLineup) {
  return lineup.projectedStarterCount ? lineup.projectedTotal.toFixed(1) : "—";
}

function projectionCoverage(lineup: ProjectedLineup) {
  return `${lineup.projectedStarterCount}/${lineup.slots.length} projected starters`;
}

function topProjection(lineup: ProjectedLineup) {
  return lineup.slots
    .flatMap((slot) => slot.player ? [slot.player] : [])
    .filter((player) => player.baselinePoints !== null)
    .sort((left, right) => (right.baselinePoints ?? 0) - (left.baselinePoints ?? 0))[0] ?? null;
}

export default function LeagueMatchups({ personalOnly = false }: { personalOnly?: boolean }) {
  const { leagueId: routeLeagueId = "" } = useParams();
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const leagueId = routeLeagueId || activeLeagueId;
  const connection = connections.find((candidate) => candidate.leagueId === leagueId) ?? null;
  const draftState = useLeagueSeasonDraft(leagueId);
  const management = useLeagueSeasonManagement(leagueId);
  const [searchParams, setSearchParams] = useSearchParams();
  const week = clampWeek(searchParams.get("week"));
  const draftSeason = draftState.status === "ready" ? draftState.season : null;
  const season = management.record?.season ?? draftSeason;
  const weekLineups = useLeagueWeekLineups(leagueId, week, Boolean(management.record), management.record?.revision ?? 0);
  const players = useMemo(() => {
    if (!season) return [];
    const rosterSize = season.rosterSlots.reduce((sum, slot) => slot.slot === "IR" ? sum : sum + slot.count, 0);
    return buildCurrentToolPlayers(toolScoring(season.scoring), [], {
      budget: season.defaultBudget,
      teamCount: season.franchises.length,
      rosterSize,
      rosterSlots: season.rosterSlots,
    });
  }, [season]);
  const projectionFreshness = useMemo(() => getLeagueProjectionFreshness(players), [players]);
  const lineups = useMemo(() => {
    if (!season) return new Map<string, ProjectedLineup>();
    const savedByFranchise = new Map(weekLineups.lineups.map((lineup) => [lineup.franchiseId, lineup]));
    return new Map(season.franchises.map((franchise) => [
      franchise.id,
      savedByFranchise.has(franchise.id)
        ? projectAssignedLineup(franchise, season.rosterSlots, players, week, savedByFranchise.get(franchise.id)?.assignments)
        : projectFranchiseLineup(franchise, season.rosterSlots, players, week),
    ]));
  }, [players, season, week, weekLineups.lineups]);
  const matchups = useMemo(() => {
    if (!season) return [];
    const schedule = management.record?.schedule.length
      ? management.record.schedule
      : buildRoundRobinSchedule(season.franchises, DEFAULT_REGULAR_SEASON_WEEKS);
    const weeklyMatchups = schedule.filter((matchup) => matchup.week === week);
    const focusedFranchiseId = management.membership?.franchiseId || searchParams.get("team");
    return personalOnly && focusedFranchiseId
      ? weeklyMatchups.filter((matchup) => matchup.homeFranchiseId === focusedFranchiseId || matchup.awayFranchiseId === focusedFranchiseId)
      : weeklyMatchups;
  }, [management.membership?.franchiseId, management.record, personalOnly, searchParams, season, week]);
  const franchiseById = useMemo(
    () => new Map(season?.franchises.map((franchise) => [franchise.id, franchise]) ?? []),
    [season],
  );

  function changeWeek(nextWeek: number) {
    const next = new URLSearchParams(searchParams);
    next.set("week", String(Math.min(DEFAULT_REGULAR_SEASON_WEEKS, Math.max(1, nextWeek))));
    setSearchParams(next, { replace: true });
  }

  if (!season) {
    return (
      <div className="league-season-page league-season-gate">
        <div className="league-season-gate-content">
          <CalendarDays aria-hidden="true" />
          <span>League matchups</span>
          <h1 className="ff-display">{draftState.status === "loading" || management.status === "loading" ? "Building the matchup board…" : "Save a draft before scheduling matchups"}</h1>
          <p>{draftState.message || management.message}</p>
          {draftState.status !== "loading" ? <Link className="league-season-primary" to="/offline-draft">Open Offline Draft</Link> : null}
        </div>
      </div>
    );
  }

  const isPublished = Boolean(management.record);
  const sourceLabel = isPublished ? "Commissioner-published schedule" : season.source === "shared" ? "Shared draft preview" : "Local draft fallback";

  return (
    <div className="league-season-page">
      <LeagueSeasonHero
        variant="matchups"
        eyebrow={`${personalOnly ? "My matchup" : "Matchups"} · ${connection?.leagueName ?? "Active league"}`}
        title={`Week ${week} ${personalOnly ? "matchup" : "projection board"}`}
        description={personalOnly ? "Keep the active manager's opponent, lineup state, and weekly baseline in one focused view." : "Compare every team using saved manager lineups when available and legal projected starters everywhere else."}
        imagePath="images/league-season/matchup-night-v1.png"
        imageAlt="Rain falls across an empty night stadium with opposing sidelines facing the field."
        sourceIcon={isPublished || season.source === "shared" ? <Cloud aria-hidden="true" /> : <CloudOff aria-hidden="true" />}
        sourceLabel={sourceLabel}
        sourceDetail={isPublished ? `Season revision ${management.record?.revision}` : season.revision ? `Draft revision ${season.revision}` : "Saved on this device"}
      />

      <section className="league-week-toolbar" aria-label="Matchup week">
        <button type="button" onClick={() => changeWeek(week - 1)} disabled={week === 1} aria-label="Previous week"><ChevronLeft aria-hidden="true" /></button>
        <label>
          <span>League week</span>
          <UniversalSelect aria-label="League week" value={String(week)} onValueChange={(value) => changeWeek(Number(value))}>
            {Array.from({ length: DEFAULT_REGULAR_SEASON_WEEKS }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}
          </UniversalSelect>
        </label>
        <button type="button" onClick={() => changeWeek(week + 1)} disabled={week === DEFAULT_REGULAR_SEASON_WEEKS} aria-label="Next week"><ChevronRight aria-hidden="true" /></button>
        <div><CalendarDays aria-hidden="true" /><span>{matchups.length} matchups</span><small>{isPublished ? "Published schedule" : "Round-robin preview"}</small></div>
      </section>

      <div className="league-projection-note">
        <Info aria-hidden="true" />
        <p><strong>These are transparent preseason baselines, not live weekly scores.</strong> GameHQ uses saved manager lineups for {weekLineups.lineups.length} team{weekLineups.lineups.length === 1 ? "" : "s"} this week, fills unsaved teams with their best legal projected starters, and sets bye-week players to zero. Projection data: {projectionFreshnessSummary(projectionFreshness)}. {weekLineups.settings?.locked ? `Week ${week} lineups are locked.` : `Week ${week} lineups are open.`} {isPublished ? "The schedule is commissioner-published." : "The schedule remains a deterministic preview until the commissioner publishes the season."}</p>
      </div>

      <section className="league-matchup-list" aria-label={`Week ${week} matchups`}>
        {matchups.map((matchup, index) => {
          const home = franchiseById.get(matchup.homeFranchiseId)!;
          const away = franchiseById.get(matchup.awayFranchiseId)!;
          const homeLineup = lineups.get(home.id)!;
          const awayLineup = lineups.get(away.id)!;
          const homeTop = topProjection(homeLineup);
          const awayTop = topProjection(awayLineup);
          const difference = homeLineup.projectedTotal - awayLineup.projectedTotal;
          const leader = Math.abs(difference) < 0.05 ? null : difference > 0 ? home : away;
          const focusedTeam = searchParams.get("team");
          const isFocused = focusedTeam === home.id || focusedTeam === away.id;

          return (
            <article key={matchup.id} className={isFocused ? "is-focused" : ""}>
              <header><span><Radio aria-hidden="true" /> Matchup {index + 1}</span><small>{leader ? `${leader.displayName} baseline edge · ${Math.abs(difference).toFixed(1)}` : "Even baseline"}</small></header>
              <div className="league-matchup-scoreboard">
                <Link to={`/league/${encodeURIComponent(leagueId)}/teams/${away.id}`} className={leader?.id === away.id ? "is-projected-leader" : ""}>
                  <span>Away</span><strong>{away.displayName}</strong><small>{projectionCoverage(awayLineup)}</small>
                </Link>
                <div><b>{formatProjection(awayLineup)}</b><span>projected</span><b>{formatProjection(homeLineup)}</b></div>
                <Link to={`/league/${encodeURIComponent(leagueId)}/teams/${home.id}`} className={leader?.id === home.id ? "is-projected-leader" : ""}>
                  <span>Home</span><strong>{home.displayName}</strong><small>{projectionCoverage(homeLineup)}</small>
                </Link>
              </div>
              <footer>
                <span>{awayTop ? `${awayTop.name} · ${awayTop.baselinePoints?.toFixed(1)} baseline` : `${away.displayName} has no matched projections`}</span>
                <span>{homeTop ? `${homeTop.name} · ${homeTop.baselinePoints?.toFixed(1)} baseline` : `${home.displayName} has no matched projections`}</span>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
