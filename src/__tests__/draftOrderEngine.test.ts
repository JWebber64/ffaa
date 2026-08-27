import { describe, expect, it } from "vitest";
import {
  changeDraftOrderRevealMode,
  createDraftOrderAnimationPlan,
  createDraftOrderDraw,
  createSecureSeed,
  verifyDraftOrderDraw,
} from "../features/draft-order/draftOrderEngine";
import type { DraftOrderParticipant } from "../features/draft-order/types";

const SEED_A = "AAECAwQFBgcICQoLDA0ODw";
const SEED_B = "Dw4NDAsKCQgHBgUEAwIBAA";

function participants(count: number): DraftOrderParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    managerName: `Manager ${index + 1}`,
    teamName: `Team ${index + 1}`,
    color: "var(--green-400)",
    source: "manual",
  }));
}

describe("draft-order draw engine", () => {
  it("reproduces the same order from the same seed and ordered participant snapshot", async () => {
    const input = {
      participants: participants(12),
      mode: "draft-dash" as const,
      masterSeed: SEED_A,
      drawId: "draw-one",
      createdAt: "2026-08-27T00:00:00.000Z",
    };
    const first = await createDraftOrderDraw(input);
    const second = await createDraftOrderDraw(input);
    expect(second.finalParticipantIds).toEqual(first.finalParticipantIds);
    expect(second.verificationHash).toBe(first.verificationHash);
  });

  it.each([8, 10, 12, 14, 16])("includes every participant exactly once for %i managers", async (count) => {
    const draw = await createDraftOrderDraw({
      participants: participants(count),
      mode: "football-plinko",
      masterSeed: SEED_A,
    });
    expect(draw.finalParticipantIds).toHaveLength(count);
    expect(new Set(draw.finalParticipantIds).size).toBe(count);
    expect(new Set(draw.finalParticipantIds)).toEqual(new Set(participants(count).map((entry) => entry.id)));
  });

  it("allows different seeds to produce different orders", async () => {
    const first = await createDraftOrderDraw({ participants: participants(16), mode: "draft-dash", masterSeed: SEED_A });
    const second = await createDraftOrderDraw({ participants: participants(16), mode: "draft-dash", masterSeed: SEED_B });
    expect(second.finalParticipantIds).not.toEqual(first.finalParticipantIds);
  });

  it("changes reveal mode without changing the locked result", async () => {
    const draw = await createDraftOrderDraw({ participants: participants(10), mode: "draft-dash", masterSeed: SEED_A });
    const changed = await changeDraftOrderRevealMode(draw, "helmet-shuffle");
    expect(changed.masterSeed).toBe(draw.masterSeed);
    expect(changed.finalParticipantIds).toEqual(draw.finalParticipantIds);
    expect(changed.verificationHash).toBe(draw.verificationHash);
    expect((await verifyDraftOrderDraw(changed)).valid).toBe(true);
  });

  it("replaying produces the same deterministic animation plan and result", async () => {
    const draw = await createDraftOrderDraw({ participants: participants(12), mode: "punt-bounce", masterSeed: SEED_A });
    const firstPlan = await createDraftOrderAnimationPlan(draw);
    const replayPlan = await createDraftOrderAnimationPlan(draw);
    expect(replayPlan).toEqual(firstPlan);
    expect(draw.rerollIndex).toBe(0);
  });

  it("rerolling creates a new seed and visible draw index", async () => {
    const seed = createSecureSeed();
    const nextSeed = createSecureSeed();
    expect(nextSeed).not.toBe(seed);
    const first = await createDraftOrderDraw({ participants: participants(8), mode: "draft-dash", masterSeed: seed, rerollIndex: 0 });
    const reroll = await createDraftOrderDraw({ participants: participants(8), mode: "draft-dash", masterSeed: nextSeed, rerollIndex: 1 });
    expect(reroll.masterSeed).not.toBe(first.masterSeed);
    expect(reroll.rerollIndex).toBe(1);
  });

  it("verifies an unchanged record and rejects result tampering", async () => {
    const draw = await createDraftOrderDraw({ participants: participants(14), mode: "fumble-pile", masterSeed: SEED_A });
    expect((await verifyDraftOrderDraw(draw)).valid).toBe(true);
    const tampered = {
      ...draw,
      finalParticipantIds: [draw.finalParticipantIds[1]!, draw.finalParticipantIds[0]!, ...draw.finalParticipantIds.slice(2)],
    };
    const verification = await verifyDraftOrderDraw(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.orderValid).toBe(false);
    expect(verification.hashValid).toBe(false);
  });
});
