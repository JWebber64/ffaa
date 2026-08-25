import { describe, expect, it } from "vitest";

import type { LeagueHistoryImportPayload } from "../features/league-history/provider/sleeperMapper";
import {
  assembleLeagueHistorySnapshot,
  buildFirestoreLeagueHistoryBundle,
  FIRESTORE_CHUNK_MAX_BYTES,
} from "../features/league-history/persistence/firestoreLeagueHistoryModel";

const payload = {
  provider: "sleeper",
  requestedExternalLeagueId: "league-current",
  importedAt: "2026-08-25T00:00:00.000Z",
  league: {
    currentExternalLeagueId: "league-current",
    name: "Test League",
    sport: "nfl",
    format: "redraft",
    settings: {},
  },
  seasons: [{
    externalLeagueId: "league-current",
    previousExternalLeagueId: "league-old",
    season: 2026,
    status: "complete",
    totalRosters: 2,
    settings: {},
    scoringSettings: { rec: 1 },
    rosterPositions: ["QB", "RB"],
    playoffWeekStart: 15,
    providerDraftId: "draft-1",
    raw: {},
    franchises: [
      {
        providerRosterId: 1,
        manager: { providerUserId: "user-1", currentUsername: "one", displayName: "One", avatarUrl: "" },
        historicalUsername: "one",
        teamName: "Team One",
        avatarUrl: "",
        finalRank: 1,
        regularSeasonRank: 1,
        playoffSeed: 1,
        wins: 1,
        losses: 0,
        ties: 0,
        pointsFor: 100,
        pointsAgainst: 90,
        playoffFinish: "Champion",
      },
      {
        providerRosterId: 2,
        manager: { providerUserId: "user-2", currentUsername: "two", displayName: "Two", avatarUrl: "" },
        historicalUsername: "two",
        teamName: "Team Two",
        avatarUrl: "",
        finalRank: 2,
        regularSeasonRank: 2,
        playoffSeed: 2,
        wins: 0,
        losses: 1,
        ties: 0,
        pointsFor: 90,
        pointsAgainst: 100,
        playoffFinish: "Runner-up",
      },
    ],
    weeklyResults: [1, 2].map((providerRosterId) => ({
      week: 1,
      providerRosterId,
      score: providerRosterId === 1 ? 100 : 90,
      starterScore: providerRosterId === 1 ? 100 : 90,
      benchScore: 10,
      optimalScore: providerRosterId === 1 ? 102 : 95,
      lineupEfficiency: 0.98,
      pointsLeftOnBench: 2,
      actualStartingPlayerIds: [`player-${providerRosterId}`],
      optimalStartingPlayerIds: [`player-${providerRosterId}`],
      bestMissedSubstitution: null,
      optimalStartersUsed: 1,
      analyticsStatus: "valid" as const,
      analyticsReason: "",
      unsupportedSlots: [],
      missingSlots: [],
      calculationVersion: "legal-lineup-v1",
      isComplete: true,
      players: [{
        providerPlayerId: `player-${providerRosterId}`,
        playerName: `Player ${providerRosterId}`,
        position: "QB",
        isStarter: true,
        fantasyPoints: providerRosterId === 1 ? 25 : 20,
      }],
    })),
    matchups: [{
      week: 1,
      providerMatchupId: "1",
      rosterAId: 1,
      rosterBId: 2,
      scoreA: 100,
      scoreB: 90,
      isPlayoff: false,
      playoffRound: null,
      isChampionship: false,
      winnerRosterId: 1,
      margin: 10,
      isComplete: true,
    }],
    playoffMatches: [{
      bracketType: "winners",
      providerMatchId: "final",
      round: 1,
      placement: 1,
      rosterAId: 1,
      rosterBId: 2,
      winnerRosterId: 1,
      loserRosterId: 2,
    }],
    drafts: [{
      providerDraftId: "draft-1",
      draftType: "auction",
      status: "complete",
      budget: 200,
      rounds: 1,
      startedAt: null,
      completedAt: null,
      settings: {},
      raw: {},
      picks: [{
        providerPickId: "pick-1",
        providerRosterId: 1,
        providerPlayerId: "player-1",
        playerName: "Player 1",
        position: "QB",
        nflTeam: "BUF",
        pickNumber: 1,
        round: 1,
        draftSlot: 1,
        auctionPrice: 25,
        isKeeper: false,
        metadata: {},
      }],
      tradedPicks: [],
    }],
    transactions: [
      {
        providerTransactionId: "transaction-complete",
        transactionType: "trade",
        status: "complete",
        week: 1,
        creatorProviderUserId: "user-1",
        faabBid: null,
        occurredAt: null,
        metadata: {},
        raw: {},
        assets: [{
          providerAssetKey: "player:player-1:1:2",
          assetType: "player",
          providerPlayerId: "player-1",
          playerName: "Player 1",
          fromRosterId: 1,
          toRosterId: 2,
          faabAmount: null,
          draftSeason: null,
          draftRound: null,
          metadata: {},
        }],
      },
      {
        providerTransactionId: "transaction-failed",
        transactionType: "waiver",
        status: "failed",
        week: 1,
        creatorProviderUserId: "user-2",
        faabBid: 10,
        occurredAt: null,
        metadata: {},
        raw: {},
        assets: [],
      },
    ],
    awards: [{
      sourceKey: "award-1",
      awardType: "weekly_high_score",
      title: "Weekly High Score",
      description: "One led the league.",
      week: 1,
      providerRosterId: 1,
      providerPlayerId: null,
      playerName: "",
      numericValue: 100,
      sourceType: "weekly_roster_result",
      sourceProviderMatchupId: null,
      calculationVersion: "weekly-awards-v1",
    }],
    moments: [{
      sourceKey: "moment-1",
      momentType: "weekly_team_score_record",
      title: "Record",
      description: "One set a record.",
      season: 2026,
      week: 1,
      providerRosterIds: [1],
      providerPlayerId: null,
      playerName: "",
      sourceType: "weekly_roster_result",
      sourceProviderMatchupId: null,
      previousValue: 90,
      newValue: 100,
      calculationVersion: "league-moments-v1",
    }],
  }],
} satisfies LeagueHistoryImportPayload;

describe("Firestore League History model", () => {
  it("maps stable relationships and preserves the legacy route aliases", () => {
    const bundle = buildFirestoreLeagueHistoryBundle(payload, ["legacy-supabase-uuid"]);

    expect(bundle.historyId).toBe("league-current");
    expect(bundle.root.routeIds).toEqual(expect.arrayContaining([
      "league-current",
      "league-old",
      "legacy-supabase-uuid",
    ]));
    expect(bundle.root.counts).toMatchObject({
      seasons: 1,
      managers: 2,
      franchises: 2,
      matchups: 1,
      weeklyResults: 2,
      weeklyPlayerResults: 2,
      transactions: 1,
      transactionAssets: 1,
      awards: 1,
      moments: 1,
    });
    expect(bundle.snapshot.transactions).toHaveLength(1);
    expect(bundle.snapshot.transactionAssets[0]).toMatchObject({
      fromFranchiseId: "league-current:roster:1",
      toFranchiseId: "league-current:roster:2",
    });
    expect(bundle.weeks).toHaveLength(1);
    expect(bundle.weeks[0]?.data).toMatchObject({ status: "complete", season: 2026, week: 1 });
    expect(bundle.weeks[0]?.data.awards[0]).toMatchObject({
      franchiseId: "league-current:roster:1",
      managerId: "user-1",
      weeklyRosterResultId: "league-current:week:1:roster:1",
    });
    expect(bundle.weeks[0]?.data.moments[0]?.managerIds).toEqual(["user-1"]);
  });

  it("round-trips every snapshot chunk below the safe document limit", () => {
    const bundle = buildFirestoreLeagueHistoryBundle(payload);
    const assembled = assembleLeagueHistorySnapshot(bundle.root, bundle.chunks.map((entry) => entry.data));

    expect(assembled).toEqual(bundle.snapshot);
    for (const chunk of bundle.chunks) {
      expect(new TextEncoder().encode(JSON.stringify(chunk.data)).length).toBeLessThanOrEqual(FIRESTORE_CHUNK_MAX_BYTES);
    }
  });
});
