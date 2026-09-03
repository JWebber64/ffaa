import { useMemo, useState } from "react";
import { Clock3, Gavel, ListChecks, RotateCcw, ShieldCheck, WalletCards } from "lucide-react";
import { List, type RowComponentProps } from "react-window";

import type { WaiverClaimAlternative, WaiverPlayerPosition } from "../../../shared/leagueCommandProtocol";
import { buildNativeDecisionRecommendations } from "../../../shared/nativeLeagueIntelligence";
import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { NumericInput } from "../../ui/NumericInput";
import { PositionBadge } from "../../ui/PositionBadge";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { acquireFreeAgentCommand, initializeWaiverPlayerPoolCommand, processWaiverRunCommand, submitWaiverClaimGroupCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, NativeWaiverPlayerState } from "../league-domain/types";
import { useLeaguePlayerSheet, type LeaguePlayerSheetRequest } from "../player-sheet/leaguePlayerSheetContext";
import { useNativeLineup } from "../native-lineup/useNativeLineup";
import { useNativeScoring } from "../native-scoring/useNativeScoring";
import { useNativeWaivers } from "./useNativeWaivers";
import "./native-waivers.css";

type Alternative = WaiverClaimAlternative & { id: string };
const NEW_ALTERNATIVE = (): Alternative => ({ id: crypto.randomUUID(), addPlayerId: "", dropPlayerId: "", bid: 0 });

function time(value: string, timezone: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Not scheduled";
  const leagueTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(parsed);
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!localTimezone || localTimezone === timezone) return leagueTime;
  const localTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  return `${leagueTime} league · ${localTime} local`;
}

function modeLabel(value: string) { return value.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()); }

type PlayerDirectoryEntry = ReturnType<typeof buildCurrentToolPlayers>[number];
type WaiverPlayerRowProps = {
  entries: NativeWaiverPlayerState[];
  directory: Map<string, PlayerDirectoryEntry>;
  leagueId: string;
  selectedTeamName: string;
  timezone: string;
  week: number;
  immediate: boolean;
  openPlayer: (request: LeaguePlayerSheetRequest) => void;
};

function WaiverPlayerRow({ index, style, entries, directory, leagueId, selectedTeamName, timezone, week, immediate, openPlayer }: RowComponentProps<WaiverPlayerRowProps>) {
  const entry = entries[index];
  if (!entry) return null;
  const player = directory.get(entry.playerId);
  return <div className="native-waiver-player" style={style}><div><PositionBadge position={entry.position} /><span><strong>{player?.name ?? entry.playerId}</strong><small>{player?.team || "FA"} · Rank {player?.rank ?? "—"}</small></span><button type="button" className="league-player-view" onClick={() => openPlayer({ playerId: entry.playerId, currentWeek: week, leagueState: entry.state, ownership: "Unrostered", rosterFit: `${entry.position} · ${selectedTeamName || "Choose a team"}`, actionLabel: immediate ? "Add from Players" : "Claim from Players", actionTo: `/league/${leagueId}/players` })}>View</button></div><strong>{entry.state === "on_waivers" ? "Waivers" : "Free agent"}</strong><small>{entry.droppedUntil ? time(entry.droppedUntil, timezone) : "Now"}</small></div>;
}

export function NativeWaiverWorkspace({ workspace }: { workspace: CanonicalLeagueWorkspace }) {
  const season = workspace.season!;
  const isCommissioner = workspace.authority.roles.some((role) => role === "commissioner" || role === "co_commissioner");
  const state = useNativeWaivers(workspace.league.id, season.id, season.settingsVersionId, workspace.membership?.userId ?? "", isCommissioner);
  const { openPlayer } = useLeaguePlayerSheet();
  const [teamId, setTeamId] = useState("");
  const [week, setWeek] = useState(1);
  const [riskPreference, setRiskPreference] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [alternatives, setAlternatives] = useState<Alternative[]>([NEW_ALTERNATIVE()]);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const directory = useMemo(() => new Map(buildCurrentToolPlayers("halfPpr").map((player) => [player.id, player])), []);
  const controlledIds = workspace.roleGrants.filter((grant) => ["team_owner", "co_manager"].includes(grant.role) && grant.franchiseId).map((grant) => grant.franchiseId!);
  const selectableTeams = isCommissioner ? state.teams : state.teams.filter((team) => controlledIds.includes(team.franchiseId));
  const selectedTeamId = selectableTeams.some((team) => team.franchiseId === teamId) ? teamId : selectableTeams[0]?.franchiseId ?? "";
  const selectedTeam = state.teams.find((team) => team.franchiseId === selectedTeamId) ?? null;
  const selectedTeamState = state.teamStates.find((team) => team.franchiseId === selectedTeamId) ?? null;
  const available = state.players.filter((player) => player.state === "free_agent" || player.state === "on_waivers").sort((left, right) => (directory.get(left.playerId)?.rank ?? 9999) - (directory.get(right.playerId)?.rank ?? 9999));
  const roster = selectedTeam?.rosterPlayerIds.map((playerId) => ({ playerId, state: state.players.find((player) => player.playerId === playerId), player: directory.get(playerId) })).sort((a, b) => (a.player?.name ?? a.playerId).localeCompare(b.player?.name ?? b.playerId)) ?? [];
  const visibleClaims = state.claims.filter((claim) => isCommissioner || claim.franchiseId === selectedTeamId).slice(0, 8);
  const visibleReceipts = state.receipts.filter((receipt) => isCommissioner || receipt.franchiseId === selectedTeamId).slice(0, 8);
  const mode = state.settings?.transactions.waiverMode ?? "faab";
  const immediate = mode === "first_come_first_served";
  const lineupState = useNativeLineup(workspace.league.id, season.id, season.settingsVersionId, week, workspace.league.timezone);
  const scoringState = useNativeScoring(workspace.league.id, season.id, week);
  const savedLineup = lineupState.lineups.find((row) => row.franchiseId === selectedTeamId && row.week === week);
  const matchup = scoringState.scoringWeek?.matchups.find((row) => [row.homeFranchiseId, row.awayFranchiseId].includes(selectedTeamId));
  const opponentProjection = matchup ? (matchup.homeFranchiseId === selectedTeamId ? matchup.awayProjectedFinal : matchup.homeProjectedFinal) : null;
  const recommendations = state.settings && selectedTeam && selectedTeamState ? buildNativeDecisionRecommendations({ settings: state.settings, franchiseId: selectedTeamId, week, rosterPlayerIds: selectedTeam.rosterPlayerIds, starterPlayerIds: Object.values(savedLineup?.assignments ?? {}), candidates: state.players.map((row) => { const player = directory.get(row.playerId); return { playerId: row.playerId, position: row.position, projectedPoints: player?.projectedPointsPerGame ?? player?.projectedPoints ?? 0, projectionLow: player?.projectionLow ?? null, projectionHigh: player?.projectionHigh ?? null, byeWeek: player?.byeWeek ?? null, ownerFranchiseId: row.ownerFranchiseId, state: row.state }; }), faabRemaining: selectedTeamState.faabRemaining, opponentProjectedFinal: opponentProjection, riskPreference }) : [];

  function updateAlternative(id: string, changes: Partial<Alternative>) { setAlternatives((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row)); }
  async function execute(action: string, task: () => Promise<{ result: Record<string, unknown> }>, success: string) {
    setPending(action); setNotice(null);
    try { await task(); setNotice({ tone: "status", text: success }); }
    catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "The waiver command failed." }); }
    finally { setPending(""); }
  }

  async function initialize() {
    const players = [...directory.values()].flatMap((player) => {
      const position = (player.position === "DEF" ? "DST" : player.position) as WaiverPlayerPosition;
      return ["QB", "RB", "WR", "TE", "K", "DST"].includes(position) ? [{ playerId: player.id, position }] : [];
    });
    await execute("initialize", () => initializeWaiverPlayerPoolCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { expectedWaiverStateRevision: state.waiverState?.revision ?? 0, players } }), `${players.length} player states reconciled with canonical rosters.`);
  }

  async function submit() {
    if (!selectedTeam || !state.settings || alternatives.some((row) => !row.addPlayerId)) { setNotice({ tone: "error", text: "Choose a team and an add player for every ordered alternative." }); return; }
    if (immediate) {
      const row = alternatives[0]!;
      await execute("submit", () => acquireFreeAgentCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { franchiseId: selectedTeam.franchiseId, week, expectedRosterRevision: selectedTeam.rosterRevision, settingsVersionId: season.settingsVersionId, addPlayerId: row.addPlayerId, dropPlayerId: row.dropPlayerId } }), `${directory.get(row.addPlayerId)?.name ?? row.addPlayerId} was acquired immediately.`);
      return;
    }
    await execute("submit", () => submitWaiverClaimGroupCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { franchiseId: selectedTeam.franchiseId, week, expectedRosterRevision: selectedTeam.rosterRevision, settingsVersionId: season.settingsVersionId, alternatives: alternatives.map(({ addPlayerId, dropPlayerId, bid }) => ({ addPlayerId, dropPlayerId, bid })) } }), `Ordered claim group submitted for ${time(state.waiverState?.nextProcessingAt ?? "", workspace.league.timezone)}.`);
    setAlternatives([NEW_ALTERNATIVE()]);
  }

  async function process() {
    if (!state.waiverState) return;
    await execute("process", () => processWaiverRunCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { week, expectedWaiverStateRevision: state.waiverState!.revision, processThrough: new Date().toISOString(), approvePendingReview: true } }), "The due waiver queue was processed atomically; receipts are now available.");
  }

  if (state.status === "loading") return <div className="native-waiver-state" role="status">Loading the native player market…</div>;
  if (state.status === "error") return <div className="native-waiver-state is-error" role="alert">{state.message}</div>;

  return (
    <div className="native-waiver-page">
      <header className="native-waiver-heading">
        <div><span>Native player market</span><h1>Free agents & waivers</h1><p>One canonical ownership ledger, server-locked rules, ordered claims, and a receipt for every result.</p></div>
        <div className="native-waiver-summary"><span><Gavel aria-hidden="true" /> {modeLabel(mode)}</span><strong>{state.waiverState ? `${state.waiverState.playerCount} players` : "Not initialized"}</strong><small>Next run {time(state.waiverState?.nextProcessingAt ?? "", workspace.league.timezone)}</small></div>
      </header>

      {state.waiverState && selectedTeam ? <section className="native-decision-engine" aria-labelledby="native-decision-title"><header><div><span>GameHQ decision engine</span><h2 id="native-decision-title">League-aware recommendations</h2><p>Read-only candidates use this league's published scoring, roster slots, ownership, waiver mode, FAAB, current lineup, opponent projection, bye exposure, and your stated risk preference.</p></div><label>Risk preference<UniversalSelect value={riskPreference} onValueChange={(value) => setRiskPreference(value as typeof riskPreference)}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></UniversalSelect></label></header>{recommendations.length ? <div>{recommendations.slice(0, 6).map((row) => { const player = directory.get(row.playerId); return <article key={row.id}><PositionBadge position={player?.position ?? ""} /><div><strong>{player?.name ?? row.playerId}</strong><small>{modeLabel(row.kind)} · {row.confidence} confidence · score {row.score.toFixed(1)}</small></div><p>{row.evidence.join(" ")}</p><small>{row.uncertainty.join(" ")}</small><button type="button" className="league-player-view" onClick={() => openPlayer({ playerId: row.playerId, currentWeek: week, leagueState: state.players.find((entry) => entry.playerId === row.playerId)?.state ?? "available", ownership: "Unrostered", rosterFit: row.evidence[0] ?? "League-aware roster fit", actionLabel: immediate ? "Review free-agent add" : "Review waiver claim", actionTo: `/league/${workspace.league.id}/players` })}>Review evidence</button></article>; })}</div> : <p className="native-decision-empty">No deterministic upgrade or bye collision clears the current roster baseline. Missing projection ranges lower confidence rather than inventing certainty.</p>}<footer><ShieldCheck aria-hidden="true" />No recommendation can submit a claim, edit a lineup, or change league state.</footer></section> : null}

      {!state.waiverState ? (
        <section className="native-waiver-empty"><ShieldCheck aria-hidden="true" /><div><h2>Establish canonical player states</h2><p>The commissioner initializes availability from the GameHQ pool while preserving every existing roster asset lock.</p></div>{isCommissioner ? <button type="button" className="btn primary" disabled={pending === "initialize"} onClick={() => void initialize()}>{pending === "initialize" ? "Reconciling…" : "Initialize player market"}</button> : <small>Waiting for a commissioner.</small>}</section>
      ) : (
        <>
          <section className="native-waiver-builder" aria-labelledby="native-waiver-builder-title">
            <header><div><span><ListChecks aria-hidden="true" /> Claim builder</span><h2 id="native-waiver-builder-title">{immediate ? "Acquire a free agent" : "Order conditional alternatives"}</h2></div><div className="native-waiver-team-meta"><strong><WalletCards aria-hidden="true" /> ${selectedTeamState?.faabRemaining ?? 0} FAAB</strong><small>Priority {selectedTeamState?.priority ?? "—"} · Week {week} adds {selectedTeamState?.weeklyAcquisitions[String(week)] ?? 0}</small></div></header>
            <div className="native-waiver-context">
              <label>Team<UniversalSelect value={selectedTeamId} onValueChange={setTeamId}>{selectableTeams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label>
              <label>Week<NumericInput aria-label="Waiver week" min={1} max={18} value={week} onChange={(event) => setWeek(Math.max(1, Math.min(18, Math.round(event.currentTarget.valueAsNumber || 1))))} /></label>
              <div><span>Rules snapshot</span><strong>{season.settingsVersionId}</strong><small>{state.settings?.transactions.weeklyAcquisitionLimit ? `${state.settings.transactions.weeklyAcquisitionLimit} adds per week` : "No weekly acquisition cap"}</small></div>
            </div>
            <div className="native-waiver-alternatives">
              {alternatives.map((row, index) => (
                <div className="native-waiver-alternative" key={row.id}>
                  <b>{index + 1}</b>
                  <label>Add player<UniversalSelect aria-label={`Alternative ${index + 1} add player`} value={row.addPlayerId} onValueChange={(value) => updateAlternative(row.id, { addPlayerId: value })}><option value="">Choose player</option>{available.map((entry) => { const player = directory.get(entry.playerId); return <option data-position={entry.position} key={entry.playerId} value={entry.playerId}>{player?.name ?? entry.playerId} · {entry.position} · {entry.state === "on_waivers" ? "Waivers" : "FA"}</option>; })}</UniversalSelect></label>
                  <label>Conditional drop<UniversalSelect aria-label={`Alternative ${index + 1} conditional drop`} value={row.dropPlayerId} onValueChange={(value) => updateAlternative(row.id, { dropPlayerId: value })}><option value="">No drop</option>{roster.map((entry) => <option data-position={entry.state?.position} key={entry.playerId} value={entry.playerId}>{entry.player?.name ?? entry.playerId} · {entry.state?.position ?? "Roster"}</option>)}</UniversalSelect></label>
                  {!immediate && mode === "faab" ? <label>Bid<NumericInput aria-label={`Alternative ${index + 1} FAAB bid`} min={state.settings?.transactions.allowZeroDollarBids ? 0 : 1} max={selectedTeamState?.faabRemaining ?? 0} value={row.bid} onChange={(event) => updateAlternative(row.id, { bid: Math.max(0, Math.round(event.currentTarget.valueAsNumber || 0)) })} /></label> : null}
                  {alternatives.length > 1 ? <button type="button" className="native-waiver-remove" aria-label={`Remove alternative ${index + 1}`} onClick={() => setAlternatives((current) => current.filter((entry) => entry.id !== row.id))}>Remove</button> : null}
                </div>
              ))}
            </div>
            <footer><p><ShieldCheck aria-hidden="true" /> The server rechecks ownership, FAAB, roster size, position limits, weekly limits, and the exact published settings before processing.</p><div>{!immediate && alternatives.length < 12 ? <button type="button" className="btn" onClick={() => setAlternatives((current) => [...current, NEW_ALTERNATIVE()])}>Add fallback</button> : null}<button type="button" className="btn primary" disabled={pending === "submit" || !selectedTeamId} onClick={() => void submit()}>{pending === "submit" ? "Submitting…" : immediate ? "Add free agent" : "Submit claim group"}</button></div></footer>
          </section>

          {notice ? <div className={`native-waiver-notice is-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div> : null}

          <div className="native-waiver-grid">
            <section className="native-waiver-market" aria-labelledby="native-market-title"><header><div><span>Availability</span><h2 id="native-market-title">Player market</h2></div><small>{available.length} claimable</small></header><div className="native-waiver-player-head" aria-hidden="true"><span>Player</span><span>Status</span><span>Eligible</span></div><List className="native-waiver-player-list" defaultHeight={Math.min(420, Math.max(64, available.length * 64))} rowComponent={WaiverPlayerRow} rowCount={available.length} rowHeight={64} rowProps={{ entries: available, directory, leagueId: workspace.league.id, selectedTeamName: selectedTeam?.name ?? "", timezone: workspace.league.timezone, week, immediate, openPlayer }} style={{ height: Math.min(420, Math.max(64, available.length * 64)) }} /></section>
            <aside className="native-waiver-queue"><header><div><span>Claims & outcomes</span><h2>Transaction receipts</h2></div>{isCommissioner && !immediate ? <button type="button" className="btn" disabled={pending === "process"} onClick={() => void process()}><RotateCcw aria-hidden="true" /> {pending === "process" ? "Processing…" : "Process due claims"}</button> : null}</header>{visibleClaims.map((claim) => <article key={claim.id}><div><strong>{claim.status.replace(/_/gu, " ")}</strong><small><Clock3 aria-hidden="true" /> {time(claim.processAt, workspace.league.timezone)}</small></div><p>{claim.alternatives.map((row) => `${row.order}. ${directory.get(row.addPlayerId)?.name ?? row.addPlayerId}${mode === "faab" ? ` $${row.bid}` : ""}`).join(" · ")}</p>{claim.failures.length ? <small>{claim.failures.join(" ")}</small> : null}</article>)}{visibleReceipts.map((receipt) => <article className={`is-${receipt.status}`} key={receipt.id}><div><strong>{receipt.status === "won" ? `Won ${directory.get(receipt.addPlayerId)?.name ?? receipt.addPlayerId}` : "Claim failed"}</strong><small>{time(receipt.processedAt, workspace.league.timezone)}</small></div><p>{receipt.winningBid === null ? "No award" : `$${receipt.winningBid} winning bid · $${receipt.remainingFaab} remaining · priority ${receipt.priorityBefore} → ${receipt.priorityAfter}`}</p>{receipt.failures.length ? <small>{receipt.failures.join(" ")}</small> : null}</article>)}{!visibleClaims.length && !visibleReceipts.length ? <div className="native-waiver-queue-empty">No claims or receipts for this team yet.</div> : null}</aside>
          </div>
        </>
      )}
    </div>
  );
}
