import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Gavel, History, ScrollText, Settings2, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import {
  ROSTER_SLOT_KEYS,
  createRedraftLeagueSettings,
  parseLeagueSettings,
  simulateLeagueSettings,
  validateLeagueSettings,
  type LeagueRosterSlot,
  type LeagueSettingsV1,
} from "../../../shared/leagueSettings";
import { Button } from "../../ui/Button";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import {
  listSettingsVersions,
} from "../league-domain/firebaseLeagueRepository";
import {
  publishSettingsCommand,
  restoreSettingsVersionCommand,
  saveSettingsDraftCommand,
} from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, SettingsVersion } from "../league-domain/types";
import {
  CommissionerOperationsOverview,
  CommissionerTeamsWorkspace,
} from "../league-membership/CommissionerPeopleWorkspace";
import { CommissionerAuditWorkspace } from "../league-membership/CommissionerAuditWorkspace";
import { CommissionerDraftWorkspace } from "../native-draft/CommissionerDraftWorkspace";
import { defaultCommissionerPeopleService, type CommissionerPeopleService } from "../league-membership/commissionerPeopleService";
import { CommissionerSafetyPanel } from "./CommissionerSafetyPanel";
import "./commissioner-settings.css";

type PendingAction = "idle" | "loading" | "saving" | "publishing" | "restoring";

export type CommissionerSettingsService = {
  listVersions: typeof listSettingsVersions;
  saveDraft: typeof saveSettingsDraftCommand;
  publish: typeof publishSettingsCommand;
  restore: typeof restoreSettingsVersionCommand;
};

const defaultSettingsService: CommissionerSettingsService = {
  listVersions: listSettingsVersions,
  saveDraft: saveSettingsDraftCommand,
  publish: publishSettingsCommand,
  restore: restoreSettingsVersionCommand,
};

function fingerprint(settings: LeagueSettingsV1) {
  return JSON.stringify(settings);
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not published";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function scoringReception(preset: LeagueSettingsV1["scoring"]["preset"]) {
  return preset === "ppr" ? 1 : preset === "half_ppr" ? 0.5 : 0;
}

function setRosterCount(settings: LeagueSettingsV1, slot: LeagueRosterSlot, count: number) {
  return {
    ...settings,
    rosterSlots: settings.rosterSlots.map((row) => row.slot === slot ? { ...row, count } : row),
  };
}

function SettingsEditor({ workspace, onWorkspaceChanged, service }: { workspace: CanonicalLeagueWorkspace; onWorkspaceChanged: () => void; service: CommissionerSettingsService }) {
  const season = workspace.season!;
  const [settings, setSettings] = useState(() => createRedraftLeagueSettings(workspace.league.timezone));
  const [versions, setVersions] = useState<SettingsVersion[]>([]);
  const [draftVersionId, setDraftVersionId] = useState(season.draftSettingsVersionId);
  const [revision, setRevision] = useState(season.revision);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [pending, setPending] = useState<PendingAction>("loading");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);

  async function loadVersions(preferredDraftId = draftVersionId) {
    const loaded = await service.listVersions(workspace.league.id);
    setVersions(loaded);
    const selected = loaded.find((version) => version.id === preferredDraftId)
      ?? loaded.find((version) => version.id === season.settingsVersionId)
      ?? loaded[0];
    if (selected) {
      const parsed = parseLeagueSettings(selected.settings, workspace.league.timezone);
      setSettings(parsed.settings);
      setSavedFingerprint(fingerprint(parsed.settings));
    }
    return loaded;
  }

  useEffect(() => {
    let disposed = false;
    setPending("loading");
    void service.listVersions(workspace.league.id)
      .then((loaded) => {
        if (disposed) return;
        setVersions(loaded);
        const selected = loaded.find((version) => version.id === season.draftSettingsVersionId)
          ?? loaded.find((version) => version.id === season.settingsVersionId)
          ?? loaded[0];
        const parsed = parseLeagueSettings(selected?.settings, workspace.league.timezone);
        setSettings(parsed.settings);
        setSavedFingerprint(fingerprint(parsed.settings));
        setDraftVersionId(season.draftSettingsVersionId);
        setRevision(season.revision);
        setPending("idle");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setPending("idle");
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "League settings could not be loaded." });
      });
    return () => { disposed = true; };
  }, [season.draftSettingsVersionId, season.revision, season.settingsVersionId, service, workspace.league.id, workspace.league.timezone]);

  const issues = useMemo(() => validateLeagueSettings(settings), [settings]);
  const impact = useMemo(() => simulateLeagueSettings(settings), [settings]);
  const unsaved = fingerprint(settings) !== savedFingerprint;
  const busy = pending !== "idle";

  async function saveDraft() {
    setPending("saving");
    setMessage({ tone: "status", text: "Saving a new immutable draft…" });
    try {
      const receipt = await service.saveDraft({
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: revision,
        payload: { settings },
      });
      const nextDraftId = String(receipt.result.settingsVersionId ?? "");
      setDraftVersionId(nextDraftId);
      setRevision(receipt.resultingRevision);
      setSavedFingerprint(fingerprint(settings));
      await loadVersions(nextDraftId);
      setMessage({ tone: "status", text: issues.length ? `Draft saved with ${issues.length} validation issue${issues.length === 1 ? "" : "s"}.` : "Draft saved and ready to publish." });
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The settings draft could not be saved." });
    } finally {
      setPending("idle");
    }
  }

  async function publishDraft() {
    if (!draftVersionId || unsaved || issues.length) return;
    setPending("publishing");
    setMessage({ tone: "status", text: "Publishing the complete rule set atomically…" });
    try {
      const receipt = await service.publish({
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: revision,
        draftVersionId,
      });
      setRevision(receipt.resultingRevision);
      setDraftVersionId("");
      await loadVersions("");
      setMessage({ tone: "status", text: "League rules published. The season now uses this exact version." });
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "League settings could not be published." });
    } finally {
      setPending("idle");
    }
  }

  async function restoreVersion(sourceVersionId: string) {
    setPending("restoring");
    setMessage({ tone: "status", text: "Restoring that rule set as a new published version…" });
    try {
      const receipt = await service.restore({
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: revision,
        sourceVersionId,
      });
      setRevision(receipt.resultingRevision);
      setDraftVersionId("");
      const loaded = await loadVersions("");
      const active = loaded.find((version) => version.id === String(receipt.result.settingsVersionId ?? ""));
      if (active) {
        const parsed = parseLeagueSettings(active.settings, workspace.league.timezone);
        setSettings(parsed.settings);
        setSavedFingerprint(fingerprint(parsed.settings));
      }
      setMessage({ tone: "status", text: "Prior rules restored as a new published version." });
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That settings version could not be restored." });
    } finally {
      setPending("idle");
    }
  }

  function updateScoringPreset(preset: LeagueSettingsV1["scoring"]["preset"]) {
    setSettings((current) => ({
      ...current,
      scoring: { ...current.scoring, preset, receptionPoints: scoringReception(preset) },
    }));
  }

  function discardChanges() {
    const saved = versions.find((version) => version.id === draftVersionId)
      ?? versions.find((version) => version.id === season.settingsVersionId);
    if (!saved) return;
    const parsed = parseLeagueSettings(saved.settings, workspace.league.timezone);
    setSettings(parsed.settings);
    setSavedFingerprint(fingerprint(parsed.settings));
    setMessage({ tone: "status", text: "Unsaved changes discarded. The saved version is restored." });
  }

  return (
    <div className="commissioner-settings-layout">
      <form className="commissioner-rulebook" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
        <header className="commissioner-page-header">
          <div><span className="hq-kicker">Commissioner rulebook</span><h1>Publish a playable redraft league</h1></div>
          <p>Every save creates a new draft. Publishing validates the entire rule set and changes the season in one atomic command.</p>
        </header>

        <div className="commissioner-action-bar">
          <div aria-live="polite">
            <strong>{unsaved ? "Unsaved changes" : draftVersionId ? "Draft saved" : "Published rules loaded"}</strong>
            <span>Season revision {revision}</span>
          </div>
          <Button type="button" size="sm" variant="ghost" disabled={busy || !unsaved} onClick={discardChanges}>Discard</Button>
          <Button type="submit" size="sm" variant="secondary" isLoading={pending === "saving"} disabled={busy || !unsaved}>Save draft</Button>
          <Button type="button" size="sm" isLoading={pending === "publishing"} disabled={busy || unsaved || !draftVersionId || issues.length > 0} onClick={() => void publishDraft()}>Publish settings</Button>
        </div>

        {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
        {issues.length ? (
          <section className="commissioner-validation" aria-labelledby="commissioner-validation-title">
            <h2 id="commissioner-validation-title">Fix before publishing</h2>
            <ul>{issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul>
          </section>
        ) : (
          <p className="commissioner-valid"><CheckCircle2 aria-hidden="true" /> This draft passes every publish rule.</p>
        )}

        <section className="commissioner-form-section" aria-labelledby="league-structure-heading">
          <header><div><span>01</span><h2 id="league-structure-heading">League structure</h2></div><p>Redraft identity, membership policy, and deadline timezone.</p></header>
          <div className="commissioner-fields is-three-column">
            <label><span>Teams</span><NumericInput aria-invalid={issues.some((issue) => issue.field === "teamCount") || undefined} min={4} max={32} value={settings.teamCount} onChange={(event) => setSettings((current) => ({ ...current, teamCount: Number(event.target.value) }))} /></label>
            <label><span>League type</span><input value="Redraft" readOnly /></label>
            <label><span>Timezone</span><input aria-invalid={issues.some((issue) => issue.field === "timezone") || undefined} value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} /></label>
          </div>
          <div className="commissioner-checks">
            <label><input type="checkbox" checked={settings.allowMultipleManagersPerTeam} onChange={(event) => setSettings((current) => ({ ...current, allowMultipleManagersPerTeam: event.target.checked }))} /><span><strong>Allow co-managers</strong><small>Multiple GameHQ accounts can manage the same franchise.</small></span></label>
            <label><input type="checkbox" checked={settings.allowMultipleTeamsPerUser} onChange={(event) => setSettings((current) => ({ ...current, allowMultipleTeamsPerUser: event.target.checked }))} /><span><strong>Allow one manager to control multiple teams</strong><small>Off by default to preserve competitive separation.</small></span></label>
          </div>
        </section>

        <section className="commissioner-form-section" aria-labelledby="roster-heading">
          <header><div><span>02</span><h2 id="roster-heading">Roster construction</h2></div><p>IR does not consume a draft pick. FLEX accepts RB, WR, and TE.</p></header>
          <div className="commissioner-roster-grid" role="group" aria-label="Roster slot counts">
            {ROSTER_SLOT_KEYS.map((slot) => {
              const row = settings.rosterSlots.find((candidate) => candidate.slot === slot);
              return <label key={slot}><span>{slot}</span><NumericInput aria-label={`${slot} roster slots`} aria-invalid={issues.some((issue) => issue.field === `rosterSlots.${slot}`) || undefined} min={0} max={12} value={row?.count ?? 0} onChange={(event) => setSettings((current) => setRosterCount(current, slot, Number(event.target.value)))} /></label>;
            })}
          </div>
        </section>

        <section className="commissioner-form-section" aria-labelledby="draft-scoring-heading">
          <header><div><span>03</span><h2 id="draft-scoring-heading">Draft and scoring</h2></div><p>Only controls with working draft and scoring behavior are offered.</p></header>
          <div className="commissioner-fields is-three-column">
            <label><span>Draft format</span><UniversalSelect aria-label="Draft format" value={settings.draft.format} onValueChange={(value) => setSettings((current) => ({ ...current, draft: { ...current.draft, format: value as LeagueSettingsV1["draft"]["format"] } }))}><option value="snake">Snake</option><option value="auction">Auction</option></UniversalSelect></label>
            {settings.draft.format === "snake" ? <label><span>Seconds per pick</span><NumericInput min={15} max={600} value={settings.draft.pickSeconds} onChange={(event) => setSettings((current) => ({ ...current, draft: { ...current.draft, pickSeconds: Number(event.target.value) } }))} /></label> : <><label><span>Budget per team</span><NumericInput min={20} max={10000} value={settings.draft.auctionBudget} onChange={(event) => setSettings((current) => ({ ...current, draft: { ...current.draft, auctionBudget: Number(event.target.value) } }))} /></label><label><span>Minimum bid</span><NumericInput min={1} max={100} value={settings.draft.minimumBid} onChange={(event) => setSettings((current) => ({ ...current, draft: { ...current.draft, minimumBid: Number(event.target.value) } }))} /></label></>}
            <label><span>Scoring preset</span><UniversalSelect aria-label="Scoring preset" value={settings.scoring.preset} onValueChange={(value) => updateScoringPreset(value as LeagueSettingsV1["scoring"]["preset"])}><option value="standard">Standard</option><option value="half_ppr">Half-PPR</option><option value="ppr">PPR</option></UniversalSelect></label>
            <label><span>Passing TD</span><NumericInput min={0} max={20} value={settings.scoring.passingTouchdown} onChange={(event) => setSettings((current) => ({ ...current, scoring: { ...current.scoring, passingTouchdown: Number(event.target.value) } }))} /></label>
            <label><span>Interception</span><NumericInput min={-10} max={0} value={settings.scoring.interception} onChange={(event) => setSettings((current) => ({ ...current, scoring: { ...current.scoring, interception: Number(event.target.value) } }))} /></label>
            <label><span>Pass yards per point</span><NumericInput min={1} max={100} value={settings.scoring.passingYardsPerPoint} onChange={(event) => setSettings((current) => ({ ...current, scoring: { ...current.scoring, passingYardsPerPoint: Number(event.target.value) } }))} /></label>
          </div>
        </section>

        <section className="commissioner-form-section" aria-labelledby="schedule-transactions-heading">
          <header><div><span>04</span><h2 id="schedule-transactions-heading">Season operations</h2></div><p>Schedule, waivers, trades, and lineup locks share one published version.</p></header>
          <div className="commissioner-fields is-three-column">
            <label><span>Regular-season weeks</span><NumericInput min={1} max={18} value={settings.schedule.regularSeasonWeeks} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, regularSeasonWeeks: Number(event.target.value) } }))} /></label>
            <label><span>Playoff teams</span><NumericInput min={2} max={16} value={settings.schedule.playoffTeams} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, playoffTeams: Number(event.target.value) } }))} /></label>
            <label><span>Games per team/week</span><NumericInput min={1} max={4} value={settings.schedule.gamesPerWeek} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, gamesPerWeek: Number(event.target.value) } }))} /></label>
            <label><span>Schedule balance</span><UniversalSelect aria-label="Schedule balance" value={settings.schedule.balance} onValueChange={(value) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, balance: value as LeagueSettingsV1["schedule"]["balance"] } }))}><option value="balanced">Balanced round robin</option><option value="division_weighted">Division weighted</option><option value="custom">Manual custom</option></UniversalSelect></label>
            <label><span>Division games</span><NumericInput min={0} max={18} value={settings.schedule.divisionGames} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, divisionGames: Number(event.target.value) } }))} /></label>
            <label><span>Conference games</span><NumericInput min={0} max={18} value={settings.schedule.conferenceGames} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, conferenceGames: Number(event.target.value) } }))} /></label>
            <label><span>Standings tiebreak order</span><input aria-label="Standings tiebreak order" value={settings.schedule.standingsTiebreakers.join(", ")} onChange={(event) => { const allowed = new Set<LeagueSettingsV1["schedule"]["standingsTiebreakers"][number]>(["winning_percentage", "head_to_head", "division_percentage", "points_for", "all_play_percentage", "potential_points", "random_draw"]); const values = event.target.value.split(/\s*,\s*/u).filter((value): value is LeagueSettingsV1["schedule"]["standingsTiebreakers"][number] => allowed.has(value as LeagueSettingsV1["schedule"]["standingsTiebreakers"][number])); setSettings((current) => ({ ...current, schedule: { ...current.schedule, standingsTiebreakers: values } })); }} /></label>
            <label><span>Playoff round length</span><UniversalSelect aria-label="Playoff round length" value={String(settings.schedule.playoffRoundWeeks)} onValueChange={(value) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, playoffRoundWeeks: value === "2" ? 2 : 1 } }))}><option value="1">One week</option><option value="2">Two weeks</option></UniversalSelect></label>
            <label><span>Trade deadline week</span><NumericInput min={1} max={18} value={settings.transactions.tradeDeadlineWeek} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeDeadlineWeek: Number(event.target.value) } }))} /></label>
            <label><span>Waivers</span><UniversalSelect aria-label="Waiver mode" value={settings.transactions.waiverMode} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, waiverMode: value as LeagueSettingsV1["transactions"]["waiverMode"] } }))}><option value="faab">FAAB</option><option value="rolling">Rolling priority</option><option value="reverse_standings">Reverse standings</option><option value="weekly_reset">Weekly reset</option><option value="continuous">Continuous waivers</option><option value="first_come_first_served">First come, first served</option></UniversalSelect></label>
            {settings.transactions.waiverMode === "faab" ? <label><span>FAAB budget</span><NumericInput min={1} max={10000} value={settings.transactions.faabBudget} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, faabBudget: Number(event.target.value) } }))} /></label> : null}
            {settings.transactions.waiverMode !== "first_come_first_served" ? <label><span>Processing weekdays</span><input aria-label="Waiver processing weekdays" value={settings.transactions.processingDays.join(", ")} onChange={(event) => { const days = [...new Set(event.target.value.split(/[^0-6]+/u).filter(Boolean).map(Number))]; setSettings((current) => ({ ...current, transactions: { ...current.transactions, processingDays: days } })); }} /></label> : null}
            {settings.transactions.waiverMode !== "first_come_first_served" ? <label><span>Processing time</span><input aria-label="Waiver processing time" type="time" value={settings.transactions.processingTime} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, processingTime: event.target.value } }))} /></label> : null}
            <label><span>Dropped-player hold (hours)</span><NumericInput min={0} max={168} value={settings.transactions.droppedPlayerWaiverHours} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, droppedPlayerWaiverHours: Number(event.target.value) } }))} /></label>
            <label><span>Weekly acquisition limit</span><NumericInput min={0} max={50} value={settings.transactions.weeklyAcquisitionLimit} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, weeklyAcquisitionLimit: Number(event.target.value) } }))} /></label>
            <label><span>Waiver tiebreaker</span><UniversalSelect aria-label="Waiver tiebreaker" value={settings.transactions.waiverTiebreaker} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, waiverTiebreaker: value as LeagueSettingsV1["transactions"]["waiverTiebreaker"] } }))}><option value="priority">Waiver priority</option><option value="earliest_claim">Earliest claim</option><option value="lowest_standing">Lowest standing</option></UniversalSelect></label>
            {(["QB", "RB", "WR", "TE", "K", "DST"] as const).map((position) => <label key={position}><span>{position} roster limit</span><NumericInput aria-label={`${position} roster limit`} min={1} max={32} value={settings.transactions.positionLimits[position]} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, positionLimits: { ...current.transactions.positionLimits, [position]: Number(event.target.value) } } }))} /></label>)}
            <label><span>Trade review</span><UniversalSelect aria-label="Trade review" disabled={!settings.transactions.tradesEnabled} value={settings.transactions.tradeReview} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeReview: value as LeagueSettingsV1["transactions"]["tradeReview"] } }))}><option value="immediate">Immediate</option><option value="commissioner">Commissioner</option><option value="league_vote">League vote</option><option value="fixed_review_period">Fixed review period</option><option value="co_commissioner">Co-commissioner approval</option><option value="none">No review</option></UniversalSelect></label>
            {settings.transactions.tradesEnabled && settings.transactions.tradeReview === "fixed_review_period" ? <label><span>Review period (hours)</span><NumericInput min={1} max={168} value={settings.transactions.tradeReviewPeriodHours} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeReviewPeriodHours: Number(event.target.value) } }))} /></label> : null}
            <label><span>Post-trade roster policy</span><UniversalSelect aria-label="Post-trade roster policy" disabled={!settings.transactions.tradesEnabled} value={settings.transactions.tradeRosterEnforcement} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeRosterEnforcement: value as LeagueSettingsV1["transactions"]["tradeRosterEnforcement"] } }))}><option value="reject_illegal">Reject illegal result</option><option value="grace_period">Allow grace period</option><option value="immediate_cuts">Require immediate cuts</option><option value="commissioner_review">Commissioner review</option></UniversalSelect></label>
            {settings.transactions.tradesEnabled && settings.transactions.tradeRosterEnforcement === "grace_period" ? <label><span>Roster grace (hours)</span><NumericInput min={1} max={168} value={settings.transactions.tradeRosterGraceHours} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeRosterGraceHours: Number(event.target.value) } }))} /></label> : null}
            <label><span>Commissioner conflict</span><UniversalSelect aria-label="Commissioner trade conflict policy" disabled={!settings.transactions.tradesEnabled} value={settings.transactions.tradeSecondaryApproval} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeSecondaryApproval: value as LeagueSettingsV1["transactions"]["tradeSecondaryApproval"] } }))}><option value="never">No secondary approval</option><option value="commissioner_team">Primary commissioner team</option><option value="any_commissioner_team">Any commissioner team</option></UniversalSelect></label>
            <label><span>Lineup lock</span><UniversalSelect aria-label="Lineup lock policy" value={settings.lineup.lockPolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, lockPolicy: value as LeagueSettingsV1["lineup"]["lockPolicy"] } }))}><option value="player_start">Each player at scheduled kickoff (legacy)</option><option value="scheduled_start">Each player at scheduled kickoff</option><option value="actual_start">Each player at actual start</option><option value="first_game">Entire lineup at first game</option><option value="thursday_split">Thursday split / player kickoff</option></UniversalSelect></label>
            <label><span>Postponed games</span><UniversalSelect aria-label="Postponed game lineup policy" value={settings.lineup.postponedGamePolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, postponedGamePolicy: value as LeagueSettingsV1["lineup"]["postponedGamePolicy"] } }))}><option value="rescheduled_start">Move to rescheduled kickoff</option><option value="original_start">Keep original lock</option><option value="unlock_until_actual">Open until actual start</option></UniversalSelect></label>
            <label><span>Canceled games</span><UniversalSelect aria-label="Canceled game lineup policy" value={settings.lineup.canceledGamePolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, canceledGamePolicy: value as LeagueSettingsV1["lineup"]["canceledGamePolicy"] } }))}><option value="unlock">Unlock affected players</option><option value="lock">Keep affected players locked</option></UniversalSelect></label>
            <label><span>Inactive player</span><UniversalSelect aria-label="Inactive player substitution policy" value={settings.lineup.inactiveSubstitution} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, inactiveSubstitution: value as LeagueSettingsV1["lineup"]["inactiveSubstitution"] } }))}><option value="ordered_fallback">Use ordered fallback</option><option value="disabled">No automatic substitution</option></UniversalSelect></label>
            <label><span>Lineup mode</span><UniversalSelect aria-label="Automatic lineup mode" value={settings.lineup.automaticMode} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, automaticMode: value as LeagueSettingsV1["lineup"]["automaticMode"] } }))}><option value="manual">Manager lineup</option><option value="best_ball">Best ball</option></UniversalSelect></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.lineup.lateSwap} onChange={(event) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, lateSwap: event.target.checked } }))} /><span><strong>Late swap</strong><small>Unlocked players may move after earlier games begin.</small></span></label>
            {settings.transactions.waiverMode === "faab" ? <label className="commissioner-toggle"><input type="checkbox" checked={settings.transactions.allowZeroDollarBids} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, allowZeroDollarBids: event.target.checked } }))} /><span><strong>Allow $0 bids</strong><small>Managers may submit a claim without spending FAAB.</small></span></label> : null}
            {settings.transactions.waiverMode !== "first_come_first_served" ? <label className="commissioner-toggle"><input type="checkbox" checked={settings.transactions.commissionerWaiverReview} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, commissionerWaiverReview: event.target.checked } }))} /><span><strong>Commissioner review</strong><small>Claims remain pending review until the commissioner runs the queue.</small></span></label> : null}
            {settings.transactions.waiverMode === "faab" ? <label className="commissioner-toggle"><input type="checkbox" checked={settings.transactions.revealNextHighestBid} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, revealNextHighestBid: event.target.checked } }))} /><span><strong>Reveal next-highest bid</strong><small>Completed receipts show the runner-up price.</small></span></label> : null}
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.transactions.tradesEnabled} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradesEnabled: event.target.checked } }))} /><span><strong>Enable trades</strong><small>Turn this off to reject every new offer, counter, and acceptance.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.medianOpponent} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, medianOpponent: event.target.checked } }))} /><span><strong>League median opponent</strong><small>Add one median result per completed Week.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.allPlay} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, allPlay: event.target.checked } }))} /><span><strong>All-play standings</strong><small>Track every team against every weekly score.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.twoWeekMatchups} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, twoWeekMatchups: event.target.checked } }))} /><span><strong>Two-week matchups</strong><small>Keep opponents paired across consecutive weeks.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.playoffReseeding} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, playoffReseeding: event.target.checked } }))} /><span><strong>Playoff reseeding</strong><small>Highest remaining seed faces the lowest.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.consolationBracket} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, consolationBracket: event.target.checked } }))} /><span><strong>Consolation bracket</strong><small>Generate a parallel bracket for non-qualifiers.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.toiletBowl} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, toiletBowl: event.target.checked } }))} /><span><strong>Toilet bowl</strong><small>Track the bottom bracket under published rules.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.loserAdvances} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, loserAdvances: event.target.checked } }))} /><span><strong>Loser advances</strong><small>Bottom-bracket losers move toward the final.</small></span></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.schedule.thirdPlaceGame} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, thirdPlaceGame: event.target.checked } }))} /><span><strong>Third-place game</strong><small>Add the semifinal-loss placement matchup.</small></span></label>
            <label><span>Lineup weeks</span><NumericInput min={1} max={18} value={settings.lineup.lineupWeekCount} onChange={(event) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, lineupWeekCount: Number(event.target.value) } }))} /></label>
          </div>
        </section>
      </form>

      <aside className="commissioner-settings-aside">
        <section aria-labelledby="impact-heading">
          <header><ClipboardList aria-hidden="true" /><h2 id="impact-heading">Rule impact</h2></header>
          <dl>
            <div><dt>Drafted players</dt><dd>{impact.draftedPlayers}</dd></div>
            <div><dt>Starters / team</dt><dd>{impact.startersPerTeam}</dd></div>
            <div><dt>Bench / team</dt><dd>{impact.benchPerTeam}</dd></div>
            <div><dt>Matchups / week</dt><dd>{impact.matchupsPerWeek}</dd></div>
            <div><dt>Weekly byes</dt><dd>{impact.byeTeamsPerWeek}</dd></div>
            <div><dt>Playoff byes</dt><dd>{impact.playoffByes}</dd></div>
            {impact.auctionPool !== null ? <div><dt>League auction pool</dt><dd>${impact.auctionPool}</dd></div> : null}
          </dl>
        </section>
        <section aria-labelledby="versions-heading">
          <header><History aria-hidden="true" /><h2 id="versions-heading">Version history</h2></header>
          <ol className="commissioner-version-list">
            {versions.map((version) => (
              <li key={version.id} className={version.id === draftVersionId || version.id === season.settingsVersionId ? "is-current" : ""}>
                <div><strong>Revision {version.revision}</strong><span className={`is-${version.status}`}>{version.status}</span></div>
                <small>{formatTimestamp(version.publishedAt ?? version.createdAt)}</small>
                {version.status !== "draft" && version.id !== season.settingsVersionId ? <Button type="button" size="sm" variant="ghost" disabled={busy || unsaved} onClick={() => void restoreVersion(version.id)}>Restore as new version</Button> : null}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

export function CommissionerSettingsWorkspace({
  workspace,
  section,
  onWorkspaceChanged,
  service = defaultSettingsService,
  peopleService = defaultCommissionerPeopleService,
}: {
  workspace: CanonicalLeagueWorkspace;
  section: string;
  onWorkspaceChanged: () => void;
  service?: CommissionerSettingsService;
  peopleService?: CommissionerPeopleService;
}) {
  const base = `/league/${encodeURIComponent(workspace.league.id)}/commissioner`;
  return (
    <main className="commissioner-workspace">
      <nav aria-label="Commissioner workspace">
        <NavLink end to={base}><Settings2 aria-hidden="true" />Overview</NavLink>
        <NavLink to={`${base}/teams`}><Users aria-hidden="true" />Teams &amp; roles</NavLink>
        <NavLink to={`${base}/settings`}><ClipboardList aria-hidden="true" />Rulebook</NavLink>
        <NavLink to={`${base}/draft`}><Gavel aria-hidden="true" />Draft</NavLink>
        <NavLink to={`${base}/audit`}><ScrollText aria-hidden="true" />Audit log</NavLink>
        {workspace.season?.settingsVersionId ? <NavLink to={`/league/${encodeURIComponent(workspace.league.id)}/rules`}><History aria-hidden="true" />Published rules</NavLink> : null}
      </nav>
      {section === "settings"
        ? <SettingsEditor workspace={workspace} onWorkspaceChanged={onWorkspaceChanged} service={service} />
        : section === "teams"
          ? <CommissionerTeamsWorkspace workspace={workspace} onWorkspaceChanged={onWorkspaceChanged} service={peopleService} />
          : section === "draft"
            ? <CommissionerDraftWorkspace workspace={workspace} onWorkspaceChanged={onWorkspaceChanged} />
          : section === "audit"
            ? <CommissionerAuditWorkspace workspace={workspace} onWorkspaceChanged={onWorkspaceChanged} />
            : <><CommissionerOperationsOverview workspace={workspace} service={peopleService} /><CommissionerSafetyPanel workspace={workspace} /></>}
    </main>
  );
}
