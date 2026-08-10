import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadWeeklyPlayerStats,
  summarizeWeeklyPlayerStats,
  type WeeklyPlayerStatRow,
} from "../data/weeklyPlayerStats";

function makeWeeklyRow(
  week: number,
  selectedFantasyPoints: number,
  overrides: Partial<WeeklyPlayerStatRow> = {}
): WeeklyPlayerStatRow {
  return {
    playerId: "player-1",
    playerName: "Test Runner",
    shortName: "T.Runner",
    position: "RB",
    positionGroup: "RB",
    headshotUrl: "https://example.com/player.png",
    team: week === 5 ? "NYJ" : "BUF",
    opponent: week === 5 ? "BUF" : "MIA",
    season: 2025,
    week,
    seasonType: "REG",
    gameId: "2025_" + String(week).padStart(2, "0") + "_BUF_MIA",
    standardFantasyPoints: selectedFantasyPoints - 5,
    halfPprFantasyPoints: selectedFantasyPoints - 2.5,
    pprFantasyPoints: selectedFantasyPoints,
    selectedFantasyPoints,
    stats: {
      carries: week,
      targets: week * 2,
      receptions: week,
      rushing_yards: week * 10,
      receiving_yards: week * 20,
      passing_yards: week * 100,
      rushing_tds: 1,
      receiving_tds: 1,
      passing_tds: 1,
      target_share: week / 10,
      ...(week % 2 === 1 ? { air_yards_share: week / 5 } : {}),
      ...(week % 2 === 0 ? { wopr: week / 5 } : {}),
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("summarizeWeeklyPlayerStats", () => {
  it("builds chronological trend, distribution, usage, and latest-context summaries", () => {
    const rows = [5, 1, 4, 2, 3].map((week) => makeWeeklyRow(week, week * 10));
    const summary = summarizeWeeklyPlayerStats(rows)[0]!;

    expect(summary.games).toBe(5);
    expect(summary.selectedFantasyPoints).toBe(150);
    expect(summary.selectedFantasyPointsPerGame).toBe(30);
    expect(summary.last3FantasyPointsPerGame).toBe(40);
    expect(summary.last5FantasyPointsPerGame).toBe(30);
    expect(summary.medianFantasyPoints).toBe(30);
    expect(summary.floorFantasyPoints).toBe(20);
    expect(summary.ceilingFantasyPoints).toBe(40);
    expect(summary.fantasyPointsStandardDeviation).toBeCloseTo(Math.sqrt(200));
    expect(summary.standardFantasyPoints).toBe(125);
    expect(summary.halfPprFantasyPoints).toBe(137.5);
    expect(summary.pprFantasyPoints).toBe(150);
    expect(summary.weeklyRows.map((row) => row.week)).toEqual([1, 2, 3, 4, 5]);
    expect(summary.teams).toEqual(["BUF", "NYJ"]);
    expect(summary.latestSeason).toBe(2025);
    expect(summary.latestWeek).toBe(5);
    expect(summary.latestTeam).toBe("NYJ");
    expect(summary.latestOpponent).toBe("BUF");

    expect(summary.totals).toEqual({
      carries: 15,
      targets: 30,
      receptions: 15,
      rushingYards: 150,
      receivingYards: 300,
      passingYards: 1_500,
      rushingTouchdowns: 5,
      receivingTouchdowns: 5,
      passingTouchdowns: 5,
    });
    expect(summary.averageMetrics.targetShare).toBeCloseTo(0.3);
    expect(summary.averageMetrics.airYardsShare).toBeCloseTo(0.6);
    expect(summary.averageMetrics.wopr).toBeCloseTo(0.6);
  });

  it("groups players, sorts summaries by points, and leaves unavailable share metrics null", () => {
    const lowerScorer = makeWeeklyRow(1, 8, {
      playerId: "player-2",
      playerName: "Lower Scorer",
      stats: { carries: 2 },
    });
    const higherScorer = makeWeeklyRow(1, 12, {
      playerId: "player-1",
      playerName: "Higher Scorer",
      stats: { targets: 3 },
    });

    const summaries = summarizeWeeklyPlayerStats([lowerScorer, higherScorer]);

    expect(summaries.map((summary) => summary.playerId)).toEqual(["player-1", "player-2"]);
    expect(summaries[0]!.last3FantasyPointsPerGame).toBe(12);
    expect(summaries[0]!.last5FantasyPointsPerGame).toBe(12);
    expect(summaries[0]!.floorFantasyPoints).toBe(12);
    expect(summaries[0]!.ceilingFantasyPoints).toBe(12);
    expect(summaries[0]!.fantasyPointsStandardDeviation).toBe(0);
    expect(summaries[0]!.averageMetrics).toEqual({
      targetShare: null,
      airYardsShare: null,
      wopr: null,
    });
  });
});

describe("loadWeeklyPlayerStats", () => {
  const csv = [
    "player_id,player_name,player_display_name,position,position_group,headshot_url,season,week,season_type,game_id,team,opponent_team,receptions,targets,receiving_yards,target_share,air_yards_share,wopr,fantasy_points,fantasy_points_ppr",
    "p1,T.One,Test One,WR,WR,https://example.com/one.png,2097,1,REG,2097_01_A_B,A,B,2,4,40,0.2,0.3,0.4,10,12",
    "p1,T.One,Test One,WR,WR,https://example.com/one.png,2097,2,REG,2097_02_A_C,A,C,3,6,60,0.4,0.5,0.6,20,23",
    "p1,T.One,Test One,WR,WR,https://example.com/one.png,2097,3,POST,2097_03_A_D,A,D,1,2,20,0.1,0.2,0.3,5,6",
    "p2,T.Two,Test Two,RB,RB,,2097,3,REG,2097_03_E_F,E,F,0,0,0,,,,8,8",
  ].join("\n");

  it("filters season type and inclusive weeks while applying the selected scoring mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(csv, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadWeeklyPlayerStats({
      seasons: [2097, 2097, Number.NaN, 2097.5],
      seasonType: "REG",
      scoring: "halfPpr",
      weekStart: 2,
      weekEnd: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("stats_player_week_2097.csv");
    expect(result.unavailableSeasons).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!).toMatchObject({
      playerId: "p1",
      playerName: "Test One",
      team: "A",
      opponent: "C",
      season: 2097,
      week: 2,
      seasonType: "REG",
      gameId: "2097_02_A_C",
      standardFantasyPoints: 20,
      halfPprFantasyPoints: 21.5,
      pprFantasyPoints: 23,
      selectedFantasyPoints: 21.5,
    });
    expect(result.rows[0]!.stats.receiving_yards).toBe(60);
    expect(result.summaries[0]!.selectedFantasyPoints).toBe(21.5);

    const allResult = await loadWeeklyPlayerStats({
      seasons: [2097],
      seasonType: "ALL",
      scoring: "ppr",
      weekStart: 3,
      weekEnd: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(allResult.rows).toHaveLength(4);
    expect(allResult.rows.find((row) => row.gameId === "2097_03_A_D")?.selectedFantasyPoints).toBe(6);
  });

  it("falls back to the nflverse GitHub release when the bundled season is unavailable", async () => {
    const fallbackCsv = csv.split("2097").join("2098");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response(fallbackCsv, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadWeeklyPlayerStats({
      seasons: [2098],
      seasonType: "POST",
      scoring: "standard",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain(
      "github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2098.csv"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.selectedFantasyPoints).toBe(5);
  });

  it("rejects immediately when its AbortSignal is already aborted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(
      loadWeeklyPlayerStats({
        seasons: [2099],
        seasonType: "REG",
        scoring: "ppr",
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
