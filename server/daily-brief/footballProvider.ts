import { addDays, editionSchema, type BriefEdition, type BriefGame, type Observation } from "../../src/features/daily-brief/model.js";
import { boundedMap, csvRecords, numeric, type SourceReader } from "./fetchSource.js";
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const cleanTeam = (team: string) => ({ LA: "LAR", JAC: "JAX", OAK: "LV", SD: "LAC" }[team] ?? team);
export function footballStats(row: Record<string, string>) {
  const fields: Record<string, string> = {
    pass_yd: "passing_yards", pass_td: "passing_tds", pass_int: "passing_interceptions",
    pass_cmp: "completions", pass_att: "attempts", pass_2pt: "passing_2pt_conversions",
    rush_yd: "rushing_yards", rush_td: "rushing_tds", rush_att: "carries", rush_2pt: "rushing_2pt_conversions",
    rec: "receptions", rec_yd: "receiving_yards", rec_td: "receiving_tds", rec_tgt: "targets",
    rec_2pt: "receiving_2pt_conversions", fum_lost: "fumbles_lost_total", fum: "fumbles_total",
    targets: "targets", carries: "carries", pass_fd: "passing_first_downs", rush_fd: "rushing_first_downs", rec_fd: "receiving_first_downs",
    st_td: "special_teams_tds", fum_rec_td: "fumble_recovery_tds", pass_sack: "sacks_suffered",
    kr_yd: "kickoff_return_yards", pr_yd: "punt_return_yards",
  };
  const stats: Record<string, number> = {};
  for (const [key, field] of Object.entries(fields)) { const value = numeric(row[field]); if (value !== null) stats[key] = value; }
  // A zero combined total proves the special-team subset is zero. A positive
  // total cannot establish which plays earned Sleeper's individual ST points.
  if (numeric(row.def_fumbles_forced) === 0) stats.st_ff = 0;
  if (numeric(row.fumble_recovery_own) === 0 && numeric(row.fumble_recovery_opp) === 0) stats.st_fum_rec = 0;
  return stats;
}
export async function footballBrief(date: string, now: string, read: SourceReader): Promise<BriefEdition> {
  const year = Number(date.slice(0, 4)), season = Number(date.slice(5, 7)) < 3 ? year - 1 : year;
  const warnings: string[] = [], sources: BriefEdition["sources"] = [];
  const scoreboardUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=" + date.replace(/-/g, "");
  const scheduleUrl = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
  const statsUrl = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_" + season + ".csv";
  const idsUrl = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";
  const [scheduleResult, statsResult, idsResult] = await Promise.allSettled([read(scheduleUrl), read(statsUrl), read(idsUrl)]);
  const schedules = scheduleResult.status === "fulfilled" ? csvRecords(scheduleResult.value.text).filter(row => Number(row.season) === season && ["REG", "WC", "DIV", "CON", "SB"].includes(row.game_type ?? "")) : [];
  const gameDates = [...new Set([date, ...schedules.filter(row => row.gameday! <= date && row.gameday! >= addDays(date, -28)).map(row => row.gameday!)])];
  const scoreboards = await boundedMap(gameDates, async day => {
    const payload = object(JSON.parse((await read("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=" + day.replace(/-/g, ""))).text));
    if (!Array.isArray(payload.events)) throw new Error("Invalid NFL scoreboard");
    return payload.events;
  });
  if (scoreboards[0]?.status !== "fulfilled") throw new Error("Final-game status is unavailable");
  scoreboards.forEach((result, index) => { if (result.status === "rejected") warnings.push("Final-game evidence is missing for " + gameDates[index] + "."); });
  const completed = new Map<string, BriefGame>();
  const selectedGames = new Map<string, BriefGame>();
  const eligibleGames = new Set(schedules.filter(row => row.gameday! <= date && row.gameday! >= addDays(date, -28)).map(row => row.gameday + ":" + cleanTeam(row.home_team!) + ":" + cleanTeam(row.away_team!)));
  for (const event of scoreboards.flatMap(result => result.status === "fulfilled" ? list(result.value) : [])) {
    const row = object(event), competition = object(list(row.competitions)[0]), competitors = list(competition.competitors).map(object);
    const home = competitors.find(team => team.homeAway === "home"), away = competitors.find(team => team.homeAway === "away");
    if (!home || !away || !row.date || !row.id) continue;
    const gameDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(String(row.date)));
    const homeTeam = cleanTeam(String(object(home.team).abbreviation ?? "")), awayTeam = cleanTeam(String(object(away.team).abbreviation ?? ""));
    const final = object(object(row.status).type).completed === true;
    const match = { id: String(row.id), date: gameDate, home: homeTeam, away: awayTeam, homeScore: numeric(home.score), awayScore: numeric(away.score),
      final, sourceUrl: "https://www.espn.com/nfl/game/_/gameId/" + row.id, week: numeric(object(row.week).number) };
    if (gameDate === date) selectedGames.set(match.id, match);
    const key = gameDate + ":" + homeTeam + ":" + awayTeam;
    if (final && eligibleGames.has(key)) completed.set(key, match);
  }
  sources.push({ name: "ESPN final-game status", url: scoreboardUrl, fetchedAt: now, dataUpdatedAt: null, status: "ready" });
  const games = [...selectedGames.values()];
  sources.push({ name: "nflverse schedule", url: scheduleUrl, fetchedAt: now, dataUpdatedAt: scheduleResult.status === "fulfilled" ? scheduleResult.value.updatedAt : null, status: scheduleResult.status === "fulfilled" ? "ready" : "error" });
  if (scheduleResult.status === "rejected") warnings.push("NFL schedule unavailable; upcoming opponents and game joins are incomplete.");
  const indexed = new Map(schedules.map(row => [row.game_id!, row]));
  const providerIds = new Map<string, string>();
  if (idsResult.status === "fulfilled") {
    const ambiguous = new Set<string>();
    for (const row of csvRecords(idsResult.value.text)) {
      if (!/^00-\d+$/.test(row.gsis_id ?? "") || !/^\d+$/.test(row.sleeper_id ?? "")) continue;
      if (providerIds.has(row.gsis_id!) && providerIds.get(row.gsis_id!) !== row.sleeper_id) ambiguous.add(row.gsis_id!);
      else providerIds.set(row.gsis_id!, row.sleeper_id!);
    }
    for (const id of ambiguous) providerIds.delete(id);
  } else warnings.push("Sleeper identity mapping is unavailable; league availability cannot be verified for unmapped players.");
  sources.push({ name: "DynastyProcess GSIS / Sleeper identity crosswalk", url: idsUrl, fetchedAt: now, dataUpdatedAt: idsResult.status === "fulfilled" ? idsResult.value.updatedAt : null, status: idsResult.status === "fulfilled" ? "ready" : "error" });
  const observations: Observation[] = [], represented = new Set<string>();
  if (statsResult.status === "fulfilled") {
    const rows = csvRecords(statsResult.value.text);
    if (!rows.length || !("game_id" in rows[0]!) || !("player_id" in rows[0]!)) throw new Error("Invalid NFL player stats");
    for (const row of rows) {
      const schedule = indexed.get(row.game_id ?? ""); if (!schedule || schedule.gameday! > date || schedule.gameday! < addDays(date, -28)) continue;
      const match = completed.get(schedule.gameday + ":" + cleanTeam(schedule.home_team!) + ":" + cleanTeam(schedule.away_team!));
      if (!match || !["QB", "RB", "WR", "TE"].includes(row.position ?? "")) continue;
      observations.push({ id: row.player_id!, providerId: providerIds.get(row.player_id!) ?? null, name: row.player_display_name || row.player_name || row.player_id!,
        position: row.position!, team: cleanTeam(row.team || row.recent_team || ""), opponent: cleanTeam(row.team || row.recent_team || "") === match.home ? match.away : match.home, date: schedule.gameday!, gameId: match.id,
        stats: footballStats(row), sourceUrl: statsUrl });
      represented.add(match.id);
    }
  } else warnings.push("Player stats have not arrived or could not refresh; final scores remain available.");
  sources.push({ name: "nflverse player stats", url: statsUrl, fetchedAt: now, dataUpdatedAt: statsResult.status === "fulfilled" ? statsResult.value.updatedAt : null, status: statsResult.status === "fulfilled" ? "ready" : "error" });
  const missingGames = [...completed.values()].filter(match => match.date >= addDays(date, -28) && !represented.has(match.id));
  const unmapped = new Set(observations.filter(row => !row.providerId).map(row => row.id)).size;
  if (unmapped) warnings.push(unmapped + " player identities could not be mapped to Sleeper; they are excluded from league pickup suggestions.");
  if (missingGames.length) warnings.push("Player stats are pending for " + missingGames.length + " completed game(s) in the recent window.");
  if (games.some(match => !match.final)) warnings.push("Unfinished games are excluded from player analysis.");
  const upcoming = schedules.filter(row => row.gameday! > date && row.gameday! <= addDays(date, 14)).map(row => ({
    id: row.game_id!, date: row.gameday!, home: cleanTeam(row.home_team!), away: cleanTeam(row.away_team!), homeScore: null, awayScore: null,
    final: false, week: numeric(row.week), sourceUrl: "https://nflreadr.nflverse.com/reference/load_schedules.html",
  }));
  warnings.push("Targets and carries are supported. Live routes, injury replacements and snap counts are not inferred.");
  const partial = sources.some(row => row.status === "error") || scoreboards.some(row => row.status === "rejected") || missingGames.length > 0 || games.some(row => !row.final);
  return editionSchema.parse({ version: 1, sport: "football", date, generatedAt: now, revision: "pending", status: partial ? "partial" : games.length ? "complete" : "no-games",
    games, upcoming, observations, sources, warnings });
}
