import { useMemo, useState } from "react";
import { Activity, CalendarClock, CheckCircle2, CircleAlert, ShieldCheck, Swords, Users } from "lucide-react";
import { Link } from "react-router-dom";

import type { LeagueSettingsV1 } from "../../../shared/leagueSettings";
import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { useNativeCompetition } from "../native-competition/useNativeCompetition";
import { useNativeDraft } from "../native-draft/useNativeDraft";
import { useNativeLineup } from "../native-lineup/useNativeLineup";
import { useNativeScoring } from "../native-scoring/useNativeScoring";
import { useNativeTrades } from "../native-trades/useNativeTrades";
import { useNativeWaivers } from "../native-waivers/useNativeWaivers";
import "./native-league-home.css";

type QueueItem = { id: string; state: "warning" | "live" | "clear"; title: string; detail: string; label: string; to: string };
function starters(settings: LeagueSettingsV1 | null) { return settings?.rosterSlots.filter((slot) => !["BENCH", "IR"].includes(slot.slot)).reduce((sum, slot) => sum + slot.count, 0) ?? 0; }
function isLineupLegal(settings: LeagueSettingsV1 | null, assignments: Record<string, string>, players: Array<{ playerId: string; position: string }>) {
  if (!settings) return false;
  const slots = settings.rosterSlots.flatMap((row) => ["BENCH", "IR"].includes(row.slot) ? [] : Array.from({ length: row.count }, (_, index) => ({ key: `${row.slot}-${index + 1}`, slot: row.slot, eligible: row.eligible })));
  const playerById = new Map(players.map((player) => [player.playerId, player]));
  const selectedIds = Object.values(assignments);
  return slots.length > 0
    && selectedIds.length === slots.length
    && new Set(selectedIds).size === selectedIds.length
    && slots.every((slot) => {
      const playerId = assignments[slot.key];
      const player = playerId ? playerById.get(playerId) : undefined;
      const position = player?.position === "DEF" ? "DST" : player?.position;
      return Boolean(position && (position === slot.slot || slot.eligible.includes(position as typeof slot.slot)));
    });
}
function formatTime(value: string, timezone: string) { const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) return "Not scheduled"; try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(timestamp); } catch { return new Date(timestamp).toLocaleString(); } }

export function NativeLeagueHomeWorkspace({ workspace }: { workspace: CanonicalLeagueWorkspace }) {
  const [renderedAt] = useState(() => Date.now());
  const season = workspace.season!; const leagueId = workspace.league.id; const base = `/league/${leagueId}`;
  const isCommissioner = workspace.authority.canManage;
  const competition = useNativeCompetition(leagueId, season.id, season.settingsVersionId);
  const draft = useNativeDraft(leagueId, season.id, season.draftId ?? "");
  const waiver = useNativeWaivers(leagueId, season.id, season.settingsVersionId, workspace.membership?.userId ?? "", isCommissioner);
  const trades = useNativeTrades(leagueId, season.id, season.settingsVersionId);
  const completedIds = useMemo(() => new Set(competition.results.map((result) => result.gameId)), [competition.results]);
  const currentWeek = competition.schedule?.games.find((game) => game.awayFranchiseId && !completedIds.has(game.id))?.week ?? Math.min(competition.settings?.schedule.regularSeasonWeeks ?? 1, Math.max(1, Math.max(0, ...competition.results.map((result) => result.week)) + 1));
  const lineup = useNativeLineup(leagueId, season.id, season.settingsVersionId, currentWeek, workspace.league.timezone);
  const scoring = useNativeScoring(leagueId, season.id, currentWeek);
  const controlledId = workspace.roleGrants.find((grant) => ["team_owner", "co_manager"].includes(grant.role) && grant.franchiseId && !grant.revokedAt)?.franchiseId ?? "";
  const team = competition.teams.find((entry) => entry.franchiseId === controlledId) ?? null;
  const savedLineup = lineup.lineups.find((entry) => entry.week === currentWeek && entry.franchiseId === controlledId) ?? null;
  const starterCount = starters(competition.settings); const selectedIds = Object.values(savedLineup?.assignments ?? {}); const lineupLegal = isLineupLegal(competition.settings, savedLineup?.assignments ?? {}, lineup.week?.players ?? []);
  const scheduledGame = competition.schedule?.games.find((game) => game.week === currentWeek && game.awayFranchiseId && [game.homeFranchiseId, game.awayFranchiseId].includes(controlledId)) ?? null;
  const opponentId = scheduledGame ? (scheduledGame.homeFranchiseId === controlledId ? scheduledGame.awayFranchiseId : scheduledGame.homeFranchiseId) : null;
  const opponent = competition.teams.find((entry) => entry.franchiseId === opponentId) ?? null;
  const matchup = scoring.scoringWeek?.matchups.find((entry) => [entry.homeFranchiseId, entry.awayFranchiseId].includes(controlledId)) ?? null;
  const teamScore = matchup ? (matchup.homeFranchiseId === controlledId ? matchup.homeScore : matchup.awayScore) : null; const opponentScore = matchup ? (matchup.homeFranchiseId === controlledId ? matchup.awayScore : matchup.homeScore) : null;
  const standing = competition.standings?.rows.find((row) => row.franchiseId === controlledId) ?? null;
  const injuryRows = lineup.week?.players.filter((player) => team?.rosterPlayerIds.includes(player.playerId) && ["questionable", "doubtful", "inactive", "out", "ir"].includes(player.availability)) ?? [];
  const pendingOffer = trades.offers.find((offer) => offer.toFranchiseId === controlledId && offer.status === "sent");
  const queue: QueueItem[] = [];
  if (!team) queue.push({ id: "team", state: "warning", title: "Team access is not assigned", detail: isCommissioner ? "Assign yourself or another manager to a franchise before setting a lineup." : "A commissioner must grant this account a team-owner or co-manager role.", label: isCommissioner ? "Manage people" : "View teams", to: isCommissioner ? `${base}/commissioner/people` : `${base}/teams` });
  if (!competition.schedule) queue.push({ id: "schedule", state: "warning", title: "The regular-season schedule is not published", detail: isCommissioner ? "Generate the deterministic schedule from the active rules and team list." : "Your commissioner must publish a native schedule before matchups begin.", label: isCommissioner ? "Build schedule" : "Open schedule", to: `${base}/schedule` });
  if (team && !lineup.week) queue.push({ id: "week", state: "warning", title: `Week ${currentWeek} game states are missing`, detail: isCommissioner ? "Publish kickoff groups so player-level locks and deadlines are authoritative." : "The commissioner has not published official player kickoff states.", label: isCommissioner ? "Publish week" : "Review lineup", to: `${base}/team?week=${currentWeek}` });
  if (team && !lineupLegal) queue.push({ id: "lineup", state: "warning", title: savedLineup ? "Your saved lineup is not legal" : "Your lineup is not saved", detail: `${selectedIds.length} of ${starterCount} unique starter slots are filled for Week ${currentWeek}.`, label: "Set lineup", to: `${base}/team?week=${currentWeek}` });
  if (pendingOffer) queue.push({ id: "trade", state: "live", title: "A trade offer needs your response", detail: `${competition.teams.find((entry) => entry.franchiseId === pendingOffer.fromFranchiseId)?.name ?? "Another team"} sent an offer that expires ${formatTime(pendingOffer.expiresAt, workspace.league.timezone)}.`, label: "Review trade", to: `${base}/transactions` });
  if (!queue.length) queue.push({ id: "clear", state: "clear", title: "No required action", detail: `Week ${currentWeek} league state is synchronized and your saved lineup is legal.`, label: "View matchup", to: `${base}/matchup?week=${currentWeek}` });
  const deadlines = [
    ...(lineup.week?.players.filter((player) => team?.rosterPlayerIds.includes(player.playerId)).map((player) => ({ time: player.scheduledStartAt, label: `${player.nflTeam} player lock` })) ?? []),
    ...(waiver.waiverState?.nextProcessingAt ? [{ time: waiver.waiverState.nextProcessingAt, label: "Waiver processing" }] : []),
    ...trades.offers.filter((offer) => offer.status === "sent").map((offer) => ({ time: offer.expiresAt, label: "Trade offer expiry" })),
  ].filter((row) => Date.parse(row.time) > renderedAt).sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  const recent = [
    ...trades.receipts.slice(0, 3).map((receipt) => ({ time: receipt.processedAt, text: `${competition.teams.find((entry) => entry.franchiseId === receipt.fromFranchiseId)?.name ?? "Team"} and ${competition.teams.find((entry) => entry.franchiseId === receipt.toFranchiseId)?.name ?? "Team"} completed a trade.` })),
    ...waiver.receipts.slice(0, 3).map((receipt) => ({ time: receipt.processedAt, text: receipt.status === "won" ? `${competition.teams.find((entry) => entry.franchiseId === receipt.franchiseId)?.name ?? "Team"} won a waiver claim.` : "A waiver claim was not awarded." })),
    ...competition.results.slice(-3).map((result) => ({ time: result.updatedAt, text: `Week ${result.week}: ${competition.teams.find((entry) => entry.franchiseId === result.homeFranchiseId)?.name ?? "Home"} ${result.homeScore}–${result.awayScore} ${competition.teams.find((entry) => entry.franchiseId === result.awayFranchiseId)?.name ?? "Away"}.` })),
  ].sort((left, right) => Date.parse(right.time) - Date.parse(left.time)).slice(0, 6);
  const lastUpdated = [competition.schedule?.updatedAt, competition.standings?.updatedAt, scoring.scoringWeek?.updatedAt, waiver.waiverState?.updatedAt].filter(Boolean).sort().at(-1) ?? "";

  return <main className="native-ops-home">
    <header className="native-ops-status"><div><span>Week {currentWeek} · {season.phase.replace(/_/gu, " ")}</span><h1>{team?.name ?? workspace.league.name}</h1><p>{workspace.league.name} · {workspace.authority.label}</p></div><dl><div><dt>Opponent</dt><dd>{opponent?.name ?? (scheduledGame ? "Bye" : "Not scheduled")}</dd></div><div><dt>Lineup</dt><dd className={lineupLegal ? "is-clear" : "is-warning"}>{lineupLegal ? "Legal" : "Needs attention"}</dd></div><div><dt>Next deadline</dt><dd>{deadlines[0] ? formatTime(deadlines[0].time, workspace.league.timezone) : "None published"}</dd></div><div><dt>Updated</dt><dd>{lastUpdated ? formatTime(lastUpdated, workspace.league.timezone) : "Awaiting data"}</dd></div></dl></header>
    <section className="native-ops-actions" aria-labelledby="native-action-title"><header><div><span>Action queue</span><h2 id="native-action-title">What requires your attention</h2></div><strong>{queue.filter((item) => item.state !== "clear").length} open</strong></header><div>{queue.map((item) => <article className={`is-${item.state}`} key={item.id}>{item.state === "clear" ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}<div><strong>{item.title}</strong><p>{item.detail}</p></div><Link to={item.to}>{item.label}</Link></article>)}</div></section>
    <div className="native-ops-primary"><section className="native-ops-matchup"><header><div><span>My matchup</span><h2>Week {currentWeek}</h2></div><Swords aria-hidden="true" /></header><div><strong>{team?.name ?? "Your team"}</strong><b>{teamScore === null ? "—" : teamScore.toFixed(2)}</b><i>vs</i><b>{opponentScore === null ? "—" : opponentScore.toFixed(2)}</b><strong>{opponent?.name ?? "Opponent pending"}</strong></div><footer><span>{matchup ? `${Math.round((matchup.homeFranchiseId === controlledId ? matchup.homeWinProbability : matchup.awayWinProbability) * 100)}% win probability` : "Scoring slate not started"}</span><Link to={`${base}/matchup?week=${currentWeek}`}>Open matchup</Link></footer></section>
    <section className="native-ops-pulse"><header><div><span>League pulse</span><h2>Recent activity</h2></div><Activity aria-hidden="true" /></header>{recent.length ? <ol>{recent.map((row, index) => <li key={`${row.time}-${index}`}><span>{row.text}</span><small>{formatTime(row.time, workspace.league.timezone)}</small></li>)}</ol> : <p>No completed native activity has been recorded yet.</p>}</section></div>
    <div className="native-ops-secondary"><section><header><Users aria-hidden="true" /><div><span>Roster health</span><h2>{team?.rosterPlayerIds.length ?? 0} rostered players</h2></div></header><dl><div><dt>Starter slots</dt><dd>{selectedIds.length} / {starterCount}</dd></div><div><dt>Availability alerts</dt><dd className={injuryRows.length ? "is-warning" : "is-clear"}>{injuryRows.length}</dd></div><div><dt>Draft</dt><dd>{draft.draft?.status ?? "Not configured"}</dd></div><div><dt>Pending claims</dt><dd>{waiver.claims.filter((claim) => claim.franchiseId === controlledId && claim.status === "pending").length}</dd></div></dl><Link to={`${base}/team?week=${currentWeek}`}>Review roster and lineup</Link></section><section><header><ShieldCheck aria-hidden="true" /><div><span>Playoff race</span><h2>{standing ? `Seed ${standing.seed}` : "Standings pending"}</h2></div></header><dl><div><dt>Overall</dt><dd>{standing ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}` : "—"}</dd></div><div><dt>Points for</dt><dd>{standing?.pointsFor.toFixed(1) ?? "—"}</dd></div><div><dt>Playoff probability</dt><dd>{standing ? `${Math.round(standing.playoffProbability * 100)}%` : "—"}</dd></div><div><dt>State</dt><dd>{standing?.state ?? "Awaiting results"}</dd></div></dl><Link to={`${base}/standings`}>Open standings</Link></section><section><header><CalendarClock aria-hidden="true" /><div><span>Upcoming deadlines</span><h2>{deadlines.length} scheduled</h2></div></header>{deadlines.length ? <ol>{deadlines.slice(0, 4).map((row) => <li key={`${row.time}-${row.label}`}><strong>{row.label}</strong><small>{formatTime(row.time, workspace.league.timezone)}</small></li>)}</ol> : <p>No future player lock, waiver run, or trade expiry is published.</p>}</section></div>
  </main>;
}
