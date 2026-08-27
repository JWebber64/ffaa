import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftOrderDraw } from "../features/draft-order/draftOrderEngine";
import type { DraftOrderParticipant, DraftRoomOrderContext } from "../features/draft-order/types";

const apiMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock("../multiplayer/api", () => ({
  getDraftConfig: apiMocks.getConfig,
  updateDraftConfig: apiMocks.updateConfig,
  getDraftByCode: vi.fn(),
}));
vi.mock("../multiplayer/firebaseBackend", () => ({ getFirebaseDraftById: vi.fn(), listFirebaseParticipants: vi.fn() }));
vi.mock("../multiplayer/localMode", () => ({
  isLocalMultiplayerMode: () => true,
  getLocalDraftById: vi.fn(),
  getLocalUserId: vi.fn(),
  listLocalParticipants: vi.fn(),
}));
vi.mock("../lib/authSession", () => ({ ensureFirebaseUserId: vi.fn() }));
vi.mock("../features/league-hq/sleeperLeague", () => ({ loadSleeperLeagueHQ: vi.fn() }));

import { applyDraftOrderToRoom } from "../features/draft-order/draftOrderLeagueAdapter";

const participants: DraftOrderParticipant[] = Array.from({ length: 8 }, (_, index) => ({
  id: `draft-room:user-${index}`,
  source: "draft-room",
  sourceId: `user-${index}`,
  managerName: `Manager ${index + 1}`,
  teamName: `Team ${index + 1}`,
  color: "var(--green-400)",
}));

beforeEach(() => {
  apiMocks.getConfig.mockResolvedValue({
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
  });
  apiMocks.updateConfig.mockResolvedValue(undefined);
});

describe("host application to the live room configuration", () => {
  it("writes the verified manager IDs to the config consumed by the room and fixes auction nomination order", async () => {
    const draw = await createDraftOrderDraw({ participants, mode: "football-plinko", masterSeed: "AAECAwQFBgcICQoLDA0ODw" });
    const context: DraftRoomOrderContext = {
      draftId: "room-id",
      code: "ABC123",
      draftType: "auction",
      teamCount: 8,
      humanSeatCount: 8,
      isHost: true,
      isLobby: true,
      participants,
    };
    await applyDraftOrderToRoom(context, draw);
    expect(apiMocks.updateConfig).toHaveBeenCalledWith("room-id", expect.objectContaining({
      auctionSettings: expect.objectContaining({ nominationOrderMode: "fixed" }),
      draftOrder: expect.objectContaining({
        drawId: draw.id,
        verificationHash: draw.verificationHash,
        participantUserIds: draw.finalParticipantIds.map((id) => draw.participants.find((participant) => participant.id === id)?.sourceId),
      }),
    }));
  });
});
