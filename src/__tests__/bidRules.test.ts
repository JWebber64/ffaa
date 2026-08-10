import { describe, expect, it } from "vitest";
import { getBidValidation } from "../multiplayer/bidRules";
import type { DraftSnapshotState, RuntimeDraftSettings } from "../multiplayer/draftSnapshot";

const baseSettings: RuntimeDraftSettings = {
  draftType: "auction",
  scoring: "ppr",
  teamCount: 2,
  computerManagers: 0,
  nominationSeconds: 30,
  bidSeconds: 10,
  bidIncrements: [1, 2, 5, 10],
  startingBudget: 10,
  teamBudgets: [10, 10],
  nominationOrderMode: "fixed",
  rosterSlots: [
    { slot: "QB", count: 1 },
    { slot: "BENCH", count: 1 },
  ],
  snakeAutopick: true,
  snakePauseBetweenRounds: false,
};

function makeSnapshot(overrides: Partial<DraftSnapshotState> = {}): DraftSnapshotState {
  return {
    phase: "bidding",
    settings: baseSettings,
    auction: {
      player: {
        playerId: "p1",
        name: "Quarterback",
        pos: "QB",
      },
      currentBid: 0,
      highBidderTeamId: null,
      secondsLeft: 10,
      call: "none",
    },
    teams: [
      {
        teamId: "t1",
        name: "Team 1",
        budget: 10,
        spent: 0,
        roster: [],
      },
    ],
    ...overrides,
  };
}

describe("bidRules", () => {
  it("requires the configured minimum increment", () => {
    const snapshot = makeSnapshot({
      settings: {
        ...baseSettings,
        bidIncrements: [2, 4, 8],
      },
    });

    expect(getBidValidation(snapshot, "t1", 1).canBid).toBe(false);
    expect(getBidValidation(snapshot, "t1", 2).canBid).toBe(true);
  });

  it("reserves one dollar for each future open roster slot", () => {
    const snapshot = makeSnapshot({
      settings: {
        ...baseSettings,
        rosterSlots: [
          { slot: "QB", count: 1 },
          { slot: "BENCH", count: 2 },
        ],
      },
      teams: [
        {
          teamId: "t1",
          name: "Team 1",
          budget: 5,
          spent: 0,
          roster: [],
        },
      ],
    });

    expect(getBidValidation(snapshot, "t1").maxBid).toBe(3);
    expect(getBidValidation(snapshot, "t1", 4).canBid).toBe(false);
    expect(getBidValidation(snapshot, "t1", 3).canBid).toBe(true);
  });

  it("rejects a player who cannot fit any roster slot", () => {
    const snapshot = makeSnapshot({
      settings: {
        ...baseSettings,
        rosterSlots: [{ slot: "QB", count: 1 }],
      },
      auction: {
        player: {
          playerId: "p2",
          name: "Running Back",
          pos: "RB",
        },
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 10,
        call: "none",
      },
    });

    const validation = getBidValidation(snapshot, "t1", 1);

    expect(validation.canBid).toBe(false);
    expect(validation.reason).toBe("No roster slot fits this player.");
  });

  it("rejects bids from the current high bidder", () => {
    const snapshot = makeSnapshot({
      auction: {
        player: {
          playerId: "p1",
          name: "Quarterback",
          pos: "QB",
        },
        currentBid: 1,
        highBidderTeamId: "t1",
        secondsLeft: 10,
        call: "none",
      },
    });

    expect(getBidValidation(snapshot, "t1", 2).canBid).toBe(false);
  });

  it("rejects bids after the auction is sold", () => {
    const snapshot = makeSnapshot({
      auction: {
        player: {
          playerId: "p1",
          name: "Quarterback",
          pos: "QB",
        },
        currentBid: 1,
        highBidderTeamId: "t2",
        secondsLeft: 0,
        call: "sold",
      },
    });

    const validation = getBidValidation(snapshot, "t1", 2);

    expect(validation.canBid).toBe(false);
    expect(validation.reason).toBe("Auction is already sold.");
  });
});
