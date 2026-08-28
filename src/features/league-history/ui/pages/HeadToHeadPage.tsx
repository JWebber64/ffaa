import { ArrowLeft, CalendarDays, Flame, Swords, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { UniversalSelect } from "../../../../ui/UniversalSelect";
import { calculateHeadToHead } from "../../analytics";
import type { HeadToHeadStats, LeagueHistorySnapshot } from "../../domain/types";
import { useLeagueHistorySnapshot } from "../historyContext";
import { formatNumber } from "../format";
import { leagueRivalryPath, resolveLeagueHistoryManagerId } from "../leagueRoutes";

type H2HScope = "all" | "regular" | "playoffs";

function filteredSnapshot(snapshot: LeagueHistorySnapshot, start: number, end: number, scope: H2HScope) {
  const seasonIds = new Set(snapshot.seasons.filter((season) => season.season >= start && season.season <= end).map((season) => season.id));
  return {
    ...snapshot,
    matchups: snapshot.matchups.filter((matchup) => seasonIds.has(matchup.leagueSeasonId)
      && (scope === "all" || (scope === "playoffs" ? matchup.isPlayoff : !matchup.isPlayoff))),
  };
}

function matrixRecord(stats: HeadToHeadStats | null, perspectiveA: boolean) {
  if (!stats) return "—";
  const wins = perspectiveA ? stats.winsA : stats.winsB;
  const losses = perspectiveA ? stats.winsB : stats.winsA;
  return `${wins}-${losses}${stats.ties ? `-${stats.ties}` : ""}`;
}

export function HeadToHeadMatrixPage() {
  const snapshot = useLeagueHistorySnapshot();
  const seasons = snapshot.seasons.map((season) => season.season).sort((left, right) => left - right);
  const [start, setStart] = useState(seasons[0] ?? 0);
  const [end, setEnd] = useState(seasons.at(-1) ?? 0);
  const [scope, setScope] = useState<H2HScope>("all");
  const filtered = useMemo(() => filteredSnapshot(snapshot, start, end, scope), [snapshot, start, end, scope]);
  const managers = [...snapshot.managers].sort((left, right) => left.displayName.localeCompare(right.displayName));

  return (
    <main className="history-content">
      <section className="history-page-heading history-page-heading-row">
        <div><span>All-time comparison</span><h2>Head-to-head matrix</h2><p>Tap any record to open every historical meeting between those managers.</p></div>
        <div className="history-filter-bar">
          <label><span>From</span><UniversalSelect value={String(start)} onValueChange={(value) => setStart(Number(value))}>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</UniversalSelect></label>
          <label><span>Through</span><UniversalSelect value={String(end)} onValueChange={(value) => setEnd(Number(value))}>{seasons.map((season) => <option key={season} value={season}>{season}</option>)}</UniversalSelect></label>
          <div className="history-segment" role="group" aria-label="Matchup scope">
            {(["all", "regular", "playoffs"] as H2HScope[]).map((value) => <button type="button" className={scope === value ? "is-active" : ""} onClick={() => setScope(value)} key={value}>{value}</button>)}
          </div>
        </div>
      </section>
      <section className="history-panel history-matrix-panel">
        <div className="history-table-wrap"><table className="history-h2h-matrix">
          <thead><tr><th>Manager</th>{managers.map((manager) => <th key={manager.id}><span>{manager.displayName}</span></th>)}</tr></thead>
          <tbody>{managers.map((rowManager) => <tr key={rowManager.id}>
            <th><Link to={`../managers/${rowManager.id}`}>{rowManager.displayName}</Link></th>
            {managers.map((columnManager) => {
              if (rowManager.id === columnManager.id) return <td className="is-self" key={columnManager.id}>—</td>;
              const sorted = [rowManager.id, columnManager.id].sort();
              const stats = calculateHeadToHead(filtered, sorted[0]!, sorted[1]!);
              const perspectiveA = rowManager.id === sorted[0];
              return <td key={columnManager.id}><Link title={`${rowManager.displayName} vs ${columnManager.displayName}: ${stats?.meetings.length ?? 0} meetings`} to={leagueRivalryPath(snapshot.league.currentExternalLeagueId, rowManager.id, columnManager.id)}>{matrixRecord(stats, perspectiveA)}<small>{stats?.meetings.length ?? 0}</small></Link></td>;
            })}
          </tr>)}</tbody>
        </table></div>
        <p className="history-table-note">Each cell is W-L-T from the row manager’s perspective. The small number is total meetings.</p>
      </section>
    </main>
  );
}

function rivalryLabels(snapshot: LeagueHistorySnapshot, managerAId: string, managerBId: string) {
  const comparisons = snapshot.managers
    .filter((manager) => manager.id !== managerAId)
    .map((manager) => calculateHeadToHead(snapshot, managerAId, manager.id))
    .filter((row): row is HeadToHeadStats => Boolean(row?.meetings.length));
  const target = comparisons.find((row) => row.managerB.id === managerBId);
  if (!target) return [];
  const labels: string[] = [];
  const differential = (row: HeadToHeadStats) => row.winsA - row.winsB;
  const nemesisValue = Math.min(...comparisons.map(differential));
  const favoriteValue = Math.max(...comparisons.map(differential));
  const mostMeetings = Math.max(...comparisons.map((row) => row.meetings.length));
  const mostPlayoffMeetings = Math.max(...comparisons.map((row) => row.playoffMeetings));
  if (differential(target) === nemesisValue && nemesisValue < 0) labels.push("Nemesis");
  if (differential(target) === favoriteValue && favoriteValue > 0) labels.push("Favorite Opponent");
  if (target.meetings.length === mostMeetings) labels.push("Most Frequent Rival");
  if (target.playoffMeetings > 0 && target.playoffMeetings === mostPlayoffMeetings) labels.push("Playoff Rival");
  return labels;
}

export function RivalryPage() {
  const snapshot = useLeagueHistorySnapshot();
  const { managerAId: managerARouteId = "", managerBId: managerBRouteId = "" } = useParams();
  const managerAId = resolveLeagueHistoryManagerId(snapshot.managers, managerARouteId);
  const managerBId = resolveLeagueHistoryManagerId(snapshot.managers, managerBRouteId);
  const stats = calculateHeadToHead(snapshot, managerAId, managerBId);
  if (!stats) return <main className="history-content"><div className="history-empty">Rivalry not found.</div></main>;
  const labels = rivalryLabels(snapshot, managerAId, managerBId);
  const meetingsBySeason = new Map<number, typeof stats.meetings>();
  for (const meeting of stats.meetings) meetingsBySeason.set(meeting.season, [...(meetingsBySeason.get(meeting.season) ?? []), meeting]);

  return (
    <main className="history-content">
      <Link className="history-back" to="../../h2h"><ArrowLeft size={14} /> H2H matrix</Link>
      <section className="history-rivalry-hero">
        <div><span>{stats.managerA.displayName}</span><strong>{stats.winsA}</strong><small>{formatNumber(stats.totalPointsA)} points</small></div>
        <div className="history-rivalry-mark"><Swords /><span>{stats.meetings.length} meetings</span><small>{stats.ties} ties</small></div>
        <div><span>{stats.managerB.displayName}</span><strong>{stats.winsB}</strong><small>{formatNumber(stats.totalPointsB)} points</small></div>
      </section>
      {labels.length ? <div className="history-label-row">{labels.map((label) => <span key={label}><Flame size={13} />{label}</span>)}</div> : null}

      <section className="history-stat-grid">
        <article><span>Regular season</span><strong>{stats.regularSeasonWinsA}-{stats.regularSeasonWinsB}</strong><small>{stats.meetings.length - stats.playoffMeetings} meetings</small></article>
        <article><span>Playoffs</span><strong>{stats.playoffWinsA}-{stats.playoffWinsB}</strong><small>{stats.playoffMeetings} meetings</small></article>
        <article><span>Championships</span><strong>{stats.championshipWinsA}-{stats.championshipWinsB}</strong><small>{stats.championshipMeetings} title games</small></article>
        <article><span>Point differential</span><strong>{stats.pointDifferential > 0 ? "+" : ""}{formatNumber(stats.pointDifferential)}</strong><small>{formatNumber(stats.averageMargin)} avg margin</small></article>
        <article><span>Current streak</span><strong>{stats.currentStreak.games || "—"}</strong><small>{snapshot.managers.find((manager) => manager.id === stats.currentStreak.managerId)?.displayName ?? "No active streak"}</small></article>
        <article><span>Longest streaks</span><strong>{stats.longestStreakA} / {stats.longestStreakB}</strong><small>{stats.managerA.displayName} / {stats.managerB.displayName}</small></article>
      </section>

      <section className="history-section-grid">
        <article className="history-panel">
          <header><div><span>Rivalry records</span><h2>Defining games</h2></div><Trophy /></header>
          <div className="history-rivalry-facts">
            <div><span>Biggest victory</span><strong>{formatNumber(stats.biggestVictory ? Math.abs(stats.biggestVictory.managerAScore - stats.biggestVictory.managerBScore) : null)}</strong><small>{stats.biggestVictory?.season} Week {stats.biggestVictory?.matchup.week}</small></div>
            <div><span>Closest game</span><strong>{formatNumber(stats.closestGame ? Math.abs(stats.closestGame.managerAScore - stats.closestGame.managerBScore) : null)}</strong><small>{stats.closestGame?.season} Week {stats.closestGame?.matchup.week}</small></div>
            <div><span>Highest combined</span><strong>{formatNumber(stats.highestScoringGame ? stats.highestScoringGame.managerAScore + stats.highestScoringGame.managerBScore : null)}</strong><small>{stats.highestScoringGame?.season}</small></div>
            <div><span>Season sweeps</span><strong>{stats.seasonSweepsA} / {stats.seasonSweepsB}</strong><small>{stats.managerA.displayName} / {stats.managerB.displayName}</small></div>
          </div>
        </article>
        <article className="history-panel">
          <header><div><span>Season by season</span><h2>Rivalry ledger</h2></div><CalendarDays /></header>
          <div className="history-season-rivalries">{[...meetingsBySeason.entries()].sort((a, b) => b[0] - a[0]).map(([season, meetings]) => {
            const aWins = meetings.filter((meeting) => meeting.winnerManagerId === stats.managerA.id).length;
            const bWins = meetings.filter((meeting) => meeting.winnerManagerId === stats.managerB.id).length;
            return <div key={season}><Link to={`../../seasons/${season}`}>{season}</Link><strong>{aWins}-{bWins}{meetings.length - aWins - bWins ? `-${meetings.length - aWins - bWins}` : ""}</strong><span>{meetings.length} meetings</span></div>;
          })}</div>
        </article>
      </section>

      <section className="history-panel">
        <header><div><span>Complete timeline</span><h2>Every historical meeting</h2></div><Swords /></header>
        <div className="history-meeting-list">{[...stats.meetings].reverse().map((meeting) => <article key={meeting.matchup.id}>
          <div><span>{meeting.season} · Week {meeting.matchup.week}</span>{meeting.matchup.isChampionship ? <small>Championship</small> : meeting.matchup.isPlayoff ? <small>Playoffs</small> : null}</div>
          <strong>{meeting.managerAFranchise.teamName} <b>{formatNumber(meeting.managerAScore)}</b></strong>
          <span>—</span>
          <strong><b>{formatNumber(meeting.managerBScore)}</b> {meeting.managerBFranchise.teamName}</strong>
          <Link to={`../../seasons/${meeting.season}`}>Season</Link>
        </article>)}</div>
      </section>
    </main>
  );
}
