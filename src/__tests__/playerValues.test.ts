import { describe, expect, it } from "vitest";
import { VALUE_SOURCE_WEIGHTS } from "../config/valueSourceWeights";
import { applyConsensusAuctionValues, rankToAuctionValue } from "../data/playerValues";
import type { Player } from "../types/draft";

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: overrides.id ?? "player-1",
    name: overrides.name ?? "Test Player",
    pos: overrides.pos ?? "RB",
    nflTeam: overrides.nflTeam ?? "FA",
    rank: overrides.rank ?? 50,
    ...overrides,
  };
}

describe("player value consensus", () => {
  it("derives descending auction values from rank", () => {
    const elite = rankToAuctionValue(1, 200);
    const starter = rankToAuctionValue(60, 200);
    const depth = rankToAuctionValue(180, 200);

    expect(elite).toBeGreaterThan(starter ?? 0);
    expect(starter).toBeGreaterThan(depth ?? 0);
    expect(depth).toBeGreaterThanOrEqual(1);
  });

  it("adds consensus value and source metadata to players", () => {
    const [player] = applyConsensusAuctionValues([
      makePlayer({
        id: "2026-WR-jamarr-chase",
        name: "Ja'Marr Chase",
        pos: "WR",
        nflTeam: "CIN",
        rank: 1,
      }),
    ]);

    expect(player?.auctionValue).toBeGreaterThan(1);
    expect(player?.projectedValue).toBe(player?.auctionValue);
    expect(player?.valueConfidence).toBeGreaterThan(0);
    expect(player?.valueConfidence).toBeGreaterThan(0.55);
    expect(player?.valueConfidence).toBeLessThanOrEqual(0.98);
    expect(player?.marketValue).toBeGreaterThan(1);
    expect(player?.marketValueSourceCount).toBeGreaterThanOrEqual(7);
    expect(
      player?.valueSources?.find((source) => source.sourceId === "sleeper-suggested")
        ?.normalizedValue,
    ).toBe(65);
    expect(
      player?.valueSources?.find((source) => source.sourceId === "sleeper-suggested")?.weight,
    ).toBe(VALUE_SOURCE_WEIGHTS.sleeperSuggested);
    expect(
      player?.valueSources?.find((source) => source.sourceId === "sportsbrackets")
        ?.includedInConsensus,
    ).toBe(false);
    expect(player?.valueSources?.some((source) => source.source.includes("ESPN"))).toBe(true);
    expect(player?.valueSources?.some((source) => source.source.includes("WinWithOdds"))).toBe(true);
    expect(
      player?.valueSources?.find((source) => source.source.includes("WinWithOdds"))?.weight
    ).toBe(VALUE_SOURCE_WEIGHTS.winWithOddsProjection);
    expect(player?.valueSources?.some((source) => source.kind === "rank-derived")).toBe(true);
    expect(player?.projectedPoints).toBeGreaterThan(250);
    expect(player?.auctionValue).toBeLessThan(100);
  });

  it("matches Vegas defense abbreviations to defense team names", () => {
    const [player] = applyConsensusAuctionValues([
      makePlayer({
        id: "2026-DEF-denver-broncos",
        name: "Denver Broncos",
        pos: "DEF",
        nflTeam: "FA",
        rank: 103,
      }),
    ]);

    expect(player?.valueSources?.some((source) => source.source.includes("WinWithOdds"))).toBe(true);
    expect(player?.projectedPoints).toBeGreaterThan(0);
  });

  it("falls back to rank-derived value when no direct source matches", () => {
    const [player] = applyConsensusAuctionValues([
      makePlayer({
        id: "2026-RB-example",
        name: "Example Back",
        pos: "RB",
        nflTeam: "FA",
        rank: 75,
      }),
    ]);

    expect(player?.auctionValue).toBeGreaterThanOrEqual(1);
    expect(player?.valueSources).toHaveLength(1);
    expect(player?.valueSources?.[0]?.kind).toBe("rank-derived");
    expect(player?.marketValue).toBeUndefined();
    expect(player?.marketValueSourceCount).toBe(0);
  });

  it("conserves every dollar in the default 12-team auction pool", () => {
    const players = Array.from({ length: 180 }, (_, index) =>
      makePlayer({
        id: `synthetic-${index + 1}`,
        name: `Synthetic Player ${index + 1}`,
        pos: index < 12 ? "K" : index < 24 ? "DEF" : index % 3 === 0 ? "RB" : "WR",
        rank: index + 1,
      }),
    );

    const valued = applyConsensusAuctionValues(players, 200, {
      teamCount: 12,
      rosterSize: 15,
    });

    expect(valued.reduce((sum, player) => sum + (player.auctionValue ?? 0), 0)).toBe(2400);
    expect(valued.every((player) => (player.auctionValue ?? 0) >= 1)).toBe(true);
  });

  it("scales the conserved pool for a custom per-team budget", () => {
    const players = Array.from({ length: 180 }, (_, index) =>
      makePlayer({
        id: `budget-player-${index + 1}`,
        name: `Budget Player ${index + 1}`,
        pos: index < 12 ? "K" : index < 24 ? "DEF" : "RB",
        rank: index + 1,
      }),
    );

    const valued = applyConsensusAuctionValues(players, 100, {
      teamCount: 12,
      rosterSize: 15,
    });

    expect(valued.reduce((sum, player) => sum + (player.auctionValue ?? 0), 0)).toBe(1200);
  });

  it("uses standard-compatible boards without blending PPR-only values", () => {
    const [player] = applyConsensusAuctionValues([
      makePlayer({
        id: "2026-WR-jamarr-chase-standard",
        name: "Ja'Marr Chase",
        pos: "WR",
        nflTeam: "CIN",
        rank: 1,
      }),
    ], 200, { scoring: "standard", calibrate: false });

    expect(player?.marketValue).toBeGreaterThan(1);
    expect(player?.marketValueSourceCount).toBe(2);
    expect(
      player?.valueSources?.find(
        (source) => source.sourceId === "fftoday" && source.includedInConsensus !== false,
      )
        ?.includedInConsensus,
    ).toBe(true);
    expect(
      player?.valueSources?.find((source) => source.sourceId === "sports-illustrated")
        ?.includedInConsensus,
    ).toBe(false);
    expect(
      player?.valueSources?.find((source) => source.sourceId === "sleeper-suggested")
        ?.includedInConsensus,
    ).toBe(false);
  });
});
