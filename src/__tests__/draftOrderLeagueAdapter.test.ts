import { describe, expect, it } from "vitest";
import { createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import { applyDraftOrderToRoom } from "../features/draft-order/draftOrderLeagueAdapter";
import type { DraftOrderParticipant, DraftRoomOrderContext } from "../features/draft-order/types";

const participants: DraftOrderParticipant[] = Array.from({ length: 8 }, (_, index) => ({
  id: `draft-room:user-${index}`,
  source: "draft-room",
  sourceId: `user-${index}`,
  managerName: `Manager ${index + 1}`,
  teamName: `Team ${index + 1}`,
  color: "var(--green-400)",
}));

describe("draft-order league application guard", () => {
  it("rejects an official update from a non-host before any room mutation", async () => {
    const draw = await createDraftOrderDraw({ participants, mode: "draft-dash", masterSeed: "AAECAwQFBgcICQoLDA0ODw" });
    const context: DraftRoomOrderContext = {
      draftId: "room-id",
      code: "ABC123",
      draftType: "snake",
      teamCount: 8,
      humanSeatCount: 8,
      isHost: false,
      isLobby: true,
      participants,
    };
    await expect(applyDraftOrderToRoom(context, draw)).rejects.toThrow("Only the GameHQ draft host");
  });
});

