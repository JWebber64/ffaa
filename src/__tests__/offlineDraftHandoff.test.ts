// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import {
  OFFLINE_DRAFT_HANDOFF_KEY,
  clearOfflineDraftHandoff,
  createOfflineDraftHandoff,
  loadOfflineDraftHandoff,
  saveOfflineDraftHandoff,
} from "../features/draft-order/offlineDraftHandoff";
import type { DraftOrderParticipant, DraftRoomOrderContext } from "../features/draft-order/types";

const participants: DraftOrderParticipant[] = Array.from({ length: 8 }, (_, index) => ({
  id: `manager-${index + 1}`,
  managerName: `Manager ${index + 1}`,
  teamName: `Team ${index + 1}`,
  color: "var(--green-400)",
  source: "manual",
}));

beforeEach(() => window.localStorage.clear());

describe("offline draft handoff", () => {
  it("stores the exact verified finish order with a snake default", async () => {
    const draw = await createDraftOrderDraw({
      participants,
      mode: "draft-dash",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const handoff = createOfflineDraftHandoff(draw, null);
    const participantsById = new Map(draw.participants.map((participant) => [participant.id, participant]));

    expect(handoff.draftType).toBe("snake");
    expect(handoff.participants.map((participant) => participant.teamName)).toEqual(
      draw.finalParticipantIds.map((id) => participantsById.get(id)?.teamName),
    );

    saveOfflineDraftHandoff(handoff);
    expect(loadOfflineDraftHandoff()).toEqual(handoff);
    clearOfflineDraftHandoff();
    expect(window.localStorage.getItem(OFFLINE_DRAFT_HANDOFF_KEY)).toBeNull();
  });

  it("carries the connected room's auction format into the offline fallback", async () => {
    const roomParticipants = participants.map((participant, index) => ({
      ...participant,
      id: `draft-room:user-${index}`,
      source: "draft-room" as const,
      sourceId: `user-${index}`,
    }));
    const draw = await createDraftOrderDraw({
      participants: roomParticipants,
      mode: "football-plinko",
      masterSeed: "AAECAwQFBgcICQoLDA0ODw",
    });
    const roomContext: DraftRoomOrderContext = {
      draftId: "room-id",
      code: "ABC123",
      draftType: "auction",
      teamCount: 8,
      humanSeatCount: 8,
      isHost: true,
      isLobby: true,
      participants: roomParticipants,
    };

    expect(createOfflineDraftHandoff(draw, roomContext).draftType).toBe("auction");
  });
});
