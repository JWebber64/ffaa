/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatsExplorer from "@/screens/StatsExplorer";

const mocks = vi.hoisted(() => ({
  buildPlayerStatRows: vi.fn(),
  loadFfcAdp: vi.fn(),
  loadSleeperPlayerDirectory: vi.fn(),
  loadSleeperTrending: vi.fn(),
  loadWeeklyPlayerStats: vi.fn(),
}));

vi.mock("@/data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("@/data/playerStatCategories", () => ({
  buildPlayerStatRows: mocks.buildPlayerStatRows,
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

function summary({
  id,
  name,
  points,
  pointsPerGame,
  games,
}: {
  id: string;
  name: string;
  points: number;
  pointsPerGame: number;
  games: number;
}) {
  return {
    playerId: id,
    playerName: name,
    shortName: name,
    position: "RB",
    positionGroup: "RB",
    headshotUrl: null,
    teams: ["SEA"],
    seasons: [2025],
    games,
    standardFantasyPoints: points,
    halfPprFantasyPoints: points,
    pprFantasyPoints: points,
    selectedFantasyPoints: points,
    selectedFantasyPointsPerGame: pointsPerGame,
    last3FantasyPointsPerGame: pointsPerGame,
    last5FantasyPointsPerGame: pointsPerGame,
    medianFantasyPoints: pointsPerGame,
    floorFantasyPoints: pointsPerGame,
    ceilingFantasyPoints: pointsPerGame,
    fantasyPointsStandardDeviation: 0,
    latestSeason: 2025,
    latestWeek: 18,
    latestGameId: `2025_18_${id}`,
    latestTeam: "SEA",
    latestOpponent: "LAR",
    totals: {
      carries: 0,
      targets: 0,
      receptions: 0,
      rushingYards: 0,
      receivingYards: 0,
      passingYards: 0,
      rushingTouchdowns: 0,
      receivingTouchdowns: 0,
      passingTouchdowns: 0,
    },
    averageMetrics: { targetShare: null, airYardsShare: null, wopr: null },
    weeklyRows: Array.from({ length: games }, () => ({ selectedFantasyPoints: pointsPerGame })),
  };
}

function projection({
  id,
  name,
  points,
  low,
  high,
}: {
  id: string;
  name: string;
  points: number;
  low: number;
  high: number;
}) {
  return {
    player: {
      id,
      name,
      pos: "RB",
      nflTeam: "SEA",
      rank: 1,
      byeWeek: 8,
      projectedPoints: points,
      projectionSourceCount: 5,
      projectionLow: low,
      projectionHigh: high,
      valueSources: [],
    },
    derived: {},
    sleeper: { playerId: id, status: "Active", injuryStatus: "" },
    espnClay: { games: 17, projectedPoints: points - 10 },
    winWithOdds: { projectedPoints: points - 5 },
  };
}

describe("StatsExplorer fantasy leaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildPlayerStatRows.mockReturnValue([
      projection({ id: "projected-leader", name: "Projected Leader", points: 310, low: 280, high: 330 }),
      projection({ id: "projected-runner-up", name: "Projected Runner-Up", points: 300, low: 270, high: 320 }),
    ]);
    mocks.loadFfcAdp.mockResolvedValue({ meta: {}, players: [] });
    mocks.loadSleeperPlayerDirectory.mockResolvedValue([]);
    mocks.loadSleeperTrending.mockResolvedValue([]);
    mocks.loadWeeklyPlayerStats.mockResolvedValue({
      rows: [],
      unavailableSeasons: [],
      summaries: [
        summary({ id: "volume", name: "Volume Back", points: 255, pointsPerGame: 15, games: 17 }),
        summary({ id: "efficiency", name: "Efficiency Back", points: 200, pointsPerGame: 20, games: 10 }),
      ],
    });
  });

  it("opens Leaders in a clearly labeled 2026 projection mode ranked by total projected points", async () => {
    render(
      <MemoryRouter initialEntries={["/stats?position=RB"]}>
        <StatsExplorer />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: "Season: 2026 projections" })).toBeInTheDocument();
    expect(screen.getByText("2026 projected leaders")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Games:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^From week:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^To week:/ })).not.toBeInTheDocument();

    const table = screen.getByRole("table", { name: "2026 projected fantasy leaders" });
    const pointsHeader = within(table).getByRole("button", { name: /2026 Proj FPTS/ });
    expect(pointsHeader.closest("th")).toHaveAttribute("aria-sort", "descending");

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Projected Leader");
    expect(rows[0]).toHaveTextContent("RB1");
    expect(rows[0]).toHaveTextContent("310.0");
    expect(rows[0]).toHaveTextContent("280.0–330.0");
    expect(rows[0]).toHaveTextContent("5");
    expect(rows[1]).toHaveTextContent("Projected Runner-Up");

    await waitFor(() => {
      expect(mocks.loadWeeklyPlayerStats).toHaveBeenCalledWith(expect.objectContaining({ seasons: [2025] }));
    });
  }, 60_000);

  it("defaults position rank and table order to total fantasy points while preserving FPG sorting", async () => {
    render(
      <MemoryRouter initialEntries={["/stats?season=2025&position=RB"]}>
        <StatsExplorer />
      </MemoryRouter>,
    );

    const table = screen.getByRole("table", { name: "Fantasy leaders player table" });
    await within(table).findByText("Volume Back");

    const pointsHeader = within(table).getByRole("button", { name: /FPTS/ });
    expect(pointsHeader.closest("th")).toHaveAttribute("aria-sort", "descending");

    let rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Volume Back");
    expect(rows[0]).toHaveTextContent("RB1");
    expect(rows[1]).toHaveTextContent("Efficiency Back");
    expect(rows[1]).toHaveTextContent("RB2");

    fireEvent.click(within(table).getByRole("button", { name: /FPG/ }));

    await waitFor(() => {
      rows = within(table).getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("Efficiency Back");
    });
    expect(rows[0]).toHaveTextContent("RB2");
    expect(rows[1]).toHaveTextContent("Volume Back");
    expect(rows[1]).toHaveTextContent("RB1");
  }, 60_000);
});
