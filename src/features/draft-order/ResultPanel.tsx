import { Check, Clipboard, Link2, Play, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { Button } from "../../ui/Button";
import { ParticipantMark } from "./renderers/shared";
import { VerificationPanel } from "./VerificationPanel";
import {
  DRAFT_ORDER_MODES,
  MODE_LABELS,
  type DraftOrderDrawRecord,
  type DraftOrderMode,
  type DraftOrderVerification,
  type DraftRoomOrderContext,
} from "./types";

export function ResultPanel({
  draw,
  roomContext,
  accepted,
  readOnly,
  verification,
  actionStatus,
  onApply,
  onSave,
  onCopy,
  onShare,
  onReplay,
  onReroll,
  onChangeMode,
  onVerify,
  onCopyHash,
}: {
  draw: DraftOrderDrawRecord;
  roomContext: DraftRoomOrderContext | null;
  accepted: boolean;
  readOnly: boolean;
  verification: DraftOrderVerification | null;
  actionStatus: string;
  onApply: () => void;
  onSave: () => void;
  onCopy: () => void;
  onShare: () => void;
  onReplay: () => void;
  onReroll: () => void;
  onChangeMode: (mode: DraftOrderMode) => void;
  onVerify: () => void;
  onCopyHash: () => void;
}) {
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const applyReason = !roomContext
    ? "Import a GameHQ room during setup to apply an official order."
    : !roomContext.isHost
      ? "Only that room's host can apply the official order."
      : !roomContext.isLobby
        ? "This room has already started."
        : roomContext.participants.length !== roomContext.humanSeatCount
          ? `Waiting for all ${roomContext.humanSeatCount} human managers.`
          : "";

  return (
    <section className="showdown-results" aria-labelledby="showdown-results-title">
      <header className="results-hero">
        <div className="results-trophy" aria-hidden="true">1</div>
        <div><span>Order final · Draw {draw.rerollIndex + 1}</span><h2 id="showdown-results-title">{participants.get(draw.finalParticipantIds[0]!)?.teamName} owns the first pick</h2><p>{MODE_LABELS[draw.mode]} · {new Date(draw.createdAt).toLocaleString()}</p></div>
        <strong className={verification?.valid ? "is-verified" : ""}><ShieldCheck aria-hidden="true" /> {verification?.valid ? "Verified" : "Verification available"}</strong>
      </header>

      <div className="results-content">
        <ol className="final-order-list" aria-label="Complete final draft order">
          {draw.finalParticipantIds.map((id, index) => {
            const participant = participants.get(id)!;
            return (
              <li className={index === 0 ? "is-first" : ""} key={id}>
                <span>{index + 1}</span><ParticipantMark participant={participant} />
                <div><strong>{participant.teamName}</strong><small>{participant.managerName}</small></div>
                {index === 0 ? <em>First pick</em> : null}
              </li>
            );
          })}
        </ol>
        <details className="verification-disclosure">
          <summary><ShieldCheck aria-hidden="true" /><span><strong>Verify draw</strong><small>{verification?.valid ? "Verified" : "View seed and integrity check"}</small></span></summary>
          <VerificationPanel draw={draw} verification={verification} onVerify={onVerify} onCopyHash={onCopyHash} />
        </details>
      </div>

      <div className="results-actions" aria-label="Draft order actions">
        <div className="results-primary-actions">
          {!readOnly ? <Button onClick={onApply} disabled={Boolean(applyReason) || accepted}>{accepted ? <Check size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{accepted ? "Applied to Draft Room" : "Apply to Draft Room"}</Button> : null}
          {!readOnly ? <Button variant="secondary" onClick={onSave}><Save size={16} aria-hidden="true" /> Save Draw</Button> : null}
          {!readOnly ? <Button variant="secondary" onClick={onShare}><Link2 size={16} aria-hidden="true" /> Share Replay</Button> : null}
        </div>
        <div className="results-secondary-actions">
          <Button variant="ghost" onClick={onCopy}><Clipboard size={16} aria-hidden="true" /> Copy Order</Button>
          <Button variant="ghost" onClick={onReplay}><Play size={16} aria-hidden="true" /> Replay Animation</Button>
          {!readOnly ? <Button variant="ghost" onClick={onReroll}><RefreshCw size={16} aria-hidden="true" /> Generate New Order</Button> : null}
        </div>
      </div>
      {applyReason && !readOnly ? <p className="results-action-note">{applyReason}</p> : null}
      {actionStatus ? <p className="results-action-status" role="status">{actionStatus}</p> : null}

      <details className="alternate-reveal">
        <summary>Watch with another game</summary>
        <div>{DRAFT_ORDER_MODES.filter((mode) => mode !== draw.mode).map((mode) => <Button size="sm" variant="ghost" onClick={() => onChangeMode(mode)} key={mode}>{MODE_LABELS[mode]}</Button>)}</div>
      </details>
    </section>
  );
}
