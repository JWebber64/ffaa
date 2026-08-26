// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolPlayerPicker } from "../components/tools/ToolPlayerPicker";
import type { ToolPlayer } from "../data/toolPlayerData";

function player(overrides: Partial<ToolPlayer> = {}): ToolPlayer {
  return {
    id: "josh-allen",
    name: "Josh Allen",
    position: "QB",
    team: "BUF",
    rank: 1,
    positionRank: 1,
    byeWeek: 7,
    adp: 1,
    auctionValue: 52,
    marketValue: 50,
    projectedPoints: 400,
    projectedPointsPerGame: 23.5,
    valueConfidence: 0.9,
    valueSources: [],
    status: "Active",
    injuryStatus: "",
    historicalGames: 17,
    historicalPoints: 390,
    historicalPointsPerGame: 22.9,
    last3PointsPerGame: 24,
    floorPoints: 17,
    ceilingPoints: 30,
    standardDeviation: 5,
    opportunitiesPerGame: 7,
    targetsPerGame: 0,
    carriesPerGame: 7,
    targetShare: null,
    airYardsShare: null,
    weeklyPoints: [],
    summary: null,
    ...overrides,
  };
}

describe("ToolPlayerPicker", () => {
  it("shows each player's bye week in the shared picker label", () => {
    const { container } = render(
      <ToolPlayerPicker
        id="test-player"
        label="Player"
        players={[player()]}
        value="josh-allen"
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelector('option[value="josh-allen"]')?.textContent).toContain(
      "Josh Allen · QB · BUF | Bye 7 · $52",
    );
    expect(container.querySelector(".ffaa-custom-select-value-label")?.textContent).toContain(
      "BUF | Bye 7",
    );
  });
});
