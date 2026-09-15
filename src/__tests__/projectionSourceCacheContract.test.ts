import { describe, expect, it } from "vitest";
import espnClayRows from "../data/players-2026-espn-clay-projections.json";
import leagueLogsRows from "../data/players-2026-leaguelogs.json";
import publicProjectionRows from "../data/players-2026-public-projections.json";
import winWithOddsRows from "../data/players-2026-winwithodds.json";

describe("projection and market source cache contract", () => {
  it("keeps ESPN Clay coverage above position-specific safety floors", () => {
    const counts = espnClayRows.reduce<Record<string, number>>((totals, row) => {
      totals[row.pos] = (totals[row.pos] ?? 0) + 1;
      return totals;
    }, {});

    expect(espnClayRows.length).toBeGreaterThanOrEqual(350);
    expect(counts.QB).toBeGreaterThanOrEqual(35);
    expect(counts.RB).toBeGreaterThanOrEqual(85);
    expect(counts.WR).toBeGreaterThanOrEqual(130);
    expect(counts.TE).toBeGreaterThanOrEqual(55);
    expect(counts.K).toBeGreaterThanOrEqual(25);
    expect(espnClayRows.every((row) => Date.parse(row.updatedAt) >= Date.parse("2026-09-01"))).toBe(true);
  });

  it("keeps both unattended public projection publishers populated", () => {
    const fftoday = publicProjectionRows.filter((row) => row.sourceId === "fftoday-projections");
    const cbs = publicProjectionRows.filter((row) => row.sourceId === "cbs-projections");

    expect(fftoday.length).toBeGreaterThanOrEqual(350);
    expect(cbs.length).toBeGreaterThanOrEqual(350);
    expect(Math.max(...cbs.map((row) => row.projectedPoints))).toBeGreaterThanOrEqual(250);
    expect(winWithOddsRows.length).toBeGreaterThanOrEqual(600);
  });

  it("keeps LeagueLogs public rankings matched across supported formats", () => {
    expect(leagueLogsRows.length).toBeGreaterThanOrEqual(170);
    expect(leagueLogsRows.filter((row) => row.pprRank !== null).length).toBeGreaterThanOrEqual(170);
    expect(leagueLogsRows.filter((row) => row.halfPprRank !== null).length).toBeGreaterThanOrEqual(170);
    expect(leagueLogsRows.filter((row) => row.twoQbRank !== null).length).toBeGreaterThanOrEqual(170);
    expect(leagueLogsRows.every((row) => Date.parse(row.updatedAt) >= Date.parse("2026-09-01"))).toBe(true);
  });
});
