import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Info, Radio } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { buildCurrentToolPlayers, type ToolPlayer } from "../data/toolPlayerData";
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
import type { MyHQData, MyHQLineupEntry } from "../features/my-hq/myHQ";
import { useOptionalLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { PositionBadge } from "../ui/PositionBadge";
import { UniversalSelect } from "../ui/UniversalSelect";
import "./league-season.css";
import { NativeLiveMatchupWorkspace } from "../features/native-scoring/NativeLiveMatchupWorkspace";

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

function formatLiveScore(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

function formatPlayerBaseline(player: ToolPlayer | null) {
  return player?.projectedPointsPerGame === null || !player ? "—" : player.projectedPointsPerGame.toFixed(1);
}

function MatchupPlayerSide({ player, side }: { player: ToolPlayer | null; side: "left" | "right" }) {
  const detail = player
    ? [player.position, player.team || "FA", player.byeWeek ? `Bye ${player.byeWeek}` : "", player.injuryStatus || ""].filter(Boolean).join(" · ")
    : "No player assigned";
  return (
    <div className={`league-h2h-player is-${side}`}>
      <div><strong>{player?.name ?? "Open slot"}</strong><small>{detail}</small></div>
      <b>{formatPlayerBaseline(player)}<small>PPG</small></b>
    </div>
  );
}

function MatchupLineupRows({ left, right, bench = false }: { left: MyHQLineupEntry[]; right: MyHQLineupEntry[]; bench?: boolean }) {
  const rowCount = Math.max(left.length, right.length);
  if (!rowCount) return null;
  return (
    <div className="league-h2h-rows" role="rowgroup" aria-label={bench ? "Bench" : "Starters"}>
      {Array.from({ length: rowCount }, (_, index) => {
        const leftEntry = left[index];
        const rightEntry = right[index];
        const slot = leftEntry?.slot ?? rightEntry?.slot ?? (bench ? `BN${index + 1}` : "FLEX");
        return (
          <div className={`league-h2h-row ${bench ? "is-bench" : ""}`} role="row" key={`${slot}-${index}`}>
            <MatchupPlayerSide player={leftEntry?.player ?? null} side="left" />
            <PositionBadge className="league-position" position={slot}>{bench ? "BN" : slot.replace(/_/g, " ")}</PositionBadge>
            <MatchupPlayerSide player={rightEntry?.player ?? null} side="right" />
          </div>
        );
      })}
    </div>
  );
}

function ConnectedTeamMatchup({ data }: { data: MyHQData }) {
  const leftBench = data.bench.map((player, index): MyHQLineupEntry => ({ slot: `BN${index + 1}`, player }));
  const rightBench = data.opponentBench.map((player, index): MyHQLineupEntry => ({ slot: `BN${index + 1}`, player }));
  const hasOpponent = data.opponentProviderUserId || data.opponentStarterLineup.length || data.opponentName !== "Opponent not set";
  return (
    <div className="league-season-page league-personal-matchup">
      <header className="league-compact-page-heading">
        <div><span>My matchup · {data.leagueName}</span><h1>{data.week ? `Week ${data.week}` : "Next matchup"}</h1></div>
        <small>Current Sleeper rosters · season baselines</small>
      </header>

      <section className="league-head-to-head" aria-label={`${data.teamName} versus ${data.opponentName}`}>
        <header className="league-h2h-teams">
          <div className="is-left"><span>Your team</span><strong>{data.teamName}</strong><small>{data.record} · {data.teamBaselinePoints?.toFixed(1) ?? "—"} baseline</small><b>{formatLiveScore(data.teamScore)}</b></div>
          <span className="league-h2h-versus" aria-hidden="true">VS</span>
          <div className="is-right"><span>Opponent</span><strong>{data.opponentName}</strong><small>{data.opponentRecord} · {data.opponentBaselinePoints?.toFixed(1) ?? "—"} baseline</small><b>{formatLiveScore(data.opponentScore)}</b></div>
        </header>

        {hasOpponent ? (
          <>
            <div className="league-h2h-section-label"><span>Starters</span><small>Season baseline PPG</small></div>
            <MatchupLineupRows left={data.starterLineup} right={data.opponentStarterLineup} />
            {(leftBench.length || rightBench.length) ? <div className="league-h2h-section-label"><span>Bench</span><small>Roster depth</small></div> : null}
            <MatchupLineupRows left={leftBench} right={rightBench} bench />
          </>
        ) : <div className="league-h2h-empty">Sleeper has not assigned an opponent for this week yet.</div>}
      </section>

      <div className="league-projection-note">
        <Info aria-hidden="true" />
        <p><strong>Scores come from the current Sleeper matchup.</strong> {data.projectionNote}</p>
      </div>
    </div>
  );
}

function LeagueScheduleMatchups({ personalOnly = false }: { personalOnly?: boolean }) {
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
      <header className="league-compact-page-heading">
        <div>
          <span>{personalOnly ? "My matchup" : "Matchups"} · {connection?.leagueName ?? "Active league"}</span>
          <h1>Week {week} {personalOnly ? "matchup" : "matchups"}</h1>
        </div>
        <small>{sourceLabel} · {isPublished ? `season revision ${management.record?.revision}` : season.revision ? `draft revision ${season.revision}` : "saved on this device"}</small>
      </header>

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

export default function LeagueMatchups({ personalOnly = false }: { personalOnly?: boolean }) {
  const workspace = useOptionalLeagueWorkspace();
  if (workspace?.canonicalWorkspace?.league.authorityMode === "native" && workspace.canonicalWorkspace.season) {
    return <NativeLiveMatchupWorkspace workspace={workspace.canonicalWorkspace} personalOnly={personalOnly} />;
  }
  if (personalOnly && workspace) {
    if (workspace.teamState.status === "ready") return <ConnectedTeamMatchup data={workspace.teamState.data} />;
    return (
      <div className="league-season-page">
        <div className={`league-compact-state ${workspace.teamState.status === "error" ? "is-error" : ""}`} aria-busy={workspace.teamState.status !== "error"}>
          <CalendarDays aria-hidden="true" />
          <div><span>My matchup</span><h1>{workspace.teamState.status === "error" ? "Matchup unavailable" : "Loading both lineups…"}</h1><p>{workspace.teamState.status === "error" ? workspace.teamState.error : "Reading the active manager, opponent, and current Sleeper rosters."}</p></div>
        </div>
      </div>
    );
  }
  return <LeagueScheduleMatchups personalOnly={personalOnly} />;
}
