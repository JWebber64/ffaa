import { describe, expect, it } from "vitest";

import {
  mergeSpreadsheetAuctionSources,
  parseAuctionSheet,
  parseCsv,
  type SpreadsheetAuctionSource,
} from "../features/league-history/provider/spreadsheetAuction";
import type { LeagueHistoryImportPayload, PlayerReference } from "../features/league-history/provider/sleeperMapper";

const source: SpreadsheetAuctionSource = {
  season: 2025,
  label: "Test auction workbook",
  spreadsheetId: "sheet-id",
  auctionGid: "auction-gid",
  teamsGid: "teams-gid",
  budgetPerTeam: 10,
  teamCount: 2,
  expectedRosterSpots: 8,
  expectedSales: 6,
  expectedSpend: 9,
  playerAliases: { "Hollywood Brown": "Marquise Brown" },
};

const auctionCsv = [
  "Workbook metadata,,,,,,,,,,,,,",
  "Player,Pos,Bye,Team,Tier,Projected $,Skew,Paid,Deflated $,Keeper?,ESPN $,Site Skew,Drafted By?",
  "Alpha One,RB,1,AAA,RB1,$5,$0,$1,$0,No,$4,$0,alice",
  "Alpha Two,WR,2,AAA,WR1,$5,$0,$2,$0,No,$4,$0,alice",
  "Hollywood Brown,WR,3,KC,WR2,$5,$0,$3,$0,No,$4,$0,alice",
  "Beta One,QB,4,BBB,QB1,$5,$0,$1,$0,No,$4,$0,bob",
  "Beta Two,TE,5,BBB,TE1,$5,$0,$1,$0,No,$4,$0,bob",
  "Beta Three,RB,6,BBB,RB2,$5,$0,$1,$0,No,$4,$0,bob",
].join("\n");

const teamsCsv = [
  "Alice,,,,,,Teams,,,,,,,,,,,Spending",
  "Position,Player,Cost,Value,Bye,,Number,Name,Remaining Budget,Max Bid,Total Drafted,QB,RB,WR,TE,K,DEF,QB Spend,RB Spend,WR Spend,TE Spend",
  "RB,Alpha One,$1,$0,1,,1,Alice,$4,$5,3,0,1,2,0,0,0,$0,$1,$5,$0",
  "QB,Beta One,$1,$0,4,,2,Bob,$7,$8,3,1,1,0,1,0,0,$1,$1,$0,$1",
  "QB,Repeated roster row,$1,$0,4,,QB,Beta One,$7,$8,4,1,1,0,1,0,0,$1,$1,$0,$1",
].join("\n");

function payload(): LeagueHistoryImportPayload {
  const player = (providerPlayerId: string, playerName: string, position: string) => ({ providerPlayerId, playerName, position, isStarter: true, fantasyPoints: 1 });
  return {
    provider: "sleeper",
    requestedExternalLeagueId: "league-2025",
    importedAt: "2026-08-20T00:00:00.000Z",
    league: { currentExternalLeagueId: "league-2025", name: "Test", sport: "nfl", format: "2-team", settings: {} },
    seasons: [{
      externalLeagueId: "league-2025",
      previousExternalLeagueId: null,
      season: 2025,
      status: "complete",
      totalRosters: 2,
      settings: {},
      scoringSettings: {},
      rosterPositions: ["QB", "RB", "WR"],
      playoffWeekStart: 15,
      providerDraftId: "draft-2025",
      raw: {},
      franchises: [
        { providerRosterId: 1, manager: { providerUserId: "alice-id", currentUsername: "alice", displayName: "Alice", avatarUrl: "" }, historicalUsername: "alice", teamName: "Alice Team", avatarUrl: "", finalRank: 1, regularSeasonRank: 1, playoffSeed: 1, wins: 10, losses: 4, ties: 0, pointsFor: 100, pointsAgainst: 90, playoffFinish: "Champion" },
        { providerRosterId: 2, manager: { providerUserId: "bob-id", currentUsername: "bob", displayName: "Bob", avatarUrl: "" }, historicalUsername: "bob", teamName: "Bob Team", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 8, losses: 6, ties: 0, pointsFor: 90, pointsAgainst: 100, playoffFinish: "Runner-up" },
      ],
      weeklyResults: [
        { week: 1, providerRosterId: 1, score: 10, starterScore: 10, benchScore: 0, optimalScore: 10, lineupEfficiency: 1, pointsLeftOnBench: 0, actualStartingPlayerIds: ["a1", "a2", "marquise"], optimalStartingPlayerIds: ["a1", "a2", "marquise"], bestMissedSubstitution: null, optimalStartersUsed: 3, analyticsStatus: "valid", analyticsReason: "", unsupportedSlots: [], missingSlots: [], calculationVersion: "test", isComplete: true, players: [player("a1", "Alpha One", "RB"), player("a2", "Alpha Two", "WR"), player("marquise", "Marquise Brown", "WR")] },
        { week: 1, providerRosterId: 2, score: 9, starterScore: 9, benchScore: 0, optimalScore: 9, lineupEfficiency: 1, pointsLeftOnBench: 0, actualStartingPlayerIds: ["b1", "b2", "b3"], optimalStartingPlayerIds: ["b1", "b2", "b3"], bestMissedSubstitution: null, optimalStartersUsed: 3, analyticsStatus: "valid", analyticsReason: "", unsupportedSlots: [], missingSlots: [], calculationVersion: "test", isComplete: true, players: [player("b1", "Beta One", "QB"), player("b2", "Beta Two", "TE"), player("b3", "Beta Three", "RB")] },
      ],
      matchups: [],
      playoffMatches: [],
      drafts: [{ providerDraftId: "draft-2025", draftType: "snake", status: "complete", budget: null, rounds: 4, startedAt: null, completedAt: null, settings: {}, raw: {}, picks: [], tradedPicks: [] }],
      transactions: [],
      awards: [],
      moments: [],
    }],
  };
}

describe("spreadsheet auction history", () => {
  it("parses quoted CSV cells and the auction ledger columns", () => {
    expect(parseCsv('Player,Note\n"Smith, John","said ""hi"""')).toEqual([["Player", "Note"], ["Smith, John", 'said "hi"']]);
    expect(parseAuctionSheet(auctionCsv)).toHaveLength(6);
  });

  it("validates manager identity, preserves price provenance, and leaves unavailable order null", async () => {
    const references = new Map<string, PlayerReference>([
      ["a1", { name: "Alpha One", position: "RB", team: "AAA" }],
      ["a2", { name: "Alpha Two", position: "WR", team: "AAA" }],
      ["marquise", { name: "Marquise Brown", position: "WR", team: "KC" }],
      ["b1", { name: "Beta One", position: "QB", team: "BBB" }],
      ["b2", { name: "Beta Two", position: "TE", team: "BBB" }],
      ["b3", { name: "Beta Three", position: "RB", team: "BBB" }],
    ]);
    const result = await mergeSpreadsheetAuctionSources(payload(), [source], references, async (_source, gid) => gid === source.auctionGid ? auctionCsv : teamsCsv);
    const draft = result.payload.seasons[0]!.drafts[0]!;
    expect(result.validations[0]).toMatchObject({ sales: 6, spend: 9, isComplete: false });
    expect(result.validations[0]?.managerMatches.map((match) => [match.sourceManager, match.providerRosterId])).toEqual([["alice", 1], ["bob", 2]]);
    expect(draft).toMatchObject({ draftType: "auction", budget: 10 });
    expect(draft.picks).toHaveLength(6);
    expect(draft.picks.every((pick) => pick.pickNumber == null && pick.round == null && pick.draftSlot == null)).toBe(true);
    expect(draft.picks.find((pick) => pick.providerPlayerId === "marquise")).toMatchObject({ auctionPrice: 3, providerRosterId: 1, playerName: "Marquise Brown" });
    expect(draft.settings.auctionLedger).toMatchObject({ orderKnown: false, recordedSales: 6, expectedRosterSpots: 8 });
  });
});

