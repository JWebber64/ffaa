import { describe, expect, it } from "vitest";
import {
  chooseComputerBid,
  chooseComputerNomination,
  chooseComputerSnakePick,
  getComputerManagerNominationDelayMultiplier,
  getComputerManagerProfile,
  getComputerManagerThinkDelayMultiplier,
} from "../engine/autoManager";
import { normalizeRuntimeSettings, type DraftSnapshotState } from "../multiplayer/draftSnapshot";
import type { Player } from "../types/draft";

function makePlayer(
  id: string,
  name: string,
  pos: Player["pos"],
  rank: number,
  auctionValue?: number
): Player {
  return {
    id,
    name,
    pos,
    nflTeam: "FA",
    rank,
    ...(typeof auctionValue === "number" ? { auctionValue } : {}),
  };
}

const rosterSlots = [
  { slot: "QB", count: 1 },
  { slot: "RB", count: 1 },
  { slot: "WR", count: 1 },
  { slot: "BENCH", count: 1 },
];

function makeSettings(draftType: "auction" | "snake") {
  return normalizeRuntimeSettings({
    draftType,
    teamCount: 2,
    computerManagers: 1,
    rosterSlots,
    auctionSettings: {
      defaultBudget: 200,
      teamBudgets: [200, 200],
      nominationSeconds: 30,
      bidResetSeconds: 10,
      minIncrement: 1,
      nominationOrderMode: "fixed",
    },
    snakeSettings: {
      pickSeconds: 45,
      autopick: true,
      pauseBetweenRounds: false,
    },
  });
}

describe("autoManager", () => {
  it("assigns stable computer manager profiles from CPU labels", () => {
    expect(getComputerManagerProfile({ teamId: "t9", name: "CPU 1", managerType: "computer" }).id).toBe("balanced");
    expect(getComputerManagerProfile({ teamId: "t10", name: "CPU 2", managerType: "computer" }).id).toBe("aggressive");
    expect(getComputerManagerProfile({ teamId: "t11", name: "CPU 3", managerType: "computer" }).id).toBe("frugal");
    expect(getComputerManagerProfile({ teamId: "t12", name: "CPU 4", managerType: "computer" }).id).toBe("stars_and_scrubs");
    expect(getComputerManagerProfile({ teamId: "t13", name: "CPU 5", managerType: "computer" }).id).toBe("need_focused");
    expect(getComputerManagerProfile({ teamId: "t14", name: "CPU 6", managerType: "computer" }).id).toBe("balanced");
  });

  it("uses explicit computer manager profiles when provided", () => {
    expect(
      getComputerManagerProfile({
        teamId: "t9",
        name: "CPU 1",
        managerType: "computer",
        managerProfileId: "frugal",
      }).id
    ).toBe("frugal");
  });

  it("uses a faster delay profile for nominations than bids", () => {
    const team = { teamId: "t2", name: "CPU 1", managerType: "computer" as const };

    expect(getComputerManagerNominationDelayMultiplier(team)).toBeLessThan(
      getComputerManagerThinkDelayMultiplier(team)
    );
    expect(getComputerManagerNominationDelayMultiplier(team)).toBeLessThanOrEqual(0.45);
  });

  it("prioritizes open position needs when nominating", () => {
    const settings = makeSettings("auction");
    const snapshot: DraftSnapshotState = {
      phase: "nominating",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 30,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            {
              playerId: "qb-1",
              name: "Existing QB",
              pos: "QB",
              price: 10,
            },
          ],
        },
      ],
    };

    const players = [
      makePlayer("qb-elite", "Elite QB", "QB", 1),
      makePlayer("rb-elite", "Elite RB", "RB", 4),
      makePlayer("wr-elite", "Elite WR", "WR", 6),
    ];

    const nomination = chooseComputerNomination(snapshot, snapshot.teams![1]!, players);
    expect(nomination?.playerId).toBe("rb-elite");
  });

  it("nominates for pressing starter needs before pure value", () => {
    const settings = makeSettings("auction");
    const snapshot: DraftSnapshotState = {
      phase: "nominating",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 30,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            { playerId: "qb-1", name: "Existing QB", pos: "QB", price: 10 },
            { playerId: "rb-1", name: "Existing RB", pos: "RB", price: 24 },
          ],
        },
      ],
    };

    const players = [
      makePlayer("qb-star", "Star QB", "QB", 1, 45),
      makePlayer("wr-need", "Needed WR", "WR", 42, 18),
    ];

    const nomination = chooseComputerNomination(snapshot, snapshot.teams![1]!, players);
    expect(nomination?.playerId).toBe("wr-need");
  });

  it("falls back to high-value nominations when there is no pressing need", () => {
    const settings = makeSettings("auction");
    const snapshot: DraftSnapshotState = {
      phase: "nominating",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 30,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            { playerId: "qb-1", name: "Existing QB", pos: "QB", price: 10 },
            { playerId: "rb-1", name: "Existing RB", pos: "RB", price: 24 },
            { playerId: "wr-1", name: "Existing WR", pos: "WR", price: 18 },
          ],
        },
      ],
    };

    const players = [
      makePlayer("wr-depth", "Depth WR", "WR", 40, 14),
      makePlayer("qb-value", "High Value QB", "QB", 4, 36),
    ];

    const nomination = chooseComputerNomination(snapshot, snapshot.teams![1]!, players);
    expect(nomination?.playerId).toBe("qb-value");
  });

  it("bids with the computer team that still needs the player", () => {
    const settings = makeSettings("auction");
    const players = [
      makePlayer("rb-elite", "Elite RB", "RB", 4),
    ];

    const snapshot: DraftSnapshotState = {
      phase: "bidding",
      settings,
      order: {
        nominatingIndex: 0,
        currentNominatorTeamId: "t1",
      },
      auction: {
        player: {
          playerId: "rb-elite",
          name: "Elite RB",
          pos: "RB",
          team: "FA",
        },
        currentBid: 12,
        highBidderTeamId: "t1",
        secondsLeft: 9,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            {
              playerId: "qb-1",
              name: "Existing QB",
              pos: "QB",
              price: 8,
            },
          ],
        },
      ],
    };

    const bid = chooseComputerBid(snapshot, players);
    expect(bid?.teamId).toBe("t2");
    expect(bid?.amount ?? 0).toBeGreaterThan(13);
  });

  it("lets aggressive CPUs stretch modestly but stops above value", () => {
    const settings = normalizeRuntimeSettings({
      draftType: "auction",
      teamCount: 3,
      computerManagers: 2,
      rosterSlots: [
        { slot: "RB", count: 1 },
        { slot: "BENCH", count: 2 },
      ],
      auctionSettings: {
        defaultBudget: 200,
        teamBudgets: [200, 200, 200],
        nominationSeconds: 30,
        bidResetSeconds: 10,
        minIncrement: 1,
        nominationOrderMode: "fixed",
      },
    });
    const players = [
      makePlayer("rb-value", "Value RB", "RB", 8, 40),
    ];

    const baseSnapshot: DraftSnapshotState = {
      phase: "bidding",
      settings,
      order: {
        nominatingIndex: 0,
        currentNominatorTeamId: "t1",
      },
      auction: {
        player: {
          playerId: "rb-value",
          name: "Value RB",
          pos: "RB",
          team: "FA",
          auctionValue: 40,
        },
        currentBid: 43,
        highBidderTeamId: "t1",
        secondsLeft: 9,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 2",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [],
        },
        {
          teamId: "t3",
          name: "CPU 3",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [],
        },
      ],
    };

    const aggressiveBid = chooseComputerBid(baseSnapshot, players);
    expect(aggressiveBid?.teamId).toBe("t2");
    expect(aggressiveBid?.amount ?? 0).toBeGreaterThanOrEqual(44);
    expect(aggressiveBid?.amount ?? 0).toBeLessThanOrEqual(50);

    expect(
      chooseComputerBid(
        {
          ...baseSnapshot,
          auction: {
            ...baseSnapshot.auction!,
            currentBid: 50,
          },
        },
        players
      )
    ).toBeNull();

    const frugalOnly = {
      ...baseSnapshot,
      teams: [baseSnapshot.teams![0]!, baseSnapshot.teams![2]!],
    };
    expect(chooseComputerBid(frugalOnly, players)).toBeNull();
  });

  it("uses the same roster-need logic for snake picks", () => {
    const settings = makeSettings("snake");
    const snapshot: DraftSnapshotState = {
      phase: "picking",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
        overallPick: 5,
        snakeRound: 1,
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 40,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            {
              playerId: "qb-1",
              name: "Existing QB",
              pos: "QB",
              price: 0,
            },
            {
              playerId: "rb-1",
              name: "Existing RB",
              pos: "RB",
              price: 0,
            },
          ],
        },
      ],
    };

    const players = [
      makePlayer("qb-elite", "Elite QB", "QB", 1),
      makePlayer("rb-elite", "Elite RB", "RB", 3),
      makePlayer("wr-elite", "Elite WR", "WR", 8),
    ];

    const pick = chooseComputerSnakePick(snapshot, snapshot.teams![1]!, players);
    expect(pick?.playerId).toBe("wr-elite");
  });

  it("fills the last starter slot before taking extra bench depth", () => {
    const settings = normalizeRuntimeSettings({
      draftType: "auction",
      teamCount: 2,
      computerManagers: 1,
      rosterSlots: [
        { slot: "QB", count: 1 },
        { slot: "RB", count: 1 },
        { slot: "WR", count: 1 },
        { slot: "K", count: 1 },
        { slot: "BENCH", count: 1 },
      ],
      auctionSettings: {
        defaultBudget: 200,
        teamBudgets: [200, 200],
        nominationSeconds: 30,
        bidResetSeconds: 10,
        minIncrement: 1,
        nominationOrderMode: "fixed",
      },
    });
    const snapshot: DraftSnapshotState = {
      phase: "nominating",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 30,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            { playerId: "qb-1", name: "Existing QB", pos: "QB", price: 10 },
            { playerId: "rb-1", name: "Existing RB", pos: "RB", price: 18 },
            { playerId: "wr-1", name: "Existing WR", pos: "WR", price: 16 },
          ],
        },
      ],
    };

    const players = [
      makePlayer("wr-bench", "Bench WR", "WR", 8),
      makePlayer("k-starter", "Starter K", "K", 90),
    ];

    const nomination = chooseComputerNomination(snapshot, snapshot.teams![1]!, players);
    expect(nomination?.playerId).toBe("k-starter");
  });

  it("prefers skill-position bench depth over duplicate quarterback depth", () => {
    const settings = makeSettings("snake");
    const snapshot: DraftSnapshotState = {
      phase: "picking",
      settings,
      order: {
        nominatingIndex: 1,
        currentNominatorTeamId: "t2",
        overallPick: 7,
        snakeRound: 2,
      },
      auction: {
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: 40,
        call: "none",
      },
      teams: [
        {
          teamId: "t1",
          name: "Human",
          budget: 200,
          spent: 0,
          managerType: "human",
          roster: [],
        },
        {
          teamId: "t2",
          name: "CPU 1",
          budget: 200,
          spent: 0,
          managerType: "computer",
          roster: [
            { playerId: "qb-1", name: "Existing QB", pos: "QB", price: 0 },
            { playerId: "rb-1", name: "Existing RB", pos: "RB", price: 0 },
            { playerId: "wr-1", name: "Existing WR", pos: "WR", price: 0 },
          ],
        },
      ],
    };

    const players = [
      makePlayer("qb-elite", "Elite QB", "QB", 2),
      makePlayer("wr-depth", "Depth WR", "WR", 14),
      makePlayer("rb-depth", "Depth RB", "RB", 18),
    ];

    const pick = chooseComputerSnakePick(snapshot, snapshot.teams![1]!, players);
    expect(["wr-depth", "rb-depth"]).toContain(pick?.playerId);
    expect(pick?.playerId).not.toBe("qb-elite");
  });
});
