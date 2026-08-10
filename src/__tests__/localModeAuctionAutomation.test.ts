// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPlayerPool } from "../data/loadPlayerPool";
import {
  appendLocalDraftAction,
  createLocalDraftRoom,
  getLocalDraftById,
  tickLocalDraft,
} from "../multiplayer/localMode";
import {
  DEFAULT_CONFIG_AUCTION_12,
  makeDefaultBudgets,
  type DraftConfigV2,
} from "../types/draftConfig";
import type { Player } from "../types/draft";

function makeAuctionConfig(overrides: {
  computerManagers?: number;
  nominationSeconds?: number;
  bidResetSeconds?: number;
} = {}): DraftConfigV2 {
  const teamCount = 8;
  const defaultBudget = 200;
  return {
    ...DEFAULT_CONFIG_AUCTION_12,
    teamCount,
    computerManagers: overrides.computerManagers ?? 0,
    auctionSettings: {
      ...DEFAULT_CONFIG_AUCTION_12.auctionSettings!,
      defaultBudget,
      teamBudgets: makeDefaultBudgets(teamCount, defaultBudget),
      nominationSeconds: overrides.nominationSeconds ?? 30,
      bidResetSeconds: overrides.bidResetSeconds ?? 10,
      nominationOrderMode: "fixed",
    },
  };
}

function toDraftPlayer(player: Player) {
  return {
    playerId: player.id,
    name: player.name,
    pos: player.pos,
    team: player.nflTeam,
    auctionValue: player.auctionValue,
    projectedValue: player.projectedValue,
  };
}

function getLastLogText(snapshot: NonNullable<ReturnType<typeof getLocalDraftById>>["snapshot"] | undefined) {
  const log = snapshot?.log ?? [];
  return log[log.length - 1]?.text ?? "";
}

describe("local auction automation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("force nominates for a human team when the nomination clock expires", () => {
    const draft = createLocalDraftRoom(
      "Host",
      makeAuctionConfig({ nominationSeconds: 1 })
    );

    appendLocalDraftAction(draft.id, "start_draft", {});
    expect(getLocalDraftById(draft.id)?.snapshot.phase).toBe("nominating");

    vi.setSystemTime(new Date(Date.now() + 2000));
    tickLocalDraft(draft.id);

    const snapshot = getLocalDraftById(draft.id)?.snapshot;
    expect(snapshot?.phase).toBe("bidding");
    expect(snapshot?.auction?.player?.playerId).toBeTruthy();
    expect(snapshot?.auction?.currentBid).toBe(0);
    expect(getLastLogText(snapshot)).toContain("Timer nominated");
  });

  it("lets CPU managers bid after a human nominates a player", () => {
    const draft = createLocalDraftRoom(
      "Host",
      makeAuctionConfig({ computerManagers: 1, bidResetSeconds: 10 })
    );
    const player = loadPlayerPool()[0]!;

    appendLocalDraftAction(draft.id, "start_draft", {});
    appendLocalDraftAction(draft.id, "nominate", {
      teamId: "t1",
      player: toDraftPlayer(player),
    });

    tickLocalDraft(draft.id);
    expect(getLocalDraftById(draft.id)?.snapshot.engine?.bot_action_key).toMatch(/^bid:/);

    vi.setSystemTime(new Date(Date.now() + 3000));
    tickLocalDraft(draft.id);

    const snapshot = getLocalDraftById(draft.id)?.snapshot;
    const highBidder = snapshot?.teams?.find(
      (team) => team.teamId === snapshot.auction?.highBidderTeamId
    );

    expect(snapshot?.phase).toBe("bidding");
    expect(snapshot?.auction?.currentBid ?? 0).toBeGreaterThan(0);
    expect(highBidder?.managerType).toBe("computer");
  });

  it("starts bidding at the nominator's selected dollar amount", () => {
    const draft = createLocalDraftRoom(
      "Host",
      makeAuctionConfig({ bidResetSeconds: 10 })
    );
    const player = loadPlayerPool()[0]!;

    appendLocalDraftAction(draft.id, "start_draft", {});
    appendLocalDraftAction(draft.id, "nominate", {
      teamId: "t1",
      player: toDraftPlayer(player),
      startingBid: 7,
    });

    const openedSnapshot = getLocalDraftById(draft.id)?.snapshot;
    expect(openedSnapshot?.phase).toBe("bidding");
    expect(openedSnapshot?.auction?.currentBid).toBe(7);
    expect(openedSnapshot?.auction?.highBidderTeamId).toBe("t1");
    expect(getLastLogText(openedSnapshot)).toContain("$7");

    appendLocalDraftAction(draft.id, "bid", {
      teamId: "t2",
      amount: 8,
    });

    const nextSnapshot = getLocalDraftById(draft.id)?.snapshot;
    expect(nextSnapshot?.auction?.currentBid).toBe(8);
    expect(nextSnapshot?.auction?.highBidderTeamId).toBe("t2");
  });

  it("ignores late bids after an auction is marked sold", () => {
    const draft = createLocalDraftRoom(
      "Host",
      makeAuctionConfig({ bidResetSeconds: 1 })
    );
    const player = loadPlayerPool()[0]!;

    appendLocalDraftAction(draft.id, "start_draft", {});
    appendLocalDraftAction(draft.id, "nominate", {
      teamId: "t1",
      player: toDraftPlayer(player),
    });
    appendLocalDraftAction(draft.id, "bid", {
      teamId: "t1",
      amount: 1,
    });

    vi.setSystemTime(new Date(Date.now() + 2000));
    tickLocalDraft(draft.id);

    expect(getLocalDraftById(draft.id)?.snapshot.auction?.call).toBe("sold");

    appendLocalDraftAction(draft.id, "bid", {
      teamId: "t2",
      amount: 2,
    });

    const snapshot = getLocalDraftById(draft.id)?.snapshot;
    expect(snapshot?.auction?.call).toBe("sold");
    expect(snapshot?.auction?.currentBid).toBe(1);
    expect(snapshot?.auction?.highBidderTeamId).toBe("t1");
  });

  it("accepts bids submitted before the deadline while the sold banner is showing", () => {
    const draft = createLocalDraftRoom(
      "Host",
      makeAuctionConfig({ bidResetSeconds: 1 })
    );
    const player = loadPlayerPool()[0]!;

    appendLocalDraftAction(draft.id, "start_draft", {});
    appendLocalDraftAction(draft.id, "nominate", {
      teamId: "t1",
      player: toDraftPlayer(player),
    });
    appendLocalDraftAction(draft.id, "bid", {
      teamId: "t1",
      amount: 1,
    });

    const submittedAt = Date.now() + 900;
    vi.setSystemTime(new Date(Date.now() + 1100));
    tickLocalDraft(draft.id);

    expect(getLocalDraftById(draft.id)?.snapshot.auction?.call).toBe("sold");

    appendLocalDraftAction(draft.id, "bid", {
      teamId: "t2",
      amount: 2,
      submittedAt,
    });

    const snapshot = getLocalDraftById(draft.id)?.snapshot;
    expect(snapshot?.auction?.call).toBe("none");
    expect(snapshot?.auction?.currentBid).toBe(2);
    expect(snapshot?.auction?.highBidderTeamId).toBe("t2");
  });
});
