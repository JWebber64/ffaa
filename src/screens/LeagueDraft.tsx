import { Link, useSearchParams } from "react-router-dom";

import { NativeDraftBoard } from "../features/native-draft/NativeDraftBoard";
import { useNativeDraft } from "../features/native-draft/useNativeDraft";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import "../features/native-draft/native-draft.css";

export default function LeagueDraft() {
  const { canonicalWorkspace, capabilities } = useLeagueWorkspace();
  const [searchParams] = useSearchParams();
  const watchToken = searchParams.get("watch")?.trim() ?? "";
  const season = canonicalWorkspace?.season;
  const state = useNativeDraft(canonicalWorkspace?.league.id ?? "", season?.id ?? "", season?.draftId ?? "", watchToken);
  if (!canonicalWorkspace || canonicalWorkspace.league.authorityMode !== "native" || !season) return <section className="native-draft-gate"><span className="hq-kicker">Native draft</span><h1>Connected drafts stay read-only</h1><p>This route becomes authoritative only after a league is created or migrated into native GameHQ control.</p></section>;
  if (!season.draftId) return <section className="native-draft-gate"><span className="hq-kicker">Native draft</span><h1>The commissioner has not created the draft</h1><p>Published rules and team slots must be ready before the room opens.</p>{capabilities.canManage ? <Link to={`/league/${canonicalWorkspace.league.id}/commissioner/draft`}>Configure draft</Link> : null}</section>;
  if (state.status !== "ready" || !state.draft) return <section className={`native-draft-gate${state.status === "error" ? " is-error" : ""}`} aria-busy={state.status === "loading" || undefined}><span className="hq-kicker">Native draft</span><h1>{state.status === "loading" ? "Reconnecting to the draft…" : "Draft room unavailable"}</h1><p>{state.message}</p></section>;
  return watchToken ? <section className="native-draft-spectator-view"><p className="native-draft-spectator-banner"><strong>Spectator view</strong><span>Live read-only state. Draft controls and private queues are not shared.</span></p><NativeDraftBoard workspace={{ ...canonicalWorkspace, roleGrants: [], authority: { ...canonicalWorkspace.authority, canManage: false } }} draft={state.draft} teams={state.teams} /></section> : <NativeDraftBoard workspace={canonicalWorkspace} draft={state.draft} teams={state.teams} />;
}
