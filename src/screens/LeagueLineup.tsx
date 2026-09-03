import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, LockKeyhole, RotateCcw, Save, ShieldCheck, Unlock } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { buildCurrentToolPlayers } from "../data/toolPlayerData";
import { LeagueAccountPanel } from "../features/league-season/LeagueAccountPanel";
import { LeagueSeasonHero } from "../features/league-season/LeagueSeasonHero";
import { getLeagueProjectionFreshness, projectionFreshnessSummary } from "../features/league-season/leagueProjectionFreshness";
import { setLeagueWeekLocked } from "../features/league-season/leagueSeasonPersistence";
import {
  buildLineupSlotDefinitions,
  isPlayerEligibleForLineupSlot,
  lineupAssignmentsFromProjection,
  positionLabel,
  projectAssignedLineup,
  projectFranchiseLineup,
  scoringLabel,
  toolScoring,
  type LeagueLineupAssignments,
} from "../features/league-season/leagueSeasonModel";
import { useLeagueSeasonManagement } from "../features/league-season/useLeagueSeasonManagement";
import { useLeagueWeekLineups } from "../features/league-season/useLeagueWeekLineups";
import { connectExternalLeague, saveWeeklyLineupCommand } from "../features/league-domain/leagueCommands";
import { LeagueCommandError } from "../features/league-domain/LeagueCommandService";
import { isGamehqLeagueId } from "../features/league-domain/types";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { NativeLineupWorkspace } from "../features/native-lineup/NativeLineupWorkspace";
import { appUrl } from "../lib/appBasePath";
import { PositionBadge } from "../ui/PositionBadge";
import { UniversalSelect } from "../ui/UniversalSelect";
import "./league-season.css";

function clampWeek(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(18, Math.max(1, Math.round(parsed))) : 1;
}

function formatSavedAt(value: string) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved lineup" : `Saved ${date.toLocaleString()}`;
}

function LeagueLineupGate({
  action,
  description,
  icon,
  title,
}: {
  action?: { label: string; to: string };
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="league-season-page league-season-gate">
      <div className="league-season-gate-content is-editorial">
        <div className="league-season-gate-copy">
          {icon}
          <span>Weekly lineup</span>
          <h1 className="ff-display">{title}</h1>
          <p>{description}</p>
          {action ? <Link className="league-season-primary" to={action.to}>{action.label}</Link> : null}
        </div>
        <div className="league-season-gate-artwork">
          <img
            src={appUrl("images/football-playbook-banner.png")}
            alt="A football rests beside a chalked route on dark turf."
            width="2048"
            height="1152"
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>
    </div>
  );
}

export default function LeagueLineup() {
  const navigate = useNavigate();
  const {
    canonicalWorkspace,
    capabilities,
    connection,
    dataLeagueId,
    leagueId,
    refreshWorkspace,
  } = useLeagueWorkspace();
  const management = useLeagueSeasonManagement(dataLeagueId);
  const [searchParams, setSearchParams] = useSearchParams();
  const week = clampWeek(searchParams.get("week"));
  const weekLineups = useLeagueWeekLineups(dataLeagueId, week, Boolean(management.record), management.record?.revision ?? 0);
  const [assignments, setAssignments] = useState<LeagueLineupAssignments>({});
  const [dirty, setDirty] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const connectAttemptRef = useRef<{ commandId: string; fingerprint: string } | null>(null);
  const saveAttemptRef = useRef<{ commandId: string; fingerprint: string } | null>(null);
  const season = management.record?.season ?? null;
  const isCommissioner = canonicalWorkspace
    ? capabilities.canManage
    : Boolean(management.record && management.record.commissionerUserId === management.currentUserId);
  const manageableFranchiseIds = useMemo(() => {
    if (!season) return new Set<string>();
    if (isCommissioner) return new Set(season.franchises.map((franchise) => franchise.id));
    return new Set(management.claims
      .filter((claim) => claim.status === "approved" && claim.approvedUserId === management.currentUserId)
      .map((claim) => claim.franchiseId));
  }, [isCommissioner, management.claims, management.currentUserId, season]);
  const requestedTeamId = searchParams.get("team") ?? "";
  const selected = season?.franchises.find((franchise) => franchise.id === requestedTeamId && manageableFranchiseIds.has(franchise.id))
    ?? season?.franchises.find((franchise) => manageableFranchiseIds.has(franchise.id))
    ?? null;
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
  const optimized = useMemo(
    () => selected && season ? projectFranchiseLineup(selected, season.rosterSlots, players, week) : null,
    [players, season, selected, week],
  );
  const saved = weekLineups.lineups.find((lineup) => lineup.franchiseId === selected?.id) ?? null;
  const slotDefinitions = useMemo(() => season ? buildLineupSlotDefinitions(season.rosterSlots) : [], [season]);
  const displayed = useMemo(
    () => selected && season ? projectAssignedLineup(selected, season.rosterSlots, players, week, assignments) : null,
    [assignments, players, season, selected, week],
  );

  useEffect(() => {
    if (!optimized) {
      setAssignments({});
      setDirty(false);
      return;
    }
    setAssignments(saved?.assignments ?? lineupAssignmentsFromProjection(optimized));
    setDirty(false);
    setOverrideReason("");
    setSaveState({ status: "idle", message: "" });
  }, [optimized, saved]);

  if (canonicalWorkspace?.league.authorityMode === "native" && canonicalWorkspace.season) {
    return <NativeLineupWorkspace workspace={canonicalWorkspace} initialWeek={week} onWeekChange={changeWeek} onWorkspaceChanged={refreshWorkspace} />;
  }

  function changeWeek(nextWeek: number) {
    saveAttemptRef.current = null;
    const next = new URLSearchParams(searchParams);
    next.set("week", String(Math.min(18, Math.max(1, nextWeek))));
    setSearchParams(next, { replace: true });
  }

  function changeTeam(franchiseId: string) {
    saveAttemptRef.current = null;
    const next = new URLSearchParams(searchParams);
    next.set("team", franchiseId);
    setSearchParams(next, { replace: true });
  }

  function assign(slotKey: string, playerId: string) {
    setAssignments((current) => {
      const next = { ...current };
      if (playerId) next[slotKey] = playerId;
      else delete next[slotKey];
      return next;
    });
    setDirty(true);
    saveAttemptRef.current = null;
    setSaveState({ status: "idle", message: "" });
  }

  function resetToBest() {
    if (!optimized) return;
    setAssignments(lineupAssignmentsFromProjection(optimized));
    setDirty(true);
    saveAttemptRef.current = null;
    setSaveState({ status: "idle", message: "" });
  }

  async function save() {
    if (!selected || !dataLeagueId) return;
    setSaveState({ status: "saving", message: "Saving weekly lineup…" });
    try {
      let commandLeagueId = canonicalWorkspace?.league.id ?? "";
      let commandSeasonId = canonicalWorkspace?.season?.id ?? "";
      let attachedDuringSave = false;
      if (!isGamehqLeagueId(commandLeagueId) || !isGamehqLeagueId(commandSeasonId)) {
        const fingerprint = dataLeagueId;
        if (connectAttemptRef.current?.fingerprint !== fingerprint) {
          connectAttemptRef.current = {
            commandId: crypto.randomUUID(),
            fingerprint,
          };
        }
        const attachReceipt = await connectExternalLeague({
          provider: "sleeper",
          externalLeagueId: dataLeagueId,
          leagueName: connection?.leagueName || `Sleeper League ${dataLeagueId}`,
          season: connection?.season || String(new Date().getUTCFullYear()),
        }, connectAttemptRef.current);
        commandLeagueId = attachReceipt.leagueId;
        commandSeasonId = attachReceipt.seasonId;
        attachedDuringSave = true;
      }
      if (!isGamehqLeagueId(commandLeagueId) || !isGamehqLeagueId(commandSeasonId)) {
        throw new LeagueCommandError({
          code: "migration_required",
          message: "This connected league has no published GameHQ season to receive lineup changes.",
        });
      }
      const expectedRevision = saved?.revision ?? 0;
      const fingerprint = JSON.stringify([
        commandLeagueId,
        commandSeasonId,
        selected.id,
        week,
        expectedRevision,
        assignments,
        overrideReason.trim(),
      ]);
      if (saveAttemptRef.current?.fingerprint !== fingerprint) {
        saveAttemptRef.current = { commandId: crypto.randomUUID(), fingerprint };
      }
      const receipt = await saveWeeklyLineupCommand({
        commandId: saveAttemptRef.current.commandId,
        leagueId: commandLeagueId,
        seasonId: commandSeasonId,
        expectedRevision,
        payload: {
          legacyLeagueId: dataLeagueId,
          franchiseId: selected.id,
          week,
          assignments,
          overrideReason,
        },
      });
      saveAttemptRef.current = null;
      connectAttemptRef.current = null;
      setDirty(false);
      setSaveState({ status: "success", message: `Week ${week} lineup saved at revision ${receipt.resultingRevision}.` });
      if (attachedDuringSave) {
        navigate(`/league/${encodeURIComponent(commandLeagueId)}/team/roster?${searchParams.toString()}`, { replace: true });
      }
    } catch (error) {
      const conflict = error instanceof LeagueCommandError && error.code === "stale_revision"
        ? `${error.message} Reloaded lineup data will be required before retrying.`
        : error instanceof Error ? error.message : "The weekly lineup could not be saved.";
      setSaveState({ status: "error", message: conflict });
    }
  }

  async function changeWeekLock(locked: boolean) {
    setSaveState({ status: "saving", message: locked ? `Locking Week ${week}…` : `Reopening Week ${week}…` });
    try {
      await setLeagueWeekLocked(dataLeagueId, week, locked);
      setSaveState({ status: "success", message: locked ? `Week ${week} lineups locked.` : `Week ${week} lineups reopened.` });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "The lineup lock could not be changed." });
    }
  }

  if (management.status === "loading" || management.status === "idle") {
    return <LeagueLineupGate icon={<CalendarDays aria-hidden="true" />} title="Loading team access…" description={management.message} />;
  }

  if (!season || !management.record) {
    return <LeagueLineupGate icon={<ShieldCheck aria-hidden="true" />} title="Publish the league season first" description="A commissioner-published roster and schedule are required before weekly lineups can be saved." action={{ label: "Open League Teams", to: `/league/${encodeURIComponent(leagueId)}/teams` }} />;
  }

  if (!selected) {
    return <LeagueLineupGate icon={<ShieldCheck aria-hidden="true" />} title="Your team is not assigned yet" description="Sign in and request a franchise on League Teams. The commissioner must approve it before your account can save lineups." action={{ label: "Request a team", to: `/league/${encodeURIComponent(leagueId)}/teams` }} />;
  }

  const usedPlayers = new Set(Object.values(assignments));
  const projectedById = new Map(
    [...(displayed?.slots.flatMap((slot) => slot.player ? [slot.player] : []) ?? []), ...(displayed?.bench ?? [])]
      .map((player) => [player.id, player]),
  );
  const isLocked = Boolean(weekLineups.settings?.locked);
  const roleReadOnly = Boolean(canonicalWorkspace && !capabilities.canSaveLineup);
  const isReadOnly = roleReadOnly || (isLocked && !isCommissioner);
  const accessBlocked = roleReadOnly || isLocked;

  return (
    <div className="league-season-page">
      <LeagueSeasonHero
        variant="lineup"
        eyebrow={`Weekly lineup · ${canonicalWorkspace?.league.name ?? connection?.leagueName ?? "Active league"}`}
        title={`Set ${selected.displayName}`}
        description="Choose legal starters, save the week, and feed the manager lineup directly into the matchup board."
        imagePath="images/football-playbook-banner.png"
        imageAlt="A football rests on dark turf beside a chalked play route."
        sourceIcon={<Save aria-hidden="true" />}
        sourceLabel={`Week ${week} lineup`}
        sourceDetail={saved ? formatSavedAt(saved.updatedAt) : "Using best projected starters"}
      />

      <LeagueAccountPanel />

      <section className="league-lineup-toolbar" aria-label="Lineup controls">
        <div className="league-week-stepper">
          <button type="button" onClick={() => changeWeek(week - 1)} disabled={week === 1} aria-label="Previous week"><ChevronLeft aria-hidden="true" /></button>
          <label><span>League week</span><UniversalSelect value={String(week)} onValueChange={(value) => changeWeek(Number(value))} aria-label="League week">{Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</UniversalSelect></label>
          <button type="button" onClick={() => changeWeek(week + 1)} disabled={week === 18} aria-label="Next week"><ChevronRight aria-hidden="true" /></button>
        </div>
        {isCommissioner ? <label className="league-team-select"><span>Manage team</span><UniversalSelect value={selected.id} onValueChange={changeTeam} aria-label="Manage team">{season.franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.displayName}</option>)}</UniversalSelect></label> : null}
        <div className="league-lineup-buttons">
          {isCommissioner ? <button type="button" className="is-secondary" onClick={() => changeWeekLock(!isLocked)} disabled={saveState.status === "saving"}>{isLocked ? <Unlock aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />} {isLocked ? "Reopen week" : "Lock week"}</button> : null}
          <button type="button" className="is-secondary" onClick={resetToBest} disabled={isReadOnly}><RotateCcw aria-hidden="true" /> Best projection</button>
          <button type="button" onClick={save} disabled={isReadOnly || !dirty || saveState.status === "saving" || (isLocked && isCommissioner && overrideReason.trim().length < 4)}><Save aria-hidden="true" /> {saveState.status === "saving" ? "Saving…" : "Save lineup"}</button>
        </div>
      </section>

      <div className={`league-lineup-lock ${accessBlocked ? "is-locked" : "is-open"}`}>
        {accessBlocked ? <LockKeyhole aria-hidden="true" /> : <Unlock aria-hidden="true" />}
        <div><strong>{roleReadOnly ? "Your GameHQ role is read-only" : isLocked ? `Week ${week} is locked` : `Week ${week} is open`}</strong><small>{roleReadOnly ? "A commissioner must grant lineup access for this franchise." : isReadOnly ? "Managers can view this lineup, but only the commissioner can override it." : isLocked ? "Commissioner overrides are recorded with a reason." : "Approved managers can save changes until the commissioner locks the week."}</small></div>
        {isLocked && isCommissioner ? <label><span>Override reason</span><input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} maxLength={240} placeholder="Required for a locked-lineup change" /></label> : null}
      </div>

      {saveState.message ? <p className={`league-action-message is-${saveState.status}`} role={saveState.status === "error" ? "alert" : "status"}>{saveState.message}</p> : null}
      {weekLineups.status === "error" ? <p className="league-action-message is-error" role="alert">{weekLineups.message}</p> : null}

      <section className="league-lineup-editor" aria-labelledby="lineup-editor-title">
        <header><div><span>{scoringLabel(season.scoring)} lineup</span><h2 id="lineup-editor-title">Week {week} starters</h2></div><div><strong>{displayed?.projectedTotal.toFixed(1) ?? "0.0"}</strong><small>baseline points</small></div></header>
        <div className="league-lineup-rows">
          {slotDefinitions.map((slot) => {
            const selectedPlayerId = assignments[slot.key] ?? "";
            const eligible = selected.roster
              .filter((player) => isPlayerEligibleForLineupSlot(player, slot))
              .sort((left, right) => (projectedById.get(right.id)?.baselinePoints ?? -1) - (projectedById.get(left.id)?.baselinePoints ?? -1));
            const selectedPlayer = projectedById.get(selectedPlayerId);
            return (
              <div className="league-lineup-row" key={slot.key}>
                <PositionBadge className="league-position" position={slot.label}>{positionLabel(slot.label)}</PositionBadge>
                <UniversalSelect value={selectedPlayerId} onValueChange={(value) => assign(slot.key, value)} aria-label={`${slot.label} starter`} disabled={isReadOnly}>
                  <option value="">Open slot</option>
                  {eligible.map((player) => {
                    const projection = projectedById.get(player.id);
                    const disabled = usedPlayers.has(player.id) && player.id !== selectedPlayerId;
                    return <option key={player.id} value={player.id} disabled={disabled}>{player.name} · {player.nflTeam || "FA"} · {projection?.baselinePoints?.toFixed(1) ?? "—"}</option>;
                  })}
                </UniversalSelect>
                <div><strong>{selectedPlayer?.baselinePoints?.toFixed(1) ?? "—"}</strong><small>{selectedPlayer?.isOnBye ? "Bye week" : "baseline"}</small></div>
              </div>
            );
          })}
        </div>
        <footer><AlertCircle aria-hidden="true" /><p>GameHQ validates the signed-in account, active role grants, franchise scope, position eligibility, duplicate starters, exact lineup revision, published settings, and the week lock before one atomic save. Every accepted command creates an immutable audit event and idempotent receipt. Projection data: {projectionFreshnessSummary(projectionFreshness)}.</p></footer>
      </section>

      <section className="league-lineup-bench" aria-labelledby="lineup-bench-title">
        <header><div><span>Available depth</span><h2 id="lineup-bench-title">Bench</h2></div><b>{displayed?.bench.length ?? 0}</b></header>
        <div>{displayed?.bench.map((player) => <article key={player.id}><PositionBadge className="league-position" position={player.position}>{positionLabel(player.position)}</PositionBadge><div><strong>{player.name}</strong><small>{player.nflTeam || "FA"}{player.isOnBye ? " · Bye" : ""}</small></div><span>{player.baselinePoints?.toFixed(1) ?? "—"}</span></article>)}</div>
      </section>
    </div>
  );
}
