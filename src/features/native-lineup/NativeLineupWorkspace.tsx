import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";

import type { LineupGameStatus, LineupPlayerAvailability, LineupWeekPlayerInput } from "../../../shared/leagueCommandProtocol";
import type { LeagueRosterSlot, LeagueSettingsV1 } from "../../../shared/leagueSettings";
import { buildCurrentToolPlayers, type ToolPlayer } from "../../data/toolPlayerData";
import { configureLineupWeekCommand, saveWeeklyLineupCommand, setLineupLockOverrideCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, NativeLineupWeekPlayer, SeasonTeam } from "../league-domain/types";
import { useLeaguePlayerSheet } from "../player-sheet/leaguePlayerSheetContext";
import { PositionBadge } from "../../ui/PositionBadge";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { getNativePlayerLock } from "./nativeLineup";
import { useNativeLineup } from "./useNativeLineup";
import "./native-lineup.css";

type SlotDefinition = { key: string; slot: LeagueRosterSlot; eligible: LeagueRosterSlot[] };
type KickoffGroup = { id: string; label: string; teamCodes: string; originalStart: string; scheduledStart: string; actualStart: string; status: LineupGameStatus };

function slotDefinitions(settings: LeagueSettingsV1): SlotDefinition[] {
  return settings.rosterSlots.flatMap((row) => ["BENCH", "IR"].includes(row.slot) ? [] : Array.from({ length: row.count }, (_, index) => ({ key: `${row.slot}-${index + 1}`, slot: row.slot, eligible: row.eligible })));
}

function eligible(position: string, slot: SlotDefinition) {
  const normalized = position === "DEF" ? "DST" : position;
  return slot.slot === normalized || slot.eligible.includes(normalized as LeagueRosterSlot);
}

function playerName(playerId: string, directory: Map<string, ToolPlayer>) {
  return directory.get(playerId)?.name ?? playerId.replace(/^\d{4}-[A-Z]+-/u, "").replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function optimize(team: SeasonTeam, settings: LeagueSettingsV1, weekPlayers: NativeLineupWeekPlayer[]) {
  const byId = new Map(weekPlayers.map((player) => [player.playerId, player]));
  const used = new Set<string>();
  return Object.fromEntries(slotDefinitions(settings).flatMap((slot) => {
    const selected = team.rosterPlayerIds
      .map((id) => byId.get(id))
      .filter((player): player is NativeLineupWeekPlayer => Boolean(player) && !used.has(player!.playerId) && eligible(player!.position, slot) && !["inactive", "out", "ir"].includes(player!.availability))
      .sort((left, right) => right.projectedPoints - left.projectedPoints || left.playerId.localeCompare(right.playerId))[0];
    if (!selected) return [];
    used.add(selected.playerId);
    return [[slot.key, selected.playerId]];
  }));
}

function availability(player: ToolPlayer | undefined, forced: { inactive: Set<string>; out: Set<string>; ir: Set<string> }): LineupPlayerAvailability {
  if (player && forced.ir.has(player.id)) return "ir";
  if (player && forced.out.has(player.id)) return "out";
  if (player && forced.inactive.has(player.id)) return "inactive";
  const source = `${player?.status ?? ""} ${player?.injuryStatus ?? ""}`.toLowerCase();
  if (/\bir\b|reserve/u.test(source)) return "ir";
  if (/\bout\b/u.test(source)) return "out";
  if (/inactive/u.test(source)) return "inactive";
  if (/doubt/u.test(source)) return "doubtful";
  if (/question/u.test(source)) return "questionable";
  return "active";
}

function localDateTimeToIso(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Every kickoff group needs a valid scheduled time.");
  return new Date(timestamp).toISOString();
}

function formatTime(value: string, timezone: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "No deadline";
  try {
    return new Intl.DateTimeFormat([], { timeZone: timezone, dateStyle: "medium", timeStyle: "short", timeZoneName: "short" }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function ids(value: string) {
  return new Set(value.split(/[\s,]+/u).map((entry) => entry.trim()).filter(Boolean));
}

function initialGroups(): KickoffGroup[] {
  return [
    { id: "opening", label: "Opening game", teamCodes: "", originalStart: "", scheduledStart: "", actualStart: "", status: "scheduled" },
    { id: "weekend", label: "Weekend games", teamCodes: "", originalStart: "", scheduledStart: "", actualStart: "", status: "scheduled" },
  ];
}

export function NativeLineupWorkspace({ workspace, initialWeek, onWeekChange, onWorkspaceChanged }: {
  workspace: CanonicalLeagueWorkspace;
  initialWeek: number;
  onWeekChange: (week: number) => void;
  onWorkspaceChanged: () => void;
}) {
  const season = workspace.season!;
  const state = useNativeLineup(workspace.league.id, season.id, season.settingsVersionId, initialWeek, workspace.league.timezone);
  const { openPlayer } = useLeaguePlayerSheet();
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [fallbackText, setFallbackText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const [groups, setGroups] = useState<KickoffGroup[]>(initialGroups);
  const [inactiveIds, setInactiveIds] = useState("");
  const [outIds, setOutIds] = useState("");
  const [irIds, setIrIds] = useState("");
  const [reopenPlayerId, setReopenPlayerId] = useState("");
  const [reopenUntil, setReopenUntil] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [renderedAt, setRenderedAt] = useState(() => Date.now());
  const saveCommandRef = useRef<{ id: string; fingerprint: string } | null>(null);
  const isCommissioner = workspace.authority.canManage;
  const managedIds = useMemo(() => isCommissioner
    ? state.teams.map((team) => team.franchiseId)
    : workspace.roleGrants.filter((grant) => ["team_owner", "co_manager"].includes(grant.role) && !grant.revokedAt && grant.franchiseId).map((grant) => grant.franchiseId!), [isCommissioner, state.teams, workspace.roleGrants]);
  const selectedId = managedIds.includes(selectedFranchiseId) ? selectedFranchiseId : managedIds[0] ?? "";
  const team = state.teams.find((entry) => entry.franchiseId === selectedId) ?? null;
  const saved = state.lineups.find((lineup) => lineup.week === initialWeek && lineup.franchiseId === selectedId) ?? null;
  const scoring = state.settings?.scoring.preset === "ppr" ? "ppr" : state.settings?.scoring.preset === "standard" ? "standard" : "halfPpr";
  const directoryPlayers = useMemo(() => buildCurrentToolPlayers(scoring), [scoring]);
  const directory = useMemo(() => new Map(directoryPlayers.map((player) => [player.id, player])), [directoryPlayers]);
  const weekById = useMemo(() => new Map(state.week?.players.map((player) => [player.playerId, player]) ?? []), [state.week]);
  const slots = useMemo(() => state.settings ? slotDefinitions(state.settings) : [], [state.settings]);

  useEffect(() => {
    if (!team || !state.settings) return;
    setAssignments(saved?.assignments ?? (state.week ? optimize(team, state.settings, state.week.players) : {}));
    setFallbackText((saved?.orderedFallbackPlayerIds ?? []).join("\n"));
    setDirty(false);
    setMessage(null);
    saveCommandRef.current = null;
  }, [saved, state.settings, state.week, team]);

  useEffect(() => {
    const timer = window.setInterval(() => setRenderedAt(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const locks = useMemo(() => {
    if (!state.week || !state.settings) return new Map<string, ReturnType<typeof getNativePlayerLock>>();
    return new Map(state.week.players.map((player) => [player.playerId, getNativePlayerLock(player, state.week!, state.settings!, renderedAt)]));
  }, [renderedAt, state.settings, state.week]);
  const projectedTotal = Object.values(assignments).reduce((sum, playerId) => sum + (weekById.get(playerId)?.projectedPoints ?? directory.get(playerId)?.projectedPoints ?? 0), 0);
  const starterIds = new Set(Object.values(assignments));
  const byeCount = [...starterIds].filter((id) => directory.get(id)?.byeWeek === initialWeek).length;
  const injuryCount = [...starterIds].filter((id) => ["questionable", "doubtful", "inactive", "out", "ir"].includes(weekById.get(id)?.availability ?? "active")).length;
  const nextDeadline = [...locks.values()].filter((lock) => !lock.locked && lock.lockAt && Date.parse(lock.lockAt) > renderedAt).sort((left, right) => Date.parse(left.lockAt) - Date.parse(right.lockAt))[0]?.lockAt ?? "";
  const complete = slots.length > 0
    && slots.every((slot) => {
      const playerId = assignments[slot.key];
      const playerPosition = playerId ? weekById.get(playerId)?.position ?? directory.get(playerId)?.position ?? "" : "";
      return Boolean(playerId && eligible(playerPosition, slot));
    })
    && new Set(Object.values(assignments)).size === Object.values(assignments).length;

  function assign(slot: SlotDefinition, playerId: string) {
    const currentId = assignments[slot.key];
    if (currentId && locks.get(currentId)?.locked) return;
    setAssignments((current) => ({ ...current, [slot.key]: playerId }));
    setDirty(true);
    setMessage(null);
    saveCommandRef.current = null;
  }

  async function save() {
    if (!team || !state.settings || !state.week) return;
    const orderedFallbackPlayerIds = [...ids(fallbackText)].filter((id) => team.rosterPlayerIds.includes(id));
    const fingerprint = JSON.stringify([selectedId, initialWeek, saved?.revision ?? 0, season.revision, team.rosterRevision, season.settingsVersionId, assignments, orderedFallbackPlayerIds]);
    if (saveCommandRef.current?.fingerprint !== fingerprint) saveCommandRef.current = { id: crypto.randomUUID(), fingerprint };
    setPending("save");
    try {
      const receipt = await saveWeeklyLineupCommand({
        commandId: saveCommandRef.current.id,
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: saved?.revision ?? 0,
        payload: { legacyLeagueId: "", franchiseId: selectedId, week: initialWeek, assignments, overrideReason: "", expectedSeasonRevision: season.revision, expectedRosterRevision: team.rosterRevision, settingsVersionId: season.settingsVersionId, orderedFallbackPlayerIds },
      });
      setDirty(false);
      saveCommandRef.current = null;
      setMessage({ tone: "status", text: `Week ${initialWeek} lineup saved at revision ${receipt.resultingRevision}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The native lineup could not be saved." });
    } finally {
      setPending("");
    }
  }

  async function publishWeek() {
    const allRosterIds = [...new Set(state.teams.flatMap((entry) => entry.rosterPlayerIds))];
    const forced = { inactive: ids(inactiveIds), out: ids(outIds), ir: ids(irIds) };
    try {
      const groupTeams = groups.map((group) => ({ group, teams: new Set(group.teamCodes.toUpperCase().split(/[\s,]+/u).filter(Boolean)) }));
      const players: LineupWeekPlayerInput[] = allRosterIds.map((playerId) => {
        const player = directory.get(playerId);
        const group = groupTeams.find((candidate) => player?.team && candidate.teams.has(player.team))?.group;
        if (!player || !group) throw new Error(`${playerName(playerId, directory)} needs a known NFL team assigned to a kickoff group.`);
        const scheduledStartAt = localDateTimeToIso(group.scheduledStart);
        return {
          playerId,
          position: (player.position === "DEF" ? "DST" : player.position) as LineupWeekPlayerInput["position"],
          nflTeam: player.team,
          gameId: `${season.year}-week-${initialWeek}-${group.id}`,
          originalScheduledStartAt: group.originalStart ? localDateTimeToIso(group.originalStart) : scheduledStartAt,
          scheduledStartAt,
          actualStartedAt: group.actualStart ? localDateTimeToIso(group.actualStart) : "",
          gameStatus: group.status,
          availability: availability(player, forced),
          projectedPoints: player.projectedPointsPerGame ?? player.projectedPoints ?? 0,
        };
      });
      setPending("publish-week");
      await configureLineupWeekCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { week: initialWeek, expectedWeekRevision: state.week?.revision ?? 0, players } });
      setMessage({ tone: "status", text: `Week ${initialWeek} player game states published for ${players.length} rostered players.` });
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Week game states could not be published." });
    } finally {
      setPending("");
    }
  }

  async function reopenPlayer() {
    if (!state.week || !reopenPlayerId || !reopenUntil || overrideReason.trim().length < 5) {
      setMessage({ tone: "error", text: "Choose a player, future deadline, and clear audit reason." });
      return;
    }
    setPending("reopen");
    try {
      await setLineupLockOverrideCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: season.revision, payload: { week: initialWeek, expectedWeekRevision: state.week.revision, playerIds: [reopenPlayerId], reopenedUntil: localDateTimeToIso(reopenUntil) }, reason: overrideReason });
      setMessage({ tone: "status", text: `${playerName(reopenPlayerId, directory)} was reopened with an immutable audit reason.` });
      setOverrideReason("");
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The emergency reopening could not be recorded." });
    } finally {
      setPending("");
    }
  }

  if (state.status === "loading") return <section className="native-lineup-gate" aria-busy="true"><CalendarClock aria-hidden="true" /><h1>Loading native lineups…</h1><p>{state.message}</p></section>;
  if (state.status === "error") return <section className="native-lineup-gate is-error"><AlertCircle aria-hidden="true" /><h1>Native lineups are unavailable</h1><p>{state.message}</p></section>;
  if (!team || !state.settings) return <section className="native-lineup-gate"><ShieldCheck aria-hidden="true" /><h1>No managed team is assigned</h1><p>A commissioner must grant this account a team-owner or co-manager role before it can set a lineup.</p></section>;

  return (
    <div className="native-lineup-workspace">
      <header className="native-lineup-header">
        <div><span className="hq-kicker">Native lineup · {workspace.league.name}</span><h1>Week {initialWeek} lineup</h1><p>{state.settings.lineup.automaticMode === "best_ball" ? "Best ball chooses the highest-scoring legal starters." : "Player-level locks preserve later-game changes."} Deadlines use {workspace.league.timezone}.</p></div>
        <div className="native-lineup-summary" aria-label="Lineup status"><span className={complete ? "is-legal" : "is-warning"}>{complete ? "Legal" : "Incomplete"}</span><strong>{Object.keys(assignments).length} / {slots.length}</strong><small>{dirty ? "Unsaved changes" : saved ? `Saved revision ${saved.revision}` : "Not saved"}</small></div>
      </header>

      <section className="native-lineup-toolbar" aria-label="Native lineup controls">
        <label><span>Week</span><UniversalSelect aria-label="Native lineup week" value={initialWeek} onValueChange={(value) => onWeekChange(Number(value))}>{Array.from({ length: state.settings.lineup.lineupWeekCount }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</UniversalSelect></label>
        {isCommissioner ? <label><span>Team</span><UniversalSelect aria-label="Native lineup team" value={selectedId} onValueChange={setSelectedFranchiseId}>{state.teams.map((entry) => <option key={entry.franchiseId} value={entry.franchiseId}>{entry.name}</option>)}</UniversalSelect></label> : null}
        <div><span><b>{projectedTotal.toFixed(1)}</b> projected</span><span><b>{byeCount}</b> on bye</span><span><b>{injuryCount}</b> warnings</span></div>
        <button type="button" onClick={() => void save()} disabled={!state.week || !complete || !dirty || Boolean(pending)}><Save aria-hidden="true" />{pending === "save" ? "Saving…" : state.settings.lineup.automaticMode === "best_ball" ? "Publish best ball" : "Save lineup"}</button>
      </section>

      <div className={`native-lineup-deadline ${state.week ? "is-ready" : "is-missing"}`}><CalendarClock aria-hidden="true" /><div><strong>{state.week ? nextDeadline ? `Next lock: ${formatTime(nextDeadline, workspace.league.timezone)}` : "No future player deadline" : `Week ${initialWeek} game states are not published`}</strong><small>{state.week ? `${state.settings.lineup.lockPolicy.replace(/_/gu, " ")} · week revision ${state.week.revision}` : "A commissioner or scheduler must publish the official kickoff groups."}</small></div></div>
      {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}

      <section className="native-lineup-editor" aria-labelledby="native-lineup-editor-title">
        <header><div><span>{team.name}</span><h2 id="native-lineup-editor-title">Starters</h2></div><small>Roster revision {team.rosterRevision} · Settings {season.settingsVersionId}</small></header>
        <div className="native-lineup-rows">
          {slots.map((slot) => {
            const selectedPlayerId = assignments[slot.key] ?? "";
            const selectedLock = selectedPlayerId ? locks.get(selectedPlayerId) : null;
            return <div className={`native-lineup-row ${selectedLock?.locked ? "is-locked" : ""}`} key={slot.key}>
              <PositionBadge position={slot.slot}>{slot.slot}</PositionBadge>
              <div><UniversalSelect aria-label={`${slot.key} starter`} value={selectedPlayerId} disabled={state.settings!.lineup.automaticMode === "best_ball" || Boolean(selectedLock?.locked)} onValueChange={(value) => assign(slot, value)}><option value="">Open slot</option>{team.rosterPlayerIds.filter((id) => eligible(weekById.get(id)?.position ?? directory.get(id)?.position ?? "", slot)).map((id) => { const lock = locks.get(id); return <option key={id} value={id} disabled={(starterIds.has(id) && id !== selectedPlayerId) || Boolean(lock?.locked && id !== selectedPlayerId)}>{playerName(id, directory)} · {weekById.get(id)?.nflTeam || directory.get(id)?.team || "FA"}</option>; })}</UniversalSelect><small>{selectedPlayerId ? selectedLock?.reason ?? "Game state unavailable." : "Choose an eligible rostered player."}</small>{selectedPlayerId ? <button type="button" className="league-player-view" onClick={() => openPlayer({ playerId: selectedPlayerId, currentWeek: initialWeek, leagueState: selectedLock?.locked ? "locked" : "owned", ownership: team.name, rosterFit: `${slot.slot} starter`, actionLabel: "Manage this lineup", actionTo: `/league/${workspace.league.id}/team?week=${initialWeek}` })}>View player</button> : null}</div>
              <div><strong>{selectedPlayerId ? (weekById.get(selectedPlayerId)?.projectedPoints ?? directory.get(selectedPlayerId)?.projectedPoints ?? 0).toFixed(1) : "—"}</strong><small>{selectedPlayerId && locks.get(selectedPlayerId)?.lockAt ? formatTime(locks.get(selectedPlayerId)!.lockAt, workspace.league.timezone) : "No lock time"}</small></div>
              {selectedLock?.locked ? <LockKeyhole aria-label="Player locked" /> : null}
            </div>;
          })}
        </div>
      </section>

      <section className="native-lineup-fallback" aria-labelledby="native-lineup-fallback-title"><header><div><span>Inactive protection</span><h2 id="native-lineup-fallback-title">Ordered fallback players</h2></div><small>{state.settings.lineup.inactiveSubstitution === "ordered_fallback" ? "First eligible unlocked player is used" : "Disabled by rulebook"}</small></header><label><span>Player IDs in priority order</span><textarea rows={4} value={fallbackText} disabled={state.settings.lineup.inactiveSubstitution === "disabled"} onChange={(event) => { setFallbackText(event.target.value); setDirty(true); }} placeholder={team.rosterPlayerIds.join("\n")} /></label></section>

      {isCommissioner ? <section className="native-lineup-commissioner" aria-labelledby="native-lineup-commissioner-title">
        <header><div><span>Commissioner control</span><h2 id="native-lineup-commissioner-title">Week game and lock state</h2></div><small>Inputs are normalized into {workspace.league.timezone} display times after publication.</small></header>
        <div className="native-kickoff-groups">{groups.map((group, index) => <fieldset key={group.id}><legend>Kickoff group {index + 1}</legend><label><span>Label</span><input value={group.label} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, label: event.target.value } : entry))} /></label><label><span>NFL team codes</span><input value={group.teamCodes} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, teamCodes: event.target.value } : entry))} placeholder="KC, DAL" /></label><label><span>Original kickoff · browser time</span><input type="datetime-local" value={group.originalStart} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, originalStart: event.target.value } : entry))} /></label><label><span>Current kickoff · browser time</span><input type="datetime-local" value={group.scheduledStart} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, scheduledStart: event.target.value } : entry))} /></label><label><span>Actual start · optional</span><input type="datetime-local" value={group.actualStart} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, actualStart: event.target.value } : entry))} /></label><label><span>Status</span><UniversalSelect aria-label={`${group.label} game status`} value={group.status} onValueChange={(value) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, status: value as LineupGameStatus } : entry))}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="postponed">Postponed</option><option value="canceled">Canceled</option><option value="final">Final</option></UniversalSelect></label><button type="button" aria-label={`Remove kickoff group ${index + 1}`} disabled={groups.length === 1} onClick={() => setGroups((current) => current.filter((entry) => entry.id !== group.id))}><Trash2 aria-hidden="true" /> Remove</button></fieldset>)}</div>
        <button type="button" className="is-secondary" onClick={() => setGroups((current) => [...current, { id: crypto.randomUUID(), label: "Additional games", teamCodes: "", originalStart: "", scheduledStart: "", actualStart: "", status: "scheduled" }])}><Plus aria-hidden="true" /> Add kickoff group</button>
        <div className="native-lineup-availability"><label><span>Inactive player IDs</span><textarea rows={2} value={inactiveIds} onChange={(event) => setInactiveIds(event.target.value)} /></label><label><span>Out player IDs</span><textarea rows={2} value={outIds} onChange={(event) => setOutIds(event.target.value)} /></label><label><span>IR player IDs</span><textarea rows={2} value={irIds} onChange={(event) => setIrIds(event.target.value)} /></label></div>
        <button type="button" onClick={() => void publishWeek()} disabled={Boolean(pending) || !state.teams.some((entry) => entry.rosterPlayerIds.length)}>{pending === "publish-week" ? "Publishing…" : `Publish Week ${initialWeek} game states`}</button>
        {state.week ? <div className="native-lineup-reopen"><label><span>Emergency player</span><UniversalSelect aria-label="Emergency reopened player" value={reopenPlayerId} onValueChange={setReopenPlayerId}><option value="">Choose player</option>{state.week.players.map((player) => <option key={player.playerId} value={player.playerId}>{playerName(player.playerId, directory)}</option>)}</UniversalSelect></label><label><span>Reopen through · browser time</span><input type="datetime-local" value={reopenUntil} onChange={(event) => setReopenUntil(event.target.value)} /></label><label><span>Immutable audit reason</span><input value={overrideReason} maxLength={240} onChange={(event) => setOverrideReason(event.target.value)} /></label><button type="button" onClick={() => void reopenPlayer()} disabled={Boolean(pending)}>{pending === "reopen" ? "Recording…" : "Emergency reopen player"}</button></div> : null}
      </section> : null}
    </div>
  );
}
