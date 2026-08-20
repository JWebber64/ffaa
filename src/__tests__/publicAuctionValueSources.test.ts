import { describe, expect, it } from "vitest";
import publicAuctionRows from "../data/players-2026-public-auction-values.json";
import { PUBLIC_AUCTION_VALUE_SOURCES } from "../data/publicAuctionValueSources";

type PublicAuctionRow = {
  sourceId: string;
  name: string;
  pos: string;
  auctionValue: number;
  scoring?: string;
};

const rows = publicAuctionRows as PublicAuctionRow[];

describe("public auction value sources", () => {
  it("catalogs every researched public surface without duplicate IDs", () => {
    expect(PUBLIC_AUCTION_VALUE_SOURCES).toHaveLength(22);
    expect(new Set(PUBLIC_AUCTION_VALUE_SOURCES.map((source) => source.id)).size).toBe(22);
  });

  it("contains normalized rows from the eight extractable public boards", () => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.sourceId, (counts.get(row.sourceId) ?? 0) + 1);

    expect(rows.length).toBeGreaterThanOrEqual(1_400);
    expect(counts.size).toBe(8);
    expect(counts.get("fftoday")).toBeGreaterThanOrEqual(600);
    expect(counts.get("sports-illustrated")).toBeGreaterThanOrEqual(230);
    expect(counts.get("rtsports-aav")).toBeGreaterThanOrEqual(200);
    expect(counts.get("yafsb-aav")).toBeGreaterThanOrEqual(200);
    expect(counts.get("draftsharks")).toBe(25);
    expect(counts.get("footballguys")).toBe(15);
    expect(counts.get("fantasynerds")).toBe(10);
    expect(counts.get("sportsbrackets")).toBeGreaterThanOrEqual(55);
  });

  it("has valid rows and no duplicate player/source/scoring entries", () => {
    expect(rows.every((row) => row.name && row.pos && row.auctionValue > 0)).toBe(true);
    const keys = rows.map((row) =>
      [row.sourceId, row.scoring ?? "any", row.name.toLowerCase(), row.pos].join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not independently weight derivative or gated sources", () => {
    for (const id of [
      "sportsbrackets",
      "elboberto",
      "csg",
      "fantasy-football-helper",
      "fantasy-on-draft",
      "rotowire",
    ]) {
      expect(PUBLIC_AUCTION_VALUE_SOURCES.find((source) => source.id === id)?.includedInConsensus)
        .toBe(false);
    }
  });
});
