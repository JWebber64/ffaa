import { describe, expect, it } from "vitest";
import {
  applyAuctionStateToSnapshot,
  auctionStateFromSnapshot,
  normalizeAuctionState,
} from "../multiplayer/auctionState";
import type { DraftSnapshotState, RuntimeDraftSettings } from "../multiplayer/draftSnapshot";

const settings: RuntimeDraftSettings = {
  draftType: "auction",
  scoring: "ppr",
  teamCount: 2,
  computerManagers: 0,
  nominationSeconds: 30,
  bidSeconds: 10,
  bidIncrements: [1],
  startingBudget: 200,
  teamBudgets: [200, 200],
  nominationOrderMode: "fixed",
  rosterSlots: [],
  snakeAutopick: true,
  snakePauseBetweenRounds: false,
};

function makeSnapshot(): DraftSnapshotState {
  const timerExpiresAt = new Date(Date.now() + 8000).toISOString();
  return {
    phase: "bidding",
    settings,
    auction: {
      player: {
        playerId: "p1",
        name: "Player One",
      },
      currentBid: 1,
      highBidderTeamId: "t1",
      secondsLeft: 8,
      call: "once",
    },
    engine: {
      timer_expires_at: timerExpiresAt,
      bid_window_expires_at: timerExpiresAt,
    },
    teams: [],
  };
}

describe("auctionState", () => {
  it("projects the hot auction fields from a draft snapshot", () => {
    const state = auctionStateFromSnapshot(makeSnapshot());

    expect(state.playerId).toBe("p1");
    expect(state.currentBid).toBe(1);
    expect(state.highBidderTeamId).toBe("t1");
    expect(state.bidWindowExpiresAt).toBe(state.timerExpiresAt);
    expect(state.call).toBe("once");
  });

  it("merges matching hot state into a snapshot", () => {
    const snapshot = makeSnapshot();
    const timerExpiresAt = new Date(Date.now() + 10000).toISOString();
    const merged = applyAuctionStateToSnapshot(
      snapshot,
      normalizeAuctionState({
        playerId: "p1",
        currentBid: 5,
        highBidderTeamId: "t2",
        timerExpiresAt,
        bidWindowExpiresAt: timerExpiresAt,
        call: "none",
        actionId: "bid-1",
        updatedAt: new Date().toISOString(),
        version: 2,
      })
    );

    expect(merged.auction?.currentBid).toBe(5);
    expect(merged.auction?.highBidderTeamId).toBe("t2");
    expect(merged.auction?.call).toBe("none");
    expect(merged.engine?.timer_expires_at).toBe(timerExpiresAt);
    expect(merged.engine?.bid_window_expires_at).toBe(timerExpiresAt);
  });

  it("ignores stale hot state for a different player", () => {
    const snapshot = makeSnapshot();
    const merged = applyAuctionStateToSnapshot(
      snapshot,
      normalizeAuctionState({
        playerId: "previous-player",
        currentBid: 99,
        highBidderTeamId: "t2",
        timerExpiresAt: new Date(Date.now() + 10000).toISOString(),
        bidWindowExpiresAt: new Date(Date.now() + 10000).toISOString(),
        call: "none",
        actionId: "bid-1",
        updatedAt: new Date().toISOString(),
        version: 2,
      })
    );

    expect(merged.auction?.currentBid).toBe(1);
    expect(merged.auction?.highBidderTeamId).toBe("t1");
  });
});
