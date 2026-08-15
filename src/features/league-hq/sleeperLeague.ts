import type {
  LeagueAward,
  LeagueFuture,
  LeagueHQData,
  LeagueManager,
  LeagueManagerSeasonRecord,
  LeagueRivalry,
  LeagueSeason,
  LeagueStanding,
  LeagueStoryline,
  LeagueWeekRecap,
} from "./leagueHQData";

export const DEFAULT_SLEEPER_LEAGUE_ID = "1385319428408774656";
const SLEEPER_API = "https://api.sleeper.app/v1";
const MAX_HISTORY_SEASONS = 10;

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  previous_league_id?: string | null;
  draft_id?: string | null;
  avatar?: string | null;
  settings: JsonRecord;
  scoring_settings: JsonRecord;
  roster_positions: string[];
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  username?: string;
  avatar?: string | null;
  is_owner?: boolean;
  metadata?: Record<string, string> | null;
}

interface SleeperRoster {
  roster_id: number;
  owner_id?: string | null;
  co_owners?: string[] | null;
  settings: JsonRecord;
}

interface SleeperBracketMatch {
  r: number;
  m: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  p?: number | null;
}

interface SleeperDraft {
  draft_id: string;
  type: string;
  status: string;
  start_time?: number | null;
  settings: JsonRecord;
  slot_to_roster_id?: Record<string, number> | null;
  draft_order?: Record<string, number> | null;
}

interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  custom_points?: number | null;
}

interface SleeperState {
  week?: number;
  display_week?: number;
  season?: string;
  league_season?: string;
}

interface SleeperSeasonBundle {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  winnersBracket: SleeperBracketMatch[];
  losersBracket: SleeperBracketMatch[];
  drafts: SleeperDraft[];
  matchups: Array<{ week: number; rows: SleeperMatchup[] }>;
}

interface ManagerAccumulator extends LeagueManager {
  latestSeason: number;
  seasonHistory: LeagueManagerSeasonRecord[];
}

interface HeadToHeadRecord {
  managerAId: string;
  managerBId: string;
  winsA: number;
  winsB: number;
  ties: number;
  seasons: Set<number>;
}

export interface SleeperLeagueImportResult {
  data: LeagueHQData;
  leagueId: string;
  leagueName: string;
  seasonsImported: number;
  managersImported: number;
}

export interface SleeperLeagueChoice {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  totalRosters: number;
  avatarUrl: string;
  sourceUrl: string;
}

export interface SleeperLeagueLookupResult {
  lookupType: "league" | "user";
  displayName: string;
  leagues: SleeperLeagueChoice[];
}

const numberValue = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const textValue = (value: unknown) => (typeof value === "string" ? value : "");

function rosterPoints(settings: JsonRecord, prefix: "fpts" | "fpts_against" | "ppts" = "fpts") {
  return numberValue(settings[prefix]) + numberValue(settings[`${prefix}_decimal`]) / 100;
}

function recordLabel(roster: SleeperRoster | undefined) {
  if (!roster) return "";
  const wins = numberValue(roster.settings.wins);
  const losses = numberValue(roster.settings.losses);
  const ties = numberValue(roster.settings.ties);
  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
}

function managerIdForRoster(leagueId: string, roster: SleeperRoster) {
  const userId = textValue(roster.owner_id) || roster.co_owners?.[0] || "";
  return userId ? `sleeper-user-${userId}` : `sleeper-roster-${leagueId}-${roster.roster_id}`;
}

function userForRoster(users: SleeperUser[], roster: SleeperRoster) {
  const ownerIds = [roster.owner_id, ...(roster.co_owners ?? [])].filter(Boolean);
  return users.find((user) => ownerIds.includes(user.user_id)) ?? null;
}

function avatarUrl(user: SleeperUser | null) {
  const custom = user?.metadata?.avatar;
  if (custom) return custom;
  return user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : "";
}

function teamName(user: SleeperUser | null, rosterId: number) {
  return user?.metadata?.team_name?.trim() || user?.display_name?.trim() || `Roster ${rosterId}`;
}

async function sleeperJson<T>(path: string, fetcher: Fetcher, signal?: AbortSignal): Promise<T> {
  const response = await fetcher(`${SLEEPER_API}${path}`, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Sleeper returned ${response.status} for ${path}.`);
  }
  return response.json() as Promise<T>;
}

function leagueChoice(league: SleeperLeague): SleeperLeagueChoice {
  return {
    leagueId: league.league_id,
    name: league.name || `League ${league.league_id}`,
    season: league.season,
    status: league.status,
    totalRosters: numberValue(league.total_rosters),
    avatarUrl: league.avatar ? `https://sleepercdn.com/avatars/thumbs/${league.avatar}` : "",
    sourceUrl: `https://sleeper.com/leagues/${league.league_id}`,
  };
}

export function normalizeSleeperLeagueLookup(value: string) {
  const trimmed = value.trim();
  const leagueIdFromUrl = trimmed.match(/(?:leagues?|leagueId)[^0-9]*(\d{10,})/i)?.[1];
  if (leagueIdFromUrl) return { kind: "league" as const, value: leagueIdFromUrl };
  if (/^\d{10,}$/.test(trimmed)) return { kind: "league" as const, value: trimmed };
  return { kind: "user" as const, value: trimmed.replace(/^@/, "") };
}

export async function findSleeperLeagues(
  lookup: string,
  season: number,
  options: { fetcher?: Fetcher; signal?: AbortSignal } = {},
): Promise<SleeperLeagueLookupResult> {
  const normalized = normalizeSleeperLeagueLookup(lookup);
  if (!normalized.value) {
    throw new Error("Enter a Sleeper username or paste a numeric league ID.");
  }
  if (!Number.isInteger(season) || season < 2017 || season > 2100) {
    throw new Error("Choose a valid Sleeper season.");
  }

  const fetcher = options.fetcher ?? fetch;
  if (normalized.kind === "league") {
    const league = await sleeperJson<SleeperLeague>(
      `/league/${normalized.value}`,
      fetcher,
      options.signal,
    );
    return {
      lookupType: "league",
      displayName: league.name || `League ${league.league_id}`,
      leagues: [leagueChoice(league)],
    };
  }

  let user: SleeperUser;
  try {
    user = await sleeperJson<SleeperUser>(
      `/user/${encodeURIComponent(normalized.value)}`,
      fetcher,
      options.signal,
    );
  } catch (error) {
    if (error instanceof Error && /returned 404/.test(error.message)) {
      throw new Error(`No Sleeper user was found for “${normalized.value}”.`);
    }
    throw error;
  }
  if (!user?.user_id) {
    throw new Error(`No Sleeper user was found for “${normalized.value}”.`);
  }

  const leagues = await sleeperJson<SleeperLeague[]>(
    `/user/${user.user_id}/leagues/nfl/${season}`,
    fetcher,
    options.signal,
  );
  return {
    lookupType: "user",
    displayName: user.display_name || user.username || normalized.value,
    leagues: leagues
      .map(leagueChoice)
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function maxMatchupWeek(league: SleeperLeague, state: SleeperState) {
  if (league.status === "pre_draft") {
    return Math.min(18, Math.max(0, numberValue(league.settings.playoff_week_start) - 1));
  }
  if (league.status === "complete") {
    return Math.min(18, Math.max(1, numberValue(league.settings.playoff_week_start) + 2));
  }
  return Math.min(18, Math.max(1, numberValue(state.display_week) || numberValue(state.week)));
}

async function loadSeasonBundle(
  league: SleeperLeague,
  state: SleeperState,
  fetcher: Fetcher,
  signal?: AbortSignal
): Promise<SleeperSeasonBundle> {
  const leagueId = league.league_id;
  const [users, rosters, winnersBracket, losersBracket, drafts] = await Promise.all([
    sleeperJson<SleeperUser[]>(`/league/${leagueId}/users`, fetcher, signal),
    sleeperJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, fetcher, signal),
    sleeperJson<SleeperBracketMatch[]>(`/league/${leagueId}/winners_bracket`, fetcher, signal),
    sleeperJson<SleeperBracketMatch[]>(`/league/${leagueId}/losers_bracket`, fetcher, signal),
    sleeperJson<SleeperDraft[]>(`/league/${leagueId}/drafts`, fetcher, signal),
  ]);
  const weekCount = maxMatchupWeek(league, state);
  const matchups = await Promise.all(
    Array.from({ length: weekCount }, (_, index) => index + 1).map(async (week) => ({
      week,
      rows: await sleeperJson<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`, fetcher, signal),
    }))
  );

  return { league, users, rosters, winnersBracket, losersBracket, drafts, matchups };
}

function scoringLabel(scoring: JsonRecord) {
  const reception = numberValue(scoring.rec);
  if (reception === 1) return "Full PPR";
  if (reception === 0.5) return "Half PPR";
  if (reception === 0) return "Standard";
  return `${reception} points per reception`;
}

function rosterSummary(positions: string[], reserveSlots: number) {
  const counts = new Map<string, number>();
  for (const position of positions) counts.set(position, (counts.get(position) ?? 0) + 1);
  if (reserveSlots > 0) counts.set("IR", reserveSlots);
  return [...counts.entries()]
    .map(([position, count]) => `${count} ${position === "BN" ? "BENCH" : position}`)
    .join(" / ");
}

function matchupScore(row: SleeperMatchup) {
  return row.custom_points == null ? numberValue(row.points) : numberValue(row.custom_points);
}

function addHeadToHead(
  headToHead: Map<string, HeadToHeadRecord>,
  leftId: string,
  rightId: string,
  leftScore: number,
  rightScore: number,
  season: number
) {
  const sortedManagerIds = [leftId, rightId].sort();
  const managerAId = sortedManagerIds[0]!;
  const managerBId = sortedManagerIds[1]!;
  const key = `${managerAId}|${managerBId}`;
  const record = headToHead.get(key) ?? {
    managerAId,
    managerBId,
    winsA: 0,
    winsB: 0,
    ties: 0,
    seasons: new Set<number>(),
  };
  const scoreA = leftId === managerAId ? leftScore : rightScore;
  const scoreB = leftId === managerAId ? rightScore : leftScore;
  if (scoreA > scoreB) record.winsA += 1;
  else if (scoreB > scoreA) record.winsB += 1;
  else record.ties += 1;
  record.seasons.add(season);
  headToHead.set(key, record);
}

function managerFromRoster(bundle: SleeperSeasonBundle, roster: SleeperRoster, season: number): ManagerAccumulator {
  const user = userForRoster(bundle.users, roster);
  return {
    id: managerIdForRoster(bundle.league.league_id, roster),
    ...(user?.user_id ? { sleeperUserId: user.user_id } : {}),
    currentRosterId: null,
    avatarUrl: avatarUrl(user),
    isCommissioner: Boolean(user?.is_owner),
    managerName: user?.display_name?.trim() || teamName(user, roster.roster_id),
    teamName: teamName(user, roster.roster_id),
    bio: "Add this manager's league story, signature moves, and commissioner notes.",
    seasons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    playoffWins: 0,
    playoffLosses: 0,
    titles: 0,
    titleYears: [],
    divisionTitles: 0,
    rivalryWins: 0,
    rivalryLosses: 0,
    draftSlot: null,
    topGame: null,
    badges: [],
    outlook: "",
    seasonHistory: [],
    latestSeason: season,
  };
}

function award(
  id: string,
  title: string,
  managerId: string,
  value: string,
  detail: string
): LeagueAward {
  return { id, title, winnerManagerId: managerId, value, detail };
}

function rankedRosters(rosters: SleeperRoster[]) {
  return [...rosters].sort((a, b) => {
    const wins = numberValue(b.settings.wins) - numberValue(a.settings.wins);
    const ties = numberValue(b.settings.ties) - numberValue(a.settings.ties);
    return wins || ties || rosterPoints(b.settings) - rosterPoints(a.settings);
  });
}

function normalize(value: number, minimum: number, maximum: number) {
  return maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5;
}

function managerWinRate(manager: LeagueManager) {
  const games = manager.wins + manager.losses + manager.ties;
  return games ? (manager.wins + manager.ties * 0.5) / games : 0.5;
}

function managerPpg(manager: LeagueManager) {
  const games = manager.wins + manager.losses + manager.ties;
  return games ? manager.pointsFor / games : 0;
}

function buildPowerStandings(
  current: SleeperSeasonBundle,
  rosterToManager: Map<number, string>,
  managerById: Map<string, ManagerAccumulator>
): LeagueStanding[] {
  const currentManagers = current.rosters
    .map((roster) => managerById.get(rosterToManager.get(roster.roster_id) ?? ""))
    .filter((manager): manager is ManagerAccumulator => Boolean(manager));
  const ppgValues = currentManagers.map(managerPpg);
  const minPpg = ppgValues.length ? Math.min(...ppgValues) : 0;
  const maxPpg = ppgValues.length ? Math.max(...ppgValues) : 0;
  const previousRanks = new Map(
    currentManagers.map((manager) => {
      const previous = manager.seasonHistory
        .filter((season) => season.status === "complete")
        .sort((a, b) => b.year - a.year)[0];
      return [manager.id, previous?.rank ?? currentManagers.length];
    })
  );
  const scored = current.rosters.map((roster) => {
    const managerId = rosterToManager.get(roster.roster_id) ?? "";
    const manager = managerById.get(managerId)!;
    const currentGames = numberValue(roster.settings.wins) + numberValue(roster.settings.losses) + numberValue(roster.settings.ties);
    const currentRate = currentGames
      ? (numberValue(roster.settings.wins) + numberValue(roster.settings.ties) * 0.5) / currentGames
      : managerWinRate(manager);
    const recent = manager.seasonHistory
      .filter((season) => season.status === "complete")
      .sort((a, b) => b.year - a.year)[0];
    const recentGames = recent ? recent.wins + recent.losses + recent.ties : 0;
    const recentRate = recentGames && recent
      ? (recent.wins + recent.ties * 0.5) / recentGames
      : managerWinRate(manager);
    const scoringStrength = normalize(managerPpg(manager), minPpg, maxPpg);
    const postseasonStrength = Math.min(1, manager.titles * 0.35 + manager.playoffWins * 0.05);
    const score = currentGames
      ? currentRate * 45 + recentRate * 20 + scoringStrength * 25 + postseasonStrength * 10
      : recentRate * 42 + managerWinRate(manager) * 23 + scoringStrength * 25 + postseasonStrength * 10;
    return { roster, managerId, score };
  }).sort((a, b) => b.score - a.score || rosterPoints(b.roster.settings) - rosterPoints(a.roster.settings));

  const powerRank = new Map(scored.map((entry, index) => [entry.managerId, { rank: index + 1, score: entry.score }]));
  return rankedRosters(current.rosters).map((roster, index) => {
    const managerId = rosterToManager.get(roster.roster_id) ?? "";
    const power = powerRank.get(managerId) ?? { rank: index + 1, score: 50 };
    const previousRank = previousRanks.get(managerId) ?? power.rank;
    const games = numberValue(roster.settings.wins) + numberValue(roster.settings.losses) + numberValue(roster.settings.ties);
    return {
      managerId,
      rank: index + 1,
      powerRank: power.rank,
      wins: numberValue(roster.settings.wins),
      losses: numberValue(roster.settings.losses),
      ties: numberValue(roster.settings.ties),
      pointsFor: rosterPoints(roster.settings),
      pointsAgainst: rosterPoints(roster.settings, "fpts_against"),
      streak: "-",
      powerScore: Number(power.score.toFixed(1)),
      powerTrend: previousRank - power.rank,
      powerReason: games
        ? "Current record, scoring strength, recent form, and postseason results."
        : "Recent form, career scoring, win rate, and postseason results.",
    };
  });
}

function americanOdds(probability: number) {
  if (probability <= 0 || probability >= 1) return 0;
  const raw = probability >= 0.5
    ? -100 * probability / (1 - probability)
    : 100 * (1 - probability) / probability;
  return Math.round(raw / 10) * 10;
}

function modelFutures(
  managers: LeagueManager[],
  standings: LeagueStanding[],
  regularSeasonGames: number
): LeagueFuture[] {
  const powerByManager = new Map(standings.map((standing) => [standing.managerId, standing.powerScore ?? 50]));
  const currentManagers = managers.filter((manager) => manager.currentRosterId != null);
  const maximum = Math.max(...currentManagers.map((manager) => powerByManager.get(manager.id) ?? 50), 50);
  const weights = currentManagers.map((manager) => ({
    manager,
    weight: Math.exp(((powerByManager.get(manager.id) ?? 50) - maximum) / 18),
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return weights.map(({ manager, weight }) => {
    const probability = weight / totalWeight;
    const strength = Math.max(0, Math.min(1, (powerByManager.get(manager.id) ?? 50) / 100));
    const projectedWins = Math.round(regularSeasonGames * (0.28 + strength * 0.44) * 2) / 2;
    const latest = manager.seasonHistory?.filter((season) => season.status === "complete").sort((a, b) => b.year - a.year)[0];
    return {
      managerId: manager.id,
      championshipOdds: americanOdds(probability),
      winTotal: projectedWins,
      fairProbability: Number(probability.toFixed(3)),
      source: "gamehq-model",
      caseFor: latest
        ? `${latest.rank <= 3 ? "Top-three recent finish" : `Finished #${latest.rank} last season`}; ${manager.titles} career title${manager.titles === 1 ? "" : "s"} and ${(managerWinRate(manager) * 100).toFixed(1)}% career win rate.`
        : `First imported fantasy season; the opening line uses available career and postseason data.`,
    };
  });
}

function buildStorylines(
  currentSeason: number,
  managers: LeagueManager[],
  standings: LeagueStanding[],
  seasons: LeagueSeason[],
  draftStatus: string
): LeagueStoryline[] {
  const stories: LeagueStoryline[] = [];
  const latestSeason = seasons[0];
  const topPower = [...standings].sort((a, b) => a.powerRank - b.powerRank)[0];
  const decorated = [...managers].sort((a, b) => b.titles - a.titles || b.playoffWins - a.playoffWins)[0];
  if (latestSeason?.championManagerId) {
    const champion = managers.find((manager) => manager.id === latestSeason.championManagerId);
    stories.push({
      id: "defending-champion",
      label: "Title defense",
      title: champion?.teamName || "Defending champion",
      detail: `${champion?.managerName || "The champion"} enters ${currentSeason} carrying the ${latestSeason.year} banner.`,
      managerIds: [latestSeason.championManagerId],
      tone: "gold",
    });
  }
  if (topPower?.managerId) {
    const manager = managers.find((entry) => entry.id === topPower.managerId);
    stories.push({
      id: "power-favorite",
      label: "GameHQ Power Index",
      title: `${manager?.teamName || "Power leader"} starts #1`,
      detail: `${topPower.powerScore?.toFixed(1) ?? "50.0"} model score from recent form, scoring, career record, and playoff results.`,
      managerIds: [topPower.managerId],
      tone: "emerald",
    });
  }
  if (latestSeason?.runnerUpManagerId) {
    const runnerUp = managers.find((manager) => manager.id === latestSeason.runnerUpManagerId);
    stories.push({
      id: "unfinished-business",
      label: "Unfinished business",
      title: runnerUp?.teamName || "Last year's runner-up",
      detail: `${runnerUp?.managerName || "The runner-up"} returns after reaching the ${latestSeason.year} final.`,
      managerIds: [latestSeason.runnerUpManagerId],
      tone: "blue",
    });
  }
  if (decorated && decorated.titles > 0) {
    stories.push({
      id: "most-decorated",
      label: "All-time standard",
      title: `${decorated.managerName}: ${decorated.titles} title${decorated.titles === 1 ? "" : "s"}`,
      detail: `${decorated.playoffWins} playoff wins across ${decorated.seasons} completed seasons.`,
      managerIds: [decorated.id],
      tone: "rose",
    });
  }
  if (stories.length < 4) {
    stories.push({
      id: "draft-status",
      label: "Draft room",
      title: draftStatus.replace(/_/g, " "),
      detail: "Sleeper remains the source of truth for the live draft status.",
      managerIds: [],
      tone: "blue",
    });
  }
  return stories.slice(0, 4);
}

function seasonResult(
  bundle: SleeperSeasonBundle,
  rosterToManager: Map<number, string>,
  managerById: Map<string, ManagerAccumulator>
): LeagueSeason | null {
  if (bundle.league.status !== "complete") return null;
  const year = numberValue(bundle.league.season);
  const final = bundle.winnersBracket.find((match) => match.p === 1);
  if (!final?.w) return null;
  const thirdPlace = bundle.winnersBracket.find((match) => match.p === 3);
  const lastPlaceMatch = [...bundle.losersBracket]
    .filter((match) => match.p != null)
    .sort((a, b) => numberValue(b.p) - numberValue(a.p))[0];
  const championManagerId = rosterToManager.get(final.w) ?? "";
  const runnerUpManagerId = final.l ? rosterToManager.get(final.l) ?? "" : "";
  const thirdManagerId = thirdPlace?.w ? rosterToManager.get(thirdPlace.w) ?? "" : "";
  const lastPlaceManagerId = lastPlaceMatch?.l ? rosterToManager.get(lastPlaceMatch.l) ?? "" : "";
  const rosterById = new Map(bundle.rosters.map((roster) => [roster.roster_id, roster]));
  const scoringLeader = [...bundle.rosters].sort(
    (a, b) => rosterPoints(b.settings) - rosterPoints(a.settings)
  )[0];
  const recordLeader = [...bundle.rosters].sort((a, b) => {
    const wins = numberValue(b.settings.wins) - numberValue(a.settings.wins);
    return wins || rosterPoints(b.settings) - rosterPoints(a.settings);
  })[0];
  const movesLeader = [...bundle.rosters].sort(
    (a, b) => numberValue(b.settings.total_moves) - numberValue(a.settings.total_moves)
  )[0];
  const faabLeader = [...bundle.rosters].sort(
    (a, b) => numberValue(b.settings.waiver_budget_used) - numberValue(a.settings.waiver_budget_used)
  )[0];
  const potentialLeader = [...bundle.rosters].sort(
    (a, b) => rosterPoints(b.settings, "ppts") - rosterPoints(a.settings, "ppts")
  )[0];
  const allMatchupRows = bundle.matchups.flatMap(({ rows }) => rows);
  const highGame = [...allMatchupRows].sort((a, b) => matchupScore(b) - matchupScore(a))[0];
  const completedGames = bundle.matchups.flatMap(({ rows, week }) => {
    const groups = new Map<number, SleeperMatchup[]>();
    for (const row of rows) {
      if (row.matchup_id == null) continue;
      groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
    }
    return [...groups.values()].flatMap((group) => {
      if (group.length !== 2) return [];
      const left = group[0]!;
      const right = group[1]!;
      const leftScore = matchupScore(left);
      const rightScore = matchupScore(right);
      if (leftScore === 0 && rightScore === 0) return [];
      const winner = leftScore >= rightScore ? left : right;
      return [{ week, winner, margin: Math.abs(leftScore - rightScore) }];
    });
  });
  const closestGame = [...completedGames].sort((a, b) => a.margin - b.margin)[0];
  const biggestBlowout = [...completedGames].sort((a, b) => b.margin - a.margin)[0];
  const awards: LeagueAward[] = [];
  const superlatives: LeagueAward[] = [];
  if (scoringLeader) {
    awards.push(
      award(
        `sleeper-${year}-scoring`,
        "Regular-season scoring leader",
        rosterToManager.get(scoringLeader.roster_id) ?? "",
        `${rosterPoints(scoringLeader.settings).toFixed(2)} points`,
        "Highest Sleeper regular-season points total."
      )
    );
  }
  if (recordLeader) {
    awards.push(
      award(
        `sleeper-${year}-record`,
        "Best regular-season record",
        rosterToManager.get(recordLeader.roster_id) ?? "",
        recordLabel(recordLeader),
        "Best Sleeper regular-season record, with points for as the tiebreaker."
      )
    );
  }
  if (highGame && matchupScore(highGame) > 0) {
    awards.push(
      award(
        `sleeper-${year}-high-game`,
        "Highest weekly score",
        rosterToManager.get(highGame.roster_id) ?? "",
        `${matchupScore(highGame).toFixed(2)} points`,
        "Highest recorded Sleeper lineup score of the season."
      )
    );
  }
  if (potentialLeader && rosterPoints(potentialLeader.settings, "ppts") > 0) {
    awards.push(
      award(
        `sleeper-${year}-ceiling`,
        "Lineup ceiling leader",
        rosterToManager.get(potentialLeader.roster_id) ?? "",
        `${rosterPoints(potentialLeader.settings, "ppts").toFixed(2)} potential points`,
        "Highest Sleeper potential-points total."
      )
    );
  }
  if (movesLeader && numberValue(movesLeader.settings.total_moves) > 0) {
    superlatives.push(
      award(
        `sleeper-${year}-moves`,
        "Most active manager",
        rosterToManager.get(movesLeader.roster_id) ?? "",
        `${numberValue(movesLeader.settings.total_moves)} moves`,
        "Most recorded roster moves in Sleeper."
      )
    );
  }
  if (faabLeader && numberValue(faabLeader.settings.waiver_budget_used) > 0) {
    superlatives.push(
      award(
        `sleeper-${year}-faab`,
        "Biggest FAAB spender",
        rosterToManager.get(faabLeader.roster_id) ?? "",
        `$${numberValue(faabLeader.settings.waiver_budget_used)}`,
        "Most waiver budget used during the season."
      )
    );
  }
  if (closestGame) {
    superlatives.push(
      award(
        `sleeper-${year}-closest`,
        "Narrowest escape",
        rosterToManager.get(closestGame.winner.roster_id) ?? "",
        `${closestGame.margin.toFixed(2)}-point margin`,
        `Closest recorded win, in Week ${closestGame.week}.`
      )
    );
  }
  if (biggestBlowout) {
    superlatives.push(
      award(
        `sleeper-${year}-blowout`,
        "Biggest statement win",
        rosterToManager.get(biggestBlowout.winner.roster_id) ?? "",
        `${biggestBlowout.margin.toFixed(2)}-point margin`,
        `Largest recorded win, in Week ${biggestBlowout.week}.`
      )
    );
  }

  const champion = managerById.get(championManagerId);
  const runnerUp = managerById.get(runnerUpManagerId);
  const scorer = scoringLeader ? managerById.get(rosterToManager.get(scoringLeader.roster_id) ?? "") : null;
  const summaryParts = [
    `${champion?.managerName || "The champion"} won the ${year} title${runnerUp ? ` over ${runnerUp.managerName}` : ""}.`,
  ];
  if (scorer && scoringLeader) {
    summaryParts.push(`${scorer.managerName} led regular-season scoring with ${rosterPoints(scoringLeader.settings).toFixed(2)} points.`);
  }

  return {
    year,
    sourceLeagueId: bundle.league.league_id,
    title: `${year} ${bundle.league.name}`,
    summary: summaryParts.join(" "),
    championManagerId,
    championTeam: final.w
      ? teamName(userForRoster(bundle.users, rosterById.get(final.w)!), final.w)
      : champion?.teamName ?? "",
    championRecord: recordLabel(rosterById.get(final.w)),
    runnerUpManagerId,
    thirdManagerId,
    lastPlaceManagerId,
    lastPlaceTeam: lastPlaceMatch?.l
      ? teamName(userForRoster(bundle.users, rosterById.get(lastPlaceMatch.l)!), lastPlaceMatch.l)
      : managerById.get(lastPlaceManagerId)?.teamName ?? "",
    lastPlaceRecord: recordLabel(lastPlaceMatch?.l ? rosterById.get(lastPlaceMatch.l) : undefined),
    awards,
    superlatives,
    managerReviews: [],
  };
}

function weeklyRecaps(
  bundle: SleeperSeasonBundle,
  rosterToManager: Map<number, string>,
  standings: LeagueStanding[],
  managers: LeagueManager[]
): LeagueWeekRecap[] {
  const powerRank = new Map(standings.map((standing) => [standing.managerId, standing.powerRank]));
  const managerNames = new Map(managers.map((manager) => [manager.id, manager.managerName]));
  return bundle.matchups.flatMap(({ week, rows }) => {
    const scored = rows.filter((row) => row.matchup_id != null && matchupScore(row) > 0);
    const highScore = [...scored].sort((a, b) => matchupScore(b) - matchupScore(a))[0];
    if (!highScore) return [];
    const lowScore = [...scored].sort((a, b) => matchupScore(a) - matchupScore(b))[0];
    const groups = new Map<number, SleeperMatchup[]>();
    for (const row of scored) {
      if (row.matchup_id == null) continue;
      groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
    }
    const games = [...groups.values()].flatMap((group) => {
      if (group.length !== 2) return [];
      const left = group[0]!;
      const right = group[1]!;
      const leftScore = matchupScore(left);
      const rightScore = matchupScore(right);
      const winner = leftScore >= rightScore ? left : right;
      const loser = winner === left ? right : left;
      const winnerId = rosterToManager.get(winner.roster_id) ?? "";
      const loserId = rosterToManager.get(loser.roster_id) ?? "";
      return [{ winnerId, loserId, margin: Math.abs(leftScore - rightScore) }];
    });
    const closest = [...games].sort((a, b) => a.margin - b.margin)[0];
    const blowout = [...games].sort((a, b) => b.margin - a.margin)[0];
    const upset = [...games]
      .filter((game) => (powerRank.get(game.winnerId) ?? 0) > (powerRank.get(game.loserId) ?? 99))
      .sort((a, b) =>
        ((powerRank.get(b.winnerId) ?? 0) - (powerRank.get(b.loserId) ?? 0)) -
        ((powerRank.get(a.winnerId) ?? 0) - (powerRank.get(a.loserId) ?? 0))
      )[0];
    const managerId = rosterToManager.get(highScore.roster_id) ?? "";
    const highScoreName = managerNames.get(managerId) || "The week's top manager";
    const summaryBits = [`${highScoreName} led the league with ${matchupScore(highScore).toFixed(2)} points.`];
    if (closest) summaryBits.push(`The closest matchup was decided by ${closest.margin.toFixed(2)}.`);
    if (blowout && blowout !== closest) summaryBits.push(`The largest margin was ${blowout.margin.toFixed(2)}.`);
    return [{
      week,
      title: `${highScoreName} owns Week ${week}`,
      summary: summaryBits.join(" "),
      highScoreManagerId: managerId,
      highScore: matchupScore(highScore),
      upsetManagerId: upset?.winnerId ?? "",
      upsetAgainstManagerId: upset?.loserId ?? "",
      lowScoreManagerId: lowScore ? rosterToManager.get(lowScore.roster_id) ?? "" : "",
      lowScore: lowScore ? matchupScore(lowScore) : null,
      closestMargin: closest?.margin ?? null,
      blowoutMargin: blowout?.margin ?? null,
    }];
  });
}

function generatedRivalries(
  headToHead: Map<string, HeadToHeadRecord>,
  managerById: Map<string, ManagerAccumulator>,
  nextMeetings: Map<string, string>
): LeagueRivalry[] {
  return [...headToHead.values()]
    .filter((record) => record.winsA + record.winsB + record.ties >= 2)
    .sort((a, b) => {
      const gamesA = a.winsA + a.winsB + a.ties;
      const gamesB = b.winsA + b.winsB + b.ties;
      return gamesB - gamesA || Math.abs(a.winsA - a.winsB) - Math.abs(b.winsA - b.winsB);
    })
    .slice(0, 8)
    .map((record) => {
      const managerA = managerById.get(record.managerAId);
      const managerB = managerById.get(record.managerBId);
      const seasons = [...record.seasons].sort().join(", ");
      const rivalryKey = [record.managerAId, record.managerBId].sort().join("|");
      return {
        id: `sleeper-rivalry-${record.managerAId}-${record.managerBId}`,
        name: `${managerA?.teamName || "Team A"} / ${managerB?.teamName || "Team B"} Series`,
        managerAId: record.managerAId,
        managerBId: record.managerBId,
        winsA: record.winsA,
        winsB: record.winsB,
        ties: record.ties,
        summary: `${record.winsA + record.winsB + record.ties} recorded Sleeper matchups across ${seasons}.`,
        nextMeeting: nextMeetings.get(rivalryKey) ?? "",
      };
    });
}

function mergeManualFields(existing: LeagueHQData, imported: LeagueHQData): LeagueHQData {
  const existingManagers = new Map(existing.managers.map((manager) => [manager.id, manager]));
  const managers = imported.managers.map((manager) => {
    const previous = existingManagers.get(manager.id);
    if (!previous) return manager;
    return {
      ...manager,
      bio: previous.bio || manager.bio,
      rivalryWins: previous.rivalryWins,
      rivalryLosses: previous.rivalryLosses,
      draftSlot: manager.draftSlot ?? previous.draftSlot,
    };
  });
  const existingSeasons = new Map(existing.seasons.map((season) => [season.year, season]));
  const seasons = imported.seasons.map((season) => {
    const previous = existingSeasons.get(season.year);
    if (!previous) return season;
    const customAwards = previous.awards.filter((item) => !item.id.startsWith("sleeper-"));
    const customSuperlatives = previous.superlatives.filter((item) => !item.id.startsWith("sleeper-"));
    return {
      ...season,
      title: previous.title || season.title,
      summary: previous.summary || season.summary,
      awards: [...season.awards, ...customAwards],
      superlatives: [...season.superlatives, ...customSuperlatives],
      managerReviews: previous.managerReviews,
    };
  });
  const generatedByPair = new Map(
    imported.rivalries.map((rivalry) => [
      [rivalry.managerAId, rivalry.managerBId].sort().join("|"),
      rivalry,
    ])
  );
  const rivalries = existing.rivalries.length
    ? existing.rivalries.map((rivalry) => {
        const fresh = generatedByPair.get([rivalry.managerAId, rivalry.managerBId].sort().join("|"));
        return fresh
          ? { ...fresh, id: rivalry.id, name: rivalry.name, summary: rivalry.summary, nextMeeting: rivalry.nextMeeting || fresh.nextMeeting }
          : rivalry;
      })
    : imported.rivalries;
  const existingFutures = new Map(existing.futures.map((future) => [future.managerId, future]));
  const futures = imported.futures.map((future) => {
    const previous = existingFutures.get(future.managerId);
    if (!previous) return future;
    const manuallyEdited = previous.source === "commissioner" || (
      previous.source == null && (
        previous.championshipOdds !== 0 ||
        previous.winTotal !== 0 ||
        previous.caseFor !== "Add a commissioner case for this manager."
      )
    );
    return manuallyEdited ? { ...previous, source: "commissioner" as const } : future;
  });
  const sleeperRuleIds = new Set(imported.rules.map((rule) => rule.id));
  const customRules = existing.rules.filter((rule) => !sleeperRuleIds.has(rule.id));

  return {
    ...imported,
    identity: existing.sleeper
      ? {
          ...imported.identity,
          shortName: existing.identity.shortName || imported.identity.shortName,
          tagline: existing.identity.tagline || imported.identity.tagline,
          draftAt: imported.identity.draftAt || existing.identity.draftAt,
        }
      : imported.identity,
    rules: [...imported.rules, ...customRules],
    managers,
    seasons,
    rivalries,
    hallOfFame: existing.hallOfFame,
    futures,
  };
}

export async function loadSleeperLeagueHQ(
  leagueId: string,
  options: { fetcher?: Fetcher; signal?: AbortSignal; now?: Date } = {}
): Promise<SleeperLeagueImportResult> {
  const normalizedLeagueId = leagueId.trim();
  if (!/^\d{10,}$/.test(normalizedLeagueId)) {
    throw new Error("Enter the numeric Sleeper league ID from the league URL.");
  }
  const fetcher = options.fetcher ?? fetch;
  const state = await sleeperJson<SleeperState>("/state/nfl", fetcher, options.signal);
  const bundles: SleeperSeasonBundle[] = [];
  const seen = new Set<string>();
  let nextLeagueId = normalizedLeagueId;

  while (nextLeagueId && !seen.has(nextLeagueId) && bundles.length < MAX_HISTORY_SEASONS) {
    seen.add(nextLeagueId);
    const league = await sleeperJson<SleeperLeague>(`/league/${nextLeagueId}`, fetcher, options.signal);
    bundles.push(await loadSeasonBundle(league, state, fetcher, options.signal));
    nextLeagueId = textValue(league.previous_league_id);
  }

  const current = bundles[0];
  if (!current) throw new Error("Sleeper did not return a league for that ID.");
  const managerById = new Map<string, ManagerAccumulator>();
  const headToHead = new Map<string, HeadToHeadRecord>();
  const nextMeetings = new Map<string, string>();
  const rosterMaps = new Map<string, Map<number, string>>();

  for (const bundle of bundles) {
    const season = numberValue(bundle.league.season);
    const rosterToManager = new Map<number, string>();
    const ranks = new Map(rankedRosters(bundle.rosters).map((roster, index) => [roster.roster_id, index + 1]));
    rosterMaps.set(bundle.league.league_id, rosterToManager);
    for (const roster of bundle.rosters) {
      const managerId = managerIdForRoster(bundle.league.league_id, roster);
      rosterToManager.set(roster.roster_id, managerId);
      const currentManager = managerById.get(managerId) ?? managerFromRoster(bundle, roster, season);
      currentManager.seasons += bundle.league.status === "pre_draft" ? 0 : 1;
      currentManager.wins += numberValue(roster.settings.wins);
      currentManager.losses += numberValue(roster.settings.losses);
      currentManager.ties += numberValue(roster.settings.ties);
      currentManager.pointsFor += rosterPoints(roster.settings);
      currentManager.pointsAgainst += rosterPoints(roster.settings, "fpts_against");
      const historicalUser = userForRoster(bundle.users, roster);
      currentManager.seasonHistory.push({
        year: season,
        teamName: teamName(historicalUser, roster.roster_id),
        status: bundle.league.status,
        rank: ranks.get(roster.roster_id) ?? bundle.rosters.length,
        wins: numberValue(roster.settings.wins),
        losses: numberValue(roster.settings.losses),
        ties: numberValue(roster.settings.ties),
        pointsFor: rosterPoints(roster.settings),
        pointsAgainst: rosterPoints(roster.settings, "fpts_against"),
      });
      if (bundle === current) currentManager.currentRosterId = roster.roster_id;
      managerById.set(managerId, currentManager);
    }
    for (const match of bundle.winnersBracket) {
      const winnerId = match.w ? rosterToManager.get(match.w) : "";
      const loserId = match.l ? rosterToManager.get(match.l) : "";
      if (winnerId) managerById.get(winnerId)!.playoffWins += 1;
      if (loserId) managerById.get(loserId)!.playoffLosses += 1;
      if (match.p === 1 && winnerId) {
        const champion = managerById.get(winnerId)!;
        champion.titles += 1;
        champion.titleYears.push(season);
      }
    }
    for (const { week, rows } of bundle.matchups) {
      const groups = new Map<number, SleeperMatchup[]>();
      for (const row of rows) {
        if (row.matchup_id == null) continue;
        groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
        const manager = managerById.get(rosterToManager.get(row.roster_id) ?? "");
        if (manager && matchupScore(row) > numberValue(manager.topGame?.points)) {
          manager.topGame = { player: "Weekly lineup", points: matchupScore(row), season };
        }
      }
      for (const group of groups.values()) {
        if (group.length !== 2) continue;
        const left = group[0]!;
        const right = group[1]!;
        const leftId = rosterToManager.get(left.roster_id);
        const rightId = rosterToManager.get(right.roster_id);
        if (!leftId || !rightId) continue;
        const leftScore = matchupScore(left);
        const rightScore = matchupScore(right);
        const rivalryKey = [leftId, rightId].sort().join("|");
        if (leftScore > 0 || rightScore > 0) {
          addHeadToHead(headToHead, leftId, rightId, leftScore, rightScore, season);
        } else if (bundle === current && !nextMeetings.has(rivalryKey)) {
          nextMeetings.set(rivalryKey, `Week ${week}`);
        }
      }
    }
  }

  const latestChampion = bundles
    .flatMap((bundle) => bundle.winnersBracket
      .filter((match) => match.p === 1 && match.w)
      .map((match) => ({
        year: numberValue(bundle.league.season),
        managerId: rosterMaps.get(bundle.league.league_id)?.get(match.w!),
      })))
    .sort((a, b) => b.year - a.year)[0];
  for (const manager of managerById.values()) {
    manager.seasonHistory.sort((a, b) => b.year - a.year);
    const latest = manager.seasonHistory.find((season) => season.status === "complete");
    const badges: string[] = [];
    if (manager.isCommissioner) badges.push("Commissioner");
    if (latestChampion?.managerId === manager.id) badges.push("Defending champion");
    if (manager.titles > 0) badges.push(`${manager.titles}x champion`);
    if (latest?.rank && latest.rank <= 3) badges.push(`Last season #${latest.rank}`);
    manager.badges = badges;
    manager.outlook = latest
      ? `${manager.managerName} enters ${current.league.season} after a ${latest.wins}-${latest.losses}${latest.ties ? `-${latest.ties}` : ""} season and #${latest.rank} regular-season finish. Career win rate: ${(managerWinRate(manager) * 100).toFixed(1)}%.`
      : `${manager.managerName} begins a first imported fantasy season with no completed Sleeper history yet.`;
  }

  const currentRosterMap = rosterMaps.get(current.league.league_id) ?? new Map<number, string>();
  const currentDraft = current.drafts[0];
  const slotByRoster = new Map<number, number>();
  for (const [slot, rosterId] of Object.entries(currentDraft?.slot_to_roster_id ?? {})) {
    slotByRoster.set(numberValue(rosterId), numberValue(slot));
  }
  for (const [userId, slot] of Object.entries(currentDraft?.draft_order ?? {})) {
    const manager = managerById.get(`sleeper-user-${userId}`);
    if (manager) manager.draftSlot = numberValue(slot);
  }
  for (const manager of managerById.values()) {
    if (manager.currentRosterId && slotByRoster.has(manager.currentRosterId)) {
      manager.draftSlot = slotByRoster.get(manager.currentRosterId) ?? null;
    }
  }

  const managers = [...managerById.values()]
    .sort((a, b) => Number(Boolean(b.currentRosterId)) - Number(Boolean(a.currentRosterId)) || a.managerName.localeCompare(b.managerName))
    .map(({ latestSeason: _latestSeason, ...manager }) => manager);
  const seasons = bundles
    .map((bundle) => seasonResult(bundle, rosterMaps.get(bundle.league.league_id) ?? new Map(), managerById))
    .filter((season): season is LeagueSeason => Boolean(season))
    .sort((a, b) => b.year - a.year);
  const reserveSlots = numberValue(current.league.settings.reserve_slots);
  const draftBudget = numberValue(currentDraft?.settings.budget);
  const draftType = currentDraft?.type ? `${currentDraft.type[0]?.toUpperCase()}${currentDraft.type.slice(1)}` : "Sleeper";
  const faab = numberValue(current.league.settings.waiver_budget);
  const tradeDeadline = numberValue(current.league.settings.trade_deadline);
  const standings = buildPowerStandings(current, currentRosterMap, managerById);
  const regularSeasonGames = Math.max(1, numberValue(current.league.settings.playoff_week_start) - 1 || 14);
  const futures = modelFutures(managers, standings, regularSeasonGames);
  const storylines = buildStorylines(
    numberValue(current.league.season),
    managers,
    standings,
    seasons,
    currentDraft?.status ?? current.league.status
  );
  const syncTime = options.now ?? new Date();
  const seasonLeagueIds = Object.fromEntries(
    bundles.map((bundle) => [bundle.league.season, bundle.league.league_id])
  );
  const data: LeagueHQData = {
    sleeper: {
      provider: "sleeper",
      leagueId: current.league.league_id,
      leagueName: current.league.name,
      season: numberValue(current.league.season),
      status: current.league.status,
      syncedAt: syncTime.toISOString(),
      sourceUrl: `https://sleeper.com/leagues/${current.league.league_id}`,
      seasonLeagueIds,
      seasonsImported: bundles.length,
      managersImported: managers.length,
    },
    identity: {
      name: current.league.name,
      shortName: "Fantasy Football",
      tagline: "Sleeper results and league history, presented by GameHQ.",
      currentSeason: numberValue(current.league.season),
      foundedYear: Math.min(...bundles.map((bundle) => numberValue(bundle.league.season))),
      format: `${current.league.total_rosters}-team ${draftType.toLowerCase()} league`,
      scoring: scoringLabel(current.league.scoring_settings),
      rosterSummary: rosterSummary(current.league.roster_positions, reserveSlots),
      draftAt: currentDraft?.start_time ? new Date(currentDraft.start_time).toISOString() : "",
    },
    rules: [
      {
        id: "teams",
        label: "League size",
        value: `${current.league.total_rosters} teams`,
        detail: `Synced from Sleeper league ${current.league.league_id}.`,
      },
      {
        id: "draft",
        label: "Draft",
        value: `${draftType}${draftBudget ? ` / $${draftBudget} budget` : ""}`,
        detail: currentDraft ? `${currentDraft.status.replace(/_/g, " ")} on Sleeper` : "No Sleeper draft found.",
      },
      {
        id: "scoring",
        label: "Scoring",
        value: scoringLabel(current.league.scoring_settings),
        detail: `${numberValue(current.league.scoring_settings.pass_td)}-point passing touchdowns / ${numberValue(current.league.scoring_settings.rush_td)}-point rushing touchdowns.`,
      },
      {
        id: "roster",
        label: "Roster",
        value: rosterSummary(current.league.roster_positions, reserveSlots),
        detail: "Starting lineup, bench, and reserve slots from Sleeper.",
      },
      {
        id: "waivers",
        label: "Waivers & trades",
        value: faab ? `$${faab} FAAB` : "Sleeper waivers",
        detail: tradeDeadline ? `Trade deadline: Week ${tradeDeadline}.` : "No trade deadline recorded.",
      },
    ],
    managers,
    standings,
    seasons,
    rivalries: generatedRivalries(headToHead, managerById, nextMeetings),
    hallOfFame: [],
    weekRecaps: weeklyRecaps(current, currentRosterMap, standings, managers),
    futures,
    storylines,
  };

  return {
    data,
    leagueId: current.league.league_id,
    leagueName: current.league.name,
    seasonsImported: bundles.length,
    managersImported: managers.length,
  };
}

export function mergeSleeperLeagueHQ(existing: LeagueHQData, imported: LeagueHQData) {
  return mergeManualFields(existing, imported);
}
