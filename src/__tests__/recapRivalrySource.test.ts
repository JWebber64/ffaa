import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const loadHistory = vi.hoisted(() => vi.fn());
vi.mock("../features/league-history/persistence/firebaseLeagueHistory", () => ({ loadLeagueHistory: loadHistory }));
import { buildRecapWeek, loadRecapRivalries } from "../features/weekly-recap/recapSource";

let sequence = 0;
function finalWeek(week = 1) {
  return buildRecapWeek({
    league: { league_id: `test-${++sequence}`, season: "2026", sport: "nfl", name: "Test", status: "in_season", total_rosters: 2, settings: { last_scored_leg: week }, scoring_settings: {}, roster_positions: [] },
    state: { season: "2026", week: week + 1 }, week, updatedAt: "2026-09-15", stats: new Map(), players: [], users: [],
    rosters: [{ roster_id: 1, owner_id: "a", settings: {} }, { roster_id: 2, owner_id: "b", settings: {} }],
    rows: [{ roster_id: 1, matchup_id: 5, points: 120 }, { roster_id: 2, matchup_id: 5, points: 100 }],
  });
}
const story = (data: Awaited<ReturnType<typeof loadRecapRivalries>>) => data.recaps[0]!.sections.find((section) => section.id === "rivalry")!.paragraphs.join(" ");
beforeEach(() => { loadHistory.mockReset().mockResolvedValue({ managers: [], seasons: [], franchises: [], matchups: [] }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("read-only historical recap enrichment", () => {
  it("shares one archive load and one set of bounded previous-week reads across reports and concurrent consumers", async () => {
    let active = 0; let maximum = 0;
    const fetcher = vi.fn(async () => {
      active += 1; maximum = Math.max(maximum, active);
      await Promise.resolve(); active -= 1;
      return { ok: true, json: async () => [{ roster_id: 1, matchup_id: 5, points: 80 }, { roster_id: 2, matchup_id: 5, points: 100 }] };
    });
    vi.stubGlobal("fetch", fetcher);
    const input = finalWeek(7);
    input.recaps.push({ ...input.recaps[0]!, id: "second-report" });
    const [result] = await Promise.all([loadRecapRivalries(input), loadRecapRivalries(input)]);
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(maximum).toBeLessThanOrEqual(4);
    expect(loadHistory).toHaveBeenCalledTimes(1);
    expect(loadHistory).toHaveBeenCalledWith(input.league.league_id, { refresh: true });
    expect(story(result!)).toContain("to 1–6 in 2026");
    expect(result!.recaps.every((recap) => recap.sections.some((section) => section.id === "rivalry"))).toBe(true);
    expect(input.recaps[0]!.sections.some((section) => section.id === "rivalry")).toBe(false);
  });
  it("respects a league's start week", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const input = finalWeek(4); input.league.settings.start_week = 4;
    expect(story(await loadRecapRivalries(input))).toContain("to 1–0");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps the main report when history is unavailable and retries a failed archive read", async () => {
    const input = finalWeek();
    loadHistory.mockRejectedValueOnce(new Error("Archive unavailable"));
    const result = await loadRecapRivalries(input);
    expect(result.recaps[0]!.headline).toBe(input.recaps[0]!.headline);
    expect(result.recaps[0]!.teams).toEqual(input.recaps[0]!.teams);
    expect(story(result)).toContain("history could not be loaded");
    expect(story(await loadRecapRivalries(input))).toContain("to 1–0");
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });
  it("does not claim a partial record if any required earlier week fails or is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const input = finalWeek(2);
    expect(story(await loadRecapRivalries(input))).toContain("history could not be loaded");
  });
  it("times out optional history without losing the final report", async () => {
    vi.useFakeTimers();
    loadHistory.mockReturnValue(new Promise(() => {}));
    const input = finalWeek();
    const pending = loadRecapRivalries(input);
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await pending;
    expect(result.status).toBe("final");
    expect(story(result)).toContain("final result above still stands");
  });
  it("does not read history for an unfinished week", async () => {
    const input = finalWeek(); input.status = "pending"; input.recaps = [];
    expect(await loadRecapRivalries(input)).toBe(input);
    expect(loadHistory).not.toHaveBeenCalled();
  });
});
