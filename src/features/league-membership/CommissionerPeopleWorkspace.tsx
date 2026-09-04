import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { LeagueInvitationRole } from "../../../shared/leagueCommandProtocol";
import { Button } from "../../ui/Button";
import { UniversalSelect } from "../../ui/UniversalSelect";
import type { CanonicalLeagueWorkspace, LeagueMembership, RoleGrant } from "../league-domain/types";
import { defaultCommissionerPeopleService, type CommissionerPeopleService } from "./commissionerPeopleService";
import { type LeaguePeopleSnapshot } from "./leaguePeople";
import "./league-people.css";

type Message = { tone: "status" | "error"; text: string } | null;

const EMPTY_SNAPSHOT: LeaguePeopleSnapshot = {
  teams: [],
  memberships: [],
  roleGrants: [],
  invitations: [],
  recentAuditEvents: [],
};

function activeGrant(grant: RoleGrant) {
  if (grant.revokedAt) return false;
  const expiresAt = grant.expiresAt ? Date.parse(grant.expiresAt) : Number.NaN;
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

function displayRole(role: string) {
  return role.replace(/_/gu, " ").replace(/\b\w/gu, (character: string) => character.toUpperCase());
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function memberLabel(member: LeagueMembership | undefined) {
  if (!member) return "Unknown manager";
  return member.displayName || member.email || `Manager ${member.userId.slice(0, 8)}`;
}

function grantsForTeam(snapshot: LeaguePeopleSnapshot, franchiseId: string) {
  return snapshot.roleGrants
    .filter((grant) => grant.franchiseId === franchiseId && ["team_owner", "co_manager"].includes(grant.role) && activeGrant(grant))
    .map((grant) => ({ grant, member: snapshot.memberships.find((membership) => membership.userId === grant.userId && membership.status === "active") }))
    .filter((entry) => Boolean(entry.member));
}

function primaryCommissionerIds(snapshot: LeaguePeopleSnapshot) {
  return new Set(snapshot.roleGrants.filter((grant) => grant.role === "commissioner" && activeGrant(grant)).map((grant) => grant.userId));
}

function buildInviteUrl(leagueId: string, invitationId: string, token: string) {
  const path = `/ff/league/${encodeURIComponent(leagueId)}/join?invitation=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}`;
  return new URL(path, window.location.origin).toString();
}

function PeopleLoading() {
  return <section className="commissioner-people-state" aria-busy="true"><Users aria-hidden="true" /><strong>Loading teams and roles…</strong></section>;
}

export function CommissionerTeamsWorkspace({
  workspace,
  onWorkspaceChanged,
  service = defaultCommissionerPeopleService,
}: {
  workspace: CanonicalLeagueWorkspace;
  onWorkspaceChanged: () => void;
  service?: CommissionerPeopleService;
}) {
  const season = workspace.season!;
  const [snapshot, setSnapshot] = useState<LeaguePeopleSnapshot>(EMPTY_SNAPSHOT);
  const [revision, setRevision] = useState(season.revision);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LeagueInvitationRole>("team_owner");
  const [franchiseId, setFranchiseId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [removalTarget, setRemovalTarget] = useState<LeagueMembership | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const deferredWorkspaceRefresh = useRef(false);

  useEffect(() => () => {
    if (!deferredWorkspaceRefresh.current) return;
    deferredWorkspaceRefresh.current = false;
    onWorkspaceChanged();
  }, [onWorkspaceChanged]);

  async function reload() {
    const loaded = await service.load(workspace.league.id, season.id);
    setSnapshot(loaded);
    if (!franchiseId && loaded.teams[0]) setFranchiseId(loaded.teams[0].franchiseId);
    return loaded;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    service.load(workspace.league.id, season.id).then((loaded) => {
      if (!active) return;
      setSnapshot(loaded);
      setFranchiseId((current) => current || loaded.teams[0]?.franchiseId || "");
      setLoading(false);
    }).catch((error) => {
      if (!active) return;
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Teams and roles could not be loaded." });
      setLoading(false);
    });
    return () => { active = false; };
  }, [season.id, service, workspace.league.id]);

  const pendingInvitations = snapshot.invitations.filter((invitation) => invitation.status === "pending");
  const activeMembers = snapshot.memberships.filter((membership) => membership.status === "active");
  const commissionerIds = primaryCommissionerIds(snapshot);
  const leagueManagers = activeMembers.filter((member) => snapshot.roleGrants.some((grant) => grant.userId === member.userId && ["commissioner", "co_commissioner"].includes(grant.role) && activeGrant(grant)));
  const invitationReady = displayName.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())
    && (role === "co_commissioner" || Boolean(franchiseId));

  async function runAction(
    key: string,
    action: () => Promise<{ resultingRevision: number }>,
    success: string,
    options: { deferWorkspaceRefresh?: boolean } = {},
  ) {
    setBusy(key);
    setMessage(null);
    try {
      const receipt = await action();
      setRevision(receipt.resultingRevision);
      await reload();
      if (options.deferWorkspaceRefresh) {
        deferredWorkspaceRefresh.current = true;
      } else {
        deferredWorkspaceRefresh.current = false;
        onWorkspaceChanged();
      }
      setMessage({ tone: "status", text: success });
      return receipt;
    } catch (error) {
      const currentRevision = error && typeof error === "object" && "currentRevision" in error ? Number(error.currentRevision) : Number.NaN;
      if (Number.isFinite(currentRevision)) setRevision(currentRevision);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The league access command failed." });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function provisionTeams() {
    await runAction("provision", () => service.provisionTeams({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision }), "Team slots now match the published league rules.");
  }

  async function createInvitation() {
    setShareUrl("");
    const receipt = await runAction("invite", () => service.createInvitation({
      leagueId: workspace.league.id,
      seasonId: season.id,
      expectedRevision: revision,
      payload: {
        displayName: displayName.trim(),
        email: email.trim(),
        role,
        franchiseId: role === "co_commissioner" ? "" : franchiseId,
        expiresInDays: 7,
      },
    }), `Invitation created for ${displayName.trim()}.`, { deferWorkspaceRefresh: true });
    if (!receipt) return;
    const invitationId = String((receipt as { result?: Record<string, unknown> }).result?.invitationId ?? "");
    const token = String((receipt as { result?: Record<string, unknown> }).result?.token ?? "");
    if (invitationId && token) setShareUrl(buildInviteUrl(workspace.league.id, invitationId, token));
    setDisplayName("");
    setEmail("");
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage({ tone: "status", text: "Invitation link copied." });
      if (deferredWorkspaceRefresh.current) {
        deferredWorkspaceRefresh.current = false;
        onWorkspaceChanged();
      }
    } catch {
      setMessage({ tone: "error", text: "Copy was blocked. Select the invitation link and copy it manually." });
    }
  }

  async function confirmRemoval() {
    if (!removalTarget || removalReason.trim().length < 5) return;
    const target = removalTarget;
    const receipt = await runAction(`remove-${target.userId}`, () => service.removeMember({
      leagueId: workspace.league.id,
      seasonId: season.id,
      expectedRevision: revision,
      userId: target.userId,
      reason: removalReason,
    }), `${memberLabel(target)} no longer has active league access.`);
    if (receipt) {
      setRemovalTarget(null);
      setRemovalReason("");
    }
  }

  if (loading) return <PeopleLoading />;

  return (
    <div className="commissioner-people">
      <header className="commissioner-page-header">
        <div><span className="hq-kicker">Teams and roles</span><h1>Fill every seat safely</h1></div>
        <p>Invite a verified GameHQ account into a specific team role. Sleeper identity never grants native access.</p>
      </header>

      {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}

      {!season.settingsVersionId ? (
        <section className="commissioner-people-gate">
          <AlertTriangle aria-hidden="true" />
          <div><strong>Publish the rulebook before assigning teams</strong><p>Team count and co-manager policy must come from an immutable settings version.</p></div>
          <Link className="hq-primary-link" to={`/league/${encodeURIComponent(workspace.league.id)}/commissioner/settings`}>Open rulebook</Link>
        </section>
      ) : !snapshot.teams.length ? (
        <section className="commissioner-people-gate">
          <Users aria-hidden="true" />
          <div><strong>Create team slots from the published rules</strong><p>This repairs native leagues created before automatic team provisioning was added.</p></div>
          <Button type="button" size="sm" isLoading={busy === "provision"} onClick={() => void provisionTeams()}>Create team slots</Button>
        </section>
      ) : (
        <>
          <section className="commissioner-invite" aria-labelledby="invite-heading">
            <header><UserPlus aria-hidden="true" /><div><h2 id="invite-heading">Create invitation</h2><p>Links expire after seven days and only the invited sign-in email can accept.</p></div></header>
            <div className="commissioner-invite-fields">
              <label><span>Manager name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" /></label>
              <label><span>Sign-in email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" aria-invalid={email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())} /></label>
              <label><span>Role</span><UniversalSelect aria-label="Invitation role" value={role} onValueChange={(value) => setRole(value as LeagueInvitationRole)}><option value="team_owner">Team owner</option><option value="co_manager">Co-manager</option><option value="co_commissioner">Co-commissioner</option></UniversalSelect></label>
              <label><span>Team</span><UniversalSelect aria-label="Invitation team" value={franchiseId} disabled={role === "co_commissioner"} onValueChange={setFranchiseId}>{snapshot.teams.map((team) => <option key={team.franchiseId} value={team.franchiseId}>{team.name}</option>)}</UniversalSelect></label>
              <Button type="button" size="sm" isLoading={busy === "invite"} disabled={!invitationReady || Boolean(busy)} onClick={() => void createInvitation()}>Create invitation</Button>
            </div>
            {shareUrl ? (
              <div className="commissioner-share-link" role="status">
                <Link2 aria-hidden="true" />
                <label><span>Secure invitation link</span><input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copyShareUrl()}><Copy aria-hidden="true" />Copy</Button>
              </div>
            ) : null}
          </section>

          <section className="commissioner-team-table" aria-labelledby="team-seat-heading">
            <header><div><h2 id="team-seat-heading">Team seats</h2><p>{snapshot.teams.length} teams · {snapshot.teams.filter((team) => grantsForTeam(snapshot, team.franchiseId).some(({ grant }) => grant.role === "team_owner")).length} owners assigned</p></div></header>
            <div className="commissioner-table-scroll">
              <table>
                <thead><tr><th scope="col">Team</th><th scope="col">Owner</th><th scope="col">Co-managers</th><th scope="col">Status</th><th scope="col">Access</th></tr></thead>
                <tbody>{snapshot.teams.map((team) => {
                  const managers = grantsForTeam(snapshot, team.franchiseId);
                  const owner = managers.find(({ grant }) => grant.role === "team_owner");
                  const coManagers = managers.filter(({ grant }) => grant.role === "co_manager");
                  const pending = pendingInvitations.filter((invitation) => invitation.franchiseId === team.franchiseId);
                  return <tr key={team.franchiseId}>
                    <th scope="row" data-label="Team"><span className="commissioner-team-number">{team.draftPosition ?? "—"}</span><strong>{team.name}</strong></th>
                    <td data-label="Owner">{owner ? memberLabel(owner.member) : <span className="is-unassigned">Unassigned</span>}</td>
                    <td data-label="Co-managers">{coManagers.length ? coManagers.map(({ member }) => memberLabel(member)).join(", ") : "—"}</td>
                    <td data-label="Status">{pending.length ? <span className="commissioner-state is-pending"><Clock3 aria-hidden="true" />{pending.length} pending</span> : owner ? <span className="commissioner-state is-ready"><CheckCircle2 aria-hidden="true" />Owned</span> : <span className="commissioner-state"><AlertTriangle aria-hidden="true" />Needs owner</span>}</td>
                    <td data-label="Access"><div className="commissioner-team-access">{managers.length ? managers.map(({ grant, member }) => member ? <Button key={grant.id} type="button" size="sm" variant="ghost" disabled={Boolean(busy)} aria-label={`Remove ${memberLabel(member)} access`} onClick={() => { setRemovalTarget(member); setRemovalReason(""); }}>Remove</Button> : null) : "—"}</div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>

          <div className="commissioner-people-columns">
            <section aria-labelledby="league-role-heading">
              <header><ShieldCheck aria-hidden="true" /><div><h2 id="league-role-heading">League roles</h2><p>Commissioner authority is separate from team control.</p></div></header>
              <ul className="commissioner-role-list">{leagueManagers.map((member) => {
                const roles = snapshot.roleGrants.filter((grant) => grant.userId === member.userId && ["commissioner", "co_commissioner"].includes(grant.role) && activeGrant(grant));
                return <li key={member.userId}><div><strong>{memberLabel(member)}</strong><span>{roles.map((grant) => displayRole(grant.role)).join(", ")}</span></div>{commissionerIds.has(member.userId) ? <small>Primary authority</small> : <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => { setRemovalTarget(member); setRemovalReason(""); }}>Remove access</Button>}</li>;
              })}</ul>
            </section>
            <section aria-labelledby="pending-invite-heading">
              <header><Clock3 aria-hidden="true" /><div><h2 id="pending-invite-heading">Pending invitations</h2><p>{pendingInvitations.length ? "Awaiting the invited accounts" : "No open invitations"}</p></div></header>
              {pendingInvitations.length ? <ul className="commissioner-role-list">{pendingInvitations.map((invitation) => {
                const team = snapshot.teams.find((candidate) => candidate.franchiseId === invitation.franchiseId);
                return <li key={invitation.id}><div><strong>{invitation.displayName}</strong><span>{displayRole(invitation.role)}{team ? ` · ${team.name}` : ""} · expires {displayDate(invitation.expiresAt)}</span></div><Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void runAction(`revoke-${invitation.id}`, () => service.revokeInvitation({ leagueId: workspace.league.id, seasonId: season.id, expectedRevision: revision, invitationId: invitation.id }), `Invitation for ${invitation.displayName} revoked.`)}><X aria-hidden="true" />Revoke</Button></li>;
              })}</ul> : <p className="commissioner-empty">Create an invitation above when a manager is ready to join.</p>}
            </section>
          </div>

          {removalTarget ? (
            <section className="commissioner-removal" aria-labelledby="remove-access-heading">
              <header><AlertTriangle aria-hidden="true" /><div><h2 id="remove-access-heading">Remove {memberLabel(removalTarget)}?</h2><p>All active league and team grants for this account will be revoked atomically.</p></div></header>
              <label htmlFor="member-removal-reason"><span>Audit reason</span><textarea id="member-removal-reason" value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} maxLength={240} aria-describedby="member-removal-help" /></label>
              <small id="member-removal-help">Enter at least five characters. The reason is stored with the commissioner audit event.</small>
              <div><Button type="button" size="sm" variant="ghost" onClick={() => { setRemovalTarget(null); setRemovalReason(""); }}>Cancel</Button><Button type="button" size="sm" variant="danger" isLoading={busy === `remove-${removalTarget.userId}`} disabled={removalReason.trim().length < 5} onClick={() => void confirmRemoval()}>Remove access</Button></div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function CommissionerOperationsOverview({
  workspace,
  service = defaultCommissionerPeopleService,
}: {
  workspace: CanonicalLeagueWorkspace;
  service?: CommissionerPeopleService;
}) {
  const season = workspace.season!;
  const [snapshot, setSnapshot] = useState<LeaguePeopleSnapshot>(EMPTY_SNAPSHOT);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    service.load(workspace.league.id, season.id).then((loaded) => {
      if (!active) return;
      setSnapshot(loaded);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [season.id, service, workspace.league.id]);

  const health = useMemo(() => {
    const ownerTeamIds = new Set(snapshot.roleGrants.filter((grant) => grant.role === "team_owner" && activeGrant(grant)).map((grant) => grant.franchiseId));
    const unownedTeams = snapshot.teams.filter((team) => !ownerTeamIds.has(team.franchiseId)).length;
    const pendingInvitations = snapshot.invitations.filter((invitation) => invitation.status === "pending").length;
    const gates = [Boolean(season.settingsVersionId), snapshot.teams.length > 0, snapshot.teams.length > 0 && unownedTeams === 0, pendingInvitations === 0];
    return { complete: gates.filter(Boolean).length, total: gates.length, unownedTeams, pendingInvitations };
  }, [season.settingsVersionId, snapshot]);
  const base = `/league/${encodeURIComponent(workspace.league.id)}/commissioner`;

  return (
    <div className="commissioner-overview">
      <header className="commissioner-page-header"><div><span className="hq-kicker">Commissioner workspace</span><h1>{workspace.league.name}</h1></div><p>Resolve setup gaps first, then review the real operational queues behind this native season.</p></header>
      {state === "error" ? <p className="commissioner-message is-error" role="alert">Setup health could not be loaded. Refresh before making commissioner decisions.</p> : null}
      <section className="commissioner-health" aria-busy={state === "loading"}>
        <header><div><span>Setup health</span><strong>{state === "loading" ? "Checking…" : `${health.complete} of ${health.total} gates clear`}</strong></div><span>{season.year} · revision {season.revision}</span></header>
        <div className="commissioner-health-meter" role="progressbar" aria-label="Setup gates clear" aria-valuemin={0} aria-valuemax={health.total} aria-valuenow={health.complete}><span style={{ width: `${(health.complete / health.total) * 100}%` }} /></div>
        <ol>
          <li className={season.settingsVersionId ? "is-done" : ""}><span>{season.settingsVersionId ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}</span><div><strong>Published rulebook</strong><small>{season.settingsVersionId ? "Immutable rules are active" : "Rules must publish before team assignment"}</small></div>{!season.settingsVersionId ? <Link to={`${base}/settings`}>Open rulebook</Link> : null}</li>
          <li className={snapshot.teams.length ? "is-done" : ""}><span>{snapshot.teams.length ? <CheckCircle2 aria-hidden="true" /> : <Users aria-hidden="true" />}</span><div><strong>Team slots</strong><small>{snapshot.teams.length ? `${snapshot.teams.length} active teams` : "No team slots provisioned"}</small></div>{!snapshot.teams.length && season.settingsVersionId ? <Link to={`${base}/teams`}>Create teams</Link> : null}</li>
          <li className={!health.unownedTeams && snapshot.teams.length ? "is-done" : ""}><span>{!health.unownedTeams && snapshot.teams.length ? <CheckCircle2 aria-hidden="true" /> : <UserPlus aria-hidden="true" />}</span><div><strong>Team ownership</strong><small>{health.unownedTeams ? `${health.unownedTeams} teams need an owner` : snapshot.teams.length ? "Every team has an owner" : "Waiting for team slots"}</small></div>{health.unownedTeams ? <Link to={`${base}/teams`}>Invite managers</Link> : null}</li>
          <li className={!health.pendingInvitations ? "is-done" : ""}><span>{health.pendingInvitations ? <Clock3 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</span><div><strong>Pending invitations</strong><small>{health.pendingInvitations ? `${health.pendingInvitations} awaiting acceptance` : "No open invitation decisions"}</small></div>{health.pendingInvitations ? <Link to={`${base}/teams`}>Review</Link> : null}</li>
        </ol>
      </section>

      <div className="commissioner-operations-grid">
        <section aria-labelledby="operations-heading">
          <header><h2 id="operations-heading">Operational queue</h2><span>Current native systems only</span></header>
          <dl>
            <div><dt>Manager requests</dt><dd>Invite-only</dd></div>
            <div><dt>Teams without managers</dt><dd className={health.unownedTeams ? "is-warning" : ""}>{health.unownedTeams}</dd></div>
            <div><dt>Import or sync failures</dt><dd className={workspace.connection?.syncStatus === "error" ? "is-warning" : ""}>{workspace.connection?.syncStatus === "error" ? "1 failed" : "None"}</dd></div>
            <div><dt>Waiver jobs</dt><dd>Not active</dd></div>
            <div><dt>Trade reviews</dt><dd>Not active</dd></div>
            <div><dt>Stat corrections</dt><dd>Not active</dd></div>
            <div><dt>Unpaid dues</dt><dd>Not configured</dd></div>
            <div><dt>Upcoming deadlines</dt><dd>No deadlines published</dd></div>
          </dl>
        </section>
        <section aria-labelledby="recent-actions-heading">
          <header><h2 id="recent-actions-heading">Recent commissioner actions</h2><span>Immutable audit</span></header>
          {snapshot.recentAuditEvents.length ? <ol className="commissioner-audit-list">{snapshot.recentAuditEvents.map((event) => <li key={event.id}><strong>{event.publicSummary || displayRole(event.action)}</strong><span>{displayDate(event.timestamp)} · revision {event.resultingRevision}</span></li>)}</ol> : <p className="commissioner-empty">No commissioner actions have been recorded yet.</p>}
        </section>
      </div>
    </div>
  );
}
