import { useMemo, useState } from "react";

import {
  applyNativeDraftActionCommand,
  revertNativeDraftActionCommand,
} from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, NativeDraft, SeasonTeam } from "../league-domain/types";
import { NumericInput } from "../../ui/NumericInput";
import { UniversalSelect } from "../../ui/UniversalSelect";
import "./native-draft.css";

function formatLabel(value: NativeDraft["format"]) {
  if (value === "third_round_reversal") return "Third-round reversal";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function playerLabel(playerId: string) {
  return playerId.replace(/^\d{4}-[A-Z]+-/u, "").replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function timeLabel(value: string | null) {
  if (!value) return "No active timer";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : value;
}

export function NativeDraftBoard({
  workspace,
  draft,
  teams,
  commissionerControls = false,
}: {
  workspace: CanonicalLeagueWorkspace;
  draft: NativeDraft;
  teams: SeasonTeam[];
  commissionerControls?: boolean;
}) {
  const [playerId, setPlayerId] = useState("");
  const [bidAmount, setBidAmount] = useState(draft.minimumBid);
  const [actingFranchiseId, setActingFranchiseId] = useState("");
  const [queueText, setQueueText] = useState("");
  const [reason, setReason] = useState("");
  const [visibleSelections, setVisibleSelections] = useState(100);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.franchiseId, team])), [teams]);
  const managedFranchiseIds = useMemo(() => {
    if (commissionerControls || workspace.authority.canManage) return draft.orderFranchiseIds;
    return workspace.roleGrants
      .filter((grant) => ["team_owner", "co_manager"].includes(grant.role) && !grant.revokedAt && grant.franchiseId)
      .map((grant) => grant.franchiseId!)
      .filter((id) => draft.orderFranchiseIds.includes(id));
  }, [commissionerControls, draft.orderFranchiseIds, workspace.authority.canManage, workspace.roleGrants]);
  const selectedFranchiseId = managedFranchiseIds.includes(actingFranchiseId) ? actingFranchiseId : managedFranchiseIds[0] ?? "";
  const currentTeam = draft.currentFranchiseId ? teamById.get(draft.currentFranchiseId) : null;
  const mayPick = Boolean(draft.currentFranchiseId && managedFranchiseIds.includes(draft.currentFranchiseId));

  async function apply(action: Parameters<typeof applyNativeDraftActionCommand>[0]["payload"]["action"], success: string) {
    setPending(action.type);
    setMessage({ tone: "status", text: "Sending the action to the authoritative draft…" });
    try {
      await applyNativeDraftActionCommand({
        leagueId: workspace.league.id,
        seasonId: draft.seasonId,
        expectedRevision: draft.seasonRevision,
        payload: { draftId: draft.id, expectedDraftRevision: draft.revision, action },
        reason: action.type === "pause" || action.type === "resume" || action.type === "complete" ? reason || success : success,
      });
      setMessage({ tone: "status", text: success });
      if (["pick", "nominate"].includes(action.type)) setPlayerId("");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The draft action could not be recorded." });
    } finally {
      setPending("");
    }
  }

  async function revertLast() {
    if (reason.trim().length < 5) {
      setMessage({ tone: "error", text: "Enter a clear audit reason before reverting the last result." });
      return;
    }
    setPending("revert");
    try {
      await revertNativeDraftActionCommand({
        leagueId: workspace.league.id,
        seasonId: draft.seasonId,
        expectedRevision: draft.seasonRevision,
        payload: { draftId: draft.id, expectedDraftRevision: draft.revision },
        reason,
      });
      setMessage({ tone: "status", text: "The last draft result was reversed and the room was paused." });
      setReason("");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The draft result could not be reverted." });
    } finally {
      setPending("");
    }
  }

  const activeAuction = draft.auctionState;
  const activeTeamState = draft.teamStates.find((team) => team.franchiseId === selectedFranchiseId);
  const remainingForTeam = activeTeamState ? activeTeamState.budget - activeTeamState.spent : 0;

  return (
    <section className="native-draft-board" aria-label="Native league draft">
      <header className="native-draft-header">
        <div>
          <span className="hq-kicker">{draft.mode === "slow" ? "Slow draft" : "Live draft"} · {formatLabel(draft.format)}</span>
          <h1>{draft.status === "complete" ? "Draft complete" : currentTeam ? `${currentTeam.name} is on the clock` : "Native draft room"}</h1>
          <p>Revision {draft.revision} · {draft.selections.length} of {draft.rosterSize * draft.orderFranchiseIds.length} roster spots published</p>
        </div>
        <div className={`native-draft-status is-${draft.status}`}><span>Status</span><strong>{draft.status}</strong><small>{timeLabel(draft.currentDeadlineAt)}</small></div>
      </header>

      {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}

      {draft.status !== "complete" && managedFranchiseIds.length ? (
        <div className="native-draft-action-shell">
          <div className="native-draft-player-action">
            <label><span>Player ID</span><input value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="2026-RB-player-name" /></label>
            {draft.format === "auction" ? (
              activeAuction ? (
                <div className="native-auction-live">
                  <div><span>Current auction</span><strong>{playerLabel(activeAuction.playerId)}</strong><small>${activeAuction.currentBid} · {teamById.get(activeAuction.highBidderFranchiseId)?.name ?? "No high bidder"}</small></div>
                  <label><span>Bid for</span><UniversalSelect aria-label="Auction bidding team" value={selectedFranchiseId} onValueChange={setActingFranchiseId}>{managedFranchiseIds.map((id) => <option key={id} value={id}>{teamById.get(id)?.name ?? id}</option>)}</UniversalSelect></label>
                  <label><span>Bid amount</span><NumericInput aria-label="Native auction bid amount" min={activeAuction.currentBid + draft.minimumBid} max={remainingForTeam} value={bidAmount} onChange={(event) => setBidAmount(Number(event.target.value))} /></label>
                  <button type="button" disabled={!selectedFranchiseId || Boolean(pending)} onClick={() => void apply({ type: "bid", franchiseId: selectedFranchiseId, amount: bidAmount }, "Bid accepted by the native draft.")}>Place bid</button>
                  {commissionerControls ? <button type="button" disabled={Boolean(pending)} onClick={() => void apply({ type: "settle" }, "Auction sale published to the roster ledger.")}>Settle expired sale</button> : null}
                </div>
              ) : (
                <div className="native-draft-inline-actions">
                  <label><span>Opening bid</span><NumericInput aria-label="Native auction opening bid" min={draft.minimumBid} value={bidAmount} onChange={(event) => setBidAmount(Number(event.target.value))} /></label>
                  <button type="button" disabled={!mayPick || !playerId.trim() || Boolean(pending)} onClick={() => void apply({ type: "nominate", playerId: playerId.trim(), openingBid: bidAmount }, "Nomination opened for bidding.")}>Nominate player</button>
                </div>
              )
            ) : (
              <div className="native-draft-inline-actions">
                <button type="button" disabled={!mayPick || !playerId.trim() || Boolean(pending)} onClick={() => void apply({ type: "pick", playerId: playerId.trim() }, "Selection published to the team roster.")}>Make pick</button>
                {commissionerControls ? <button type="button" disabled={!playerId.trim() || Boolean(pending)} onClick={() => void apply(playerId.trim() ? { type: "autopick", playerId: playerId.trim() } : { type: "autopick" }, "Commissioner autopick published.")}>Auto-pick</button> : null}
              </div>
            )}
          </div>

          {selectedFranchiseId ? <div className="native-draft-queue"><label><span>Queue · {teamById.get(selectedFranchiseId)?.name}</span><textarea rows={2} value={queueText} onChange={(event) => setQueueText(event.target.value)} placeholder="One player ID per line" /></label><button type="button" disabled={Boolean(pending)} onClick={() => void apply({ type: "set_queue", franchiseId: selectedFranchiseId, playerIds: queueText.split(/[\n,]+/u).map((value) => value.trim()).filter(Boolean) }, "Draft queue saved for reconnect and auto-pick.")}>Save queue</button></div> : null}
        </div>
      ) : null}

      {commissionerControls && draft.status !== "lobby" ? (
        <div className="native-draft-controls" aria-label="Commissioner draft controls">
          <label><span>Audit reason for control or correction</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain a pause or correction" /></label>
          {draft.status === "live" ? <button type="button" disabled={Boolean(pending)} onClick={() => void apply({ type: "pause" }, "Native draft paused.")}>Pause</button> : null}
          {draft.status === "paused" ? <button type="button" disabled={Boolean(pending)} onClick={() => void apply({ type: "resume" }, "Native draft resumed.")}>Resume</button> : null}
          {draft.selections.length ? <button type="button" className="is-danger" disabled={Boolean(pending)} onClick={() => void revertLast()}>Revert last result</button> : null}
        </div>
      ) : null}

      <div className="native-draft-team-table" role="table" aria-label="Draft team progress">
        <div role="row" className="native-draft-team-head"><span role="columnheader">Pick</span><span role="columnheader">Team</span><span role="columnheader">Players</span>{draft.format === "auction" ? <><span role="columnheader">Spent</span><span role="columnheader">Left</span></> : null}</div>
        {draft.orderFranchiseIds.map((franchiseId, index) => {
          const team = teamById.get(franchiseId);
          const state = draft.teamStates.find((entry) => entry.franchiseId === franchiseId);
          return <div role="row" key={franchiseId} className={franchiseId === draft.currentFranchiseId ? "is-current" : ""}><span role="cell" data-label="Pick">{index + 1}</span><strong role="cell" data-label="Team">{team?.name ?? franchiseId}</strong><span role="cell" data-label="Players">{state?.picks ?? 0} / {draft.rosterSize}</span>{draft.format === "auction" ? <><span role="cell" data-label="Spent">${state?.spent ?? 0}</span><span role="cell" data-label="Left">${(state?.budget ?? 0) - (state?.spent ?? 0)}</span></> : null}</div>;
        })}
      </div>

      <section className="native-draft-ledger" aria-labelledby="native-draft-ledger-title">
        <header><div><span>Authoritative results</span><h2 id="native-draft-ledger-title">Draft ledger</h2></div><strong>{draft.selections.length} selections</strong></header>
        {draft.selections.length ? <><ol>{[...draft.selections].reverse().slice(0, visibleSelections).map((selection) => <li key={selection.id}><span>#{selection.overallPick}</span><div><strong>{playerLabel(selection.playerId)}</strong><small>{teamById.get(selection.franchiseId)?.name ?? selection.franchiseId} · Round {selection.round}{selection.price ? ` · $${selection.price}` : ""}</small></div><code>{selection.rosterTransactionId}</code></li>)}</ol>{visibleSelections < draft.selections.length ? <button className="native-draft-load-more" type="button" onClick={() => setVisibleSelections((count) => count + 100)}>Show 100 older selections</button> : null}</> : <p>No selections have been published yet.</p>}
      </section>
    </section>
  );
}
