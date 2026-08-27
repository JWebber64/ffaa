import { describe, expect, it } from "vitest";
import {
  normalizeDraftConfigV2,
  orderByOfficialDraftOrder,
  type DraftConfigV2,
} from "../types/draftConfig";

const config: DraftConfigV2 = {
  leagueType: "redraft",
  draftType: "auction",
  teamCount: 8,
  scoring: "ppr",
  rosterSlots: [],
  auctionSettings: {
    defaultBudget: 200,
    teamBudgets: Array(8).fill(200),
    nominationSeconds: 30,
    bidResetSeconds: 10,
    minIncrement: 1,
    nominationOrderMode: "random_first_rotate",
  },
};

describe("official live-room order", () => {
  it("orders matched managers first and keeps unmatched CPU seats stable", () => {
    const values = [
      { id: "u1" },
      { id: "u2" },
      { id: null },
      { id: "u3" },
    ];
    const ordered = orderByOfficialDraftOrder(values, {
      participantUserIds: ["u3", "u1", "u2"],
      drawId: "draw",
      verificationHash: "hash",
      algorithmVersion: "gamehq-draft-order-v1",
      mode: "draft-dash",
      appliedAt: "2026-08-27T00:00:00.000Z",
    }, (value) => value.id);
    expect(ordered.map((value) => value.id)).toEqual(["u3", "u1", "u2", null]);
  });

  it("preserves a valid official order through config normalization", () => {
    const normalized = normalizeDraftConfigV2({
      ...config,
      draftOrder: {
        participantUserIds: ["u2", "u1"],
        drawId: "draw",
        verificationHash: "hash",
        algorithmVersion: "gamehq-draft-order-v1",
        mode: "helmet-shuffle",
        appliedAt: "2026-08-27T00:00:00.000Z",
      },
    });
    expect(normalized.draftOrder?.participantUserIds).toEqual(["u2", "u1"]);
  });
});

