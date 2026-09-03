import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, RotateCcw } from "lucide-react";

import { Button } from "../../ui/Button";
import { reverseRosterTransactionCommand } from "../league-domain/leagueCommands";
import type { CanonicalLeagueWorkspace, RosterTransaction } from "../league-domain/types";
import { loadCommissionerAudit, type CommissionerAuditSnapshot } from "./commissionerAudit";

const EMPTY_AUDIT: CommissionerAuditSnapshot = { events: [], transactions: [] };

export type CommissionerAuditService = {
  load: typeof loadCommissionerAudit;
  reverse: typeof reverseRosterTransactionCommand;
};

const defaultAuditService: CommissionerAuditService = {
  load: loadCommissionerAudit,
  reverse: reverseRosterTransactionCommand,
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function displayAction(value: string) {
  return value.replace(/_/gu, " ").replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function CommissionerAuditWorkspace({
  workspace,
  onWorkspaceChanged,
  service = defaultAuditService,
}: {
  workspace: CanonicalLeagueWorkspace;
  onWorkspaceChanged: () => void;
  service?: CommissionerAuditService;
}) {
  const season = workspace.season!;
  const [snapshot, setSnapshot] = useState(EMPTY_AUDIT);
  const [revision, setRevision] = useState(season.revision);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reversalTarget, setReversalTarget] = useState<RosterTransaction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);

  async function refresh() {
    const loaded = await service.load(workspace.league.id, season.id);
    setSnapshot(loaded);
    return loaded;
  }

  useEffect(() => {
    let active = true;
    setState("loading");
    service.load(workspace.league.id, season.id).then((loaded) => {
      if (!active) return;
      setSnapshot(loaded);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [season.id, service, workspace.league.id]);

  const transactionById = useMemo(() => new Map(snapshot.transactions.map((transaction) => [transaction.id, transaction])), [snapshot.transactions]);

  async function reverseTransaction() {
    if (!reversalTarget || reason.trim().length < 5) return;
    setBusy(true);
    setMessage(null);
    try {
      const receipt = await service.reverse({
        leagueId: workspace.league.id,
        seasonId: season.id,
        expectedRevision: revision,
        payload: { transactionId: reversalTarget.id },
        reason,
      });
      setRevision(receipt.resultingRevision);
      await refresh();
      onWorkspaceChanged();
      setReversalTarget(null);
      setReason("");
      setMessage({ tone: "status", text: `Roster transaction ${reversalTarget.id} was reversed.` });
    } catch (error) {
      const currentRevision = error && typeof error === "object" && "currentRevision" in error ? Number(error.currentRevision) : Number.NaN;
      if (Number.isFinite(currentRevision)) setRevision(currentRevision);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The reversal command failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="commissioner-audit-workspace">
      <header className="commissioner-page-header"><div><span className="hq-kicker">Universal audit</span><h1>Every action has a receipt</h1></div><p>Public league context stays readable; private administrative metadata is restricted to current commissioners.</p></header>
      {message ? <p className={`commissioner-message is-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}
      {state === "error" ? <p className="commissioner-message is-error" role="alert">The audit ledger could not be loaded.</p> : null}
      <section className="commissioner-audit-ledger" aria-busy={state === "loading"} aria-labelledby="audit-ledger-heading">
        <header><div><ClipboardCheck aria-hidden="true" /><div><h2 id="audit-ledger-heading">Commissioner ledger</h2><p>{snapshot.events.length} most recent immutable events</p></div></div><span>Season revision {revision}</span></header>
        {snapshot.events.length ? <div className="commissioner-table-scroll"><table><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Receipt</th><th scope="col">Actor</th><th scope="col">Revision</th><th scope="col">Reason</th><th scope="col">Correction</th></tr></thead><tbody>{snapshot.events.map((event) => {
          const transaction = event.transactionId ? transactionById.get(event.transactionId) : undefined;
          const reversible = transaction && transaction.approvalState === "accepted" && !transaction.reversalOfTransactionId && !transaction.reversedByTransactionId;
          return <tr key={event.id}><td data-label="When">{displayDate(event.timestamp)}</td><th scope="row" data-label="Action"><strong>{event.publicSummary || displayAction(event.action)}</strong><small>{displayAction(event.action)}</small></th><td data-label="Receipt"><code>{event.commandId.slice(0, 8)}</code>{event.transactionId ? <small>{event.transactionId.slice(0, 11)}</small> : null}</td><td data-label="Actor"><code>{event.actorUserId.slice(0, 10)}</code></td><td data-label="Revision">{event.previousRevision} → {event.resultingRevision}</td><td data-label="Reason">{event.reason || "—"}</td><td data-label="Correction">{reversible ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setReversalTarget(transaction); setReason(""); }}><RotateCcw aria-hidden="true" />Reverse</Button> : transaction?.approvalState === "reversed" ? "Reversed" : "—"}</td></tr>;
        })}</tbody></table></div> : <p className="commissioner-empty">No canonical league actions have been recorded.</p>}
      </section>
      {reversalTarget ? <section className="commissioner-removal" aria-labelledby="reversal-heading"><header><RotateCcw aria-hidden="true" /><div><h2 id="reversal-heading">Reverse {reversalTarget.id}?</h2><p>The inverse asset moves will commit atomically only if every roster still matches this transaction.</p></div></header><label htmlFor="transaction-reversal-reason"><span>Audit reason</span><textarea id="transaction-reversal-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} aria-describedby="transaction-reversal-help" /></label><small id="transaction-reversal-help">Enter at least five characters. A reversal never rewrites the original receipt.</small><div><Button type="button" size="sm" variant="ghost" onClick={() => { setReversalTarget(null); setReason(""); }}>Cancel</Button><Button type="button" size="sm" variant="danger" isLoading={busy} disabled={reason.trim().length < 5} onClick={() => void reverseTransaction()}>Reverse transaction</Button></div></section> : null}
    </div>
  );
}
