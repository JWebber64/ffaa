import { describe, expect, it } from "vitest";

import { compareOfflineDraftPlayers } from "../screens_v2/offlineDraftPlayerOrder";
import type { Player } from "../types/draft";

const playerPool = [
  { id: "rank-1", name: "Lower Price", pos: "RB", rank: 1, auctionValue: 36 },
  { id: "rank-2", name: "Highest Price", pos: "RB", rank: 2, auctionValue: 48 },
  { id: "rank-3", name: "Middle Price", pos: "RB", rank: 3, auctionValue: 43 },
] satisfies Player[];

describe("offline draft player ordering", () => {
  it("shows available players by displayed price from highest to lowest", () => {
    const orderedPrices = [...playerPool]
      .sort(compareOfflineDraftPlayers)
      .map((player) => player.auctionValue);

    expect(orderedPrices).toEqual([48, 43, 36]);
  });
});
