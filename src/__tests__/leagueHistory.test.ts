import { describe, expect, it } from "vitest";

import { calculateGoatRankings, calculateHeadToHead, calculateManagerCareer } from "../features/league-history/analytics";
import type { HistoricalTransactionAsset, LeagueHistorySnapshot } from "../features/league-history/domain/types";
import { mapSleeperHistory } from "../features/league-history/provider/sleeperMapper";
import type { SleeperHistoryBundle, SleeperSeasonBundle } from "../features/league-history/provider/sleeperTypes";
import {
  leagueHistoryPath,
  leagueRivalryPath,
  recoverLeagueHistoryPath,
  resolveLeagueHistoryManagerId,
} from "../features/league-history/ui/leagueRoutes";
import { groupTransactionAssetsByRecipient } from "../features/league-history/ui/transactionPresentation";

const snapshot: LeagueHistorySnapshot = {
  league: { id: "league", provider: "sleeper", currentExternalLeagueId: "current", name: "Test", sport: "nfl", format: "2-team", settings: {}, createdAt: "", updatedAt: "" },
  seasons: [
    { id: "s25", leagueId: "league", provider: "sleeper", providerLeagueId: "l25", previousProviderLeagueId: "l24", season: 2025, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: null, importedAt: "" },
    { id: "s24", leagueId: "league", provider: "sleeper", providerLeagueId: "l24", previousProviderLeagueId: null, season: 2024, status: "complete", totalRosters: 2, scoringSettings: {}, settings: {}, rosterPositions: [], playoffWeekStart: 15, providerDraftId: null, importedAt: "" },
  ],
  managers: [
    { id: "a", provider: "sleeper", providerUserId: "user-a", currentUsername: "alpha-now", displayName: "Alpha", avatarUrl: "", createdAt: "", updatedAt: "" },
    { id: "b", provider: "sleeper", providerUserId: "user-b", currentUsername: "beta", displayName: "Beta", avatarUrl: "", createdAt: "", updatedAt: "" },
  ],
  franchises: [
    { id: "a25", leagueSeasonId: "s25", managerId: "a", providerRosterId: 1, historicalUsername: "alpha-now", teamName: "New Alpha", avatarUrl: "", finalRank: 2, regularSeasonRank: 1, playoffSeed: 1, wins: 9, losses: 5, ties: 0, pointsFor: 1500, pointsAgainst: 1400, playoffFinish: "Runner-up" },
    { id: "b25", leagueSeasonId: "s25", managerId: "b", providerRosterId: 2, historicalUsername: "beta", teamName: "Beta", avatarUrl: "", finalRank: 1, regularSeasonRank: 2, playoffSeed: 2, wins: 8, losses: 6, ties: 0, pointsFor: 1450, pointsAgainst: 1460, playoffFinish: "Champion" },
    { id: "a24", leagueSeasonId: "s24", managerId: "a", providerRosterId: 1, historicalUsername: "alpha-old", teamName: "Old Alpha", avatarUrl: "", finalRank: 1, regularSeasonRank: 1, playoffSeed: 1, wins: 10, losses: 4, ties: 0, pointsFor: 1550, pointsAgainst: 1390, playoffFinish: "Champion" },
    { id: "b24", leagueSeasonId: "s24", managerId: "b", providerRosterId: 2, historicalUsername: "beta", teamName: "Beta", avatarUrl: "", finalRank: 2, regularSeasonRank: 2, playoffSeed: 2, wins: 7, losses: 7, ties: 0, pointsFor: 1400, pointsAgainst: 1510, playoffFinish: "Runner-up" },
  ],
  matchups: [
    { id: "m1", leagueSeasonId: "s24", week: 1, providerMatchupId: "1", franchiseAId: "a24", franchiseBId: "b24", scoreA: 120, scoreB: 100, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "a24", margin: 20, isComplete: true, importedAt: "" },
    { id: "m2", leagueSeasonId: "s24", week: 17, providerMatchupId: "1", franchiseAId: "a24", franchiseBId: "b24", scoreA: 130, scoreB: 110, isPlayoff: true, playoffRound: 3, isChampionship: true, winnerFranchiseId: "a24", margin: 20, isComplete: true, importedAt: "" },
    { id: "m3", leagueSeasonId: "s25", week: 1, providerMatchupId: "1", franchiseAId: "a25", franchiseBId: "b25", scoreA: 90, scoreB: 105, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "b25", margin: 15, isComplete: true, importedAt: "" },
    { id: "m4", leagueSeasonId: "s25", week: 8, providerMatchupId: "1", franchiseAId: "a25", franchiseBId: "b25", scoreA: 115, scoreB: 100, isPlayoff: false, playoffRound: null, isChampionship: false, winnerFranchiseId: "a25", margin: 15, isComplete: true, importedAt: "" },
  ],
  weeklyResults: [],
  weeklyPlayerResults: [],
  playoffMatches: [
    { id: "p24", leagueSeasonId: "s24", bracketType: "winners", providerMatchId: "6", round: 3, placement: 1, franchiseAId: "a24", franchiseBId: "b24", winnerFranchiseId: "a24", loserFranchiseId: "b24" },
    { id: "p25", leagueSeasonId: "s25", bracketType: "winners", providerMatchId: "6", round: 3, placement: 1, franchiseAId: "a25", franchiseBId: "b25", winnerFranchiseId: "b25", loserFranchiseId: "a25" },
  ],
  drafts: [],
  draftPicks: [],
  transactions: [],
  transactionAssets: [],
};

function sleeperSeason(season: number, leagueId: string, previousLeagueId: string | null, teamName: string): SleeperSeasonBundle {
  return {
    league: { league_id: leagueId, previous_league_id: previousLeagueId, name: "Reusable League", sport: "nfl", season: String(season), status: "complete", total_rosters: 2, settings: { playoff_week_start: 15 }, scoring_settings: { rec: 1 }, roster_positions: ["QB", "RB", "WR"] },
    users: [
      { user_id: "stable-user", username: `manager-${season}`, display_name: "Manager", metadata: { team_name: teamName } },
      { user_id: "opponent", username: "opponent", display_name: "Opponent", metadata: { team_name: "Opponent Team" } },
    ],
    rosters: [
      { roster_id: 1, owner_id: "stable-user", settings: { wins: 10, losses: 4, ties: 0, fpts: 1500, fpts_against: 1400 } },
      { roster_id: 2, owner_id: "opponent", settings: { wins: 8, losses: 6, ties: 0, fpts: 1400, fpts_against: 1500 } },
    ],
    winnersBracket: [{ r: 3, m: 6, t1: 1, t2: 2, w: 1, l: 2, p: 1 }],
    losersBracket: [], tradedPicks: [], transactions: [], drafts: [],
    matchups: [{ week: 1, rows: [
      { roster_id: 1, matchup_id: 1, points: 110, players: [], starters: [] },
      { roster_id: 2, matchup_id: 1, points: 100, players: [], starters: [] },
    ] }],
  };
}

function transactionAsset(id: string, fromFranchiseId: string, toFranchiseId: string, assetType: HistoricalTransactionAsset["assetType"] = "player"): HistoricalTransactionAsset {
  return {
    id, transactionId: "trade", providerAssetKey: id, assetType, providerPlayerId: id,
    playerName: id, fromFranchiseId, toFranchiseId, faabAmount: assetType === "faab" ? 20 : null,
    draftSeason: null, draftRound: null, metadata: {},
  };
}

describe("normalized league history analytics", () => {
  it("anchors every league-history section to the league root", () => {
    expect(leagueHistoryPath("league 123", "h2h")).toBe("/league/league%20123/h2h");
    expect(leagueHistoryPath("league 123", "/history/champions/")).toBe("/league/league%20123/history/champions");
    expect(leagueHistoryPath("league 123")).toBe("/league/league%20123");
  });

  it("opens normalized rivalry history from legacy Sleeper manager IDs", () => {
    expect(leagueRivalryPath("league 123", "sleeper-user-user-a", "sleeper-user-user-b"))
      .toBe("/league/league%20123/rivalries/sleeper-user-user-a/sleeper-user-user-b");
    expect(resolveLeagueHistoryManagerId(snapshot.managers, "sleeper-user-user-a")).toBe("a");
    expect(resolveLeagueHistoryManagerId(snapshot.managers, "user-b")).toBe("b");
    expect(resolveLeagueHistoryManagerId(snapshot.managers, "a")).toBe("a");
  });

  it.each([
    ["/ff/league/123/leaderboards/h2h", "/league/123/h2h"],
    ["/ff/league/123/managers/history/champions", "/league/123/history/champions"],
    ["/ff/league/123/h2h/leaderboards", "/league/123/leaderboards"],
    ["/ff/league/123/unknown", "/league/123"],
  ])("recovers malformed nested league path %s", (pathname, expected) => {
    expect(recoverLeagueHistoryPath("123", pathname)).toBe(expected);
  });

  it("groups every trade asset under its recipient without losing sender direction", () => {
    const groups = groupTransactionAssetsByRecipient([
      transactionAsset("Pittman", "big-love", "big-freaky"),
      transactionAsset("Achane", "big-freaky", "big-love"),
      transactionAsset("FAAB", "big-love", "big-freaky", "faab"),
    ]);
    expect(groups.map((group) => ({
      recipient: group.recipientFranchiseId,
      assets: group.assets.map((asset) => ({ id: asset.id, from: asset.fromFranchiseId })),
    }))).toEqual([
      { recipient: "big-freaky", assets: [{ id: "Pittman", from: "big-love" }, { id: "FAAB", from: "big-love" }] },
      { recipient: "big-love", assets: [{ id: "Achane", from: "big-freaky" }] },
    ]);
  });

  it("keeps career and rivalry history attached to permanent manager IDs", () => {
    const career = calculateManagerCareer(snapshot, "a");
    const rivalry = calculateHeadToHead(snapshot, "a", "b");
    expect(career).toMatchObject({ seasonsPlayed: 2, wins: 19, losses: 9, championships: 1, championshipAppearances: 2 });
    expect(career?.franchises.map((franchise) => franchise.teamName)).toEqual(["New Alpha", "Old Alpha"]);
    expect(rivalry).toMatchObject({ winsA: 3, winsB: 1, playoffWinsA: 1, championshipWinsA: 1, championshipMeetings: 1 });
    expect(rivalry?.meetings).toHaveLength(4);
  });

  it("uses the centralized deterministic GOAT weights", () => {
    const rankings = calculateGoatRankings(snapshot);
    expect(rankings.map((row) => row.managerId)).toEqual(["a", "b"]);
    expect(rankings[0]?.score).toBeGreaterThan(rankings[1]?.score ?? 0);
  });

  it("does not treat provisional standings as a completed-season finish", () => {
    const activeSnapshot = structuredClone(snapshot);
    activeSnapshot.seasons.unshift({
      ...activeSnapshot.seasons[0]!, id: "s26", providerLeagueId: "l26", season: 2026, status: "in_season",
    });
    activeSnapshot.franchises.unshift({
      ...activeSnapshot.franchises[0]!, id: "a26", leagueSeasonId: "s26", finalRank: null,
      regularSeasonRank: 1, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, playoffFinish: "",
    });
    expect(calculateManagerCareer(activeSnapshot, "a")).toMatchObject({
      seasonsPlayed: 3,
      regularSeasonTitles: 2,
      averageFinish: 1.5,
    });
  });

  it("maps renamed franchises to one provider user identity across a Sleeper season chain", () => {
    const history: SleeperHistoryBundle = {
      requestedLeagueId: "league-2025",
      state: { week: 18 },
      fetchedAt: "2026-08-17T00:00:00.000Z",
      seasons: [
        sleeperSeason(2025, "league-2025", "league-2024", "New Name"),
        sleeperSeason(2024, "league-2024", null, "Old Name"),
      ],
    };
    const payload = mapSleeperHistory(history);
    expect(payload.seasons).toHaveLength(2);
    expect(payload.seasons.map((season) => season.franchises[0]?.manager?.providerUserId)).toEqual(["stable-user", "stable-user"]);
    expect(payload.seasons.map((season) => season.franchises[0]?.teamName)).toEqual(["New Name", "Old Name"]);
    expect(payload.seasons.every((season) => season.matchups.length === 1)).toBe(true);
  });

  it("keeps the G.O.A.T. League auction identity when Sleeper labels a draft as snake", () => {
    const season = sleeperSeason(2026, "1385319428408774656", null, "Auction Team");
    season.drafts = [{
      draft: {
        draft_id: "provider-draft",
        league_id: season.league.league_id,
        type: "snake",
        status: "complete",
        settings: { rounds: 12, pick_timer: 10, cpu_autopick: 1 },
      },
      picks: [{
        draft_id: "provider-draft",
        player_id: "player-1",
        roster_id: 1,
        round: 1,
        draft_slot: 1,
        pick_no: 1,
      }],
      tradedPicks: [],
    }];
    const payload = mapSleeperHistory({
      requestedLeagueId: season.league.league_id,
      state: { week: 1 },
      fetchedAt: "2026-08-18T00:00:00.000Z",
      seasons: [season],
    });

    expect(payload.league.format).toBe("2-team auction");
    expect(payload.seasons[0]?.drafts[0]?.draftType).toBe("auction");
    expect(payload.seasons[0]?.drafts[0]?.raw.type).toBe("snake");
  });

  it("excludes the known G.O.A.T. League CPU mock draft from imported history", () => {
    const season = sleeperSeason(2026, "1385319428408774656", null, "Auction Team");
    season.drafts = [{
      draft: {
        draft_id: "1385319428417142784",
        league_id: season.league.league_id,
        type: "snake",
        status: "complete",
        settings: { rounds: 12, pick_timer: 10, cpu_autopick: 1 },
      },
      picks: [{
        draft_id: "1385319428417142784",
        player_id: "player-1",
        roster_id: 1,
        round: 1,
        draft_slot: 1,
        pick_no: 1,
      }],
      tradedPicks: [],
    }];

    const payload = mapSleeperHistory({
      requestedLeagueId: season.league.league_id,
      state: { week: 1 },
      fetchedAt: "2026-08-18T00:00:00.000Z",
      seasons: [season],
    });

    expect(payload.seasons[0]?.drafts).toEqual([]);
  });

  it("never promotes the consolation-bracket winner to league champion", () => {
    const season = sleeperSeason(2025, "league-2025", null, "New Name");
    season.winnersBracket = [];
    season.losersBracket = [{ r: 3, m: 6, t1: 1, t2: 2, w: 1, l: 2, p: 1 }];
    const payload = mapSleeperHistory({
      requestedLeagueId: "league-2025",
      state: { week: 18 },
      fetchedAt: "2026-08-17T00:00:00.000Z",
      seasons: [season],
    });
    expect(payload.seasons[0]?.franchises[0]).toMatchObject({ finalRank: null, playoffFinish: "" });
    expect(payload.seasons[0]?.franchises[1]).toMatchObject({ finalRank: null, playoffFinish: "" });
  });
});
