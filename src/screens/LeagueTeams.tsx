import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock3,
  Cloud,
  CloudOff,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { buildCurrentToolPlayers } from "../data/toolPlayerData";
import { LeagueAccountPanel } from "../features/league-season/LeagueAccountPanel";
import { LeagueSeasonHero } from "../features/league-season/LeagueSeasonHero";
import { PositionBadge } from "../ui/PositionBadge";
import { getLeagueProjectionFreshness, projectionFreshnessSummary } from "../features/league-season/leagueProjectionFreshness";
import {
  approveFranchiseClaim,
  assignFranchiseToCommissioner,
  publishLeagueSeason,
  removeFranchiseClaim,
  requestFranchiseClaim,
  type FranchiseClaim,
} from "../features/league-season/leagueSeasonPersistence";
import {
  positionLabel,
  projectFranchiseLineup,
  scoringLabel,
  toolScoring,
  type LeagueFranchise,
  type ProjectedLineup,
  type ProjectedRosterPlayer,
} from "../features/league-season/leagueSeasonModel";
import { useLeagueSeasonDraft } from "../features/league-season/useLeagueSeasonDraft";
import { useLeagueSeasonManagement } from "../features/league-season/useLeagueSeasonManagement";
import { useSleeperLeagueConnections } from "../features/league-hq/sleeperConnections";
import { PlayerProfileButton } from "../features/player-profile/PlayerProfileProvider";
import "./league-season.css";

type ActionState = { status: "idle" | "working" | "success" | "error"; key: string; message: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FF";
}

function formatProjection(points: number, projectedCount: number) {
  return projectedCount ? points.toFixed(1) : "—";
}

function formatUpdatedAt(value: string) {
  if (!value) return "Saved on this device";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved league draft" : `Updated ${date.toLocaleString()}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function LeagueSeasonGate({ status, message }: { status: string; message: string }) {
  return (
    <div className="league-season-page league-season-gate">
      <div className="league-season-gate-content">
        <Users aria-hidden="true" />
        <span>League teams</span>
        <h1 className="ff-display">{status === "loading" ? "Loading the saved draft…" : "Create teams from a saved draft"}</h1>
        <p>{message}</p>
        {status !== "loading" ? <Link className="league-season-primary" to="/offline-draft">Open Offline Draft</Link> : null}
      </div>
    </div>
  );
}

function PlayerRow({ player, slot, group, scoring }: { player: ProjectedRosterPlayer | null; slot: string; group: "starter" | "bench"; scoring: ReturnType<typeof toolScoring> }) {
  return (
    <div className={`league-roster-row ${group === "bench" ? "is-bench" : ""}`} role="row">
      <div role="cell"><span className="league-mobile-label">Slot</span><PositionBadge className="league-position" position={slot}>{positionLabel(slot)}</PositionBadge></div>
      <div className="league-roster-player" role="cell">
        <span className="league-mobile-label">Player</span>
        {player ? <PlayerProfileButton player={player.projection ?? player} scoring={scoring} className="league-roster-profile"><strong>{player.name}</strong><small>{player.nflTeam || "FA"}{player.isOnBye ? " · Bye" : player.projection?.injuryStatus ? ` · ${player.projection.injuryStatus}` : ""}</small></PlayerProfileButton> : <><strong>Open slot</strong><small>No eligible player</small></>}
      </div>
      <div role="cell"><span className="league-mobile-label">Bye</span>{player?.projection?.byeWeek ?? player?.byeWeek ?? "—"}</div>
      <div role="cell"><span className="league-mobile-label">Drafted</span>{player ? `$${player.price}` : "—"}</div>
      <div role="cell"><span className="league-mobile-label">Baseline</span><strong>{player?.baselinePoints == null ? "—" : player.baselinePoints.toFixed(1)}</strong><small> pts/week</small></div>
    </div>
  );
}

function RosterTable({ lineup, scoring }: { lineup: ProjectedLineup; scoring: ReturnType<typeof toolScoring> }) {
  return (
    <div className="league-roster-table" role="table" aria-label="Projected lineup and roster">
      <div className="league-roster-header" role="row">
        <span role="columnheader">Slot</span><span role="columnheader">Player</span><span role="columnheader">Bye</span><span role="columnheader">Drafted</span><span role="columnheader">Baseline</span>
      </div>
      <div role="rowgroup">
        {lineup.slots.map((slot) => <PlayerRow key={slot.key} player={slot.player} slot={slot.label} group="starter" scoring={scoring} />)}
      </div>
      {lineup.bench.length ? (
        <div className="league-roster-bench" role="rowgroup" aria-label="Bench">
          <div className="league-roster-divider"><span>Bench and depth</span><small>{lineup.bench.length} players</small></div>
          {lineup.bench.map((player, index) => <PlayerRow key={player.id} player={player} slot={`BN${index + 1}`} group="bench" scoring={scoring} />)}
        </div>
      ) : null}
    </div>
  );
}

function franchiseLineupMap(franchises: LeagueFranchise[], players: ReturnType<typeof buildCurrentToolPlayers>, rosterSlots: Parameters<typeof projectFranchiseLineup>[1]) {
  return new Map(franchises.map((franchise) => [
    franchise.id,
    projectFranchiseLineup(franchise, rosterSlots, players, 0),
  ]));
}

function claimSummary(claim: FranchiseClaim | undefined) {
  if (!claim) return "Manager unassigned";
  return claim.status === "approved"
    ? `${claim.requestedDisplayName || "Manager"} approved`
    : `${claim.requestedDisplayName || "Manager"} requested`;
}

export default function LeagueTeams() {
  const { leagueId: routeLeagueId = "", teamId = "" } = useParams();
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const leagueId = routeLeagueId || activeLeagueId;
  const connection = connections.find((candidate) => candidate.leagueId === leagueId) ?? null;
  const draftState = useLeagueSeasonDraft(leagueId);
  const management = useLeagueSeasonManagement(leagueId);
  const [managerName, setManagerName] = useState(connection?.managerDisplayName || "");
  const [action, setAction] = useState<ActionState>({ status: "idle", key: "", message: "" });
  const draftSeason = draftState.status === "ready" ? draftState.season : null;
  const season = management.record?.season ?? draftSeason;
  const currentUserId = management.currentUserId || draftState.currentUserId;
  const isCommissioner = Boolean(management.record && management.record.commissionerUserId === currentUserId);
  const myApprovedClaim = management.claims.find((claim) => claim.status === "approved" && claim.approvedUserId === currentUserId);
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
  const lineups = useMemo(
    () => season ? franchiseLineupMap(season.franchises, players, season.rosterSlots) : new Map<string, ProjectedLineup>(),
    [players, season],
  );
  const projectionFreshness = useMemo(() => getLeagueProjectionFreshness(players), [players]);

  useEffect(() => setManagerName(connection?.managerDisplayName || ""), [leagueId, connection?.managerDisplayName]);

  if (!season) {
    const gateState = management.status === "loading" || draftState.status === "loading" ? "loading" : draftState.status;
    const gateMessage = draftState.message || management.message;
    return <LeagueSeasonGate status={gateState} message={gateMessage} />;
  }

  const selected = season.franchises.find((franchise) => franchise.id === teamId)
    ?? season.franchises.find((franchise) => franchise.id === myApprovedClaim?.franchiseId)
    ?? season.franchises[0]!;
  const lineup = lineups.get(selected.id)!;
  const selectedClaim = management.claims.find((claim) => claim.franchiseId === selected.id);
  const isMyApprovedTeam = selectedClaim?.status === "approved" && selectedClaim.approvedUserId === currentUserId;
  const isMyPendingRequest = selectedClaim?.status === "requested" && selectedClaim.requestedByUserId === currentUserId;
  const hasDifferentMembership = Boolean(management.membership && management.membership.franchiseId !== selected.id);
  const sourceLabel = management.record ? "Published league season" : season.source === "shared" ? "Shared draft preview" : "Local draft fallback";
  const pendingClaims = management.claims.filter((claim) => claim.status === "requested");
  const hasNewerDraft = Boolean(
    management.record
    && draftSeason?.source === "shared"
    && draftSeason.revision > management.record.sourceDraftRevision,
  );

  async function runAction(key: string, task: () => Promise<unknown>, successMessage: string) {
    setAction({ status: "working", key, message: "Saving…" });
    try {
      await task();
      setAction({ status: "success", key, message: successMessage });
    } catch (error) {
      setAction({ status: "error", key, message: errorMessage(error, "The league change could not be saved.") });
    }
  }

  function publish() {
    return runAction("publish", () => publishLeagueSeason(leagueId), management.record ? "League season republished from the latest saved draft." : "League season published. Managers can now request their teams.");
  }

  function claimSelected() {
    const name = managerName || connection?.managerDisplayName || "";
    return runAction(
      `claim-${selected.id}`,
      () => isCommissioner
        ? assignFranchiseToCommissioner(leagueId, selected.id, name)
        : requestFranchiseClaim(leagueId, selected.id, name),
      isCommissioner ? `${selected.displayName} is now your managed team.` : `Request sent for ${selected.displayName}.`,
    );
  }

  return (
    <div className="league-season-page">
      <LeagueSeasonHero
        variant="teams"
        eyebrow={`League teams · ${connection?.leagueName ?? "Active league"}`}
        title="Every roster from the saved draft"
        description="Publish the season, approve each manager, and turn the draft board into working weekly teams."
        imagePath="images/league-season/roster-tunnel-v1.png"
        imageAlt="An unbranded football uniform and helmets wait beside a tunnel leading to a lit field."
        sourceIcon={management.record || season.source === "shared" ? <Cloud aria-hidden="true" /> : <CloudOff aria-hidden="true" />}
        sourceLabel={sourceLabel}
        sourceDetail={management.record ? `Season revision ${management.record.revision}` : formatUpdatedAt(season.updatedAt)}
      />

      <LeagueAccountPanel />

      <section className={`league-publish-panel ${management.record ? "is-published" : ""}`} aria-label="League season status">
        <div>
          {management.record ? <BadgeCheck aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          <span>{management.record ? "Season published" : "Draft preview"}</span>
          <strong>{management.record ? `${management.record.schedule.length} matchups are commissioner-published.` : "The draft is saved, but team ownership and lineups are not live yet."}</strong>
          <small>{management.record ? "Manager access follows a durable Google account, with one franchise membership per league." : draftState.isDraftOwner ? "Sign in, then publish when the draft is final. Republishing refreshes rosters and invalidates older saved lineups." : "Only the device that owns the shared draft can publish it after sign-in."}</small>
        </div>
        {draftState.isDraftOwner ? (
          <button type="button" onClick={publish} disabled={action.status === "working" && action.key === "publish"}>
            <RefreshCw aria-hidden="true" />
            {management.record ? hasNewerDraft ? "Publish latest draft" : "Republish season" : "Publish league season"}
          </button>
        ) : null}
      </section>

      {action.message ? <p className={`league-action-message is-${action.status}`} role={action.status === "error" ? "alert" : "status"}>{action.message}</p> : null}
      {management.status === "error" ? <p className="league-action-message is-error" role="alert">{management.message}</p> : null}

      {isCommissioner && pendingClaims.length ? (
        <section className="league-claim-queue" aria-labelledby="claim-queue-title">
          <header><div><span>Commissioner queue</span><h2 id="claim-queue-title">Manager requests</h2></div><b>{pendingClaims.length}</b></header>
          <div>
            {pendingClaims.map((claim) => (
              <article key={claim.franchiseId}>
                <div><strong>{claim.requestedDisplayName}</strong><small>wants {claim.franchiseName}</small></div>
                <div>
                  <button type="button" onClick={() => runAction(`approve-${claim.franchiseId}`, () => approveFranchiseClaim(leagueId, claim.franchiseId), `${claim.requestedDisplayName} can now manage ${claim.franchiseName}.`)} disabled={action.status === "working"}><Check aria-hidden="true" /> Approve</button>
                  <button type="button" onClick={() => runAction(`remove-${claim.franchiseId}`, () => removeFranchiseClaim(leagueId, claim.franchiseId), `Request removed for ${claim.franchiseName}.`)} disabled={action.status === "working"}><X aria-hidden="true" /> Decline</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <nav className="league-team-directory" aria-label="League teams">
        {season.franchises.map((franchise) => {
          const candidate = lineups.get(franchise.id)!;
          const active = franchise.id === selected.id;
          const claim = management.claims.find((entry) => entry.franchiseId === franchise.id);
          return (
            <Link key={franchise.id} to={`/league/${encodeURIComponent(leagueId)}/teams/${franchise.id}`} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
              <span className="league-team-mark" aria-hidden="true">{initials(franchise.displayName)}</span>
              <span><strong>{franchise.displayName}</strong><small>{franchise.roster.length} players · {claimSummary(claim)}</small></span>
              <b>{formatProjection(candidate.projectedTotal, candidate.projectedStarterCount)}<small>baseline</small></b>
            </Link>
          );
        })}
      </nav>

      <section className="league-team-workspace">
        <header className="league-team-header">
          <div className="league-team-identity">
            <span className="league-team-mark is-large" aria-hidden="true">{initials(selected.displayName)}</span>
            <div><span>Team {selected.teamNumber}</span><h2>{selected.displayName}</h2><small>{scoringLabel(season.scoring)} · {projectionFreshnessSummary(projectionFreshness)}</small></div>
          </div>
          <div className="league-team-actions">
            {!management.record ? (
              <span className="league-ownership-note"><Clock3 aria-hidden="true" /> Publish the season to assign this team</span>
            ) : isMyApprovedTeam ? (
              <>
                <span className="league-my-team"><Check aria-hidden="true" /> Your approved team</span>
                <Link className="league-lineup-link" to={`/league/${encodeURIComponent(leagueId)}/team/roster?team=${encodeURIComponent(selected.id)}`}>Set weekly lineup</Link>
                <button type="button" className="is-quiet" onClick={() => runAction(`release-${selected.id}`, () => removeFranchiseClaim(leagueId, selected.id), `${selected.displayName} is no longer assigned to this session.`)} disabled={action.status === "working"}>Release team</button>
              </>
            ) : isMyPendingRequest ? (
              <>
                <span className="league-ownership-note"><Clock3 aria-hidden="true" /> Waiting for commissioner approval</span>
                <button type="button" className="is-quiet" onClick={() => runAction(`cancel-${selected.id}`, () => removeFranchiseClaim(leagueId, selected.id), `Request canceled for ${selected.displayName}.`)} disabled={action.status === "working"}>Cancel request</button>
              </>
            ) : selectedClaim ? (
              <span className="league-ownership-note"><ShieldCheck aria-hidden="true" /> {claimSummary(selectedClaim)}</span>
            ) : hasDifferentMembership ? (
              <span className="league-ownership-note"><ShieldCheck aria-hidden="true" /> You already {management.membership?.status === "approved" ? "manage" : "requested"} {management.membership?.franchiseName}. One manager can have one team.</span>
            ) : (
              <div className="league-claim-form">
                <label htmlFor="league-manager-name">Manager name</label>
                <input id="league-manager-name" value={managerName} onChange={(event) => setManagerName(event.target.value)} maxLength={50} placeholder="Name commissioner recognizes" />
                <button type="button" onClick={claimSelected} disabled={action.status === "working" || managerName.trim().length < 2}><UserPlus aria-hidden="true" /> {isCommissioner ? "Assign to me" : "Request this team"}</button>
              </div>
            )}
            <small>Team access is permissioned in Firestore and tied to a signed-in manager account; a Sleeper username alone never grants control.</small>
          </div>
        </header>

        <dl className="league-team-summary">
          <div><dt>Roster</dt><dd>{selected.roster.length}</dd><small>drafted players</small></div>
          <div><dt>Spent</dt><dd>${selected.spent}</dd><small>of ${selected.budget}</small></div>
          <div><dt>Projected starters</dt><dd>{formatProjection(lineup.projectedTotal, lineup.projectedStarterCount)}</dd><small>baseline pts/week</small></div>
          <div><dt>Coverage</dt><dd>{lineup.projectedStarterCount}/{lineup.slots.length}</dd><small>starters with projections</small></div>
        </dl>

        <div className="league-roster-section-heading">
          <div><span>Projected lineup</span><h3>Starters and depth</h3></div>
          <Link to={`/league/${encodeURIComponent(leagueId)}/matchups?team=${encodeURIComponent(selected.id)}`}>View matchups</Link>
        </div>
        <RosterTable lineup={lineup} scoring={toolScoring(season.scoring)} />
      </section>
    </div>
  );
}
