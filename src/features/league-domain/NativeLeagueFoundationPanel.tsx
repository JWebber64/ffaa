import { useRef, useState, type FormEvent } from "react";
import { Database, Link2, Plus, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FANTASY_SEASON } from "../../config/fantasySeason";
import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";
import { LeagueAccountPanel } from "../league-season/LeagueAccountPanel";
import { Button } from "../../ui/Button";
import { NumericInput } from "../../ui/NumericInput";
import { connectExternalLeague, createNativeLeague } from "./leagueCommands";
import "./native-league-foundation.css";

type AttemptIds = {
  fingerprint: string;
  commandId: string;
};

function attemptFor(ref: { current: AttemptIds | null }, fingerprint: string) {
  if (ref.current?.fingerprint === fingerprint) return ref.current;
  ref.current = {
    fingerprint,
    commandId: crypto.randomUUID(),
  };
  return ref.current;
}

export function NativeLeagueFoundationPanel({
  activeConnection,
}: {
  activeConnection: SleeperLeagueConnectionSummary | null;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [year, setYear] = useState(FANTASY_SEASON);
  const [state, setState] = useState<{ status: "idle" | "creating" | "connecting" | "error"; message: string }>({ status: "idle", message: "" });
  const createAttemptRef = useRef<AttemptIds | null>(null);
  const connectAttemptRef = useRef<AttemptIds | null>(null);

  async function createLeague(event: FormEvent) {
    event.preventDefault();
    const normalizedName = name.trim().replace(/\s+/gu, " ");
    const normalizedTimezone = timezone.trim();
    const fingerprint = JSON.stringify([normalizedName, normalizedTimezone, year]);
    const attempt = attemptFor(createAttemptRef, fingerprint);
    setState({ status: "creating", message: "Creating the permanent GameHQ league identity…" });
    try {
      const receipt = await createNativeLeague({ name: normalizedName, timezone: normalizedTimezone, year }, attempt);
      createAttemptRef.current = null;
      navigate(`/league/${encodeURIComponent(receipt.leagueId)}/commissioner/settings`, { replace: false });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The native league could not be created." });
    }
  }

  async function connectLeague() {
    if (!activeConnection) return;
    const fingerprint = activeConnection.leagueId;
    const attempt = attemptFor(connectAttemptRef, fingerprint);
    setState({ status: "connecting", message: "Assigning a permanent GameHQ league identity…" });
    try {
      const receipt = await connectExternalLeague({
        provider: "sleeper",
        externalLeagueId: activeConnection.leagueId,
        leagueName: activeConnection.leagueName,
        season: activeConnection.season,
      }, attempt);
      connectAttemptRef.current = null;
      navigate(`/league/${encodeURIComponent(receipt.leagueId)}`, { replace: false });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The external league mapping could not be created." });
    }
  }

  const pending = state.status === "creating" || state.status === "connecting";

  return (
    <section className="native-league-foundation" aria-labelledby="native-league-foundation-title">
      <header>
        <div><ShieldCheck aria-hidden="true" /><span>Native league foundation</span></div>
        <h2 id="native-league-foundation-title">GameHQ owns league identity and permissions</h2>
        <p>Create a new native league, or map the selected Sleeper league without treating Sleeper ownership as GameHQ authority.</p>
      </header>
      <LeagueAccountPanel />
      <div className="native-league-foundation__workflows">
        <form onSubmit={createLeague}>
          <div className="native-league-foundation__workflow-title"><Plus aria-hidden="true" /><div><strong>New native league</strong><span>Starts with permanent GameHQ IDs</span></div></div>
          <label><span>League name</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required placeholder="League name" /></label>
          <label><span>Timezone</span><input value={timezone} onChange={(event) => setTimezone(event.target.value)} maxLength={64} required /></label>
          <label><span>Season</span><NumericInput aria-label="Native league season" min={FANTASY_SEASON - 1} max={FANTASY_SEASON + 2} value={year} onChange={(event) => setYear(Number(event.target.value))} required /></label>
          <Button type="submit" size="sm" isLoading={state.status === "creating"} disabled={pending}>Create native league</Button>
        </form>
        <div className="native-league-foundation__connect">
          <div className="native-league-foundation__workflow-title"><Link2 aria-hidden="true" /><div><strong>Map selected Sleeper league</strong><span>External ID stays a provider connection</span></div></div>
          {activeConnection ? (
            <dl>
              <div><dt>League</dt><dd>{activeConnection.leagueName}</dd></div>
              <div><dt>Sleeper ID</dt><dd>{activeConnection.leagueId}</dd></div>
              <div><dt>Season</dt><dd>{activeConnection.season || "Not reported"}</dd></div>
            </dl>
          ) : <p>Select or connect a Sleeper league below before creating its GameHQ mapping.</p>}
          <Button type="button" size="sm" variant="secondary" onClick={() => void connectLeague()} isLoading={state.status === "connecting"} disabled={!activeConnection || pending}><Database aria-hidden="true" />Create GameHQ mapping</Button>
        </div>
      </div>
      {state.message ? <p className={`native-league-foundation__message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </section>
  );
}
