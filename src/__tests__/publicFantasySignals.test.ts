import { describe, expect, it, vi } from "vitest";
import {
  FANTASY_FOOTBALL_CALCULATOR_SOURCE,
  PUBLIC_FANTASY_SIGNAL_SOURCES,
  SLEEPER_TRENDING_SOURCE,
  loadFfcAdp,
  loadSleeperTrending,
  normalizePublicFantasyPosition,
  normalizePublicFantasyTeam,
  parseFfcAdpPayload,
  parseSleeperTrendingPayload,
} from "../data/publicFantasySignals";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("public fantasy signal sources", () => {
  it("provides explicit source links and attribution", () => {
    expect(FANTASY_FOOTBALL_CALCULATOR_SOURCE.attribution).toContain("Fantasy Football Calculator");
    expect(FANTASY_FOOTBALL_CALCULATOR_SOURCE.documentationUrl).toMatch(/^https:\/\//);
    expect(SLEEPER_TRENDING_SOURCE.attribution).toContain("Sleeper");
    expect(PUBLIC_FANTASY_SIGNAL_SOURCES).toEqual({
      ffcAdp: FANTASY_FOOTBALL_CALCULATOR_SOURCE,
      sleeperTrending: SLEEPER_TRENDING_SOURCE,
    });
  });
});

describe("Fantasy Football Calculator ADP", () => {
  it("uses the existing proxy and preserves meta and draft-range fields", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () => jsonResponse({
      status: "Success",
      meta: {
        type: "Half-PPR",
        teams: 10,
        rounds: 16,
        total_drafts: 321,
        start_date: "2026-07-01",
        end_date: "2026-07-10",
      },
      players: [{
        player_id: 42,
        name: " Example Defense ",
        position: "D/ST",
        team: "JAC",
        adp: "101.2",
        adp_formatted: "11.01",
        times_drafted: "85",
        high: 76,
        low: "134",
        stdev: "9.4",
        bye: "8",
        provider_note: "retained",
      }],
    }));

    const result = await loadFfcAdp({
      scoring: "half",
      year: 2026,
      teams: 10,
      signal: controller.signal,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/ffc-api/adp/half-ppr?year=2026&teams=10",
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(result.meta).toEqual(expect.objectContaining({
      teams: 10,
      total_drafts: 321,
      start_date: "2026-07-01",
    }));
    expect(result.players).toEqual([expect.objectContaining({
      player_id: 42,
      name: "Example Defense",
      position: "DEF",
      team: "JAX",
      adp: 101.2,
      formatted: "11.01",
      adp_formatted: "11.01",
      times_drafted: 85,
      high: 76,
      low: 134,
      stdev: 9.4,
      bye: 8,
      provider_note: "retained",
    })]);
    expect(result.source).toBe(FANTASY_FOOTBALL_CALCULATOR_SOURCE);
    expect(result.warnings).toEqual([]);
  });

  it("skips unusable rows and reports malformed optional data without crashing", () => {
    const result = parseFfcAdpPayload({
      status: "Success",
      meta: "unexpected",
      players: [
        null,
        { player_id: "", name: "No ID", position: "RB" },
        {
          player_id: "123",
          name: "Valid Kicker",
          position: "PK",
          team: "WSH",
          adp: "not-a-number",
          formatted: "14.03",
        },
      ],
    });

    expect(result.players).toEqual([expect.objectContaining({
      player_id: "123",
      position: "K",
      team: "WAS",
      adp: null,
      formatted: "14.03",
    })]);
    expect(result.meta).toEqual({});
    expect(result.warnings.map((warning) => warning.path)).toEqual([
      "meta",
      "players[0]",
      "players[1]",
      "players[2].adp",
    ]);
  });

  it("normalizes common position and team aliases", () => {
    expect(normalizePublicFantasyPosition("dst")).toBe("DEF");
    expect(normalizePublicFantasyPosition("PK")).toBe("K");
    expect(normalizePublicFantasyTeam("SFO")).toBe("SF");
    expect(normalizePublicFantasyTeam("TAM")).toBe("TB");
    expect(normalizePublicFantasyTeam("nwe")).toBe("NE");
  });

  it("rejects an unsuccessful HTTP response", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ status: "Error" }, 503));
    await expect(loadFfcAdp({ year: 2026, fetcher })).rejects.toThrow("(503)");
  });
});

describe("Sleeper player trends", () => {
  it("loads add/drop signals with configurable lookback and limit", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () => jsonResponse([
      { player_id: "4866", count: 417 },
      { player_id: 999, count: "72" },
      { player_id: "", count: 3 },
      { player_id: "broken", count: "NaN" },
    ]));

    const result = await loadSleeperTrending({
      type: "drop",
      lookbackHours: 168,
      limit: 50,
      signal: controller.signal,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=168&limit=50",
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(result).toEqual([
      { playerId: "4866", count: 417, type: "drop" },
      { playerId: "999", count: 72, type: "drop" },
    ]);
  });

  it("returns an empty list for an unexpected payload", () => {
    expect(parseSleeperTrendingPayload({ error: "unexpected" }, "add")).toEqual([]);
  });

  it("passes through abort failures from fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw abortError;
    });

    await expect(loadSleeperTrending({ signal: controller.signal, fetcher })).rejects.toBe(abortError);
  });
});
