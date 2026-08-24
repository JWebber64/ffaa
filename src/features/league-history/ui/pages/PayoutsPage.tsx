import { BadgeDollarSign, CheckCircle2, Clock3, ExternalLink, FileQuestion, WalletCards } from "lucide-react";

import {
  buildPayoutRecipients,
  getPublicPayoutLedger,
  summarizePayoutStatuses,
  type PayoutPaymentStatus,
} from "../../data/publicPayoutLedgers";
import { useLeagueHistorySnapshot } from "../historyContext";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function statusLabel(status: PayoutPaymentStatus) {
  if (status === "paid") return "Paid";
  if (status === "processing") return "Processing";
  if (status === "unmarked") return "Not marked paid";
  return "No payout recorded";
}

export function PayoutsPage() {
  const snapshot = useLeagueHistorySnapshot();
  const ledger = getPublicPayoutLedger([
    snapshot.league.currentExternalLeagueId,
    ...snapshot.seasons.map((season) => season.providerLeagueId),
  ]);

  if (!ledger) {
    return (
      <main className="history-content">
        <section className="history-page-heading">
          <span>Public financial history</span>
          <h2>Payout ledger</h2>
          <p>No verified public payout source is linked to this league.</p>
        </section>
        <div className="history-empty">Payouts remain unavailable until an authoritative public ledger is validated.</div>
      </main>
    );
  }

  const recipients = buildPayoutRecipients(ledger);
  const statuses = summarizePayoutStatuses(ledger);
  const weeklyByWinner = new Map<string, number>();
  for (const award of ledger.weeklyAwards) weeklyByWinner.set(award.winner, (weeklyByWinner.get(award.winner) ?? 0) + award.amount);

  return (
    <main className="history-content history-payout-page">
      <section className="history-page-heading history-page-heading-row">
        <div>
          <span>Public financial history · {ledger.season}</span>
          <h2>{ledger.title}</h2>
          <p>Prize awards, weekly high points, payment labels, and carryover notes reproduced from the league’s public source.</p>
        </div>
        <a className="history-action-link" href={ledger.sourceUrl} target="_blank" rel="noreferrer">
          Open source sheet <ExternalLink size={14} aria-hidden="true" />
        </a>
      </section>

      <section className="history-payout-summary" aria-label={`${ledger.season} payout status summary`}>
        <article><span>Total pool</span><strong>{currency.format(ledger.totalPool)}</strong><small>Major awards plus 14 weekly prizes</small></article>
        <article data-status="paid"><span><CheckCircle2 size={14} aria-hidden="true" /> Marked paid</span><strong>{currency.format(statuses.paid)}</strong><small>As labeled in the public sheet</small></article>
        <article data-status="processing"><span><Clock3 size={14} aria-hidden="true" /> Processing</span><strong>{currency.format(statuses.processing)}</strong><small>Marked “Processing (Draft Day)”</small></article>
        <article data-status="unmarked"><span><FileQuestion size={14} aria-hidden="true" /> No paid status</span><strong>{currency.format(statuses.unmarked)}</strong><small>Blank status; not inferred as unpaid</small></article>
      </section>

      <section className="history-section-grid history-payout-feature-grid">
        <article className="history-panel history-panel-wide">
          <header><div><span>Season prizes</span><h2>Major awards</h2></div><BadgeDollarSign aria-hidden="true" /></header>
          <div className="history-table-wrap">
            <table className="history-table history-payout-awards-table">
              <thead><tr><th>Award</th><th>Winner</th><th>Base prize</th><th>Weekly bonus</th><th>Total payout</th></tr></thead>
              <tbody>{ledger.majorAwards.map((award) => {
                const weeklyAmount = weeklyByWinner.get(award.winner) ?? 0;
                return (
                  <tr key={award.id}>
                    <td><strong>{award.label}</strong></td>
                    <td>{award.winner}</td>
                    <td>{currency.format(award.amount)}</td>
                    <td>{weeklyAmount ? currency.format(weeklyAmount) : "—"}</td>
                    <td><strong>{currency.format(award.amount + weeklyAmount)}</strong></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </article>

        <article className="history-panel history-payout-source-panel">
          <header><div><span>Source record</span><h2>What this ledger means</h2></div><WalletCards aria-hidden="true" /></header>
          <p>{ledger.sourceNote}</p>
          <dl>
            <div><dt>Source</dt><dd>{ledger.sourceLabel}</dd></div>
            <div><dt>Verified</dt><dd>{new Date(`${ledger.verifiedAt}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</dd></div>
            <div><dt>Weekly prize</dt><dd>{currency.format(ledger.weeklyAwardAmount)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="history-panel">
        <header><div><span>Fourteen completed awards</span><h2>Weekly high points</h2></div><span className="history-count">{currency.format(ledger.weeklyAwards.reduce((sum, award) => sum + award.amount, 0))}</span></header>
        <div className="history-payout-weeks">
          {ledger.weeklyAwards.map((award) => (
            <article key={award.week}>
              <span>Week {award.week}</span>
              <strong>{award.winner}</strong>
              <small>{currency.format(award.amount)}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="history-panel history-payout-ledger-panel">
        <header><div><span>Owner-level reconciliation</span><h2>Payment ledger</h2></div><span className="history-count">{recipients.length} owners</span></header>
        <div className="history-table-wrap">
          <table className="history-table history-payout-ledger-table">
            <thead><tr><th>Owner</th><th>Awards</th><th>Major prizes</th><th>Weekly prizes</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{recipients.map((recipient) => (
              <tr key={recipient.owner}>
                <td><strong>{recipient.owner}</strong></td>
                <td>{recipient.breakdown.length ? recipient.breakdown.join(" · ") : "No 2025 payout recorded"}</td>
                <td>{recipient.majorAmount ? currency.format(recipient.majorAmount) : "—"}</td>
                <td>{recipient.weeklyAmount ? currency.format(recipient.weeklyAmount) : "—"}</td>
                <td><strong>{recipient.totalAmount ? currency.format(recipient.totalAmount) : "—"}</strong></td>
                <td><span className="history-payment-status" data-status={recipient.status} title={recipient.statusNote}>{statusLabel(recipient.status)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="history-table-note">Status labels are copied from the public sheet. “Not marked paid” means the source cell is blank; it is not a claim that payment was not made.</p>
      </section>

      {ledger.carryovers.map((carryover) => (
        <aside className="history-payout-carryover" key={carryover.label}>
          <div><span>Next-season note</span><strong>{carryover.label}</strong><small>{carryover.destination}</small></div>
          <strong>{currency.format(carryover.amount)}</strong>
        </aside>
      ))}
    </main>
  );
}
