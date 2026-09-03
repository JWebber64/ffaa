import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { parseLeagueSettings, type LeagueSettingsV1 } from "../../../shared/leagueSettings";
import type { CreateNativeDraftPayload, NativeDraftFormat } from "../../../shared/leagueCommandProtocol";
import { createNativeDraftCommand, startNativeDraftCommand } from "../league-domain/leagueCommands";
import { getSettingsVersion } from "../league-domain/firebaseLeagueRepository";
import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import { NativeDraftBoard } from "./NativeDraftBoard";
import { useNativeDraft } from "./useNativeDraft";
import "./native-draft.css";

export function CommissionerDraftWorkspace({ workspace, onWorkspaceChanged }: { workspace: CanonicalLeagueWorkspace; onWorkspaceChanged: () => void }) {
  const season = workspace.season!;
  const state = useNativeDraft(workspace.league.id, season.id, season.draftId ?? "");
  const [settings, setSettings] = useState<LeagueSettingsV1 | null>(null);
  const [format, setFormat] = useState<NativeDraftFormat>("snake");
  const [mode, setMode] = useState<CreateNativeDraftPayload["mode"]>("live");
  const [pickSeconds, setPickSeconds] = useState(60);
  const [nominationSeconds, setNominationSeconds] = useState(30);
  const [bidSeconds, setBidSeconds] = useState(10);
  const [antiSnipeSeconds, setAntiSnipeSeconds] = useState(5);
  const [spectatorEnabled, setSpectatorEnabled] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!season.settingsVersionId) return;
    void getSettingsVersion(workspace.league.id, season.settingsVersionId).then((version) => {
      const parsed = parseLeagueSettings(version?.settings, workspace.league.timezone);
      setSettings(parsed.settings);
      setFormat(parsed.settings.draft.format);
      setPickSeconds(parsed.settings.draft.pickSeconds);
    });
  }, [season.settingsVersionId, workspace.league.id, workspace.league.timezone]);

  useEffect(() => {
    if (!order.length && state.teams.length) setOrder(state.teams.map((team) => team.franchiseId));
  }, [order.length, state.teams]);

  async function createDraft() {
    if (!settings || order.length !== state.teams.length || new Set(order).size !== order.length) {
      setMessage({ tone: "error", text: "Draft order must contain every team exactly once." });
      return;
    }
    setPending("create");
    try {
      await createNativeDraftCommand({
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: season.revision,
        payload: { format, mode, draftOrderFranchiseIds: order, pickSeconds: mode === "slow" ? Math.max(900, pickSeconds) : pickSeconds, nominationSeconds, bidSeconds, antiSnipeSeconds, spectatorEnabled },
      });
      setMessage({ tone: "status", text: "Native draft created from the published teams and rules." });
      onWorkspaceChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The native draft could not be created." });
    } finally {
      setPending("");
    }
  }

  async function startDraft() {
    if (!state.draft) return;
    setPending("start");
    try {
      await startNativeDraftCommand({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: state.draft.seasonRevision, payload: { draftId: state.draft.id } });
      setMessage({ tone: "status", text: "Native draft launched. Managers can reconnect to the same authoritative room." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The native draft could not be started." });
    } finally {
      setPending("");
    }
  }

  if (!season.settingsVersionId) return <section className="native-draft-gate"><span className="hq-kicker">Commissioner draft</span><h1>Publish the rulebook first</h1><p>The draft takes its roster, budget, and timing constraints from one published settings version.</p><Link to={`/league/${workspace.league.id}/commissioner/settings`}>Open rulebook</Link></section>;
  if (state.status === "loading") return <section className="native-draft-gate" aria-busy="true"><span className="hq-kicker">Commissioner draft</span><h1>Loading authoritative draft…</h1><p>{state.message}</p></section>;
  if (season.draftId && !state.draft) return <section className="native-draft-gate is-error"><span className="hq-kicker">Commissioner draft</span><h1>Draft state is unavailable</h1><p>{state.message}</p></section>;

  return (
    <div className="commissioner-native-draft">
      {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
      {!state.draft ? (
        <section className="native-draft-setup">
          <header><div><span className="hq-kicker">Commissioner draft</span><h1>Configure the native draft</h1></div><p>Published roster and budget rules stay fixed. Choose the order, clock, recovery mode, and spectator access.</p></header>
          <div className="native-draft-setup-fields">
            <label><span>Format</span><UniversalSelect aria-label="Native draft format" value={format} onValueChange={(value) => setFormat(value as NativeDraftFormat)}>{settings?.draft.format === "auction" ? <option value="auction">Auction</option> : <><option value="snake">Snake</option><option value="linear">Linear</option><option value="third_round_reversal">Third-round reversal</option></>}</UniversalSelect></label>
            <label><span>Clock mode</span><UniversalSelect aria-label="Native draft clock mode" value={mode} onValueChange={(value) => setMode(value as CreateNativeDraftPayload["mode"])}><option value="live">Live</option><option value="slow">Slow / asynchronous</option></UniversalSelect></label>
            <label><span>Seconds per pick</span><NumericInput aria-label="Native draft seconds per pick" min={mode === "slow" ? 900 : 15} max={mode === "slow" ? 604800 : 600} value={pickSeconds} onChange={(event) => setPickSeconds(Number(event.target.value))} /></label>
            {settings?.draft.format === "auction" ? <><label><span>Nomination seconds</span><NumericInput aria-label="Native draft nomination seconds" min={10} max={600} value={nominationSeconds} onChange={(event) => setNominationSeconds(Number(event.target.value))} /></label><label><span>Bid seconds</span><NumericInput aria-label="Native draft bid seconds" min={5} max={120} value={bidSeconds} onChange={(event) => setBidSeconds(Number(event.target.value))} /></label><label><span>Anti-snipe window</span><NumericInput aria-label="Native draft anti-snipe window" min={0} max={bidSeconds} value={antiSnipeSeconds} onChange={(event) => setAntiSnipeSeconds(Number(event.target.value))} /></label></> : null}
            <label className="native-draft-spectator"><input type="checkbox" checked={spectatorEnabled} onChange={(event) => setSpectatorEnabled(event.target.checked)} /><span><strong>Enable spectator link</strong><small>Exact-link viewers can watch but never mutate the room.</small></span></label>
          </div>
          <section className="native-draft-order" aria-labelledby="native-draft-order-title"><header><h2 id="native-draft-order-title">Draft order</h2><span>Every franchise exactly once</span></header>{order.map((franchiseId, index) => <label key={`${index}-${franchiseId}`}><span>{index + 1}</span><UniversalSelect aria-label={`Draft position ${index + 1}`} value={franchiseId} onValueChange={(value) => setOrder((current) => current.map((id, position) => position === index ? value : id))}>{state.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label>)}</section>
          <div className="native-draft-setup-summary"><span>{state.teams.length} teams</span><span>{settings ? settings.rosterSlots.filter((slot) => slot.slot !== "IR").reduce((sum, slot) => sum + slot.count, 0) : 0} picks per team</span>{settings?.draft.format === "auction" ? <span>${settings.draft.auctionBudget} per team · ${settings.draft.minimumBid} minimum</span> : null}<button type="button" disabled={Boolean(pending) || !settings} onClick={() => void createDraft()}>{pending === "create" ? "Creating…" : "Create native draft"}</button></div>
        </section>
      ) : (
        <>
          <div className="native-draft-launch-bar"><div><strong>{state.draft.status === "lobby" ? "Draft room ready" : "Authoritative room active"}</strong><span>{state.draft.spectatorEnabled ? "Spectator view enabled" : "Spectator access disabled"}</span></div><Link to={`/league/${workspace.league.id}/draft`}>Open manager room</Link>{state.draft.spectatorEnabled ? <Link to={`/league/${workspace.league.id}/draft?watch=${encodeURIComponent(state.draft.spectatorCode)}`}>Open spectator view</Link> : null}{state.draft.status === "lobby" ? <button type="button" disabled={Boolean(pending)} onClick={() => void startDraft()}>{pending === "start" ? "Starting…" : "Start draft"}</button> : null}</div>
          <NativeDraftBoard workspace={workspace} draft={state.draft} teams={state.teams} commissionerControls />
        </>
      )}
    </div>
  );
}
