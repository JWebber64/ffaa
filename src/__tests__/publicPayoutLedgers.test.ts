import { describe, expect, it } from "vitest";

import {
  buildPayoutRecipients,
  getPublicPayoutLedger,
  summarizePayoutStatuses,
  validatePublicPayoutLedger,
} from "../features/league-history/data/publicPayoutLedgers";

describe("public league payout ledgers", () => {
  it("resolves the GOAT ledger from any season in the provider chain", () => {
    expect(getPublicPayoutLedger(["1254300099715018753"])?.season).toBe(2025);
    expect(getPublicPayoutLedger(["unrelated-league"])).toBeNull();
  });

  it("balances major and weekly awards to the full public pool", () => {
    const ledger = getPublicPayoutLedger(["1385319428408774656"]);
    expect(ledger).not.toBeNull();
    const validation = validatePublicPayoutLedger(ledger!);
    expect(validation).toEqual({
      isValid: true,
      issues: [],
      weeklyTotal: 2_800,
      majorTotal: 27_200,
      recipientTotal: 30_000,
    });
    expect(ledger!.weeklyAwards).toHaveLength(14);
  });

  it("preserves source payment labels without treating blanks as unpaid", () => {
    const ledger = getPublicPayoutLedger(["1385319428408774656"]);
    const recipients = buildPayoutRecipients(ledger!);
    expect(summarizePayoutStatuses(ledger!)).toEqual({
      paid: 23_200,
      processing: 5_200,
      unmarked: 1_600,
      not_applicable: 0,
    });
    expect(recipients.find((recipient) => recipient.owner === "Tom")).toMatchObject({ totalAmount: 400, status: "unmarked" });
    expect(recipients.find((recipient) => recipient.owner === "Hatch")).toMatchObject({ totalAmount: 5_200, status: "processing" });
    expect(recipients.find((recipient) => recipient.owner === "Joel")).toMatchObject({ totalAmount: 0, status: "not_applicable" });
  });
});
