/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatsExplorer from "@/screens/StatsExplorer";

const mocks = vi.hoisted(() => ({
  loadFfcAdp: vi.fn(),
  loadSleeperPlayerDirectory: vi.fn(),
  loadSleeperTrending: vi.fn(),
  loadWeeklyPlayerStats: vi.fn(),
}));

vi.mock("@/data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("@/data/playerStatCategories", () => ({
  buildPlayerStatRows: () => [
    {
      player: {
        id: "rookie-2026",
        name: "Rookie 2026",
        pos: "WR",
        nflTeam: "NE",
        rank: 1,
        search_rank: 1,
        search_rank_ppr: 1,
      },
      derived: {},
      sleeper: { playerId: "101", status: "Active" },
      espnClay: { projectedPoints: 204, games: 17 },
    },
    {
      player: {
        id: "veteran-2026",
        name: "Veteran Current",
        pos: "WR",
        nflTeam: "SF",
        rank: 2,
        search_rank: 2,
        search_rank_ppr: 2,
      },
      derived: {},
      sleeper: { playerId: "102", status: "Active" },
      espnClay: { projectedPoints: 170, games: 17 },
    },
  ],
}));

vi.mock("@/data/sleeperPlayerDirectory", () => ({
  loadSleeperPlayerDirectory: mocks.loadSleeperPlayerDirectory,
}));

vi.mock("@/data/publicFantasySignals", () => ({
  FANTASY_FOOTBALL_CALCULATOR_SOURCE: {
    name: "Fantasy Football Calculator",
    attribution: "Public ADP",
  },
  SLEEPER_TRENDING_SOURCE: {
    name: "Sleeper",
    attribution: "Public trends",
  },
  loadFfcAdp: mocks.loadFfcAdp,
  loadSleeperTrending: mocks.loadSleeperTrending,
}));

vi.mock("@/data/weeklyPlayerStats", () => ({
  loadWeeklyPlayerStats: mocks.loadWeeklyPlayerStats,
}));

vi.mock("@/data/sleeperAuctionDraft", () => ({
  loadSleeperAuctionDraft: vi.fn(),
}));

describe("StatsExplorer 2026 Trends", () => {
  beforeEach(() => {
    mocks.loadFfcAdp.mockResolvedValue({ meta: {}, players: [] });
    mocks.loadSleeperPlayerDirectory.mockResolvedValue([]);
    mocks.loadSleeperTrending.mockImplementation(({ type }: { type: "add" | "drop" }) =>
      Promise.resolve(type === "add"
        ? [{ playerId: "101", count: 9, type: "add" }]
        : [{ playerId: "102", count: 4, type: "drop" }]),
    );
    mocks.loadWeeklyPlayerStats.mockResolvedValue({
      rows: [],
      unavailableSeasons: [],
      summaries: [
        {
          playerId: "veteran-2025",
          playerName: "Veteran Current",
          shortName: "V. Current",
          position: "WR",
          positionGroup: "WR",
          headshotUrl: null,
          teams: ["DAL"],
          seasons: [2025],
          games: 3,
          standardFantasyPoints: 42,
          halfPprFantasyPoints: 48,
          pprFantasyPoints: 54,
          selectedFantasyPoints: 54,
          selectedFantasyPointsPerGame: 18,
          last3FantasyPointsPerGame: 18,
          last5FantasyPointsPerGame: 18,
          medianFantasyPoints: 18,
          floorFantasyPoints: 15,
          ceilingFantasyPoints: 21,
          fantasyPointsStandardDeviation: 3,
          latestSeason: 2025,
          latestWeek: 18,
          latestGameId: "2025_18_DAL_NYG",
          latestTeam: "DAL",
          latestOpponent: "NYG",
          totals: {
            carries: 0,
            targets: 24,
            receptions: 18,
            rushingYards: 0,
            receivingYards: 300,
            passingYards: 0,
            rushingTouchdowns: 0,
            receivingTouchdowns: 3,
            passingTouchdowns: 0,
          },
          averageMetrics: { targetShare: 0.25, airYardsShare: 0.3, wopr: 0.6 },
          weeklyRows: [
            { selectedFantasyPoints: 12 },
            { selectedFantasyPoints: 18 },
            { selectedFantasyPoints: 24 },
          ],
        },
      ],
    });
  });

  it("uses the 2026 player pool and live net movement while labeling 2025 form as context", async () => {
    render(
      <MemoryRouter initialEntries={["/stats?view=trends&season=2024"]}>
        <StatsExplorer />
      </MemoryRouter>,
    );

    const table = await screen.findByRole("table", {
      name: "2026 live Sleeper player trends with 2025 form context",
    });
    const rookieName = within(table).getByText("Rookie 2026");
    const veteranName = within(table).getByText("Veteran Current");

    expect(screen.getByText("2026 live trends")).toBeInTheDocument();
    const trendYear = screen.getByRole("button", { name: "Trend year: 2026" });
    expect(trendYear).toBeDisabled();
    expect(trendYear).toHaveTextContent("2026");
    expect(screen.getByRole("button", { name: /Net 24h/ }).closest("th")).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("button", { name: /2026 Proj\/G/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2025 FPG/ })).toBeInTheDocument();

    const rookieRow = rookieName.closest("tr");
    const veteranRow = veteranName.closest("tr");
    expect(rookieRow).not.toBeNull();
    expect(veteranRow).not.toBeNull();
    expect(rookieRow).toHaveTextContent("NE");
    expect(rookieRow).toHaveTextContent("+9");
    expect(rookieRow).toHaveTextContent("—");
    expect(veteranRow).toHaveTextContent("SF");
    expect(veteranRow).not.toHaveTextContent("DAL");
    expect(veteranRow).toHaveTextContent("-4");

    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(bodyRows[0]).toHaveTextContent("Rookie 2026");

    await waitFor(() => {
      expect(mocks.loadWeeklyPlayerStats).toHaveBeenCalledWith(
        expect.objectContaining({ seasons: [2025] }),
      );
    });
  }, 15_000);
});
