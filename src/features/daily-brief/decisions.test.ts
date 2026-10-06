import { describe, expect, it } from "vitest";
import { compareBench } from "./comparisons";
import { emptyInsights, insightsSchema, outcome, recordPick, updateInsights } from "./insights";
import { rankBriefCandidates, type BriefCandidate } from "./ranking";
import type { BriefEdition, LeagueBriefContext, Observation } from "./model";

const row = (id: string, date = "2026-10-05", score = 10): Observation => ({ id, providerId: id, name: "Player " + id, position: "WR", team: "BUF", gameId: id + ":" + date, date, stats: { rec: score, targets: 8 }, sourceUrl: "https://example.com/stats" });
const edition: BriefEdition = { version: 1, sport: "football", date: "2026-10-06", generatedAt: "2026-10-07T12:00:00Z", revision: "r1", status: "no-games", games: [], upcoming: [], observations: [row("a"), row("a", "2026-09-28", 8), row("b", "2026-10-04", 4), row("b", "2026-09-27", 6)], sources: [], warnings: [] };
const context: LeagueBriefContext = { scopeKey: "league:team", name: "QA", snapshotAt: edition.generatedAt, complete: true, ownedIds: ["b"], myIds: ["b"], format: "points", weights: { rec: 1 }, categories: [], positions: ["WR", "FLEX"], availability: "rosters", note: "",
  roster: [{ id: "b", name: "Bench", positions: ["WR"], team: "BUF", slot: "BENCH", cost: 3, protected: false }] };
const signal: BriefCandidate = { player: row("a"), score: 10, fantasyPoints: 10, sample: 3, label: "Add now", evidence: "", risk: "", categoryHelp: [], nextGames: 1, offNights: 0 };
describe("brief decisions and follow-up", () => {
  it("retains football candidates on a no-game Wednesday edition without leaking owned players", () => {
    const ranked = rankBriefCandidates(edition, context);
    expect(ranked.map(value => value.player.id)).toEqual(["a"]);
    expect(rankBriefCandidates({ ...edition, date: "2026-10-13" }, context)).toEqual([]);
  });
  it("compares compatible bench players in real scoring and skips protected, reserve, starting and unsupported players", () => {
    expect(compareBench(row("a"), edition, context)?.delta).toBe(4);
    for (const slot of ["WR", "IR", "RESERVE", "TAXI"]) expect(compareBench(row("a"), edition, { ...context, roster: context.roster!.map(player => ({ ...player, slot })) })).toBeNull();
    expect(compareBench(row("a"), edition, { ...context, roster: context.roster!.map(player => ({ ...player, protected: true })) })).toBeNull();
    expect(compareBench(row("a"), edition, { ...context, weights: { bonus: 10 } })).toBeNull();
    expect(compareBench({ ...row("a"), position: "QB" }, edition, context)).toBeNull();
  });
  it("compares category units separately without making an aggregate fantasy score", () => {
    const comparison = compareBench(row("a"), edition, { ...context, format: "categories", categories: ["rec", "unavailable"] });
    expect(comparison?.delta).toBeNull();
    expect(comparison?.text).toContain("9.00 versus 5.00");
    expect(comparison?.text).not.toContain("unavailable");
  });
  it("honors published custom flex eligibility and does not treat a bench slot as a starting position", () => {
    const qb = { ...row("a"), position: "QB" };
    const league = { ...context, positions: ["FLEX"], slotEligibility: { FLEX: ["QB", "RB", "WR", "TE"] } };
    expect(compareBench(qb, edition, league)?.bench.id).toBe("b");
    expect(rankBriefCandidates({ ...edition, observations: [qb] }, league)).toHaveLength(1);
    expect(rankBriefCandidates(edition, { ...context, positions: ["BENCH"] })).toEqual([]);
  });
  it("requires opt-in and establishes a quiet baseline before alerting to a new pickup", () => {
    expect(updateInsights(emptyInsights, edition, context, [signal], true).alerts).toEqual([]);
    const enabled = { ...emptyInsights, alertsEnabled: true };
    const baseline = updateInsights(enabled, edition, context, [], true);
    expect(baseline.alerts).toEqual([]);
    const changed = updateInsights(baseline, { ...edition, revision: "r2" }, context, [signal], true);
    expect(changed.alerts).toHaveLength(1);
    expect(updateInsights(changed, { ...edition, revision: "r2" }, context, [signal], true).alerts).toHaveLength(1);
  });
  it("suppresses historic, stale and partial alerts and resets quietly on scoring or team changes", () => {
    const baseline = updateInsights({ ...emptyInsights, alertsEnabled: true }, edition, context, [], true);
    expect(updateInsights(baseline, edition, context, [signal], false).alerts).toEqual([]);
    expect(updateInsights(baseline, { ...edition, status: "partial" }, context, [signal], true).alerts).toEqual([]);
    expect(updateInsights(baseline, { ...edition, date: "2026-10-04" }, context, [signal], true).alerts).toEqual([]);
    expect(updateInsights(baseline, edition, { ...context, weights: { rec: 0.5 } }, [signal], true).alerts).toEqual([]);
    expect(updateInsights(baseline, edition, { ...context, scopeKey: "other" }, [signal], true).alerts).toEqual([]);
  });
  it("records only subsequent games, deduplicates corrections and freezes original scoring", () => {
    const pick = recordPick(row("a"), { ...edition, date: "2026-10-04" }, context, "Watch", row("b"));
    let saved = updateInsights({ ...emptyInsights, tracked: [pick] }, { ...edition, observations: [...edition.observations, row("a", "2026-10-07", 99)] }, { ...context, weights: { rec: 10 } }, [], false);
    expect(outcome(saved.tracked[0]!, "football")).toMatchObject({ games: 1, total: 10 });
    saved = updateInsights(saved, { ...edition, observations: [row("a", "2026-10-05", 12)] }, context, [], false);
    expect(outcome(saved.tracked[0]!, "football")).toMatchObject({ games: 1, total: 12 });
    saved = updateInsights(saved, { ...edition, generatedAt: "2026-10-06T01:00:00Z", observations: [row("a", "2026-10-05", 9)] }, context, [], false);
    expect(outcome(saved.tracked[0]!, "football").total).toBe(12);
    expect(outcome(saved.tracked[0]!, "football", "b").games).toBe(0);
    expect(insightsSchema.safeParse({ ...saved, tracked: Array(31).fill(pick) }).success).toBe(false);
  });
});
