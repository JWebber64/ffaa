import { describe, expect, it, vi } from "vitest";

import { normalizeSleeperWeeklyStatRow, loadSleeperWeeklyStats } from "../features/my-hq/sleeperWeeklyStats";
import { weeklyScoreStatus, weeklyStatLineText } from "../features/my-hq/weeklyStatLine";

describe("Sleeper weekly stat lines", () => {
  it("labels a returned score from a completed game as final", () => {
    expect(weeklyScoreStatus({
      weeklyActualPoints: 26.1,
      weeklyStatLine: { playerId: "7523", season: "2026", week: 1, team: "JAX", opponent: "CAR", gameDate: "2026-09-13", gameId: "202610115", stats: {} },
    }, new Date("2026-09-15T12:00:00-04:00"))).toBe("final");
  });

  it("keeps a returned score live only for a same-day game", () => {
    expect(weeklyScoreStatus({
      weeklyActualPoints: 3.2,
      weeklyStatLine: { playerId: "7523", season: "2026", week: 1, team: "CIN", opponent: "CLE", gameDate: "2026-09-15", gameId: "202610115", stats: {} },
    }, new Date("2026-09-15T12:00:00-04:00"))).toBe("live");
  });

  it("does not call an undated score live", () => {
    expect(weeklyScoreStatus({ weeklyActualPoints: 0, weeklyStatLine: null })).toBe("final");
  });

  it("normalizes numeric stats and keeps the game context", () => {
    const line = normalizeSleeperWeeklyStatRow({
      player_id: "7523",
      season: "2026",
      week: 1,
      team: "JAX",
      opponent: "CLE",
      date: "2026-09-13",
      game_id: "202610134",
      stats: { pass_cmp: 18, pass_att: 23, pass_yd: 245, pass_td: 4, ignored: "n/a" },
    }, "2026", 1);

    expect(line).toMatchObject({ playerId: "7523", opponent: "CLE", gameId: "202610134" });
    expect(line?.stats).toEqual({ pass_cmp: 18, pass_att: 23, pass_yd: 245, pass_td: 4 });
    expect(weeklyStatLineText({ position: "QB", weeklyStatLine: line })).toBe("18/23 pass · 245 pass yds · 4 pass TD");
  });

  it("loads and indexes the requested week", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo) => new Response(JSON.stringify([
      { player_id: "8155", week: 1, season: "2026", team: "NYJ", opponent: "TEN", stats: { rush_att: 22, rush_yd: 102, rush_td: 1, rec: 2, rec_yd: 16 } },
      { player_id: "missing", week: 1, season: "2026", stats: {} },
    ])));

    const stats = await loadSleeperWeeklyStats("2026", 1, "regular", fetcher as unknown as typeof fetch);
    expect(stats.get("8155")?.stats.rush_yd).toBe(102);
    expect(stats.has("missing")).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/stats/nfl/2026/1?");
  });

  it("uses an explicit unavailable label when Sleeper has no stat row", () => {
    expect(weeklyStatLineText({ position: "WR", weeklyStatLine: null })).toBe("Stat line unavailable");
  });
});
