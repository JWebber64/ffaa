// @vitest-environment node
import { describe, expect, it } from "vitest";
import { previousGameDate, editionSchema, type BriefEdition, type LeagueBriefContext, type Observation } from "./model";
import { rankBriefCandidates, scoredObservation } from "./ranking";
const player = (changes: Partial<Observation> = {}): Observation => ({ id: "1", providerId: "100", name: "Test player", position: "WR", team: "BUF", gameId: "g1", date: "2026-10-05", stats: { rec: 5, rec_yd: 70, rush_yd: 0, rec_td: 0, targets: 8 }, sourceUrl: "https://example.com/stats", ...changes });
const context = (changes: Partial<LeagueBriefContext> = {}): LeagueBriefContext => ({ name: "League", snapshotAt: "2026-10-06T04:00:00Z", complete: true, ownedIds: [], myIds: [], format: "points", weights: { rec: 1, rec_yd: .1 }, categories: [], positions: ["WR"], availability: "rosters", note: "Snapshot", ...changes });
const edition = (observations: Observation[], sport: "football" | "hockey" = "football"): BriefEdition => ({ version: 1, sport, date: "2026-10-05", generatedAt: "2026-10-06T12:00:00Z", revision: "test", status: "complete", games: [], upcoming: [], observations, sources: [], warnings: [] });
describe("daily brief recommendations", () => {
  it("compares football scoring within position and downgrades partial editions", () => {
    const rows = [
      player({ id: "1", providerId: "101", stats: { rec: 0, pass_yd: 300, targets: 0, pass_att: 35 }, position: "QB" }),
      player({ id: "2", providerId: "102", stats: { rec: 0, pass_yd: 250, targets: 0, pass_att: 30 }, position: "QB" }),
      player({ id: "3", providerId: "103", stats: { rec: 10, pass_yd: 0, targets: 12 } }),
      player({ id: "4", providerId: "104", stats: { rec: 1, pass_yd: 0, targets: 2 } }),
    ].flatMap(row => [row, { ...row, gameId: "g2", date: "2026-09-28" }, { ...row, gameId: "g3", date: "2026-09-21" }]);
    const rules = context({ weights: { rec: 1, pass_yd: .04 }, positions: ["QB", "WR"] });
    const ranked = rankBriefCandidates(edition(rows), rules);
    expect(ranked[0]?.player.id).toBe("3");
    expect(ranked[0]?.label).toBe("Add now");
    expect(rankBriefCandidates({ ...edition(rows), status: "partial" }, rules).every(row => row.label === "Watch")).toBe(true);
  });
  it("uses the Eastern game date across Taipei midnight and DST", () => {
    expect(previousGameDate(new Date("2026-10-06T12:00:00Z"))).toBe("2026-10-05");
    expect(previousGameDate(new Date("2026-01-06T12:00:00Z"))).toBe("2026-01-05");
  });
  it("rejects impossible calendar dates", () => {
    expect(editionSchema.shape.date.safeParse("2026-02-30").success).toBe(false);
  });
  it("filters every league roster, not just the user's team", () => {
    expect(rankBriefCandidates(edition([player()]), context({ ownedIds: ["100"] }))).toEqual([]);
    expect(rankBriefCandidates(edition([player({ providerId: null })]), context())).toEqual([]);
    expect(rankBriefCandidates(edition([player()]), context({ complete: false }))).toEqual([]);
  });
  it("respects native market restrictions and position eligibility", () => {
    expect(rankBriefCandidates(edition([player()]), context({ allowedIds: ["200"] }))).toEqual([]);
    expect(rankBriefCandidates(edition([player({ position: "QB" })]), context())).toEqual([]);
    expect(rankBriefCandidates(edition([player({ position: "QB" })]), context({ positions: ["SUPER_FLEX"] }))).toHaveLength(1);
  });
  it("uses actual league scoring and refuses incomplete custom scoring", () => {
    expect(scoredObservation(player(), context(), "football")).toBe(12);
    expect(scoredObservation(player(), context({ weights: { rec: 1, sack: 1, fgm_0_19: 3, pts_allow_0: 10, def_st_td: 6 } }), "football")).toBe(5);
    expect(scoredObservation(player(), context({ weights: { rec: .5, rec_yd: .1 } }), "football")).toBe(9.5);
    expect(scoredObservation(player(), context({ weights: { rec: 1, bonus_rec_yd: 3 } }), "football")).toBeNull();
    expect(rankBriefCandidates(edition([player()]), context({ weights: { bonus_rec_yd: 3 } }))).toEqual([]);
  });
  it("keeps one touchdown spike on Watch and deduplicates game rows", () => {
    expect(rankBriefCandidates(edition([player(), player()]), context())[0]?.sample).toBe(1);
    expect(rankBriefCandidates(edition([player()]), context())[0]?.label).toBe("Watch");
  });
  it("includes Sunday performances in Tuesday priorities without future leakage", () => {
    const report = edition([player({ date: "2026-10-04" }), player({ id: "2", providerId: "200", date: "2026-10-06" })]);
    expect(rankBriefCandidates(report, context()).map(row => row.player.id)).toEqual(["1"]);
  });
  it("ranks hockey for selected categories and does not count goalie stats as skater points", () => {
    const rows = [player({ id: "1", position: "D", stats: { hits: 5, shots: 1 }, providerId: "1" }), player({ id: "2", position: "D", stats: { hits: 1, shots: 8 }, providerId: "2" })];
    const rules = context({ format: "categories", categories: ["hits"], positions: ["D"] });
    expect(rankBriefCandidates(edition(rows, "hockey"), rules)[0]?.player.id).toBe("1");
    expect(scoredObservation(rows[0]!, context({ weights: { hits: 1, wins: 3 } }), "hockey")).toBe(5);
  });
});
