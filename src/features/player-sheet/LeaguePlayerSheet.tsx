import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Clock3, Newspaper, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";

import { NFL_SCHEDULE_2026, scheduleOpponent } from "../../data/nflSchedule";
import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { PositionBadge } from "../../ui/PositionBadge";
import { PlayerSheetContext, type LeaguePlayerSheetRequest } from "./leaguePlayerSheetContext";
import "./league-player-sheet.css";

function readable(value: string) { return value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()); }
function points(value: number | null | undefined) { return value === null || value === undefined ? "—" : value.toFixed(1); }

export function LeaguePlayerSheetProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LeaguePlayerSheetRequest | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const players = useMemo(() => buildCurrentToolPlayers("halfPpr"), []);
  const player = request ? players.find((entry) => entry.id === request.playerId || entry.sleeperId === request.playerId) ?? null : null;

  function openPlayer(next: LeaguePlayerSheetRequest) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequest(next);
  }
  function closePlayer() {
    setRequest(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!request) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePlayer(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request]);

  const currentWeek = Math.max(1, request?.currentWeek ?? 1);
  const schedule = player ? NFL_SCHEDULE_2026.filter((game) => [game.homeTeam, game.awayTeam].includes(player.team) && game.week >= currentWeek).slice(0, 4) : [];
  const recentRows = player?.summary?.weeklyRows.slice(-5).reverse() ?? [];
  const sources = player?.valueSources.filter((source) => source.kind === "projection") ?? [];

  return <PlayerSheetContext.Provider value={{ openPlayer, closePlayer }}>
    {children}
    {request ? <div className="league-player-sheet-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePlayer(); }}><aside className="league-player-sheet" role="dialog" aria-modal="true" aria-labelledby="league-player-sheet-title"><header><div><PositionBadge position={player?.position ?? request.playerId.split("-")[1] ?? ""} /><span>{player?.team || "League player"}</span><h2 id="league-player-sheet-title">{player?.name ?? readable(request.playerId.replace(/^\d{4}-[A-Z]+-/u, ""))}</h2></div><button type="button" ref={closeRef} onClick={closePlayer} aria-label="Close player details"><X aria-hidden="true" /></button></header><div className="league-player-sheet-body">
      <section aria-labelledby="player-profile-heading"><header><span>Profile</span><h3 id="player-profile-heading">Role & availability</h3></header><dl><div><dt>Position</dt><dd>{player?.position ?? "—"}</dd></div><div><dt>NFL team</dt><dd>{player?.team || "Free agent"}</dd></div><div><dt>Status</dt><dd>{player?.injuryStatus || player?.status || "No designation"}</dd></div><div><dt>Bye</dt><dd>{player?.byeWeek ? `Week ${player.byeWeek}` : "—"}</dd></div></dl></section>
      <section aria-labelledby="player-news-heading"><header><Newspaper aria-hidden="true" /><div><span>News</span><h3 id="player-news-heading">Verified status snapshot</h3></div></header><p>{player?.injuryStatus ? `${player.name} carries a ${player.injuryStatus} designation in the current player data.` : "No injury or availability alert is present in the current player data."}</p><small>Last projection refresh: {player?.projectionUpdatedAt ? new Date(player.projectionUpdatedAt).toLocaleString() : "not published"}. Temporary source outages preserve this last-known snapshot.</small></section>
      <section aria-labelledby="player-projection-heading"><header><span>Projection</span><h3 id="player-projection-heading">Source range</h3></header><dl><div><dt>Season</dt><dd>{points(player?.projectedPoints)}</dd></div><div><dt>Per game</dt><dd>{points(player?.projectedPointsPerGame)}</dd></div><div><dt>Low / high</dt><dd>{points(player?.projectionLow)} / {points(player?.projectionHigh)}</dd></div><div><dt>Sources</dt><dd>{player?.projectionSourceCount ?? sources.length}</dd></div></dl><p>{sources.length ? sources.map((source) => source.source).join(" · ") : "No named projection source is attached to this player snapshot."}</p></section>
      <section aria-labelledby="player-schedule-heading"><header><CalendarDays aria-hidden="true" /><div><span>Matchup & schedule</span><h3 id="player-schedule-heading">Next four games</h3></div></header>{schedule.length ? <ol>{schedule.map((game) => <li key={game.id}><span>Week {game.week}</span><strong>{game.awayTeam === player?.team ? "at" : "vs"} {scheduleOpponent(game, player?.team ?? "")}</strong><small>{game.gameday || "Date pending"}</small></li>)}</ol> : <p>No remaining 2026 regular-season matchup is available for this NFL team.</p>}</section>
      <section aria-labelledby="player-log-heading"><header><Clock3 aria-hidden="true" /><div><span>Game log</span><h3 id="player-log-heading">Recent fantasy production</h3></div></header>{recentRows.length ? <ol>{recentRows.map((row) => <li key={`${row.season}-${row.week}-${row.gameId}`}><span>Week {row.week}</span><strong>{points(row.selectedFantasyPoints)} points</strong><small>{row.team} vs {row.opponent}</small></li>)}</ol> : <p>No completed weekly game log is stored for this player.</p>}</section>
      <section aria-labelledby="player-league-heading"><header><ShieldCheck aria-hidden="true" /><div><span>League context</span><h3 id="player-league-heading">Ownership & fit</h3></div></header><dl><div><dt>State</dt><dd>{request.leagueState ? readable(request.leagueState) : "View only"}</dd></div><div><dt>Ownership</dt><dd>{request.ownership || "Not supplied by this view"}</dd></div><div><dt>Roster fit</dt><dd>{request.rosterFit || `${player?.position ?? "Player"} eligibility`}</dd></div></dl>{request.actionLabel && request.actionTo ? <Link className="league-player-sheet-action" to={request.actionTo} onClick={closePlayer}>{request.actionLabel}</Link> : request.actionLabel ? <strong className="league-player-sheet-action is-static">{request.actionLabel}</strong> : null}</section>
    </div></aside></div> : null}
  </PlayerSheetContext.Provider>;
}
