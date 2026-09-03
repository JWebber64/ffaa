import { useMemo, useState } from "react";
import { Activity, Clock3, Radio, RefreshCw, ShieldAlert, Trophy } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import type { NativeScoringEventInput, NativeScoringMatchupInput, NativeScoringStatistic } from "../../../shared/leagueCommandProtocol";
import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { ingestScoringEventsCommand, recalculateScoringWeekCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, NativeScoringMatchup } from "../league-domain/types";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { useNativeScoring } from "./useNativeScoring";
import "./native-scoring.css";

const STATISTICS: Array<{ value: NativeScoringStatistic; label: string }> = [
  { value: "passing_yards", label: "Passing yards" }, { value: "passing_touchdowns", label: "Passing touchdowns" },
  { value: "interceptions", label: "Interceptions" }, { value: "rushing_yards", label: "Rushing yards" },
  { value: "rushing_touchdowns", label: "Rushing touchdowns" }, { value: "receiving_yards", label: "Receiving yards" },
  { value: "receptions", label: "Receptions" }, { value: "receiving_touchdowns", label: "Receiving touchdowns" },
];

function formatScore(value: number) { return value.toFixed(2); }
function localToIso(value: string) { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString(); }
function formatTime(value: string, timezone: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone: timezone }).format(time) : "No provider timestamp";
}

function defaultPairings(teamIds: string[]): NativeScoringMatchupInput[] {
  return Array.from({ length: Math.floor(teamIds.length / 2) }, (_, index) => ({
    matchupId: `matchup-${index + 1}`,
    awayFranchiseId: teamIds[index * 2] ?? "",
    homeFranchiseId: teamIds[index * 2 + 1] ?? "",
  }));
}

export function NativeLiveMatchupWorkspace({ workspace, personalOnly }: { workspace: CanonicalLeagueWorkspace; personalOnly: boolean }) {
  const season = workspace.season!;
  const [searchParams, setSearchParams] = useSearchParams();
  const week = Math.max(1, Math.min(18, Math.round(Number(searchParams.get("week")) || 1)));
  const state = useNativeScoring(workspace.league.id, season.id, week);
  const [pairingOverrides, setPairingOverrides] = useState<NativeScoringMatchupInput[]>([]);
  const [selectedMatchupId, setSelectedMatchupId] = useState("");
  const [providerEventId, setProviderEventId] = useState("");
  const [nflGameId, setNflGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [statistic, setStatistic] = useState<NativeScoringStatistic>("receiving_yards");
  const [statValue, setStatValue] = useState(0);
  const [description, setDescription] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState("");
  const [reason, setReason] = useState("");
  const [gameStatus, setGameStatus] = useState<"scheduled" | "in_progress" | "final" | "postponed" | "canceled">("in_progress");
  const [eventTime, setEventTime] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const directory = useMemo(() => new Map(buildCurrentToolPlayers("halfPpr").map((player) => [player.id, player])), []);
  const teamById = useMemo(() => new Map(state.teams.map((team) => [team.franchiseId, team])), [state.teams]);
  const allPlayerIds = useMemo(() => [...new Set(state.teams.flatMap((team) => team.rosterPlayerIds))].sort((left, right) => (directory.get(left)?.name ?? left).localeCompare(directory.get(right)?.name ?? right)), [directory, state.teams]);
  const managedTeamId = workspace.roleGrants.find((grant) => ["team_owner", "co_manager"].includes(grant.role) && grant.franchiseId)?.franchiseId ?? "";
  const isCommissioner = workspace.authority.roles.some((role) => role === "commissioner" || role === "co_commissioner");
  const publishedPairings = useMemo(() => {
    const published = state.scoringWeek?.matchups.map((matchup) => ({ matchupId: matchup.matchupId, homeFranchiseId: matchup.homeFranchiseId, awayFranchiseId: matchup.awayFranchiseId })) ?? [];
    return published.length ? published : defaultPairings(state.teams.map((team) => team.franchiseId));
  }, [state.scoringWeek?.matchups, state.teams]);
  const pairings = pairingOverrides.length ? pairingOverrides : publishedPairings;

  const visibleMatchups = useMemo(() => personalOnly && managedTeamId
    ? state.scoringWeek?.matchups.filter((matchup) => matchup.homeFranchiseId === managedTeamId || matchup.awayFranchiseId === managedTeamId) ?? []
    : state.scoringWeek?.matchups ?? [], [managedTeamId, personalOnly, state.scoringWeek]);
  const selected = visibleMatchups.find((matchup) => matchup.matchupId === selectedMatchupId) ?? visibleMatchups[0] ?? null;
  const lineupByTeam = new Map(state.scoringWeek?.lineupTotals.map((lineup) => [lineup.franchiseId, lineup]) ?? []);

  function changeWeek(nextWeek: number) {
    const next = new URLSearchParams(searchParams); next.set("week", String(Math.max(1, Math.min(18, nextWeek)))); setSearchParams(next, { replace: true });
  }

  async function ingest(events: NativeScoringEventInput[], action: string) {
    setPending(action); setMessage(null);
    try {
      const now = eventTime ? localToIso(eventTime) : new Date().toISOString();
      const receipt = await ingestScoringEventsCommand({
        leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, ...(reason ? { reason } : {}),
        payload: {
          week, expectedScoringWeekRevision: state.scoringWeek?.revision ?? 0, providerKey: "manual-fixture",
          fallbackProviderKey: "approved-fallback", providerState: "live", ingestionVersion: "gamehq-normalizer-v1",
          matchups: pairings, gameStatuses: nflGameId ? [{ nflGameId, status: gameStatus }] : [], events: events.map((event) => ({ ...event, providerTimestamp: now, occurredAt: now })),
        },
      });
      setMessage({ tone: "status", text: `Week ${week} scoring accepted at revision ${receipt.resultingRevision}.` });
      if (events.length) { setProviderEventId(""); setDescription(""); setCorrectionTarget(""); setReason(""); }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The scoring command failed." });
    } finally { setPending(""); }
  }

  async function addEvent() {
    if (!providerEventId || !playerId || !nflGameId) { setMessage({ tone: "error", text: "Provider event ID, player, and NFL game are required." }); return; }
    await ingest([{ providerEventId, providerTimestamp: "", occurredAt: "", playerId, nflGameId, statistics: [{ statistic, value: statValue }], description: description || `${statValue} ${STATISTICS.find((row) => row.value === statistic)?.label.toLowerCase()}`, ...(correctionTarget ? { correctionOfProviderEventId: correctionTarget } : {}) }], "event");
  }

  async function replay() {
    setPending("replay"); setMessage(null);
    try {
      const receipt = await recalculateScoringWeekCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { week, expectedScoringWeekRevision: state.scoringWeek?.revision ?? 0 }, reason: reason || `Replay Week ${week} scoring from normalized events` });
      setMessage({ tone: "status", text: `Replay completed at scoring revision ${receipt.resultingRevision}.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Scoring replay failed." }); }
    finally { setPending(""); }
  }

  if (state.status === "loading") return <section className="native-scoring-gate" aria-busy="true"><Activity aria-hidden="true" /><h1>Loading live scoring…</h1><p>{state.message}</p></section>;
  if (state.status === "error") return <section className="native-scoring-gate is-error"><ShieldAlert aria-hidden="true" /><h1>Live scoring unavailable</h1><p>{state.message}</p></section>;

  return <div className="native-scoring-workspace">
    <header className="native-scoring-page-header"><div><span className="hq-kicker">Native matchup · {workspace.league.name}</span><h1>Week {week} live scoring</h1><p>Replayable provider events scored against settings version {state.scoringWeek?.scoringRuleVersionId || season.settingsVersionId}.</p></div><div className={`native-scoring-freshness is-${state.scoringWeek?.freshness.state ?? "stale"}`}><Radio aria-hidden="true" /><strong>{state.scoringWeek?.freshness.state ?? "not started"}</strong><small>{state.scoringWeek?.freshness.message ?? "No scoring slate has been published."}</small></div></header>
    <section className="native-scoring-toolbar" aria-label="Live scoring week and matchup"><button type="button" onClick={() => changeWeek(week - 1)} disabled={week === 1}>Previous week</button><label><span>Week</span><UniversalSelect aria-label="Live scoring week" value={week} onValueChange={(value) => changeWeek(Number(value))}>{Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</UniversalSelect></label>{visibleMatchups.length > 1 ? <label><span>Matchup</span><UniversalSelect aria-label="Live matchup" value={selected?.matchupId ?? ""} onValueChange={setSelectedMatchupId}>{visibleMatchups.map((matchup) => <option key={matchup.matchupId} value={matchup.matchupId}>{teamById.get(matchup.awayFranchiseId)?.name ?? matchup.awayFranchiseId} at {teamById.get(matchup.homeFranchiseId)?.name ?? matchup.homeFranchiseId}</option>)}</UniversalSelect></label> : null}<button type="button" onClick={() => changeWeek(week + 1)} disabled={week === 18}>Next week</button></section>
    {state.scoringWeek?.cachedLastKnownScore ? <div className="native-scoring-alert"><Clock3 aria-hidden="true" /><div><strong>Cached last-known score</strong><span>{state.scoringWeek.freshness.message} Last provider event: {formatTime(state.scoringWeek.lastProviderTimestamp, workspace.league.timezone)}.</span></div></div> : null}
    {selected ? <MatchupBoard matchup={selected} teamById={teamById} lineupByTeam={lineupByTeam} scoringWeek={state.scoringWeek!} directory={directory} /> : <section className="native-scoring-empty"><Trophy aria-hidden="true" /><h2>No Week {week} scoring slate</h2><p>A commissioner can publish the team pairings below. Until then, GameHQ will not present projection baselines as live scores.</p></section>}
    {isCommissioner ? <section className="native-scoring-commissioner" aria-labelledby="native-scoring-control-title"><header><div><span>Commissioner scoring control</span><h2 id="native-scoring-control-title">Provider-neutral event ingress</h2></div><small>Every change is audited and replayed from the normalized ledger.</small></header>
      <div className="native-scoring-pairings">{pairings.map((pairing, index) => <div key={pairing.matchupId}><strong>Matchup {index + 1}</strong><UniversalSelect aria-label={`Matchup ${index + 1} away team`} value={pairing.awayFranchiseId} onValueChange={(value) => setPairingOverrides(pairings.map((row) => row.matchupId === pairing.matchupId ? { ...row, awayFranchiseId: value } : row))}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect><span>at</span><UniversalSelect aria-label={`Matchup ${index + 1} home team`} value={pairing.homeFranchiseId} onValueChange={(value) => setPairingOverrides(pairings.map((row) => row.matchupId === pairing.matchupId ? { ...row, homeFranchiseId: value } : row))}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></div>)}</div>
      <div className="native-scoring-ingress"><label><span>Provider event ID</span><input value={providerEventId} onChange={(event) => setProviderEventId(event.target.value)} /></label><label><span>Player</span><UniversalSelect aria-label="Scoring event player" value={playerId} onValueChange={setPlayerId}><option value="">Choose player</option>{allPlayerIds.map((id) => <option key={id} value={id}>{directory.get(id)?.name ?? id}</option>)}</UniversalSelect></label><label><span>NFL game ID</span><input value={nflGameId} onChange={(event) => setNflGameId(event.target.value)} /></label><label><span>Game state</span><UniversalSelect aria-label="Scoring game state" value={gameStatus} onValueChange={(value) => setGameStatus(value as typeof gameStatus)}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="final">Final</option><option value="postponed">Postponed</option><option value="canceled">Canceled</option></UniversalSelect></label><label><span>Normalized statistic</span><UniversalSelect aria-label="Normalized scoring statistic" value={statistic} onValueChange={(value) => setStatistic(value as NativeScoringStatistic)}>{STATISTICS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}</UniversalSelect></label><label><span>Stat value</span><NumericInput value={statValue} step={0.1} onChange={(event) => setStatValue(Number(event.target.value))} /></label><label><span>Play description</span><input value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} /></label><label><span>Provider event time · browser time</span><input type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label><label><span>Correct provider event ID</span><input value={correctionTarget} onChange={(event) => setCorrectionTarget(event.target.value)} /></label><label><span>Audit reason for correction/replay</span><input value={reason} maxLength={240} onChange={(event) => setReason(event.target.value)} /></label></div>
      {message ? <p className={`native-scoring-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
      <div className="native-scoring-actions"><button type="button" disabled={Boolean(pending) || !pairings.length} onClick={() => void ingest([], "slate")}>{pending === "slate" ? "Publishing…" : "Publish scoring slate"}</button><button type="button" disabled={Boolean(pending)} onClick={() => void addEvent()}>{pending === "event" ? "Scoring…" : "Ingest event"}</button><button type="button" disabled={Boolean(pending) || !state.scoringWeek} onClick={() => void replay()}><RefreshCw aria-hidden="true" />{pending === "replay" ? "Replaying…" : "Full replay"}</button></div>
    </section> : null}
  </div>;
}

function MatchupBoard({ matchup, teamById, lineupByTeam, scoringWeek, directory }: { matchup: NativeScoringMatchup; teamById: Map<string, { name: string }>; lineupByTeam: Map<string, { benchPoints: number; optimalScore: number; optimalDelta: number }>; scoringWeek: NonNullable<ReturnType<typeof useNativeScoring>["scoringWeek"]>; directory: Map<string, { name: string }> }) {
  const away = lineupByTeam.get(matchup.awayFranchiseId); const home = lineupByTeam.get(matchup.homeFranchiseId);
  const probability = (value: number) => `${Math.round(value * 100)}%`;
  return <>
    <section className="native-live-score" aria-label={`${teamById.get(matchup.awayFranchiseId)?.name} at ${teamById.get(matchup.homeFranchiseId)?.name}`}><div><span>Away</span><strong>{teamById.get(matchup.awayFranchiseId)?.name ?? matchup.awayFranchiseId}</strong><b>{formatScore(matchup.awayScore)}</b><small>{probability(matchup.awayWinProbability)} win probability · {formatScore(matchup.awayProjectedFinal)} projected</small></div><span className="native-live-state">{scoringWeek.activeNflGameIds.length ? <><Radio aria-hidden="true" />Live</> : "Projected"}</span><div><span>Home</span><strong>{teamById.get(matchup.homeFranchiseId)?.name ?? matchup.homeFranchiseId}</strong><b>{formatScore(matchup.homeScore)}</b><small>{probability(matchup.homeWinProbability)} win probability · {formatScore(matchup.homeProjectedFinal)} projected</small></div></section>
    <section className="native-scoring-metrics" aria-label="Matchup live details"><div><span>Players remaining</span><strong>{matchup.playersRemaining}</strong></div><div><span>Points remaining</span><strong>{formatScore(matchup.pointsRemaining)}</strong></div><div><span>Active NFL games</span><strong>{scoringWeek.activeNflGameIds.length}</strong></div><div><span>Top active performer</span><strong>{scoringWeek.topActivePerformer ? `${directory.get(scoringWeek.topActivePerformer.playerId)?.name ?? scoringWeek.topActivePerformer.playerId} · ${formatScore(scoringWeek.topActivePerformer.points)}` : "None"}</strong></div><div><span>Away bench / optimal</span><strong>{formatScore(away?.benchPoints ?? 0)} / {formatScore(away?.optimalScore ?? 0)}</strong></div><div><span>Home bench / optimal</span><strong>{formatScore(home?.benchPoints ?? 0)} / {formatScore(home?.optimalScore ?? 0)}</strong></div></section>
    {scoringWeek.statCorrectionState === "corrected" ? <div className="native-scoring-correction"><ShieldAlert aria-hidden="true" /><strong>{scoringWeek.correctionCount} audited stat correction{scoringWeek.correctionCount === 1 ? "" : "s"}</strong><span>All affected player, matchup, and projected-standing totals were replayed.</span></div> : null}
    <div className="native-scoring-detail-grid"><section aria-labelledby="native-feed-title"><header><div><span>Fantasy scoring plays</span><h2 id="native-feed-title">Calculation feed</h2></div><small>{scoringWeek.eventCount} active events</small></header>{scoringWeek.scoringFeed.length ? <ol>{scoringWeek.scoringFeed.map((event) => <li key={event.eventKey}><div><strong>{event.description}</strong><span>{directory.get(event.playerId)?.name ?? event.playerId} · {event.explanations.join(" · ")}</span></div><b className={event.fantasyPointDelta < 0 ? "is-negative" : ""}>{event.fantasyPointDelta >= 0 ? "+" : ""}{formatScore(event.fantasyPointDelta)}</b>{event.corrected ? <em>Corrected</em> : null}</li>)}</ol> : <p>No fantasy scoring events have arrived.</p>}</section><section aria-labelledby="native-lead-title"><header><div><span>Lead chronology</span><h2 id="native-lead-title">Lead changes</h2></div><small>Deterministic event order</small></header>{scoringWeek.leadChanges.filter((row) => row.matchupId === matchup.matchupId).length ? <ol>{scoringWeek.leadChanges.filter((row) => row.matchupId === matchup.matchupId).map((row) => <li key={`${row.eventKey}-${row.occurredAt}`}><div><strong>{row.leaderFranchiseId === "tie" ? "Score tied" : `${teamById.get(row.leaderFranchiseId)?.name ?? row.leaderFranchiseId} took the lead`}</strong><span>{formatScore(row.awayScore)} – {formatScore(row.homeScore)}</span></div></li>)}</ol> : <p>No lead change has been recorded.</p>}</section></div>
  </>;
}
