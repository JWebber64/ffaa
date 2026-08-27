import { CheckCircle2, Copy, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "../../ui/Button";
import type { DraftOrderDrawRecord, DraftOrderVerification } from "./types";

function shortHash(value: string) {
  return value.length > 30 ? `${value.slice(0, 18)}…${value.slice(-10)}` : value;
}

export function VerificationPanel({ draw, verification, onVerify, onCopyHash }: {
  draw: DraftOrderDrawRecord;
  verification: DraftOrderVerification | null;
  onVerify: () => void;
  onCopyHash: () => void;
}) {
  return (
    <section className="verification-panel" aria-labelledby="verification-title">
      <header><ShieldCheck aria-hidden="true" /><div><span>Transparent Random Draw</span><h3 id="verification-title">Verifiable draw record</h3></div></header>
      <dl>
        <div><dt>Algorithm</dt><dd>{draw.algorithmVersion}</dd></div>
        <div><dt>Seed</dt><dd title={draw.masterSeed}>{shortHash(draw.masterSeed)}</dd></div>
        <div><dt>Commitment</dt><dd title={draw.verificationHash}>{shortHash(draw.verificationHash)}</dd></div>
      </dl>
      {verification ? <p className={verification.valid ? "is-valid" : "is-invalid"} role="status">{verification.valid ? <CheckCircle2 aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}{verification.message}</p> : <p>The verifier independently regenerates the shuffle and commitment from this record.</p>}
      <footer><Button size="sm" variant="secondary" onClick={onVerify}><ShieldCheck size={15} aria-hidden="true" /> Verify Draw</Button><Button size="sm" variant="ghost" onClick={onCopyHash}><Copy size={15} aria-hidden="true" /> Copy hash</Button></footer>
    </section>
  );
}

