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
            <label><span>Playoff teams</span><NumericInput min={2} max={16} step={2} value={settings.schedule.playoffTeams} onChange={(event) => setSettings((current) => ({ ...current, schedule: { ...current.schedule, playoffTeams: Number(event.target.value) } }))} /></label>
            <label><span>Trade deadline week</span><NumericInput min={1} max={18} value={settings.transactions.tradeDeadlineWeek} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeDeadlineWeek: Number(event.target.value) } }))} /></label>
            <label><span>Waivers</span><UniversalSelect aria-label="Waiver mode" value={settings.transactions.waiverMode} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, waiverMode: value as LeagueSettingsV1["transactions"]["waiverMode"] } }))}><option value="faab">FAAB</option><option value="rolling">Rolling priority</option></UniversalSelect></label>
            {settings.transactions.waiverMode === "faab" ? <label><span>FAAB budget</span><NumericInput min={1} max={10000} value={settings.transactions.faabBudget} onChange={(event) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, faabBudget: Number(event.target.value) } }))} /></label> : null}
            <label><span>Trade review</span><UniversalSelect aria-label="Trade review" value={settings.transactions.tradeReview} onValueChange={(value) => setSettings((current) => ({ ...current, transactions: { ...current.transactions, tradeReview: value as LeagueSettingsV1["transactions"]["tradeReview"] } }))}><option value="commissioner">Commissioner</option><option value="league_vote">League vote</option><option value="none">No review</option></UniversalSelect></label>
            <label><span>Lineup lock</span><UniversalSelect aria-label="Lineup lock policy" value={settings.lineup.lockPolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, lockPolicy: value as LeagueSettingsV1["lineup"]["lockPolicy"] } }))}><option value="player_start">Each player at scheduled kickoff (legacy)</option><option value="scheduled_start">Each player at scheduled kickoff</option><option value="actual_start">Each player at actual start</option><option value="first_game">Entire lineup at first game</option><option value="thursday_split">Thursday split / player kickoff</option></UniversalSelect></label>
            <label><span>Postponed games</span><UniversalSelect aria-label="Postponed game lineup policy" value={settings.lineup.postponedGamePolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, postponedGamePolicy: value as LeagueSettingsV1["lineup"]["postponedGamePolicy"] } }))}><option value="rescheduled_start">Move to rescheduled kickoff</option><option value="original_start">Keep original lock</option><option value="unlock_until_actual">Open until actual start</option></UniversalSelect></label>
            <label><span>Canceled games</span><UniversalSelect aria-label="Canceled game lineup policy" value={settings.lineup.canceledGamePolicy} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, canceledGamePolicy: value as LeagueSettingsV1["lineup"]["canceledGamePolicy"] } }))}><option value="unlock">Unlock affected players</option><option value="lock">Keep affected players locked</option></UniversalSelect></label>
            <label><span>Inactive player</span><UniversalSelect aria-label="Inactive player substitution policy" value={settings.lineup.inactiveSubstitution} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, inactiveSubstitution: value as LeagueSettingsV1["lineup"]["inactiveSubstitution"] } }))}><option value="ordered_fallback">Use ordered fallback</option><option value="disabled">No automatic substitution</option></UniversalSelect></label>
            <label><span>Lineup mode</span><UniversalSelect aria-label="Automatic lineup mode" value={settings.lineup.automaticMode} onValueChange={(value) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, automaticMode: value as LeagueSettingsV1["lineup"]["automaticMode"] } }))}><option value="manual">Manager lineup</option><option value="best_ball">Best ball</option></UniversalSelect></label>
            <label className="commissioner-toggle"><input type="checkbox" checked={settings.lineup.lateSwap} onChange={(event) => setSettings((current) => ({ ...current, lineup: { ...current.lineup, lateSwap: event.target.checked } }))} /><span><strong>Late swap</strong><small>Unlocked players may move after earlier games begin.</small></span></label>
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
            : <CommissionerOperationsOverview workspace={workspace} service={peopleService} />}
    </main>
  );
}
