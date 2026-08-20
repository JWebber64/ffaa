import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Code2,
  Download,
  Gavel,
  Medal,
  Save,
  Settings2,
  Swords,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { LeagueFuture, LeagueHQData, LeagueManager, LeagueRivalry } from "./leagueHQData";
import { parseLeagueHQData, syncLeagueTeams } from "./leagueHQData";
import { Button } from "../../ui/Button";
import { NumericInput } from "../../ui/NumericInput";

type StudioView = "essentials" | "managers" | "rivalries" | "futures" | "advanced";

const STUDIO_VIEWS = [
  { id: "essentials", label: "Essentials", icon: Settings2 },
  { id: "managers", label: "Managers", icon: Users },
  { id: "rivalries", label: "Rivalries", icon: Swords },
  { id: "futures", label: "Futures", icon: Medal },
  { id: "advanced", label: "Advanced JSON", icon: Code2 },
] as const;

const cloneData = (data: LeagueHQData): LeagueHQData => JSON.parse(JSON.stringify(data)) as LeagueHQData;

function localDateTimeValue(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isoDateTimeValue(local: string) {
  if (!local) return "";
  const date = new Date(local);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function managerLabel(manager: LeagueManager) {
  return manager.teamName === manager.managerName
    ? manager.managerName
    : `${manager.managerName} / ${manager.teamName}`;
}

function oddsLabel(odds: number) {
  if (!odds) return "No line";
  return odds > 0 ? `+${odds}` : String(odds);
}

export function CommissionerStudio({
  data,
  starter,
  teams,
  onClose,
  onSave,
}: {
  data: LeagueHQData;
  starter: LeagueHQData;
  teams: Array<{ id: number | string; name: string }>;
  onClose: () => void;
  onSave: (data: LeagueHQData) => void;
}) {
  const originalRaw = useMemo(() => JSON.stringify(data), [data]);
  const [working, setWorking] = useState<LeagueHQData>(() => cloneData(data));
  const [view, setView] = useState<StudioView>("essentials");
  const [raw, setRaw] = useState(() => JSON.stringify(data, null, 2));
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(working) !== originalRaw, [working, originalRaw]);
  const currentManagers = useMemo(() => working.sleeper
    ? working.managers.filter((manager) => manager.currentRosterId != null)
    : working.managers, [working.managers, working.sleeper]);
  const managerById = useMemo(() => new Map(working.managers.map((manager) => [manager.id, manager])), [working.managers]);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved Commissioner Studio changes?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [requestClose]);

  const updateManager = (managerId: string, updates: Partial<LeagueManager>) => {
    setWorking((current) => ({
      ...current,
      managers: current.managers.map((manager) => manager.id === managerId ? { ...manager, ...updates } : manager),
    }));
  };

  const updateRivalry = (rivalryId: string, updates: Partial<LeagueRivalry>) => {
    setWorking((current) => ({
      ...current,
      rivalries: current.rivalries.map((rivalry) => rivalry.id === rivalryId ? { ...rivalry, ...updates } : rivalry),
    }));
  };

  const updateFuture = (managerId: string, updates: Partial<LeagueFuture>) => {
    setWorking((current) => ({
      ...current,
      futures: current.futures.map((future) => future.managerId === managerId
        ? { ...future, ...updates, source: "commissioner" }
        : future),
    }));
  };

  const selectView = (nextView: StudioView) => {
    if (nextView === "advanced") setRaw(JSON.stringify(working, null, 2));
    setView(nextView);
    setMessage("");
  };

  const applyAdvancedJson = () => {
    const parsed = parseLeagueHQData(raw);
    if (!parsed.data) {
      setMessage(parsed.error);
      return null;
    }
    setWorking(parsed.data);
    setMessage("Advanced JSON applied to the working copy. Save changes to keep it.");
    return parsed.data;
  };

  const validateAndSave = () => {
    const candidate = view === "advanced" ? applyAdvancedJson() : working;
    if (!candidate) return;
    const assignedSlots = candidate.managers
      .map((manager) => manager.draftSlot)
      .filter((slot): slot is number => slot != null && slot > 0);
    if (new Set(assignedSlots).size !== assignedSlots.length) {
      setMessage("Each draft slot can be assigned to only one manager.");
      return;
    }
    onSave(candidate);
    onClose();
  };

  const download = () => {
    const exportRaw = view === "advanced" ? raw : JSON.stringify(working, null, 2);
    const blob = new Blob([exportRaw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gamehq-fantasy-football-league-hq.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="league-dialog-backdrop" role="presentation">
      <section className="commissioner-studio" role="dialog" aria-modal="true" aria-labelledby="commissioner-studio-title">
        <header className="studio-header">
          <div>
            <span>Commissioner workbench</span>
            <h2 id="commissioner-studio-title">Commissioner Studio</h2>
            <p>Sleeper owns results. Your edits add the league’s voice, projections, and draft-night details.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={requestClose} aria-label="Close Commissioner Studio">
            <X size={17} aria-hidden="true" /> Close
          </Button>
        </header>

        <div className="studio-layout">
          <nav className="studio-nav" aria-label="Commissioner Studio sections" role="tablist">
            {STUDIO_VIEWS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={view === item.id}
                  className={view === item.id ? "is-active" : ""}
                  onClick={() => selectView(item.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="studio-panel" role="tabpanel">
            {view === "essentials" ? (
              <div className="studio-section">
                <div className="studio-section-heading">
                  <span>League identity</span>
                  <h3>Set the details Sleeper does not know</h3>
                  <p>Synced scoring and results stay authoritative. These fields survive every refresh.</p>
                </div>
                <div className="studio-form-grid">
                  <label className="is-wide">
                    League tagline
                    <input
                      value={working.identity.tagline}
                      onChange={(event) => setWorking((current) => ({ ...current, identity: { ...current.identity, tagline: event.target.value } }))}
                    />
                  </label>
                  <label>
                    Founded year
                    <NumericInput
                      aria-label="League founded year"
                      min="1900"
                      max={working.identity.currentSeason}
                      value={working.identity.foundedYear}
                      onChange={(event) => setWorking((current) => ({ ...current, identity: { ...current.identity, foundedYear: Number(event.target.value) } }))}
                    />
                  </label>
                  <label>
                    Format label
                    <input
                      value={working.identity.format}
                      onChange={(event) => setWorking((current) => ({ ...current, identity: { ...current.identity, format: event.target.value } }))}
                    />
                  </label>
                  <label className="is-wide">
                    Draft date and time
                    <input
                      type="datetime-local"
                      value={localDateTimeValue(working.identity.draftAt)}
                      onChange={(event) => setWorking((current) => ({ ...current, identity: { ...current.identity, draftAt: isoDateTimeValue(event.target.value) } }))}
                    />
                    <small>Use this override until Sleeper publishes the draft start time.</small>
                  </label>
                </div>

                <div className="studio-section-heading studio-subheading">
                  <span>Draft board</span>
                  <h3>Assign a visible draft order</h3>
                  <p>Leave slots blank for an auction without a fixed order.</p>
                </div>
                <div className="studio-order-list">
                  {currentManagers.map((manager) => (
                    <label key={manager.id}>
                      <span>{managerLabel(manager)}</span>
                      <NumericInput
                        min="1"
                        max={currentManagers.length}
                        aria-label={`Draft slot for ${manager.managerName}`}
                        value={manager.draftSlot ?? ""}
                        onChange={(event) => updateManager(manager.id, {
                          draftSlot: event.target.value ? Number(event.target.value) : null,
                        })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {view === "managers" ? (
              <div className="studio-section">
                <div className="studio-section-heading">
                  <span>Manager profiles</span>
                  <h3>Add the context behind the record</h3>
                  <p>Sleeper supplies names, avatars, and results. You supply the scouting report.</p>
                </div>
                <div className="studio-manager-list">
                  {working.managers.map((manager) => (
                    <details key={manager.id}>
                      <summary>
                        <span className="studio-avatar">{manager.avatarUrl ? <img src={manager.avatarUrl} alt="" /> : manager.managerName.slice(0, 2).toUpperCase()}</span>
                        <span><strong>{manager.managerName}</strong><small>{manager.teamName}</small></span>
                        <b>{manager.titles} titles</b>
                      </summary>
                      <label>
                        Commissioner profile
                        <textarea rows={4} value={manager.bio} onChange={(event) => updateManager(manager.id, { bio: event.target.value })} />
                      </label>
                      {manager.outlook ? <p className="studio-source-note"><strong>GameHQ outlook:</strong> {manager.outlook}</p> : null}
                    </details>
                  ))}
                </div>
              </div>
            ) : null}

            {view === "rivalries" ? (
              <div className="studio-section">
                <div className="studio-section-heading">
                  <span>Rivalry book</span>
                  <h3>Name the series; keep the record live</h3>
                  <p>Head-to-head results refresh from Sleeper while your name and story remain intact.</p>
                </div>
                <div className="studio-rivalry-list">
                  {working.rivalries.map((rivalry) => (
                    <article key={rivalry.id}>
                      <header>
                        <span>{managerById.get(rivalry.managerAId)?.managerName} {rivalry.winsA}</span>
                        <b>{rivalry.ties ? `${rivalry.ties} ties` : "Series"}</b>
                        <span>{rivalry.winsB} {managerById.get(rivalry.managerBId)?.managerName}</span>
                      </header>
                      <label>Rivalry name<input value={rivalry.name} onChange={(event) => updateRivalry(rivalry.id, { name: event.target.value })} /></label>
                      <label>Series story<textarea rows={3} value={rivalry.summary} onChange={(event) => updateRivalry(rivalry.id, { summary: event.target.value })} /></label>
                      <label>Next meeting<input placeholder="Example: Week 7" value={rivalry.nextMeeting} onChange={(event) => updateRivalry(rivalry.id, { nextMeeting: event.target.value })} /></label>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {view === "futures" ? (
              <div className="studio-section">
                <div className="studio-section-heading">
                  <span>Prediction desk</span>
                  <h3>Use the GameHQ model or set commissioner lines</h3>
                  <p>Editing a line marks it as commissioner-owned so Sleeper refreshes will not replace it.</p>
                </div>
                <div className="studio-futures-list">
                  {working.futures.map((future) => {
                    const manager = managerById.get(future.managerId);
                    return (
                      <article key={future.managerId}>
                        <header>
                          <div><strong>{manager?.managerName}</strong><small>{manager?.teamName}</small></div>
                          <span className={future.source === "commissioner" ? "is-commissioner" : ""}>
                            {future.source === "commissioner" ? "Commissioner line" : "GameHQ model"}
                          </span>
                        </header>
                        <div>
                          <label>Title odds<NumericInput aria-label={`${manager?.managerName ?? "Manager"} title odds`} step="10" value={future.championshipOdds} onChange={(event) => updateFuture(future.managerId, { championshipOdds: Number(event.target.value) })} /><small>{oddsLabel(future.championshipOdds)}</small></label>
                          <label>Win total<NumericInput aria-label={`${manager?.managerName ?? "Manager"} win total`} min="0" step="0.5" value={future.winTotal} onChange={(event) => updateFuture(future.managerId, { winTotal: Number(event.target.value) })} /></label>
                        </div>
                        <label>Case for this team<textarea rows={3} value={future.caseFor} onChange={(event) => updateFuture(future.managerId, { caseFor: event.target.value })} /></label>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {view === "advanced" ? (
              <div className="studio-section">
                <div className="studio-section-heading">
                  <span>Advanced workspace</span>
                  <h3>Import, export, or edit the complete league file</h3>
                  <p>Use this for bulk migrations. The other tabs are safer for routine commissioner work.</p>
                </div>
                <label className="league-json-label" htmlFor="league-json">League HQ JSON</label>
                <textarea id="league-json" className="league-json studio-json" spellCheck={false} value={raw} onChange={(event) => { setRaw(event.target.value); setMessage(""); }} />
                <div className="studio-advanced-actions">
                  <Button variant="ghost" size="sm" onClick={() => { const next = cloneData(starter); setRaw(JSON.stringify(next, null, 2)); setWorking(next); setMessage("Empty starter loaded into the working copy."); }}>Load empty starter</Button>
                  <Button variant="secondary" size="sm" onClick={() => { const parsed = parseLeagueHQData(raw); if (!parsed.data) { setMessage(parsed.error); return; } const next = syncLeagueTeams(parsed.data, teams); setWorking(next); setRaw(JSON.stringify(next, null, 2)); setMessage("Current GameHQ draft teams synced into the working copy."); }}><Upload size={15} aria-hidden="true" /> Sync draft teams</Button>
                  <Button variant="secondary" size="sm" onClick={download}><Download size={15} aria-hidden="true" /> Export JSON</Button>
                  <Button variant="secondary" size="sm" onClick={applyAdvancedJson}><Code2 size={15} aria-hidden="true" /> Apply JSON</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="studio-footer">
          <div>
            <Gavel size={16} aria-hidden="true" />
            <span>{message || (dirty ? "Unsaved commissioner changes" : "No unsaved changes")}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={requestClose}>Cancel</Button>
          <Button size="sm" onClick={validateAndSave}><Save size={16} aria-hidden="true" /> Save commissioner changes</Button>
        </footer>
      </section>
    </div>
  );
}
