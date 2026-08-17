import type {
  FantasyLeague,
  HistoricalDraft,
  HistoricalDraftPick,
  HistoricalMatchup,
  HistoricalTransaction,
  HistoricalTransactionAsset,
  JsonValue,
  LeagueHistorySnapshot,
  LeagueSeason,
  Manager,
  PlayoffMatch,
  SeasonFranchise,
} from "../domain/types";

type DatabaseRow = Record<string, unknown>;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || "";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REST_PAGE_SIZE = 1_000;
const IN_FILTER_CHUNK_SIZE = 100;
const requestCache = new Map<string, Promise<LeagueHistorySnapshot>>();

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function nullableNumber(value: unknown) {
  return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
}

function booleanValue(value: unknown) {
  return value === true || value === "true";
}

function objectValue(value: unknown): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inFilter(ids: string[]) {
  return `in.(${ids.join(",")})`;
}

async function selectRows(table: string, query: URLSearchParams) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("League history storage is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  const rows: DatabaseRow[] = [];
  for (let offset = 0; ; offset += REST_PAGE_SIZE) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json",
        "Accept-Profile": "app",
        "Range-Unit": "items",
        Range: `${offset}-${offset + REST_PAGE_SIZE - 1}`,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`League history query failed for ${table} (${response.status}): ${detail.slice(0, 220)}`);
    }
    const page = await response.json() as DatabaseRow[];
    rows.push(...page);
    if (page.length < REST_PAGE_SIZE) break;
  }
  return rows;
}

async function selectRelatedRows(table: string, column: string, ids: string[]) {
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += IN_FILTER_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + IN_FILTER_CHUNK_SIZE));
  }
  const pages = await Promise.all(chunks.map((chunk) => {
    const params = query();
    params.set(column, inFilter(chunk));
    return selectRows(table, params);
  }));
  return pages.flat();
}

function query(select = "*") {
  return new URLSearchParams({ select });
}

async function resolveLeague(routeId: string) {
  const leagueQuery = query();
  leagueQuery.set(UUID_PATTERN.test(routeId) ? "id" : "current_external_league_id", `eq.${routeId}`);
  leagueQuery.set("limit", "1");
  const direct = await selectRows("fantasy_leagues", leagueQuery);
  if (direct[0]) return direct[0];
  const seasonQuery = query("league_id");
  seasonQuery.set("provider_league_id", `eq.${routeId}`);
  seasonQuery.set("limit", "1");
  const season = await selectRows("fantasy_league_seasons", seasonQuery);
  const leagueId = stringValue(season[0]?.league_id);
  if (!leagueId) return null;
  const bySeasonQuery = query();
  bySeasonQuery.set("id", `eq.${leagueId}`);
  bySeasonQuery.set("limit", "1");
  return (await selectRows("fantasy_leagues", bySeasonQuery))[0] ?? null;
}

function mapLeague(row: DatabaseRow): FantasyLeague {
  return {
    id: stringValue(row.id),
    provider: stringValue(row.provider),
    currentExternalLeagueId: stringValue(row.current_external_league_id),
    name: stringValue(row.name),
    sport: stringValue(row.sport),
    format: stringValue(row.format),
    settings: objectValue(row.settings),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapSeason(row: DatabaseRow): LeagueSeason {
  return {
    id: stringValue(row.id),
    leagueId: stringValue(row.league_id),
    provider: stringValue(row.provider),
    providerLeagueId: stringValue(row.provider_league_id),
    previousProviderLeagueId: nullableString(row.previous_provider_league_id),
    season: numberValue(row.season),
    status: stringValue(row.status),
    totalRosters: numberValue(row.total_rosters),
    scoringSettings: objectValue(row.scoring_settings),
    settings: objectValue(row.settings),
    rosterPositions: stringArray(row.roster_positions),
    playoffWeekStart: nullableNumber(row.playoff_week_start),
    providerDraftId: nullableString(row.provider_draft_id),
    importedAt: stringValue(row.imported_at),
  };
}

function mapManager(row: DatabaseRow): Manager {
  return {
    id: stringValue(row.id),
    provider: stringValue(row.provider),
    providerUserId: stringValue(row.provider_user_id),
    currentUsername: stringValue(row.current_username),
    displayName: stringValue(row.display_name),
    avatarUrl: stringValue(row.avatar_url),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapFranchise(row: DatabaseRow): SeasonFranchise {
  return {
    id: stringValue(row.id),
    leagueSeasonId: stringValue(row.league_season_id),
    managerId: nullableString(row.manager_id),
    providerRosterId: numberValue(row.provider_roster_id),
    historicalUsername: stringValue(row.historical_username),
    teamName: stringValue(row.team_name),
    avatarUrl: stringValue(row.avatar_url),
    finalRank: nullableNumber(row.final_rank),
    regularSeasonRank: nullableNumber(row.regular_season_rank),
    playoffSeed: nullableNumber(row.playoff_seed),
    wins: numberValue(row.wins),
    losses: numberValue(row.losses),
    ties: numberValue(row.ties),
    pointsFor: numberValue(row.points_for),
    pointsAgainst: numberValue(row.points_against),
    playoffFinish: stringValue(row.playoff_finish),
  };
}

function mapMatchup(row: DatabaseRow): HistoricalMatchup {
  return {
    id: stringValue(row.id),
    leagueSeasonId: stringValue(row.league_season_id),
    week: numberValue(row.week),
    providerMatchupId: stringValue(row.provider_matchup_id),
    franchiseAId: stringValue(row.franchise_a_id),
    franchiseBId: stringValue(row.franchise_b_id),
    scoreA: numberValue(row.score_a),
    scoreB: numberValue(row.score_b),
    isPlayoff: booleanValue(row.is_playoff),
    playoffRound: nullableNumber(row.playoff_round),
    isChampionship: booleanValue(row.is_championship),
    winnerFranchiseId: nullableString(row.winner_franchise_id),
    margin: numberValue(row.margin),
    isComplete: booleanValue(row.is_complete),
    importedAt: stringValue(row.imported_at),
  };
}

function mapPlayoff(row: DatabaseRow): PlayoffMatch {
  return {
    id: stringValue(row.id),
    leagueSeasonId: stringValue(row.league_season_id),
    bracketType: stringValue(row.bracket_type) === "losers" ? "losers" : "winners",
    providerMatchId: stringValue(row.provider_match_id),
    round: numberValue(row.round),
    placement: nullableNumber(row.placement),
    franchiseAId: nullableString(row.franchise_a_id),
    franchiseBId: nullableString(row.franchise_b_id),
    winnerFranchiseId: nullableString(row.winner_franchise_id),
    loserFranchiseId: nullableString(row.loser_franchise_id),
  };
}

function mapDraft(row: DatabaseRow): HistoricalDraft {
  return {
    id: stringValue(row.id),
    leagueSeasonId: stringValue(row.league_season_id),
    providerDraftId: stringValue(row.provider_draft_id),
    draftType: stringValue(row.draft_type),
    status: stringValue(row.status),
    budget: nullableNumber(row.budget),
    rounds: nullableNumber(row.rounds),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    settings: objectValue(row.settings),
  };
}

function mapDraftPick(row: DatabaseRow): HistoricalDraftPick {
  return {
    id: stringValue(row.id),
    draftId: stringValue(row.draft_id),
    franchiseId: nullableString(row.franchise_id),
    providerPickId: stringValue(row.provider_pick_id),
    providerPlayerId: stringValue(row.provider_player_id),
    playerName: stringValue(row.player_name),
    position: stringValue(row.position),
    nflTeam: stringValue(row.nfl_team),
    pickNumber: numberValue(row.pick_number),
    round: numberValue(row.round),
    draftSlot: numberValue(row.draft_slot),
    auctionPrice: nullableNumber(row.auction_price),
    isKeeper: booleanValue(row.is_keeper),
  };
}

function mapTransaction(row: DatabaseRow): HistoricalTransaction {
  return {
    id: stringValue(row.id),
    leagueSeasonId: stringValue(row.league_season_id),
    providerTransactionId: stringValue(row.provider_transaction_id),
    transactionType: stringValue(row.transaction_type),
    status: stringValue(row.status),
    week: nullableNumber(row.week),
    creatorProviderUserId: stringValue(row.creator_provider_user_id),
    faabBid: nullableNumber(row.faab_bid),
    occurredAt: nullableString(row.occurred_at),
    metadata: objectValue(row.metadata),
  };
}

function mapTransactionAsset(row: DatabaseRow): HistoricalTransactionAsset {
  const assetType = stringValue(row.asset_type);
  return {
    id: stringValue(row.id),
    transactionId: stringValue(row.transaction_id),
    providerAssetKey: stringValue(row.provider_asset_key),
    assetType: assetType === "faab" || assetType === "draft_pick" ? assetType : "player",
    providerPlayerId: stringValue(row.provider_player_id),
    playerName: stringValue(row.player_name),
    fromFranchiseId: nullableString(row.from_franchise_id),
    toFranchiseId: nullableString(row.to_franchise_id),
    faabAmount: nullableNumber(row.faab_amount),
    draftSeason: nullableNumber(row.draft_season),
    draftRound: nullableNumber(row.draft_round),
    metadata: objectValue(row.metadata),
  };
}

async function loadSnapshot(routeId: string): Promise<LeagueHistorySnapshot> {
  const leagueRow = await resolveLeague(routeId);
  if (!leagueRow) throw new Error("This Sleeper league has not been imported into permanent history yet.");
  const league = mapLeague(leagueRow);
  const seasonsQuery = query();
  seasonsQuery.set("league_id", `eq.${league.id}`);
  seasonsQuery.set("order", "season.desc");
  const seasonRows = await selectRows("fantasy_league_seasons", seasonsQuery);
  const seasons = seasonRows.map(mapSeason);
  const seasonIds = seasons.map((season) => season.id);
  if (!seasonIds.length) return {
    league, seasons, managers: [], franchises: [], matchups: [], weeklyResults: [], weeklyPlayerResults: [],
    playoffMatches: [], drafts: [], draftPicks: [], transactions: [], transactionAssets: [],
  };
  const seasonFilter = inFilter(seasonIds);
  const tableQuery = () => {
    const params = query();
    params.set("league_season_id", seasonFilter);
    return params;
  };
  const transactionQuery = tableQuery();
  transactionQuery.set("status", "eq.complete");
  const [franchiseRows, matchupRows, playoffRows, draftRows, transactionRows] = await Promise.all([
    selectRows("fantasy_season_franchises", tableQuery()),
    selectRows("fantasy_matchups", tableQuery()),
    selectRows("fantasy_playoff_matches", tableQuery()),
    selectRows("fantasy_drafts", tableQuery()),
    selectRows("fantasy_transactions", transactionQuery),
  ]);
  const franchises = franchiseRows.map(mapFranchise);
  const drafts = draftRows.map(mapDraft);
  const transactions = transactionRows.map(mapTransaction);
  const managerIds = [...new Set(franchises.flatMap((franchise) => franchise.managerId ? [franchise.managerId] : []))];
  const draftIds = drafts.map((row) => row.id);
  const transactionIds = transactions.map((row) => row.id);
  const [managerRows, draftPickRows, transactionAssetRows] = await Promise.all([
    selectRelatedRows("fantasy_managers", "id", managerIds),
    selectRelatedRows("fantasy_draft_picks", "draft_id", draftIds),
    selectRelatedRows("fantasy_transaction_assets", "transaction_id", transactionIds),
  ]);
  return {
    league,
    seasons,
    managers: managerRows.map(mapManager),
    franchises,
    matchups: matchupRows.map(mapMatchup),
    // Lineup-level detail remains normalized in Supabase and can be queried by a
    // future lineup screen without inflating every history route's first load.
    weeklyResults: [],
    weeklyPlayerResults: [],
    playoffMatches: playoffRows.map(mapPlayoff),
    drafts,
    draftPicks: draftPickRows.map(mapDraftPick),
    transactions,
    transactionAssets: transactionAssetRows.map(mapTransactionAsset),
  };
}

export function loadLeagueHistory(routeId: string, options: { refresh?: boolean } = {}) {
  const key = routeId.trim();
  if (options.refresh) requestCache.delete(key);
  const cached = requestCache.get(key);
  if (cached) return cached;
  const pending = loadSnapshot(key).catch((error) => {
    requestCache.delete(key);
    throw error;
  });
  requestCache.set(key, pending);
  return pending;
}

export function leagueHistoryStorageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
