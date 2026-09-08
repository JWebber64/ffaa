import { describe, expect, it } from "vitest";
import { buildStatRanks } from "@/components/stats/statRanks";

describe("selected stat ranks", () => {
  it("shares competition ranks for ties and excludes missing or non-finite values", () => {
    const rows = [
      { id: "second", value: 20 }, { id: "missing", value: null },
      { id: "tie", value: 20 }, { id: "leader", value: 24 },
      { id: "fourth", value: 0 }, { id: "fifth", value: -2 },
      { id: "invalid", value: NaN }, { id: "infinite", value: Infinity },
      { id: "text", value: "20" },
    ];
    expect([...buildStatRanks(rows, (row) => row.value)]).toEqual([
      ["leader", 1], ["second", 2], ["tie", 2], ["fourth", 4], ["fifth", 5],
    ]);
    expect(rows[0]?.id).toBe("second");
  });

  it("ranks using underlying precision and handles empty populations", () => {
    expect([...buildStatRanks([{ id: "a", n: 20.01 }, { id: "b", n: 20.04 }], (row) => row.n)])
      .toEqual([["b", 1], ["a", 2]]);
    expect(buildStatRanks([], () => null).size).toBe(0);
  });
});
