import type { SleeperLeague, SleeperMatchupRow, SleeperRoster, SleeperUser, SleeperState } from "../league-history/provider/sleeperTypes";
import type { SleeperPlayerRow } from "../../data/playerStatCategories";
import { loadSleeperPlayerDirectory } from "../../data/sleeperPlayerDirectory";
import { loadSleeperWeeklyStats, type SleeperWeeklyStatLine } from "../my-hq/sleeperWeeklyStats";
import { weeklyStatLineText } from "../my-hq/weeklyStatLine";
import { buildMatchupRecap, type MatchupRecap, type RecapTeam } from "./matchupRecap";
import type { LeagueHistorySnapshot } from "../league-history/domain/types";
import { buildRecapRivalry, unavailableRivalry, withRivalrySection, type RecapRivalryWeek } from "./recapRivalry";

const API = "https://api.sleeper.app/v1";
const requests = new Map<string, { expires: number; promise: Promise<unknown> }>();
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

async function read<T>(path: string): Promise<T> {
  const cached = requests.get(path);
  if (cached && cached.expires > Date.now()) return cached.promise as Promise<T>;
  if (requests.size >= 256) requests.delete(requests.keys().next().value!);
  const promise = fetch(`${API}/${path}`, { signal: AbortSignal.timeout(15_000) }).then(async (response) => {
    if (!response.ok) throw new Error(`Sleeper could not load this recap (${response.status}).`);
    return response.json() as Promise<T>;
  }).catch((error: unknown) => { requests.delete(path); throw error; });
  requests.set(path, { expires: Date.now() + 30_000, promise });
  return promise;
}

export function completedRecapWeek(league: SleeperLeague, state: SleeperState) {
  const last = league.settings?.last_scored_leg;
  const scoredThrough = finite(last) && last > 0 ? Math.min(18, Math.floor(last)) : league.status === "complete" ? 18 : 0;
  if (league.status === "complete") return scoredThrough;
  if (Number(state.season) > Number(league.season)) return scoredThrough;
  // Scored does not necessarily mean finished. Require the NFL week to have
  // advanced as well, even if Sleeper still displays the previous matchup.
  if (String(state.season) !== league.season || !finite(state.week)) return 0;
  return Math.min(scoredThrough, Math.max(0, state.week - 1));
}

export function officialRecapScore(row: SleeperMatchupRow) {
  return finite(row.custom_points) ? row.custom_points : finite(row.points) ? row.points : null;
}

export type RecapWeek = {
  league: SleeperLeague;
  week: number;
  lastCompletedWeek: number;
  status: "final" | "pending" | "empty";
  recaps: MatchupRecap[];
  updatedAt: string;
};

export function buildRecapWeek(input: {
  league: SleeperLeague;
  state: SleeperState;
  week: number;
  rows: SleeperMatchupRow[];
  rosters: SleeperRoster[];
  users: SleeperUser[];
  players: SleeperPlayerRow[];
  stats: Map<string, SleeperWeeklyStatLine>;
  updatedAt: string;
}): RecapWeek {
  const { league, week, rows, rosters, users, players, stats, updatedAt } = input;
  const lastCompletedWeek = completedRecapWeek(league, input.state);
  const archived = league.status === "complete" || Number(input.state.season) > Number(league.season);
  const result: RecapWeek = { league, week, lastCompletedWeek, status: week <= lastCompletedWeek || archived ? "empty" : "pending", recaps: [], updatedAt };
  if (week > lastCompletedWeek) return result;
  const directory = new Map(players.map((player) => [String(player.playerId), player]));
  const teams = new Map<number, RecapTeam>();
  const starterSlotCount = league.roster_positions.filter((slot) => !["BN", "BENCH", "IR", "RESERVE", "TAXI"].includes(slot)).length;
  for (const row of rows) {
    const score = officialRecapScore(row);
    if (score === null) continue;
    const roster = rosters.find((candidate) => candidate.roster_id === row.roster_id);
    const user = users.find((candidate) => candidate.user_id === roster?.owner_id);
    const starterIds = new Set((row.starters ?? []).filter((id) => id && id !== "0"));
    const ids = [...new Set([...(row.players ?? []), ...starterIds])].filter((id) => id && id !== "0");
    const teamName = user?.metadata?.team_name;
    teams.set(row.roster_id, {
      id: String(row.roster_id),
      name: typeof teamName === "string" && teamName.trim() ? teamName : user?.display_name || user?.username || `Team ${row.roster_id}`,
      managerIds: [roster?.owner_id, ...(roster?.co_owners ?? [])].filter((id): id is string => Boolean(id)),
      primaryManagerId: roster?.owner_id ?? null,
      score,
      lineupComplete: Boolean(row.players?.length && starterIds.size === starterSlotCount && [...starterIds].every((id) => row.players!.includes(id))),
      benchEligibilityKnown: false,
      players: ids.map((id) => {
        const player = directory.get(id);
        const position = player?.pos ?? "";
        const statLine = weeklyStatLineText({ position, weeklyStatLine: stats.get(id) ?? null });
        return {
          providerPlayerId: id,
          playerName: player?.name || `Player ${id}`,
          position,
          isStarter: starterIds.has(id),
          fantasyPoints: finite(row.players_points?.[id]) ? row.players_points![id]! : null,
          statLine: statLine === "Stat line unavailable" ? undefined : statLine,
        };
      }),
    });
  }
  const groups = new Map<number, SleeperMatchupRow[]>();
  for (const row of rows) {
    if (row.matchup_id === null || row.matchup_id === undefined) continue;
    groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
  }
  for (const [id, pair] of groups) {
    if (pair.length !== 2 || pair[0]!.roster_id === pair[1]!.roster_id) continue;
    const ordered = [...pair].sort((a, b) => a.roster_id - b.roster_id);
    const left = teams.get(ordered[0]!.roster_id);
    const right = teams.get(ordered[1]!.roster_id);
    if (!left || !right) continue;
    const recap = buildMatchupRecap({
      id: String(id), leagueName: league.name, season: Number(league.season), week, status: "final", teams: [left, right],
      rosterPositions: league.roster_positions,
      weekScores: [...teams.values()].map((team) => ({ id: team.id, score: team.score })),
      leagueWeekComplete: teams.size === league.total_rosters && rows.length === league.total_rosters
        && rows.every((row) => row.matchup_id !== null && groups.get(row.matchup_id)?.length === 2),
      sourceUrl: `https://sleeper.com/leagues/${league.league_id}/matchup`, updatedAt,
    });
    if (recap) result.recaps.push(recap);
  }
  if (result.recaps.length) result.status = "final";
  return result;
}

async function findSeason(leagueId: string, season?: number) {
  if (!/^\d+$/u.test(leagueId)) throw new Error("The connected Sleeper league identity is not available yet.");
  const seen = new Set<string>();
  let id = leagueId;
  while (id && !seen.has(id) && seen.size < 30) {
    seen.add(id);
    const league = await read<SleeperLeague>(`league/${id}`);
    if (!league?.league_id || !Array.isArray(league.roster_positions)) throw new Error("Sleeper returned incomplete league information.");
    if (!season || Number(league.season) === season) return league;
    id = league.previous_league_id ?? "";
  }
  throw new Error(`The ${season} season is not available in this league's archive.`);
}

export async function loadRecapSeasons(leagueId: string) {
  const seasons: number[] = [];
  const seen = new Set<string>();
  let league = await findSeason(leagueId);
  while (!seen.has(league.league_id) && seen.size < 30) {
    seen.add(league.league_id);
    seasons.push(Number(league.season));
    if (!league.previous_league_id) break;
    league = await findSeason(league.previous_league_id);
  }
  return [...new Set(seasons)].sort((a, b) => b - a);
}

export async function loadRecapWeek(leagueId: string, season?: number, requestedWeek?: number): Promise<RecapWeek> {
  if (season !== undefined && (!Number.isInteger(season) || season < 2017 || season > 2100)) throw new Error("Choose an available league season.");
  const [league, state] = await Promise.all([findSeason(leagueId, season), read<SleeperState>("state/nfl")]);
  const lastCompletedWeek = completedRecapWeek(league, state);
  const week = requestedWeek ?? Math.max(1, lastCompletedWeek);
  if (!Number.isInteger(week) || week < 1 || week > 18) throw new Error("Choose a week from 1 to 18.");
  if (week > lastCompletedWeek) return { league, week, lastCompletedWeek, status: league.status === "complete" || Number(state.season) > Number(league.season) ? "empty" : "pending", recaps: [], updatedAt: new Date().toISOString() };
  const [rows, rosters, users, players, stats] = await Promise.all([
    read<SleeperMatchupRow[]>(`league/${league.league_id}/matchups/${week}`),
    read<SleeperRoster[]>(`league/${league.league_id}/rosters`),
    read<SleeperUser[]>(`league/${league.league_id}/users`),
    loadSleeperPlayerDirectory().catch(() => [] as SleeperPlayerRow[]),
    loadSleeperWeeklyStats(league.season, week, league.season_type ?? "regular").catch(() => new Map<string, SleeperWeeklyStatLine>()),
  ]);
  if (![rows, rosters, users].every(Array.isArray)) throw new Error("The weekly box score is incomplete. Please try again.");
  return buildRecapWeek({ league, state, week, rows, rosters, users, players, stats, updatedAt: new Date().toISOString() });
}

const rivalryHistory = new Map<string, { expires: number; promise: Promise<LeagueHistorySnapshot> }>();

function loadRivalryArchive(leagueId: string) {
  const cached = rivalryHistory.get(leagueId);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        import("../league-history/persistence/firebaseLeagueHistory").then(({ loadLeagueHistory }) => loadLeagueHistory(leagueId, { refresh: true })),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("History request timed out.")), 12_000); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  })().catch((error: unknown) => { rivalryHistory.delete(leagueId); throw error; });
  if (rivalryHistory.size >= 32) rivalryHistory.delete(rivalryHistory.keys().next().value!);
  rivalryHistory.set(leagueId, { expires: Date.now() + 5 * 60_000, promise });
  return promise;
}

async function previousRecapWeeks(league: SleeperLeague, throughWeek: number) {
  const start = league.settings.start_week;
  const first = typeof start === "number" && start > 0 ? Math.floor(start) : 1;
  const weeks: RecapRivalryWeek[] = [];
  // All reports share these requests; keep historical source concurrency bounded.
  for (let batch = first; batch < throughWeek; batch += 4) {
    const loaded = await Promise.all(Array.from({ length: Math.min(4, throughWeek - batch) }, async (_, offset) => {
      const week = batch + offset;
      const rows = await read<SleeperMatchupRow[]>(`league/${league.league_id}/matchups/${week}`);
      if (!Array.isArray(rows) || !rows.length) throw new Error("An earlier weekly box score is unavailable.");
      return { week, rows };
    }));
    weeks.push(...loaded);
  }
  return weeks;
}

export async function loadRecapRivalries(data: RecapWeek): Promise<RecapWeek> {
  if (data.status !== "final" || !data.recaps.length) return data;
  try {
    const [snapshot, previousWeeks] = await Promise.all([
      loadRivalryArchive(data.league.league_id),
      previousRecapWeeks(data.league, data.week),
    ]);
    return { ...data, recaps: data.recaps.map((recap) => withRivalrySection(recap, buildRecapRivalry(recap, snapshot, previousWeeks))) };
  } catch {
    return { ...data, recaps: data.recaps.map((recap) => withRivalrySection(recap, unavailableRivalry())) };
  }
}
