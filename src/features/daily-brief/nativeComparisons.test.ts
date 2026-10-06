import { describe, expect, it } from "vitest";
import { nativeComparisonRoster } from "./nativeComparisons";
const input: Parameters<typeof nativeComparisonRoster>[0] = {
  team: { franchiseId: "f", rosterRevision: 3, rosterPlayerIds: ["start", "bench", "ir", "protected"] }, week: 6, settingsVersionId: "rules", seasonRevision: 2, leagueType: "redraft",
  players: ["start", "bench", "ir", "protected"].map(playerId => ({ playerId, ownerFranchiseId: "f", state: playerId === "protected" ? "protected" : "owned" })),
  lineups: [{ franchiseId: "f", week: 6, settingsVersionId: "rules", rosterRevision: 3, seasonRevision: 2, assignments: { "WR-1": "start" }, selectionMode: "manual" }],
  directory: new Map(["start", "bench", "ir", "protected"].map(id => [id, { name: id, sleeperId: id, position: "WR", team: "BUF", status: "active", injuryStatus: id === "ir" ? "IR" : "" }])),
};
describe("native bench evidence", () => {
  it("uses the synchronized published lineup while excluding protected and reserve drops", () => {
    const roster = nativeComparisonRoster(input);
    expect(roster.find(row => row.name === "start")?.slot).toBe("WR");
    expect(roster.find(row => row.name === "bench")?.slot).toBe("BENCH");
    expect(roster.find(row => row.name === "ir")?.slot).toBe("RESERVE");
    expect(roster.find(row => row.name === "protected")?.protected).toBe(true);
  });
  it("withholds stale revisions, future lineups, best ball, unknown identities and keeper comparisons", () => {
    expect(nativeComparisonRoster({ ...input, week: 5 })).toEqual([]);
    expect(nativeComparisonRoster({ ...input, leagueType: "keeper" })).toEqual([]);
    expect(nativeComparisonRoster({ ...input, seasonRevision: 4 })).toEqual([]);
    expect(nativeComparisonRoster({ ...input, lineups: input.lineups!.map(row => ({ ...row, selectionMode: "best_ball" })) })).toEqual([]);
    expect(nativeComparisonRoster({ ...input, directory: new Map() })).toEqual([]);
    expect(nativeComparisonRoster({ ...input, players: input.players!.slice(1) })).toEqual([]);
  });
});
