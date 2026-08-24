export type PayoutPaymentStatus = "paid" | "processing" | "unmarked" | "not_applicable";

export interface WeeklyPayoutAward {
  week: number;
  winner: string;
  amount: number;
}

export interface MajorPayoutAward {
  id: string;
  label: string;
  winner: string;
  amount: number;
}

export interface PublicPayoutLedger {
  id: string;
  leagueExternalIds: string[];
  season: number;
  title: string;
  currency: "USD";
  totalPool: number;
  weeklyAwardAmount: number;
  weeklyAwards: WeeklyPayoutAward[];
  majorAwards: MajorPayoutAward[];
  owners: string[];
  paymentStatuses: Record<string, { status: PayoutPaymentStatus; note: string }>;
  carryovers: Array<{ label: string; amount: number; destination: string }>;
  sourceLabel: string;
  sourceUrl: string;
  verifiedAt: string;
  sourceNote: string;
}

export interface PayoutRecipient {
  owner: string;
  majorAmount: number;
  weeklyAmount: number;
  totalAmount: number;
  breakdown: string[];
  status: PayoutPaymentStatus;
  statusNote: string;
}

const GOAT_2025_PAYOUT_LEDGER: PublicPayoutLedger = {
  id: "goat-2025-public-payouts",
  leagueExternalIds: [
    "992455063442423808",
    "1108587587780022272",
    "1254300099715018753",
    "1385319428408774656",
  ],
  season: 2025,
  title: "GOAT FF Payslip",
  currency: "USD",
  totalPool: 30_000,
  weeklyAwardAmount: 200,
  weeklyAwards: [
    { week: 1, winner: "Hatch", amount: 200 },
    { week: 2, winner: "Jonny", amount: 200 },
    { week: 3, winner: "Tom", amount: 200 },
    { week: 4, winner: "Big John", amount: 200 },
    { week: 5, winner: "Big John", amount: 200 },
    { week: 6, winner: "Big John", amount: 200 },
    { week: 7, winner: "Kris", amount: 200 },
    { week: 8, winner: "Nevin", amount: 200 },
    { week: 9, winner: "Tom", amount: 200 },
    { week: 10, winner: "Landon", amount: 200 },
    { week: 11, winner: "Andrew", amount: 200 },
    { week: 12, winner: "Landon", amount: 200 },
    { week: 13, winner: "Kris", amount: 200 },
    { week: 14, winner: "Landon", amount: 200 },
  ],
  majorAwards: [
    { id: "playoffs-first", label: "1st Place Playoffs", winner: "Kris", amount: 12_000 },
    { id: "playoffs-second", label: "2nd Place Playoffs", winner: "Hatch", amount: 5_000 },
    { id: "playoffs-third", label: "3rd Place Playoffs", winner: "Clay", amount: 2_500 },
    { id: "regular-season-points", label: "Most Points (Regular Season)", winner: "Landon", amount: 7_700 },
  ],
  owners: ["Tom", "Clay", "Joel", "Big John", "Andrew", "Jonny", "Nevin", "Webber", "Hatch", "Kris", "Jay", "Landon"],
  paymentStatuses: {
    Tom: { status: "unmarked", note: "No paid status is recorded in the public sheet." },
    Clay: { status: "paid", note: "Marked Paid in the public sheet." },
    "Big John": { status: "unmarked", note: "No paid status is recorded in the public sheet." },
    Andrew: { status: "unmarked", note: "No paid status is recorded in the public sheet." },
    Jonny: { status: "unmarked", note: "No paid status is recorded in the public sheet." },
    Nevin: { status: "unmarked", note: "No paid status is recorded in the public sheet." },
    Hatch: { status: "processing", note: "Marked Processing (Draft Day) in the public sheet." },
    Kris: { status: "paid", note: "Marked Paid + Weekly in the public sheet." },
    Landon: { status: "paid", note: "Marked Paid + Weekly in the public sheet." },
  },
  carryovers: [
    { label: "Lube (Last place regular season) 2026 kitty", amount: 2_500, destination: "Added to next season payout" },
  ],
  sourceLabel: "Public GOAT FF Payslip spreadsheet",
  sourceUrl: "https://docs.google.com/spreadsheets/d/1kptUFTskheEuW1Tsi80KfZndtB1N-a1gwJk7OF1HpkY/edit",
  verifiedAt: "2026-08-25",
  sourceNote: "Payment labels reproduce the public sheet. A blank status is reported only as not marked paid, never inferred as unpaid.",
};

export const PUBLIC_PAYOUT_LEDGERS: readonly PublicPayoutLedger[] = [GOAT_2025_PAYOUT_LEDGER];

export function getPublicPayoutLedger(externalLeagueIds: Iterable<string>) {
  const requestedIds = new Set(externalLeagueIds);
  return PUBLIC_PAYOUT_LEDGERS.find((ledger) => ledger.leagueExternalIds.some((leagueId) => requestedIds.has(leagueId))) ?? null;
}

export function buildPayoutRecipients(ledger: PublicPayoutLedger): PayoutRecipient[] {
  const weeklyByOwner = new Map<string, WeeklyPayoutAward[]>();
  for (const award of ledger.weeklyAwards) {
    weeklyByOwner.set(award.winner, [...(weeklyByOwner.get(award.winner) ?? []), award]);
  }
  const majorByOwner = new Map<string, MajorPayoutAward[]>();
  for (const award of ledger.majorAwards) {
    majorByOwner.set(award.winner, [...(majorByOwner.get(award.winner) ?? []), award]);
  }

  return ledger.owners.map((owner) => {
    const weeklyAwards = weeklyByOwner.get(owner) ?? [];
    const majorAwards = majorByOwner.get(owner) ?? [];
    const weeklyAmount = weeklyAwards.reduce((sum, award) => sum + award.amount, 0);
    const majorAmount = majorAwards.reduce((sum, award) => sum + award.amount, 0);
    const totalAmount = weeklyAmount + majorAmount;
    const payment = ledger.paymentStatuses[owner] ?? {
      status: totalAmount ? "unmarked" as const : "not_applicable" as const,
      note: totalAmount ? "No paid status is recorded in the public sheet." : "No 2025 payout is recorded for this owner.",
    };
    return {
      owner,
      majorAmount,
      weeklyAmount,
      totalAmount,
      breakdown: [
        ...majorAwards.map((award) => award.label),
        ...(weeklyAwards.length ? [`${weeklyAwards.length} weekly high point${weeklyAwards.length === 1 ? "" : "s"}`] : []),
      ],
      status: payment.status,
      statusNote: payment.note,
    };
  });
}

export function summarizePayoutStatuses(ledger: PublicPayoutLedger) {
  return buildPayoutRecipients(ledger).reduce<Record<PayoutPaymentStatus, number>>((totals, recipient) => {
    totals[recipient.status] += recipient.totalAmount;
    return totals;
  }, { paid: 0, processing: 0, unmarked: 0, not_applicable: 0 });
}

export function validatePublicPayoutLedger(ledger: PublicPayoutLedger) {
  const issues: string[] = [];
  const weeklyTotal = ledger.weeklyAwards.reduce((sum, award) => sum + award.amount, 0);
  const majorTotal = ledger.majorAwards.reduce((sum, award) => sum + award.amount, 0);
  const recipientTotal = buildPayoutRecipients(ledger).reduce((sum, recipient) => sum + recipient.totalAmount, 0);
  if (ledger.weeklyAwards.some((award) => award.amount !== ledger.weeklyAwardAmount)) issues.push("Weekly award amounts do not match the configured weekly value.");
  if (new Set(ledger.weeklyAwards.map((award) => award.week)).size !== ledger.weeklyAwards.length) issues.push("Weekly award weeks must be unique.");
  if (weeklyTotal + majorTotal !== ledger.totalPool) issues.push("Major and weekly awards do not balance to the total pool.");
  if (recipientTotal !== ledger.totalPool) issues.push("Recipient payouts do not balance to the total pool.");
  return { isValid: issues.length === 0, issues, weeklyTotal, majorTotal, recipientTotal };
}
