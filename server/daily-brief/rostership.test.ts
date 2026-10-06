// @vitest-environment node
import { describe, expect, it } from "vitest";
import { enrichRostership, joinEspnPercentages, mapFootballEspnIds, rosterSeason } from "./rostership";
import { editionRevision } from "./pipeline";
import type { BriefEdition, Observation } from "../../src/features/daily-brief/model";
import type { SourceReader } from "./fetchSource";
const player: Observation = { id: "8478402", providerId: "8478402", name: "Connor McDavid", team: "EDM", position: "C", gameId: "g", date: "2026-10-05", stats: {}, sourceUrl: "https://example.com" };
const edition: BriefEdition = { version: 1, sport: "hockey", date: player.date, generatedAt: "2026-10-06T12:00:00Z", revision: "r", status: "complete", games: [], observations: [player], upcoming: [], sources: [], warnings: [] };
const pool = [{ id: 3895074, fullName: player.name, proTeamId: 6, defaultPositionId: 1, ownership: { percentOwned: 0 } }];
const teams = new Map([["6", "EDM"]]);
describe("platform roster percentages", () => {
  it("keeps measured zero, rejects missing/invalid percentages and ambiguous hockey identities", () => {
    expect(joinEspnPercentages(edition, pool, teams, new Map())[0]?.percent).toBe(0);
    expect(joinEspnPercentages(edition, [{ ...pool[0], ownership: {} }], teams, new Map())).toEqual([]);
    expect(joinEspnPercentages(edition, [{ ...pool[0], ownership: { percentOwned: 101 } }], teams, new Map())).toEqual([]);
    expect(joinEspnPercentages(edition, [...pool, { ...pool[0], id: 9 }], teams, new Map())).toEqual([]);
    expect(joinEspnPercentages({ ...edition, observations: [player, { ...player, id: "other" }] }, pool, teams, new Map())).toEqual([]);
    expect(joinEspnPercentages({ ...edition, observations: [{ ...player, team: "BUF" }] }, pool, teams, new Map())).toEqual([]);
  });
  it("joins football through a unique crosswalk and never guesses by name", () => {
    const mapping = mapFootballEspnIds("gsis_id,espn_id\n00-1,100\n00-2,101\n00-2,102\n00-3,103\n00-4,103");
    expect([...mapping]).toEqual([["00-1", "100"]]);
    const report = { ...edition, sport: "football" as const, observations: [{ ...player, id: "00-1", providerId: "sleeper-1", position: "WR" }] };
    expect(joinEspnPercentages(report, [{ id: 100, defaultPositionId: 3, ownership: { percentOwned: 12.5 } }], new Map(), mapping)[0]?.percent).toBe(12.5);
    expect(joinEspnPercentages(report, pool, teams, new Map())).toEqual([]);
  });
  it("uses the provider season conventions", () => {
    expect(rosterSeason(edition)).toBe("2027");
    expect(rosterSeason({ ...edition, date: "2026-04-10" })).toBe("2026");
    expect(rosterSeason({ ...edition, sport: "football", date: "2026-01-10" })).toBe("2025");
  });
  it("retains original retrieval time after failure without losing games or inventing percentages", async () => {
    const previous = { ...edition, rostership: [{ platform: "espn" as const, season: "2027", status: "ready" as const, fetchedAt: "2026-10-05T12:00:00Z", sourceUrl: "https://example.com", note: "verified", entries: [{ id: player.id, providerId: "espn-1", percent: 12, match: "exact-name-team-position" as const }] }] };
    const failed: SourceReader = async () => { throw new Error("Unavailable"); };
    const refreshed = await enrichRostership(edition, failed, previous);
    expect(refreshed.status).toBe("complete");
    expect(refreshed.observations).toEqual(edition.observations);
    expect(refreshed.rostership?.find(row => row.platform === "espn")).toMatchObject({ status: "stale", fetchedAt: previous.rostership[0]!.fetchedAt, entries: previous.rostership[0]!.entries });
    expect(refreshed.rostership?.find(row => row.platform === "yahoo")?.entries).toEqual([]);
    expect(editionRevision(refreshed)).not.toBe(editionRevision(edition));
    expect((await enrichRostership({ ...edition, date: "2025-10-05" }, failed, previous)).rostership?.find(row => row.platform === "espn")?.status).toBe("unavailable");
  });
  it("reads Sleeper ownership percentages independently from trending add counts", async () => {
    const read: SourceReader = async url => ({ text: url.includes("research") ? JSON.stringify({ 100: { owned: 1.3, started: 0 } }) : (() => { throw new Error("ESPN unavailable"); })(), updatedAt: null });
    const report = { ...edition, sport: "football" as const, observations: [{ ...player, id: "00-1", providerId: "100", position: "WR" }] };
    const result = await enrichRostership(report, read);
    expect(result.rostership?.find(row => row.platform === "sleeper")?.entries[0]?.percent).toBe(1.3);
    expect(result.rostership?.find(row => row.platform === "espn")?.status).toBe("unavailable");
  });
});
