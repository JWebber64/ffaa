export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type FantasyProvider = "sleeper" | (string & {});

export interface FantasyLeague {
  id: string;
  provider: FantasyProvider;
  currentExternalLeagueId: string;
  name: string;
  sport: string;
  format: string;
  settings: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  provider: FantasyProvider;
  providerLeagueId: string;
  previousProviderLeagueId: string | null;
  season: number;
  status: string;
  totalRosters: number;
  scoringSettings: Record<string, JsonValue>;
  settings: Record<string, JsonValue>;
  rosterPositions: string[];
  playoffWeekStart: number | null;
  providerDraftId: string | null;
  importedAt: string;
}

export interface Manager {
  id: string;
  provider: FantasyProvider;
  providerUserId: string;
  currentUsername: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonFranchise {
  id: string;
  leagueSeasonId: string;
  managerId: string | null;
  providerRosterId: number;
  historicalUsername: string;
  teamName: string;
  avatarUrl: string;
  finalRank: number | null;
  regularSeasonRank: number | null;
  playoffSeed: number | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffFinish: string;
}

export interface HistoricalMatchup {
  id: string;
  leagueSeasonId: string;
  week: number;
  providerMatchupId: string;
  franchiseAId: string;
  franchiseBId: string;
  scoreA: number;
  scoreB: number;
  isPlayoff: boolean;
  playoffRound: number | null;
  isChampionship: boolean;
  winnerFranchiseId: string | null;
  margin: number;
  isComplete: boolean;
  importedAt: string;
}

export interface WeeklyRosterResult {
  id: string;
  leagueSeasonId: string;
  franchiseId: string;
  week: number;
  score: number;
  starterScore: number | null;
  benchScore: number | null;
  optimalScore: number | null;
  lineupEfficiency: number | null;
  pointsLeftOnBench: number | null;
}

export interface WeeklyPlayerResult {
  id: string;
  weeklyRosterResultId: string;
  providerPlayerId: string;
  playerName: string;
  position: string;
  isStarter: boolean;
  fantasyPoints: number | null;
}

export interface PlayoffMatch {
  id: string;
  leagueSeasonId: string;
  bracketType: "winners" | "losers";
  providerMatchId: string;
  round: number;
  placement: number | null;
  franchiseAId: string | null;
  franchiseBId: string | null;
  winnerFranchiseId: string | null;
  loserFranchiseId: string | null;
}

export interface HistoricalDraft {
  id: string;
  leagueSeasonId: string;
  providerDraftId: string;
  draftType: string;
  status: string;
  budget: number | null;
  rounds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  settings: Record<string, JsonValue>;
}

export interface HistoricalDraftPick {
  id: string;
  draftId: string;
  franchiseId: string | null;
  providerPickId: string;
  providerPlayerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  pickNumber: number | null;
  round: number | null;
  draftSlot: number | null;
  auctionPrice: number | null;
  isKeeper: boolean;
  metadata: Record<string, JsonValue>;
}

export interface HistoricalTransaction {
  id: string;
  leagueSeasonId: string;
  providerTransactionId: string;
  transactionType: string;
  status: string;
  week: number | null;
  creatorProviderUserId: string;
  faabBid: number | null;
  occurredAt: string | null;
  metadata: Record<string, JsonValue>;
}

export type TransactionAssetType = "player" | "faab" | "draft_pick";

export interface HistoricalTransactionAsset {
  id: string;
  transactionId: string;
  providerAssetKey: string;
  assetType: TransactionAssetType;
  providerPlayerId: string;
  playerName: string;
  fromFranchiseId: string | null;
  toFranchiseId: string | null;
  faabAmount: number | null;
  draftSeason: number | null;
  draftRound: number | null;
  metadata: Record<string, JsonValue>;
}

export interface LeagueHistorySnapshot {
  league: FantasyLeague;
  seasons: LeagueSeason[];
  managers: Manager[];
  franchises: SeasonFranchise[];
  matchups: HistoricalMatchup[];
  weeklyResults: WeeklyRosterResult[];
  weeklyPlayerResults: WeeklyPlayerResult[];
  playoffMatches: PlayoffMatch[];
  drafts: HistoricalDraft[];
  draftPicks: HistoricalDraftPick[];
  transactions: HistoricalTransaction[];
  transactionAssets: HistoricalTransactionAsset[];
}

export interface ManagerCareerStats {
  manager: Manager;
  franchises: SeasonFranchise[];
  seasonsPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  championships: number;
  championshipAppearances: number;
  playoffAppearances: number;
  playoffWins: number;
  playoffLosses: number;
  playoffWinPercentage: number;
  regularSeasonTitles: number;
  averageFinish: number | null;
  medianFinish: number | null;
  bestFinish: number | null;
  worstFinish: number | null;
  highestScoringSeason: SeasonFranchise | null;
  bestSeason: SeasonFranchise | null;
  longestWinningStreak: number;
  longestLosingStreak: number;
  highestWeeklyScore: number | null;
  lowestWeeklyScore: number | null;
  winningSeasons: number;
  losingSeasons: number;
}

export interface RivalryMeeting {
  matchup: HistoricalMatchup;
  season: number;
  managerAFranchise: SeasonFranchise;
  managerBFranchise: SeasonFranchise;
  managerAScore: number;
  managerBScore: number;
  winnerManagerId: string | null;
}

export interface HeadToHeadStats {
  managerA: Manager;
  managerB: Manager;
  meetings: RivalryMeeting[];
  winsA: number;
  winsB: number;
  ties: number;
  regularSeasonWinsA: number;
  regularSeasonWinsB: number;
  playoffWinsA: number;
  playoffWinsB: number;
  championshipWinsA: number;
  championshipWinsB: number;
  totalPointsA: number;
  totalPointsB: number;
  averagePointsA: number;
  averagePointsB: number;
  pointDifferential: number;
  averageMargin: number;
  biggestVictory: RivalryMeeting | null;
  closestGame: RivalryMeeting | null;
  highestScoringGame: RivalryMeeting | null;
  lowestScoringGame: RivalryMeeting | null;
  currentStreak: { managerId: string | null; games: number };
  longestStreakA: number;
  longestStreakB: number;
  playoffMeetings: number;
  championshipMeetings: number;
  seasonSweepsA: number;
  seasonSweepsB: number;
  bestScoreA: number | null;
  bestScoreB: number | null;
  worstScoreA: number | null;
  worstScoreB: number | null;
}
