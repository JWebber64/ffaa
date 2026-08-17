import type { JsonValue } from "../domain/types";
import type {
  SleeperBracketMatch,
  SleeperHistoryBundle,
  SleeperMatchupRow,
  SleeperRoster,
  SleeperSeasonBundle,
  SleeperTransaction,
  SleeperUser,
} from "./sleeperTypes";

export interface PlayerReference {
  name: string;
  position: string;
  team: string;
}

export interface LeagueHistoryImportPayload {
  provider: "sleeper";
  requestedExternalLeagueId: string;
  importedAt: string;
  league: {
    currentExternalLeagueId: string;
    name: string;
    sport: string;
    format: string;
    settings: Record<string, JsonValue>;
  };
  seasons: SeasonImportPayload[];
}

export interface SeasonImportPayload {
  externalLeagueId: string;
  previousExternalLeagueId: string | null;
  season: number;
  status: string;
  totalRosters: number;
  settings: Record<string, JsonValue>;
  scoringSettings: Record<string, JsonValue>;
  rosterPositions: string[];
  playoffWeekStart: number | null;
  providerDraftId: string | null;
  raw: Record<string, JsonValue>;
  franchises: FranchiseImportPayload[];
  weeklyResults: WeeklyResultImportPayload[];
  matchups: MatchupImportPayload[];
  playoffMatches: PlayoffMatchImportPayload[];
  drafts: DraftImportPayload[];
  transactions: TransactionImportPayload[];
}

export interface FranchiseImportPayload {
  providerRosterId: number;
  manager: {
    providerUserId: string;
    currentUsername: string;
    displayName: string;
    avatarUrl: string;
  } | null;
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

export interface WeeklyResultImportPayload {
  week: number;
  providerRosterId: number;
  score: number;
  starterScore: number;
  players: Array<{
    providerPlayerId: string;
    playerName: string;
    position: string;
    isStarter: boolean;
    fantasyPoints: number | null;
  }>;
}

export interface MatchupImportPayload {
  week: number;
  providerMatchupId: string;
  rosterAId: number;
  rosterBId: number;
  scoreA: number;
  scoreB: number;
  isPlayoff: boolean;
  playoffRound: number | null;
  isChampionship: boolean;
  winnerRosterId: number | null;
  margin: number;
  isComplete: boolean;
}

export interface PlayoffMatchImportPayload {
  bracketType: "winners" | "losers";
  providerMatchId: string;
  round: number;
  placement: number | null;
  rosterAId: number | null;
  rosterBId: number | null;
  winnerRosterId: number | null;
  loserRosterId: number | null;
}

export interface DraftImportPayload {
  providerDraftId: string;
  draftType: string;
  status: string;
  budget: number | null;
  rounds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  settings: Record<string, JsonValue>;
  raw: Record<string, JsonValue>;
  picks: Array<{
    providerPickId: string;
    providerRosterId: number | null;
    providerPlayerId: string;
    playerName: string;
    position: string;
    nflTeam: string;
    pickNumber: number;
    round: number;
    draftSlot: number;
    auctionPrice: number | null;
    isKeeper: boolean;
    metadata: Record<string, JsonValue>;
  }>;
  tradedPicks: Array<{
    providerAssetKey: string;
    season: number;
    round: number;
    originalRosterId: number;
    previousOwnerRosterId: number;
    ownerRosterId: number;
  }>;
}

export interface TransactionImportPayload {
  providerTransactionId: string;
  transactionType: string;
  status: string;
  week: number | null;
  creatorProviderUserId: string;
  faabBid: number | null;
  occurredAt: string | null;
  metadata: Record<string, JsonValue>;
  raw: Record<string, JsonValue>;
  assets: Array<{
    providerAssetKey: string;
    assetType: "player" | "faab" | "draft_pick";
    providerPlayerId: string;
    playerName: string;
    fromRosterId: number | null;
    toRosterId: number | null;
    faabAmount: number | null;
    draftSeason: number | null;
    draftRound: number | null;
    metadata: Record<string, JsonValue>;
  }>;
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function nullableNumber(value: unknown) {
  return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function dateValue(value: unknown) {
  const timestamp = nullableNumber(value);
  return timestamp && timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function rosterPoints(settings: Record<string, JsonValue>, prefix: "fpts" | "fpts_against") {
  return numberValue(settings[prefix]) + numberValue(settings[`${prefix}_decimal`]) / 100;
}

function userForRoster(bundle: SleeperSeasonBundle, roster: SleeperRoster) {
  return bundle.users.find((user) => user.user_id === roster.owner_id) ?? null;
}

function teamName(user: SleeperUser | null, roster: SleeperRoster) {
  return stringValue(user?.metadata?.team_name).trim()
    || stringValue(roster.metadata?.team_name).trim()
    || user?.display_name?.trim()
    || `Roster ${roster.roster_id}`;
}

function avatarUrl(user: SleeperUser | null) {
  const custom = stringValue(user?.metadata?.avatar).trim();
  if (custom) return custom;
  return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : "";
}

function matchupScore(row: SleeperMatchupRow) {
  return row.custom_points == null ? numberValue(row.points) : numberValue(row.custom_points);
}

function rankedRosters(rosters: SleeperRoster[]) {
  return [...rosters].sort((left, right) =>
    numberValue(right.settings.wins) - numberValue(left.settings.wins)
    || numberValue(right.settings.ties) - numberValue(left.settings.ties)
    || rosterPoints(right.settings, "fpts") - rosterPoints(left.settings, "fpts"));
}

function playoffPlacements(bundle: SleeperSeasonBundle) {
  const rank = new Map<number, number>();
  const finish = new Map<number, string>();
  // Sleeper's losers bracket reuses placements starting at 1 for its own
  // consolation ladder. Only the winners bracket describes league finish.
  for (const match of bundle.winnersBracket) {
    if (!match.p || !match.w || !match.l) continue;
    rank.set(match.w, match.p);
    rank.set(match.l, match.p + 1);
    if (match.p === 1) {
      finish.set(match.w, "Champion");
      finish.set(match.l, "Runner-up");
    } else if (match.p === 3) {
      finish.set(match.w, "Third place");
      finish.set(match.l, "Fourth place");
    } else if (!finish.has(match.w)) {
      finish.set(match.w, `Finished ${match.p}`);
      finish.set(match.l, `Finished ${match.p + 1}`);
    }
  }
  return { rank, finish };
}

function mapBracketMatch(match: SleeperBracketMatch, bracketType: "winners" | "losers"): PlayoffMatchImportPayload {
  return {
    bracketType,
    providerMatchId: String(match.m),
    round: match.r,
    placement: match.p ?? null,
    rosterAId: match.t1 ?? match.w ?? null,
    rosterBId: match.t2 ?? match.l ?? null,
    winnerRosterId: match.w ?? null,
    loserRosterId: match.l ?? null,
  };
}

function playerReference(playerId: string, players: ReadonlyMap<string, PlayerReference>) {
  return players.get(playerId) ?? { name: playerId, position: "", team: "" };
}

function mapTransaction(
  transaction: SleeperTransaction,
  players: ReadonlyMap<string, PlayerReference>,
): TransactionImportPayload {
  const adds = transaction.adds ?? {};
  const drops = transaction.drops ?? {};
  const playerIds = new Set([...Object.keys(adds), ...Object.keys(drops)]);
  const assets: TransactionImportPayload["assets"] = [];
  for (const playerId of playerIds) {
    const player = playerReference(playerId, players);
    const fromRosterId = drops[playerId] ?? null;
    const toRosterId = adds[playerId] ?? null;
    assets.push({
      providerAssetKey: `player:${playerId}:${fromRosterId ?? "none"}:${toRosterId ?? "none"}`,
      assetType: "player",
      providerPlayerId: playerId,
      playerName: player.name,
      fromRosterId,
      toRosterId,
      faabAmount: null,
      draftSeason: null,
      draftRound: null,
      metadata: { position: player.position, team: player.team },
    });
  }
  for (const [index, transfer] of (transaction.waiver_budget ?? []).entries()) {
    assets.push({
      providerAssetKey: `faab:${index}:${transfer.sender}:${transfer.receiver}`,
      assetType: "faab",
      providerPlayerId: "",
      playerName: "FAAB",
      fromRosterId: transfer.sender,
      toRosterId: transfer.receiver,
      faabAmount: numberValue(transfer.amount),
      draftSeason: null,
      draftRound: null,
      metadata: {},
    });
  }
  for (const [index, pick] of (transaction.draft_picks ?? []).entries()) {
    assets.push({
      providerAssetKey: `pick:${pick.season}:${pick.round}:${pick.roster_id}:${index}`,
      assetType: "draft_pick",
      providerPlayerId: "",
      playerName: `${pick.season} round ${pick.round} pick`,
      fromRosterId: pick.previous_owner_id,
      toRosterId: pick.owner_id,
      faabAmount: null,
      draftSeason: numberValue(pick.season),
      draftRound: pick.round,
      metadata: { originalRosterId: pick.roster_id },
    });
  }
  return {
    providerTransactionId: transaction.transaction_id,
    transactionType: transaction.type,
    status: transaction.status,
    week: transaction.leg == null ? null : numberValue(transaction.leg),
    creatorProviderUserId: transaction.creator ?? "",
    faabBid: nullableNumber(transaction.settings?.waiver_bid),
    occurredAt: dateValue(transaction.status_updated ?? transaction.created),
    metadata: transaction.metadata ?? {},
    raw: transaction as unknown as Record<string, JsonValue>,
    assets,
  };
}

function mapSeason(bundle: SleeperSeasonBundle, players: ReadonlyMap<string, PlayerReference>): SeasonImportPayload {
  const league = bundle.league;
  const playoffStart = nullableNumber(league.settings.playoff_week_start);
  const regularRanks = new Map(rankedRosters(bundle.rosters).map((roster, index) => [roster.roster_id, index + 1]));
  const placements = playoffPlacements(bundle);
  const titlePair = bundle.winnersBracket.find((match) => match.p === 1 && match.w && match.l);
  const titleRosterIds = titlePair ? new Set([titlePair.w!, titlePair.l!]) : new Set<number>();
  const franchises = bundle.rosters.map((roster): FranchiseImportPayload => {
    const user = userForRoster(bundle, roster);
    return {
      providerRosterId: roster.roster_id,
      manager: user ? {
        providerUserId: user.user_id,
        currentUsername: user.username?.trim() ?? "",
        displayName: user.display_name?.trim() || user.username?.trim() || teamName(user, roster),
        avatarUrl: avatarUrl(user),
      } : null,
      historicalUsername: user?.username?.trim() ?? "",
      teamName: teamName(user, roster),
      avatarUrl: avatarUrl(user),
      finalRank: placements.rank.get(roster.roster_id) ?? null,
      regularSeasonRank: regularRanks.get(roster.roster_id) ?? null,
      playoffSeed: nullableNumber(roster.settings.rank),
      wins: numberValue(roster.settings.wins),
      losses: numberValue(roster.settings.losses),
      ties: numberValue(roster.settings.ties),
      pointsFor: rosterPoints(roster.settings, "fpts"),
      pointsAgainst: rosterPoints(roster.settings, "fpts_against"),
      playoffFinish: placements.finish.get(roster.roster_id) ?? "",
    };
  });
  const weeklyResults: WeeklyResultImportPayload[] = [];
  const matchups: MatchupImportPayload[] = [];
  for (const weekGroup of bundle.matchups) {
    const groups = new Map<number, SleeperMatchupRow[]>();
    for (const row of weekGroup.rows) {
      const score = matchupScore(row);
      const starters = new Set(row.starters ?? []);
      weeklyResults.push({
        week: weekGroup.week,
        providerRosterId: row.roster_id,
        score,
        starterScore: score,
        players: (row.players ?? []).map((playerId) => {
          const player = playerReference(playerId, players);
          return {
            providerPlayerId: playerId,
            playerName: player.name,
            position: player.position,
            isStarter: starters.has(playerId),
            fantasyPoints: row.players_points?.[playerId] ?? null,
          };
        }),
      });
      if (row.matchup_id != null) groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
    }
    for (const [matchupId, rows] of groups) {
      if (rows.length !== 2) continue;
      const left = rows[0]!;
      const right = rows[1]!;
      const scoreA = matchupScore(left);
      const scoreB = matchupScore(right);
      const isPlayoff = playoffStart != null && weekGroup.week >= playoffStart;
      const isComplete = league.status === "complete" || scoreA !== 0 || scoreB !== 0;
      const winnerRosterId = !isComplete || scoreA === scoreB ? null : scoreA > scoreB ? left.roster_id : right.roster_id;
      matchups.push({
        week: weekGroup.week,
        providerMatchupId: String(matchupId),
        rosterAId: left.roster_id,
        rosterBId: right.roster_id,
        scoreA,
        scoreB,
        isPlayoff,
        playoffRound: isPlayoff && playoffStart != null ? weekGroup.week - playoffStart + 1 : null,
        isChampionship: isPlayoff && titleRosterIds.has(left.roster_id) && titleRosterIds.has(right.roster_id),
        winnerRosterId,
        margin: Math.abs(scoreA - scoreB),
        isComplete,
      });
    }
  }
  const drafts = bundle.drafts.map(({ draft, picks, tradedPicks }): DraftImportPayload => ({
    providerDraftId: draft.draft_id,
    draftType: draft.type,
    status: draft.status,
    budget: nullableNumber(draft.settings?.budget),
    rounds: nullableNumber(draft.settings?.rounds),
    startedAt: dateValue(draft.start_time ?? draft.created),
    completedAt: dateValue(draft.last_picked),
    settings: draft.settings ?? {},
    raw: draft as unknown as Record<string, JsonValue>,
    picks: picks.map((pick) => {
      const playerId = pick.player_id ?? stringValue(pick.metadata?.player_id);
      const player = playerReference(playerId, players);
      const firstName = stringValue(pick.metadata?.first_name);
      const lastName = stringValue(pick.metadata?.last_name);
      return {
        providerPickId: String(pick.pick_no),
        providerRosterId: nullableNumber(pick.roster_id),
        providerPlayerId: playerId,
        playerName: `${firstName} ${lastName}`.trim() || player.name,
        position: stringValue(pick.metadata?.position) || player.position,
        nflTeam: stringValue(pick.metadata?.team) || player.team,
        pickNumber: pick.pick_no,
        round: pick.round,
        draftSlot: pick.draft_slot,
        auctionPrice: nullableNumber(pick.metadata?.amount ?? pick.metadata?.cost),
        isKeeper: Boolean(pick.is_keeper),
        metadata: pick.metadata ?? {},
      };
    }),
    tradedPicks: tradedPicks.map((pick, index) => ({
      providerAssetKey: `${pick.season}:${pick.round}:${pick.roster_id}:${index}`,
      season: numberValue(pick.season),
      round: pick.round,
      originalRosterId: pick.roster_id,
      previousOwnerRosterId: pick.previous_owner_id,
      ownerRosterId: pick.owner_id,
    })),
  }));
  return {
    externalLeagueId: league.league_id,
    previousExternalLeagueId: league.previous_league_id ?? null,
    season: numberValue(league.season),
    status: league.status,
    totalRosters: numberValue(league.total_rosters),
    settings: league.settings,
    scoringSettings: league.scoring_settings,
    rosterPositions: league.roster_positions,
    playoffWeekStart: playoffStart,
    providerDraftId: league.draft_id ?? null,
    raw: league as unknown as Record<string, JsonValue>,
    franchises,
    weeklyResults,
    matchups,
    playoffMatches: [
      ...bundle.winnersBracket.map((match) => mapBracketMatch(match, "winners")),
      ...bundle.losersBracket.map((match) => mapBracketMatch(match, "losers")),
    ],
    drafts,
    transactions: bundle.transactions.map((transaction) => mapTransaction(transaction, players)),
  };
}

export function mapSleeperHistory(
  bundle: SleeperHistoryBundle,
  players: ReadonlyMap<string, PlayerReference> = new Map(),
): LeagueHistoryImportPayload {
  const current = bundle.seasons[0]?.league;
  if (!current) throw new Error("Cannot map an empty Sleeper league history.");
  const currentDraft = bundle.seasons[0]?.drafts[0]?.draft;
  return {
    provider: "sleeper",
    requestedExternalLeagueId: bundle.requestedLeagueId,
    importedAt: bundle.fetchedAt,
    league: {
      currentExternalLeagueId: current.league_id,
      name: current.name,
      sport: current.sport || "nfl",
      format: `${current.total_rosters}-team ${currentDraft?.type ?? "fantasy"}`,
      settings: {
        avatar: current.avatar ?? null,
        seasonType: current.season_type ?? "regular",
      },
    },
    seasons: bundle.seasons.map((season) => mapSeason(season, players)),
  };
}
