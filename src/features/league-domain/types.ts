export type LeagueStatus = "draft" | "active" | "paused" | "archived";
export type LeagueMigrationState =
  | "mapped_read_only"
  | "migration_preview"
  | "legacy_backed_native"
  | "canonical_active"
  | "migration_failed";

export type LeagueAuthorityMode = "native" | "connected_read_only" | "migration_preview" | "mirror";

export type League = {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  timezone: string;
  status: LeagueStatus;
  currentSeasonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  authorityMode: LeagueAuthorityMode;
  migrationState: LeagueMigrationState;
};

export type SeasonPhase = "setup" | "draft" | "regular_season" | "playoffs" | "complete" | "archived";

export type Season = {
  id: string;
  leagueId: string;
  year: number;
  phase: SeasonPhase;
  revision: number;
  settingsVersionId: string;
  draftSettingsVersionId: string;
  draftId: string | null;
  scheduleVersionId: string | null;
  startAt: string | null;
  endAt: string | null;
  legacySourceLeagueId: string | null;
};

export type Franchise = {
  id: string;
  leagueId: string;
  createdAt: string;
  retiredAt: string | null;
  legacyFranchiseId: string | null;
};

export type SeasonTeam = {
  id: string;
  leagueId: string;
  seasonId: string;
  franchiseId: string;
  name: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  divisionId: string | null;
  draftPosition: number | null;
  budget: { initial: number; remaining: number; currency: string } | null;
  cap: { limit: number; committed: number; dead: number } | null;
  rosterRevision: number;
  rosterPlayerIds: string[];
  status: "active" | "retired";
};

export type LeagueMembershipStatus = "invited" | "requested" | "active" | "suspended" | "removed";

export type LeagueMembership = {
  leagueId: string;
  userId: string;
  status: LeagueMembershipStatus;
  joinedAt: string | null;
  revision: number;
  roleGrantIds: string[];
  displayName: string;
  email: string;
};

export type LeagueRole =
  | "commissioner"
  | "co_commissioner"
  | "team_owner"
  | "co_manager"
  | "moderator"
  | "scheduler"
  | "treasurer"
  | "historian"
  | "read_only_guest";

export type RoleGrant = {
  id: string;
  leagueId: string;
  userId: string;
  role: LeagueRole;
  franchiseId: string | null;
  permissions: string[];
  effectiveAt: string;
  expiresAt: string | null;
  grantedBy: string;
  revokedAt: string | null;
  revision: number;
};

export type LeagueInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type LeagueInvitationRole = "team_owner" | "co_manager" | "co_commissioner";

export type LeagueInvitation = {
  id: string;
  leagueId: string;
  seasonId: string;
  email: string;
  displayName: string;
  role: LeagueInvitationRole;
  franchiseId: string | null;
  status: LeagueInvitationStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  revision: number;
};

export type ExternalProvider = "sleeper" | "yahoo" | "espn" | "cbs";
export type ExternalConnectionMode = "read_only" | "mirror" | "migration_preview";

export type ExternalConnection = {
  id: string;
  leagueId: string;
  provider: ExternalProvider;
  externalLeagueId: string;
  mode: ExternalConnectionMode;
  permissions: string[];
  lastSyncAt: string | null;
  syncStatus: "never" | "syncing" | "ready" | "stale" | "error";
  importMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type SettingsVersion = {
  id: string;
  leagueId: string;
  seasonId: string;
  revision: number;
  status: "draft" | "published" | "superseded";
  effectiveAt: string;
  settings: Record<string, unknown>;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  leagueId: string;
  seasonId: string;
  actorUserId: string;
  action: string;
  target: { type: string; id: string };
  timestamp: string;
  previousRevision: number;
  resultingRevision: number;
  before: unknown;
  after: unknown;
  materialDifferences: unknown;
  reason: string | null;
  settingsVersionId: string;
  commandId: string;
  transactionId: string | null;
  publicSummary: string;
  privateMetadata: Record<string, unknown> | null;
  reversalOfAuditEventId: string | null;
};

export type RosterTransactionAsset = {
  type: "player" | "draft_pick" | "faab" | "contract" | "keeper_right";
  id: string;
  amount: number | null;
  metadata: Record<string, unknown>;
};

export type RosterTransactionParty = {
  franchiseId: string;
  assets: RosterTransactionAsset[];
};

export type RosterTransaction = {
  id: string;
  leagueId: string;
  seasonId: string;
  transactionType: string;
  assetsLeaving: RosterTransactionParty[];
  assetsEntering: RosterTransactionParty[];
  effectiveAt: string;
  sourceCommandId: string;
  settingsVersionId: string;
  actorUserId: string;
  approvalState: "accepted" | "pending" | "rejected" | "reversed";
  reviewState: string;
  beforeRosterRevisions: Record<string, number>;
  afterRosterRevisions: Record<string, number>;
  auditEventId: string;
  reversalOfTransactionId: string | null;
  reversedByTransactionId: string | null;
};

export type NativeDraftStatus = "lobby" | "live" | "paused" | "complete";

export type NativeDraftSelection = {
  id: string;
  playerId: string;
  franchiseId: string;
  overallPick: number;
  round: number;
  price: number;
  rosterTransactionId: string;
  selectedAt: string;
  source: "pick" | "autopick" | "auction";
};

export type NativeDraftTeamState = {
  franchiseId: string;
  budget: number;
  spent: number;
  picks: number;
};

export type NativeDraft = {
  id: string;
  leagueId: string;
  seasonId: string;
  settingsVersionId: string;
  format: "auction" | "snake" | "linear" | "third_round_reversal";
  mode: "live" | "slow";
  status: NativeDraftStatus;
  revision: number;
  seasonRevision: number;
  orderFranchiseIds: string[];
  rosterSize: number;
  pickSeconds: number;
  nominationSeconds: number;
  bidSeconds: number;
  antiSnipeSeconds: number;
  minimumBid: number;
  auctionBudget: number;
  spectatorEnabled: boolean;
  spectatorCode: string;
  teamStates: NativeDraftTeamState[];
  selections: NativeDraftSelection[];
  queues: Record<string, string[]>;
  overallPick: number;
  currentFranchiseId: string | null;
  currentDeadlineAt: string | null;
  auctionState: {
    playerId: string;
    nominatedByFranchiseId: string;
    highBidderFranchiseId: string;
    currentBid: number;
    startedAt: string;
    endsAt: string;
  } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type NativeLineupWeekPlayer = {
  playerId: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  nflTeam: string;
  gameId: string;
  originalScheduledStartAt: string;
  scheduledStartAt: string;
  actualStartedAt: string;
  gameStatus: "scheduled" | "in_progress" | "postponed" | "canceled" | "final";
  availability: "active" | "questionable" | "doubtful" | "inactive" | "out" | "ir";
  projectedPoints: number;
};

export type NativeLineupWeek = {
  id: string;
  leagueId: string;
  seasonId: string;
  week: number;
  settingsVersionId: string;
  timezone: string;
  revision: number;
  players: NativeLineupWeekPlayer[];
  lockOverrides: Record<string, { reopenedUntil: string; reason: string; actorUserId: string }>;
  updatedAt: string;
};

export type NativeWeeklyLineup = {
  id: string;
  leagueId: string;
  seasonId: string;
  franchiseId: string;
  week: number;
  settingsVersionId: string;
  seasonRevision: number;
  rosterRevision: number;
  lineupWeekRevision: number;
  assignments: Record<string, string>;
  orderedFallbackPlayerIds: string[];
  selectionMode: "manual" | "best_ball";
  automaticSubstitutions: Array<{ slot: string; from: string; to: string }>;
  revision: number;
  updatedAt: string;
};

export type NativeScoringLineupTotal = {
  franchiseId: string;
  assignments: Record<string, string>;
  currentScore: number;
  projectedFinal: number;
  pointsRemaining: number;
  playersRemaining: number;
  benchPoints: number;
  optimalScore: number;
  optimalDelta: number;
};

export type NativeScoringMatchup = {
  matchupId: string;
  homeFranchiseId: string;
  awayFranchiseId: string;
  homeScore: number;
  awayScore: number;
  homeProjectedFinal: number;
  awayProjectedFinal: number;
  homeWinProbability: number;
  awayWinProbability: number;
  playersRemaining: number;
  pointsRemaining: number;
};

export type NativeScoringFeedEvent = {
  eventKey: string;
  providerEventId: string;
  occurredAt: string;
  playerId: string;
  nflGameId: string;
  description: string;
  fantasyPointDelta: number;
  resultingPlayerTotal: number;
  scoringRuleIds: string[];
  explanations: string[];
  corrected: boolean;
};

export type NativeScoringWeek = {
  id: string;
  leagueId: string;
  seasonId: string;
  week: number;
  settingsVersionId: string;
  scoringRuleVersionId: string;
  lineupWeekRevision: number;
  revision: number;
  ingestionVersion: string;
  providerKey: string;
  fallbackProviderKey: string;
  providerState: "live" | "delayed" | "unavailable";
  freshness: { state: "live" | "delayed" | "stale"; ageSeconds: number | null; message: string };
  lastProviderTimestamp: string;
  eventCount: number;
  duplicateEventCount: number;
  correctionCount: number;
  statCorrectionState: "none" | "corrected";
  playerTotals: Record<string, number>;
  lineupTotals: NativeScoringLineupTotal[];
  matchups: NativeScoringMatchup[];
  standingsProjection: Array<{ franchiseId: string; projectedOutcome: "win" | "loss" | "tie" }>;
  gameStatuses: Record<string, string>;
  activeNflGameIds: string[];
  scoringFeed: NativeScoringFeedEvent[];
  leadChanges: Array<{ matchupId: string; eventKey: string; occurredAt: string; leaderFranchiseId: string; homeScore: number; awayScore: number }>;
  topActivePerformer: { playerId: string; points: number } | null;
  cachedLastKnownScore: boolean;
  updatedAt: string;
};

export type NativeWaiverPlayerState = {
  playerId: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  state: "free_agent" | "on_waivers" | "owned" | "locked" | "ineligible" | "protected" | "trade_block";
  ownerFranchiseId: string;
  droppedUntil: string;
  revision: number;
};

export type NativeWaiverTeamState = {
  franchiseId: string;
  faabRemaining: number;
  priority: number;
  standingsRank: number;
  priorityWeek: number;
  weeklyAcquisitions: Record<string, number>;
  revision: number;
};

export type NativeWaiverState = {
  revision: number;
  playerCount: number;
  settingsVersionId: string;
  nextProcessingAt: string;
  lastRunId: string;
  updatedAt: string;
};

export type NativeWaiverClaim = {
  id: string;
  franchiseId: string;
  week: number;
  status: "pending" | "pending_review" | "won" | "failed";
  processAt: string;
  alternatives: Array<{ addPlayerId: string; dropPlayerId: string; bid: number; order: number; submissionIssue: string }>;
  failures: string[];
  createdAt: string;
};

export type NativeWaiverReceipt = {
  id: string;
  runId: string;
  claimId: string;
  franchiseId: string;
  status: "won" | "failed";
  claimsEvaluated: number;
  winningBid: number | null;
  nextHighestBid: number | null;
  priorityBefore: number;
  priorityAfter: number;
  tiebreakerUsed: string;
  failures: string[];
  addPlayerId: string;
  dropPlayerId: string;
  remainingFaab: number;
  processedAt: string;
};

export type LeagueAuthorityLabel =
  | "Native GameHQ League — read/write"
  | "Connected Sleeper League — read-only"
  | "Migration Preview"
  | "Mirror Mode";

export type LeagueAuthority = {
  label: LeagueAuthorityLabel;
  mode: LeagueAuthorityMode;
  canRead: boolean;
  canManage: boolean;
  canSaveLineup: boolean;
  permissions: string[];
  roles: LeagueRole[];
  source: "gamehq" | "external";
};

export type CanonicalLeagueWorkspace = {
  league: League;
  season: Season | null;
  connection: ExternalConnection | null;
  membership: LeagueMembership | null;
  roleGrants: RoleGrant[];
  authority: LeagueAuthority;
};

export function isGamehqLeagueId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.trim());
}

export function createGamehqLeagueId() {
  return crypto.randomUUID();
}

export function externalLeagueMappingId(provider: ExternalProvider, externalLeagueId: string) {
  return `${provider}__${encodeURIComponent(externalLeagueId.trim()).replace(/%/gu, "_")}`;
}
