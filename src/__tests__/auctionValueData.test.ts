import { describe, expect, it } from "vitest";

import {
  AUCTION_PLAYER_VALUES,
  AUCTION_VALUE_SOURCE_MAP,
  AUCTION_VALUE_SOURCES,
  buildAuctionComparison,
  median,
  normalizeAuctionValue,
  sourceCompatibility,
} from "@/features/auction-values/auctionValueData";

describe("auction value data model", () => {
  it("keeps the complete data-driven public registry and distinguishes imported sheets", () => {
    expect(AUCTION_VALUE_SOURCES.length).toBeGreaterThanOrEqual(70);
    expect(new Set(AUCTION_VALUE_SOURCES.map((source) => source.id)).size).toBe(AUCTION_VALUE_SOURCES.length);
    expect(AUCTION_VALUE_SOURCE_MAP.get("fftoday")?.comparisonReady).toBe(true);
    expect(AUCTION_VALUE_SOURCE_MAP.get("fantasypros")?.externalOnly).toBe(true);
    expect(AUCTION_VALUE_SOURCE_MAP.get("rotowire")?.access).toBe("paid");
    expect(AUCTION_VALUE_SOURCE_MAP.get("spreadsheet-solving-archive")?.sourceType).toBe("archive");
  });

  it("contains real multi-source rows for Standard, Half PPR, and Full PPR", () => {
    for (const format of ["standard", "half_ppr", "ppr"] as const) {
      const populatedExpertSources = new Set(AUCTION_PLAYER_VALUES
        .filter((row) => row.scoringFormat === format && AUCTION_VALUE_SOURCE_MAP.get(row.sourceId)?.sourceType === "expert_projection")
        .map((row) => row.sourceId));
      expect(populatedExpertSources.size, format).toBeGreaterThanOrEqual(2);
      expect(populatedExpertSources.has("fftoday"), format).toBe(true);
      expect(populatedExpertSources.has("usa-today"), format).toBe(true);
    }
  });

  it("normalizes only by budget using the documented formula", () => {
    expect(normalizeAuctionValue(50, 200, 250)).toBe(62.5);
  });

  it("calculates odd and even medians", () => {
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("keeps raw and normalized displays distinct", () => {
    const base = {
      selectedSourceIds: ["fftoday"],
      scoringFormat: "ppr" as const,
      leagueSize: 12,
      selectedBudget: 250,
    };
    const raw = buildAuctionComparison({ ...base, valueMode: "raw" });
    const normalized = buildAuctionComparison({ ...base, valueMode: "normalized" });
    const rawRow = raw.find((row) => row.playerName === "Jahmyr Gibbs");
    const normalizedRow = normalized.find((row) => row.playerName === "Jahmyr Gibbs");
    expect(rawRow?.sourceValues.fftoday?.displayValue).toBe(rawRow?.sourceValues.fftoday?.rawValue);
    expect(normalizedRow?.sourceValues.fftoday?.displayValue).toBe(normalizeAuctionValue(rawRow?.sourceValues.fftoday?.rawValue ?? 0, 200, 250));
  });

  it("calculates average, median, range, spread, and missing source values", () => {
    const rows = buildAuctionComparison({
      selectedSourceIds: ["fftoday", "usa-today", "draftsharks"],
      scoringFormat: "standard",
      leagueSize: 12,
      selectedBudget: 200,
      valueMode: "raw",
    });
    const gibbs = rows.find((row) => row.playerName === "Jahmyr Gibbs");
    const values = [gibbs?.sourceValues.fftoday?.displayValue, gibbs?.sourceValues["usa-today"]?.displayValue].filter((value): value is number => value !== undefined);
    expect(gibbs?.sourceValues.draftsharks).toBeUndefined();
    expect(gibbs?.contributingSourceCount).toBe(2);
    expect(gibbs?.average).toBe(values.reduce((total, value) => total + value, 0) / values.length);
    expect(gibbs?.median).toBe(median(values));
    expect(gibbs?.spread).toBe(Math.max(...values) - Math.min(...values));
  });

  it("excludes market AAV from expert consensus until explicitly enabled", () => {
    const options = {
      selectedSourceIds: ["fftoday", "usa-today", "yafsb-aav"],
      scoringFormat: "half_ppr" as const,
      leagueSize: 12,
      selectedBudget: 200,
      valueMode: "raw" as const,
    };
    const defaultRow = buildAuctionComparison(options).find((row) => row.playerName === "Jahmyr Gibbs");
    const enabledRow = buildAuctionComparison({ ...options, includeMarketInConsensus: true }).find((row) => row.playerName === "Jahmyr Gibbs");
    expect(defaultRow?.marketAav).not.toBeNull();
    expect(defaultRow?.contributingSourceCount).toBe(2);
    expect(enabledRow?.contributingSourceCount).toBe(3);
  });

  it("marks scoring and league-size mismatches as non-comparable", () => {
    const espn = AUCTION_VALUE_SOURCE_MAP.get("espn")!;
    expect(sourceCompatibility(espn, "ppr", 10).compatible).toBe(true);
    expect(sourceCompatibility(espn, "ppr", 12)).toMatchObject({ compatible: false });
    expect(sourceCompatibility(espn, "half_ppr", 10).reasons.join(" ")).toContain("scoring format");
  });
});
