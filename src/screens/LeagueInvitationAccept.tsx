import { useState } from "react";
import { BadgeCheck, Link2, ShieldAlert } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { acceptLeagueInvitationCommand } from "../features/league-domain/leagueCommands";
import { useLeagueWorkspace } from "../features/league-workspace/leagueWorkspaceState";
import { Button } from "../ui/Button";
import "../features/league-membership/league-people.css";

export default function LeagueInvitationAccept() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canonicalWorkspace, leagueId, refreshWorkspace } = useLeagueWorkspace();
  const [state, setState] = useState<{ status: "idle" | "working" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const invitationId = searchParams.get("invitation")?.trim() ?? "";
  const token = searchParams.get("token")?.trim() ?? "";
  const season = canonicalWorkspace?.season ?? null;
  const validLink = invitationId.startsWith("invite-") && token.length >= 20;

  async function accept() {
    if (!season || !validLink) return;
    setState({ status: "working", message: "Confirming your sign-in email and league role…" });
    try {
      await acceptLeagueInvitationCommand({
        leagueId,
        seasonId: season.id,
        expectedRevision: season.revision,
        invitationId,
        token,
      });
      refreshWorkspace();
      setState({ status: "success", message: "Your GameHQ league access is active." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "The invitation could not be accepted." });
    }
  }

  if (!canonicalWorkspace || canonicalWorkspace.league.authorityMode !== "native" || !season) {
    return <main className="league-invitation-accept is-error"><ShieldAlert aria-hidden="true" /><span className="hq-kicker">League invitation</span><h1>Invitation unavailable</h1><p>This link does not point to an active native GameHQ season.</p><Link to="/leagues">Return to leagues</Link></main>;
  }

  if (canonicalWorkspace.membership?.status === "active" || state.status === "success") {
    return <main className="league-invitation-accept is-success"><BadgeCheck aria-hidden="true" /><span className="hq-kicker">Invitation accepted</span><h1>Welcome to {canonicalWorkspace.league.name}</h1><p>{state.message || "This account already has active league access."}</p><Button type="button" onClick={() => navigate(`/league/${encodeURIComponent(leagueId)}/team`)}>Open my team</Button></main>;
  }

  return (
    <main className="league-invitation-accept">
      <Link2 aria-hidden="true" />
      <span className="hq-kicker">Secure GameHQ invitation</span>
      <h1>Join {canonicalWorkspace.league.name}</h1>
      <p>The invitation is bound to one sign-in email. GameHQ will activate only the team or commissioner role selected by the league commissioner.</p>
      {!validLink ? <p className="commissioner-message is-error" role="alert">This invitation link is incomplete. Ask the commissioner for a new link.</p> : null}
      {state.message ? <p className={`commissioner-message is-${state.status === "error" ? "error" : "status"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <div><Button type="button" isLoading={state.status === "working"} disabled={!validLink} onClick={() => void accept()}>Accept invitation</Button><Link to={`/league/${encodeURIComponent(leagueId)}`}>View league home</Link></div>
      <small>Accepting creates a durable GameHQ membership and an immutable audit entry. It does not change your Sleeper account.</small>
    </main>
  );
}
