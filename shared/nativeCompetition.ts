import type { LeagueSettingsV1 } from "./leagueSettings";

export type CompetitionTeam = { franchiseId: string; divisionId?: string; conferenceId?: string };
export type ProtectedMatchup = { week: number; slot?: number; homeFranchiseId: string; awayFranchiseId: string; rivalry?: boolean };
export type ScheduleGame = { id: string; week: number; slot: number; homeFranchiseId: string; awayFranchiseId: string | null; kind: "regular" | "rivalry" | "protected" | "bye"; twoWeekSeriesId: string; divisionGame: boolean; conferenceGame: boolean };
export type ScheduleValidationIssue = { code: string; severity: "error" | "warning"; message: string; week?: number; gameId?: string };
export type MatchupResult = { gameId: string; week: number; homeFranchiseId: string; awayFranchiseId: string; homeScore: number; awayScore: number; homePotentialPoints?: number; awayPotentialPoints?: number; status: "final" | "corrected"; correctedAt?: string; correctionReason?: string };
export type StandingRow = { franchiseId: string; seed: number; wins: number; losses: number; ties: number; winningPercentage: number; divisionWins: number; divisionLosses: number; divisionTies: number; divisionPercentage: number; medianWins: number; medianLosses: number; medianTies: number; allPlayWins: number; allPlayLosses: number; allPlayTies: number; allPlayPercentage: number; pointsFor: number; pointsAgainst: number; potentialPoints: number; lineupEfficiency: number; streak: string; remainingScheduleStrength: number; playoffProbability: number; state: "clinched" | "eliminated" | "alive"; explanation: string[] };
export type PlayoffGame = { id: string; bracket: "championship" | "consolation" | "toilet"; round: number; startWeek: number; endWeek: number; highSeed: number | null; lowSeed: number | null; homeFranchiseId: string | null; awayFranchiseId: string | null; advancesTo: string | null; loserAdvances: boolean };

function hash(value: string) { let result = 2166136261; for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0; }
function pairKey(left: string, right: string) { return [left, right].sort().join("__"); }
function rounded(value: number, digits = 4) { const power = 10 ** digits; return Math.round(value * power) / power; }

export function generateDeterministicSchedule(input: { teams: CompetitionTeam[]; settings: LeagueSettingsV1; seed: string; protectedMatchups?: ProtectedMatchup[]; scheduledByes?: Record<string, number[]> }) {
  const teams = [...input.teams].sort((left, right) => hash(`${input.seed}:${left.franchiseId}`) - hash(`${input.seed}:${right.franchiseId}`));
  const games: ScheduleGame[] = []; const pairCounts = new Map<string, number>(); const byeCounts = new Map(teams.map((team) => [team.franchiseId, 0]));
  const weeks = input.settings.schedule.regularSeasonWeeks; const gamesPerWeek = input.settings.schedule.gamesPerWeek;
  for (let week = 1; week <= weeks; week += 1) {
    const seriesWeek = input.settings.schedule.twoWeekMatchups ? Math.ceil(week / 2) : week;
    const scheduledByeIds = new Set(Object.entries(input.scheduledByes ?? {}).filter(([, byeWeeks]) => byeWeeks.includes(week)).map(([teamId]) => teamId));
    for (const teamId of scheduledByeIds) { byeCounts.set(teamId, (byeCounts.get(teamId) ?? 0) + 1); games.push({ id: `week-${week}-bye-${teamId}`, week, slot: 0, homeFranchiseId: teamId, awayFranchiseId: null, kind: "bye", twoWeekSeriesId: "", divisionGame: false, conferenceGame: false }); }
    for (let slot = 1; slot <= gamesPerWeek; slot += 1) {
      const available = new Set(teams.map((team) => team.franchiseId).filter((teamId) => !scheduledByeIds.has(teamId)));
      const protectedRows = (input.protectedMatchups ?? []).filter((row) => row.week === week && (row.slot ?? 1) === slot);
      for (const row of protectedRows) {
        if (!available.has(row.homeFranchiseId) || !available.has(row.awayFranchiseId) || row.homeFranchiseId === row.awayFranchiseId) continue;
        const home = teams.find((team) => team.franchiseId === row.homeFranchiseId)!; const away = teams.find((team) => team.franchiseId === row.awayFranchiseId)!; const key = pairKey(home.franchiseId, away.franchiseId); pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1); available.delete(home.franchiseId); available.delete(away.franchiseId);
        games.push({ id: `week-${week}-slot-${slot}-${key}`, week, slot, homeFranchiseId: home.franchiseId, awayFranchiseId: away.franchiseId, kind: row.rivalry ? "rivalry" : "protected", twoWeekSeriesId: input.settings.schedule.twoWeekMatchups ? `series-${seriesWeek}-${key}` : "", divisionGame: Boolean(home.divisionId && home.divisionId === away.divisionId), conferenceGame: Boolean(home.conferenceId && home.conferenceId === away.conferenceId) });
      }
      if (available.size % 2 === 1) {
        const byeTeamId = [...available].sort((left, right) => (byeCounts.get(left) ?? 0) - (byeCounts.get(right) ?? 0) || hash(`${input.seed}:bye:${week}:${slot}:${left}`) - hash(`${input.seed}:bye:${week}:${slot}:${right}`))[0]!;
        available.delete(byeTeamId); byeCounts.set(byeTeamId, (byeCounts.get(byeTeamId) ?? 0) + 1); games.push({ id: `week-${week}-slot-${slot}-bye-${byeTeamId}`, week, slot, homeFranchiseId: byeTeamId, awayFranchiseId: null, kind: "bye", twoWeekSeriesId: "", divisionGame: false, conferenceGame: false });
      }
      while (available.size > 1) {
        const candidatePairs: Array<{ left: CompetitionTeam; right: CompetitionTeam; rank: number[] }> = [];
        const remaining = teams.filter((team) => available.has(team.franchiseId));
        for (let leftIndex = 0; leftIndex < remaining.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < remaining.length; rightIndex += 1) {
          const left = remaining[leftIndex]!; const right = remaining[rightIndex]!; const repeats = pairCounts.get(pairKey(left.franchiseId, right.franchiseId)) ?? 0; const sameDivision = Boolean(left.divisionId && left.divisionId === right.divisionId); const sameConference = Boolean(left.conferenceId && left.conferenceId === right.conferenceId);
          const divisionPriority = input.settings.schedule.balance === "division_weighted" ? (sameDivision ? 0 : sameConference ? 1 : 2) : 0;
          const seriesPenalty = input.settings.schedule.twoWeekMatchups && week % 2 === 0 && games.some((game) => game.week === week - 1 && game.slot === slot && pairKey(game.homeFranchiseId, game.awayFranchiseId ?? "") === pairKey(left.franchiseId, right.franchiseId)) ? -10 : 0;
          candidatePairs.push({ left, right, rank: [seriesPenalty + repeats, divisionPriority, hash(`${input.seed}:${week}:${slot}:${pairKey(left.franchiseId, right.franchiseId)}`)] });
        }
        candidatePairs.sort((a, b) => a.rank[0]! - b.rank[0]! || a.rank[1]! - b.rank[1]! || a.rank[2]! - b.rank[2]!); const selected = candidatePairs[0]!; const key = pairKey(selected.left.franchiseId, selected.right.franchiseId); pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1); available.delete(selected.left.franchiseId); available.delete(selected.right.franchiseId);
        const reverse = hash(`${input.seed}:home:${week}:${slot}:${key}`) % 2 === 1; const home = reverse ? selected.right : selected.left; const away = reverse ? selected.left : selected.right;
        games.push({ id: `week-${week}-slot-${slot}-${key}`, week, slot, homeFranchiseId: home.franchiseId, awayFranchiseId: away.franchiseId, kind: "regular", twoWeekSeriesId: input.settings.schedule.twoWeekMatchups ? `series-${seriesWeek}-${key}` : "", divisionGame: Boolean(home.divisionId && home.divisionId === away.divisionId), conferenceGame: Boolean(home.conferenceId && home.conferenceId === away.conferenceId) });
      }
    }
  }
  return { games: games.sort((a, b) => a.week - b.week || a.slot - b.slot || a.id.localeCompare(b.id)), seed: input.seed, pairCounts: Object.fromEntries(pairCounts), byeCounts: Object.fromEntries(byeCounts) };
}

export function validateSchedule(games: ScheduleGame[], teams: CompetitionTeam[], settings: LeagueSettingsV1): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = [];
  const teamIds = new Set(teams.map((team) => team.franchiseId));
  const ids = new Set<string>();
  const pairWeeks = new Set<string>();
  const slotAppearances = new Set<string>();
  const appearances = new Map<string, number>();
  const divisionAppearances = new Map(teams.map((team) => [team.franchiseId, 0]));
  const byes = new Map(teams.map((team) => [team.franchiseId, 0]));
  const opponents = new Map<string, number>();
  for (const game of games) {
    if (ids.has(game.id)) issues.push({ code: "duplicate_game_id", severity: "error", message: `Game ${game.id} appears more than once.`, week: game.week, gameId: game.id }); ids.add(game.id);
    if (game.week < 1 || game.week > settings.schedule.regularSeasonWeeks) issues.push({ code: "outside_regular_season", severity: "error", message: `Game ${game.id} is outside the regular season.`, week: game.week, gameId: game.id });
    if (!teamIds.has(game.homeFranchiseId) || (game.awayFranchiseId && !teamIds.has(game.awayFranchiseId))) issues.push({ code: "missing_team", severity: "error", message: `Game ${game.id} references a missing team.`, week: game.week, gameId: game.id });
    if (game.awayFranchiseId === game.homeFranchiseId) issues.push({ code: "self_matchup", severity: "error", message: `${game.homeFranchiseId} cannot play itself.`, week: game.week, gameId: game.id });
    if (game.slot < 0 || game.slot > settings.schedule.gamesPerWeek || (game.slot === 0 && game.awayFranchiseId)) issues.push({ code: "invalid_slot", severity: "error", message: `Game ${game.id} has an invalid weekly slot.`, week: game.week, gameId: game.id });
    for (const teamId of [game.homeFranchiseId, game.awayFranchiseId].filter((value): value is string => Boolean(value))) {
      const slotKey = `${game.week}:${game.slot}:${teamId}`;
      if (slotAppearances.has(slotKey)) issues.push({ code: "team_slot_conflict", severity: "error", message: `${teamId} is assigned more than once in Week ${game.week}, slot ${game.slot}.`, week: game.week, gameId: game.id });
      slotAppearances.add(slotKey);
    }
    if (!game.awayFranchiseId) { byes.set(game.homeFranchiseId, (byes.get(game.homeFranchiseId) ?? 0) + 1); continue; }
    const weekKey = `${game.week}:${pairKey(game.homeFranchiseId, game.awayFranchiseId)}`; if (pairWeeks.has(weekKey)) issues.push({ code: "duplicate_game", severity: "error", message: `${game.homeFranchiseId} and ${game.awayFranchiseId} play twice in Week ${game.week}.`, week: game.week, gameId: game.id }); pairWeeks.add(weekKey);
    for (const id of [game.homeFranchiseId, game.awayFranchiseId]) {
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
      if (game.divisionGame) divisionAppearances.set(id, (divisionAppearances.get(id) ?? 0) + 1);
    }
    const key = pairKey(game.homeFranchiseId, game.awayFranchiseId); opponents.set(key, (opponents.get(key) ?? 0) + 1);
  }
  for (let week = 1; week <= settings.schedule.regularSeasonWeeks; week += 1) {
    for (const team of teams) {
      const weeklyRows = games.filter((game) => game.week === week && (game.homeFranchiseId === team.franchiseId || game.awayFranchiseId === team.franchiseId));
      const fullWeekBye = weeklyRows.some((game) => !game.awayFranchiseId && game.slot === 0);
      if (!weeklyRows.length) issues.push({ code: "missing_week_team", severity: "error", message: `${team.franchiseId} has neither a game nor bye in Week ${week}.`, week });
      else if (fullWeekBye && weeklyRows.length > 1) issues.push({ code: "bye_game_conflict", severity: "error", message: `${team.franchiseId} has a scheduled bye and a game in Week ${week}.`, week });
      else if (!fullWeekBye && weeklyRows.length !== settings.schedule.gamesPerWeek) issues.push({ code: "missing_week_slot", severity: "error", message: `${team.franchiseId} has ${weeklyRows.length} of ${settings.schedule.gamesPerWeek} required Week ${week} slots.`, week });
    }
  }
  const appearanceValues = teams.map((team) => appearances.get(team.franchiseId) ?? 0); if (appearanceValues.length && Math.max(...appearanceValues) - Math.min(...appearanceValues) > settings.schedule.gamesPerWeek) issues.push({ code: "uneven_game_counts", severity: "warning", message: "Teams have materially uneven regular-season game counts." });
  const byeValues = [...byes.values()]; if (byeValues.length && Math.max(...byeValues) - Math.min(...byeValues) > 1) issues.push({ code: "invalid_bye_distribution", severity: "warning", message: "Bye distribution differs by more than one game." });
  const divisionValues = [...divisionAppearances.values()]; if (settings.schedule.balance === "division_weighted" && divisionValues.length && Math.max(...divisionValues) - Math.min(...divisionValues) > 1) issues.push({ code: "uneven_division_games", severity: "warning", message: "Division game counts differ by more than one game." });
  const expectedRepeats = Math.ceil((settings.schedule.regularSeasonWeeks * settings.schedule.gamesPerWeek) / Math.max(1, teams.length - 1)); for (const [key, count] of opponents) if (count > expectedRepeats + 1) issues.push({ code: "excessive_repeat_opponent", severity: "warning", message: `${key.replace("__", " and ")} meet ${count} times.` });
  return issues;
}

export function calculateStandings(input: { teams: CompetitionTeam[]; games: ScheduleGame[]; results: MatchupResult[]; settings: LeagueSettingsV1 }): StandingRow[] {
  type Mutable = Omit<StandingRow, "seed" | "winningPercentage" | "divisionPercentage" | "allPlayPercentage" | "lineupEfficiency" | "remainingScheduleStrength" | "playoffProbability" | "state" | "explanation"> & { outcomes: string[] };
  const rows = new Map<string, Mutable>(input.teams.map((team) => [team.franchiseId, { franchiseId: team.franchiseId, wins: 0, losses: 0, ties: 0, divisionWins: 0, divisionLosses: 0, divisionTies: 0, medianWins: 0, medianLosses: 0, medianTies: 0, allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0, pointsFor: 0, pointsAgainst: 0, potentialPoints: 0, streak: "—", outcomes: [] }]));
  const gameById = new Map(input.games.map((game) => [game.id, game])); const results = input.results.filter((result) => result.status === "final" || result.status === "corrected").sort((a, b) => a.week - b.week || a.gameId.localeCompare(b.gameId)); const weeklyScores = new Map<number, Map<string, number>>(); const weeklyPotential = new Map<number, Map<string, number>>();
  for (const result of results) {
    const home = rows.get(result.homeFranchiseId); const away = rows.get(result.awayFranchiseId); if (!home || !away) continue; const game = gameById.get(result.gameId); const homeOutcome = result.homeScore === result.awayScore ? "T" : result.homeScore > result.awayScore ? "W" : "L"; const awayOutcome = homeOutcome === "T" ? "T" : homeOutcome === "W" ? "L" : "W";
    for (const [row, outcome] of [[home, homeOutcome], [away, awayOutcome]] as const) { if (outcome === "W") row.wins += 1; else if (outcome === "L") row.losses += 1; else row.ties += 1; row.outcomes.push(outcome); if (game?.divisionGame) { if (outcome === "W") row.divisionWins += 1; else if (outcome === "L") row.divisionLosses += 1; else row.divisionTies += 1; } }
    home.pointsAgainst += result.awayScore; away.pointsAgainst += result.homeScore; const scores = weeklyScores.get(result.week) ?? new Map<string, number>(); if (!scores.has(home.franchiseId)) scores.set(home.franchiseId, result.homeScore); if (!scores.has(away.franchiseId)) scores.set(away.franchiseId, result.awayScore); weeklyScores.set(result.week, scores); const potential = weeklyPotential.get(result.week) ?? new Map<string, number>(); potential.set(home.franchiseId, Math.max(potential.get(home.franchiseId) ?? 0, result.homePotentialPoints ?? result.homeScore)); potential.set(away.franchiseId, Math.max(potential.get(away.franchiseId) ?? 0, result.awayPotentialPoints ?? result.awayScore)); weeklyPotential.set(result.week, potential);
  }
  for (const [week, scores] of weeklyScores) {
    const sortedScores = [...scores.values()].sort((a, b) => a - b); const midpoint = sortedScores.length / 2; const median = sortedScores.length % 2 ? sortedScores[Math.floor(midpoint)]! : (sortedScores[midpoint - 1]! + sortedScores[midpoint]!) / 2;
    for (const [teamId, score] of scores) { const row = rows.get(teamId)!; row.pointsFor += score; row.potentialPoints += weeklyPotential.get(week)?.get(teamId) ?? score; if (score > median) row.medianWins += 1; else if (score < median) row.medianLosses += 1; else row.medianTies += 1; for (const [opponentId, opponentScore] of scores) if (opponentId !== teamId) { if (score > opponentScore) row.allPlayWins += 1; else if (score < opponentScore) row.allPlayLosses += 1; else row.allPlayTies += 1; } }
  }
  const base = [...rows.values()].map((row) => { const games = row.wins + row.losses + row.ties; const divisionGames = row.divisionWins + row.divisionLosses + row.divisionTies; const allPlayGames = row.allPlayWins + row.allPlayLosses + row.allPlayTies; const tail = row.outcomes.at(-1); let streakCount = 0; for (let index = row.outcomes.length - 1; index >= 0 && row.outcomes[index] === tail; index -= 1) streakCount += 1; return { ...row, winningPercentage: games ? (row.wins + row.ties * .5) / games : 0, divisionPercentage: divisionGames ? (row.divisionWins + row.divisionTies * .5) / divisionGames : 0, allPlayPercentage: allPlayGames ? (row.allPlayWins + row.allPlayTies * .5) / allPlayGames : 0, lineupEfficiency: row.potentialPoints ? row.pointsFor / row.potentialPoints : 0, streak: tail ? `${tail}${streakCount}` : "—" }; });
  const resultByTeams = new Map<string, { wins: number; games: number }>(); for (const result of results) { const key = pairKey(result.homeFranchiseId, result.awayFranchiseId); const value = resultByTeams.get(key) ?? { wins: 0, games: 0 }; value.games += 1; if (result.homeScore !== result.awayScore) value.wins += result.homeScore > result.awayScore ? (result.homeFranchiseId < result.awayFranchiseId ? 1 : 0) : (result.awayFranchiseId < result.homeFranchiseId ? 1 : 0); resultByTeams.set(key, value); }
  function tiebreak(row: typeof base[number], criterion: LeagueSettingsV1["schedule"]["standingsTiebreakers"][number], other?: typeof base[number]) { if (criterion === "winning_percentage") return row.winningPercentage; if (criterion === "division_percentage") return row.divisionPercentage; if (criterion === "points_for") return row.pointsFor; if (criterion === "all_play_percentage") return row.allPlayPercentage; if (criterion === "potential_points") return row.potentialPoints; if (criterion === "random_draw") return hash(row.franchiseId) / 0xffffffff; if (criterion === "head_to_head" && other) { const value = resultByTeams.get(pairKey(row.franchiseId, other.franchiseId)); if (!value?.games) return 0; const lowerWon = value.wins / value.games; return row.franchiseId < other.franchiseId ? lowerWon : 1 - lowerWon; } return 0; }
  base.sort((left, right) => { for (const criterion of input.settings.schedule.standingsTiebreakers) { const delta = tiebreak(right, criterion, left) - tiebreak(left, criterion, right); if (Math.abs(delta) > 1e-9) return delta; } return left.franchiseId.localeCompare(right.franchiseId); });
  const playedWeeks = weeklyScores.size; const completed = playedWeeks >= input.settings.schedule.regularSeasonWeeks; return base.map((row, index) => { const next = base[index + 1]; const criterion = next ? input.settings.schedule.standingsTiebreakers.find((entry) => Math.abs(tiebreak(row, entry, next) - tiebreak(next, entry, row)) > 1e-9) ?? "random_draw" : "winning_percentage"; const remainingOpponents = input.games.filter((game) => !input.results.some((result) => result.gameId === game.id) && (game.homeFranchiseId === row.franchiseId || game.awayFranchiseId === row.franchiseId)).flatMap((game) => [game.homeFranchiseId === row.franchiseId ? game.awayFranchiseId : game.homeFranchiseId]).filter((id): id is string => Boolean(id)); const strength = remainingOpponents.length ? remainingOpponents.reduce((sum, id) => sum + (base.find((entry) => entry.franchiseId === id)?.winningPercentage ?? 0), 0) / remainingOpponents.length : 0; const rankProbability = Math.max(0, Math.min(1, (input.settings.schedule.playoffTeams + 1 - (index + 1)) / Math.max(1, input.settings.schedule.playoffTeams))); return { ...row, seed: index + 1, winningPercentage: rounded(row.winningPercentage), divisionPercentage: rounded(row.divisionPercentage), allPlayPercentage: rounded(row.allPlayPercentage), pointsFor: rounded(row.pointsFor, 2), pointsAgainst: rounded(row.pointsAgainst, 2), potentialPoints: rounded(row.potentialPoints, 2), lineupEfficiency: rounded(row.lineupEfficiency), remainingScheduleStrength: rounded(strength), playoffProbability: completed ? (index < input.settings.schedule.playoffTeams ? 1 : 0) : rounded(rankProbability), state: completed ? (index < input.settings.schedule.playoffTeams ? "clinched" : "eliminated") : "alive", explanation: [`Seed ${index + 1}: ${criterion.replace(/_/gu, " ")} is the first published tiebreak that separates ${row.franchiseId}${next ? ` from ${next.franchiseId}` : " from the remaining field"}.`, `Rebuilt from ${results.length} completed matchup record${results.length === 1 ? "" : "s"} through Week ${playedWeeks || 0}.`] }; });
}

export function buildPlayoffBracket(input: { standings: StandingRow[]; settings: LeagueSettingsV1; startWeek: number; manualQualifierIds?: string[] }): { games: PlayoffGame[]; qualifiers: string[]; byeSeeds: number[] } {
  const qualifierIds = input.manualQualifierIds?.length ? input.manualQualifierIds : input.standings.slice(0, input.settings.schedule.playoffTeams).map((row) => row.franchiseId); const qualifiers = qualifierIds.slice(0, input.settings.schedule.playoffTeams); const size = 2 ** Math.ceil(Math.log2(Math.max(2, qualifiers.length))); const rounds = Math.log2(size); const byeSeeds = Array.from({ length: size - qualifiers.length }, (_, index) => index + 1); const games: PlayoffGame[] = [];
  for (let round = 1; round <= rounds; round += 1) { const count = size / (2 ** round); for (let index = 0; index < count; index += 1) { const id = `championship-r${round}-g${index + 1}`; const highSeed = round === 1 ? index + 1 : null; const lowSeed = round === 1 ? size - index : null; const startWeek = input.startWeek + (round - 1) * input.settings.schedule.playoffRoundWeeks; games.push({ id, bracket: "championship", round, startWeek, endWeek: startWeek + input.settings.schedule.playoffRoundWeeks - 1, highSeed, lowSeed, homeFranchiseId: highSeed && highSeed <= qualifiers.length ? qualifiers[highSeed - 1] ?? null : null, awayFranchiseId: lowSeed && lowSeed <= qualifiers.length ? qualifiers[lowSeed - 1] ?? null : null, advancesTo: round === rounds ? null : `championship-r${round + 1}-g${Math.floor(index / 2) + 1}`, loserAdvances: false }); } }
  if (input.settings.schedule.thirdPlaceGame && rounds > 1) { const startWeek = input.startWeek + (rounds - 1) * input.settings.schedule.playoffRoundWeeks; games.push({ id: "championship-third-place", bracket: "championship", round: rounds, startWeek, endWeek: startWeek + input.settings.schedule.playoffRoundWeeks - 1, highSeed: null, lowSeed: null, homeFranchiseId: null, awayFranchiseId: null, advancesTo: null, loserAdvances: false }); }
  if (input.settings.schedule.consolationBracket || input.settings.schedule.toiletBowl) { const bracket = input.settings.schedule.toiletBowl ? "toilet" : "consolation"; const nonQualifiers = input.standings.filter((row) => !qualifiers.includes(row.franchiseId)); for (let index = 0; index + 1 < nonQualifiers.length; index += 2) games.push({ id: `${bracket}-r1-g${index / 2 + 1}`, bracket, round: 1, startWeek: input.startWeek, endWeek: input.startWeek + input.settings.schedule.playoffRoundWeeks - 1, highSeed: nonQualifiers[index]!.seed, lowSeed: nonQualifiers[index + 1]!.seed, homeFranchiseId: nonQualifiers[index]!.franchiseId, awayFranchiseId: nonQualifiers[index + 1]!.franchiseId, advancesTo: null, loserAdvances: bracket === "toilet" && input.settings.schedule.loserAdvances }); }
  return { games, qualifiers, byeSeeds };
}
