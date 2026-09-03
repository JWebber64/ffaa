import { describe, expect, it } from "vitest";

import { buildPlayoffBracket, calculateStandings, generateDeterministicSchedule, validateSchedule, type CompetitionTeam, type MatchupResult } from "../../shared/nativeCompetition";
import { createRedraftLeagueSettings } from "../../shared/leagueSettings";

const teams = (count: number): CompetitionTeam[] => Array.from({ length: count }, (_, index) => ({ franchiseId: `team-${index + 1}`, divisionId: `division-${Math.floor(index / 3) + 1}`, conferenceId: index < Math.ceil(count / 2) ? "east" : "west" }));

describe("native competition engines", () => {
  it("generates the same valid odd-team schedule and distributes byes", () => {
    const settings = createRedraftLeagueSettings(); settings.teamCount = 7; settings.schedule.regularSeasonWeeks = 7; settings.schedule.playoffTeams = 4;
    const first = generateDeterministicSchedule({ teams: teams(7), settings, seed: "season-seed" }); const second = generateDeterministicSchedule({ teams: teams(7), settings, seed: "season-seed" });
    expect(second).toEqual(first); expect(first.games.filter((game) => game.kind === "bye")).toHaveLength(7); expect(validateSchedule(first.games, teams(7), settings).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(new Set(first.games.filter((game) => game.kind === "bye").map((game) => game.homeFranchiseId)).size).toBe(7);
  });

  it("honors protected rivalry, scheduled bye, doubleheader, and two-week configuration", () => {
    const settings = createRedraftLeagueSettings(); settings.teamCount = 6; settings.schedule.regularSeasonWeeks = 4; settings.schedule.gamesPerWeek = 2; settings.schedule.twoWeekMatchups = true; settings.schedule.playoffTeams = 4;
    const schedule = generateDeterministicSchedule({ teams: teams(6), settings, seed: "custom", protectedMatchups: [{ week: 3, slot: 1, homeFranchiseId: "team-1", awayFranchiseId: "team-2", rivalry: true }], scheduledByes: { "team-6": [4] } });
    expect(schedule.games).toContainEqual(expect.objectContaining({ week: 3, slot: 1, homeFranchiseId: "team-1", awayFranchiseId: "team-2", kind: "rivalry" }));
    expect(schedule.games).toContainEqual(expect.objectContaining({ week: 4, homeFranchiseId: "team-6", kind: "bye" }));
    expect(schedule.games.filter((game) => game.week === 1 && game.kind !== "bye")).toHaveLength(6);
    expect(schedule.games.find((game) => game.week === 1 && game.slot === 1)?.twoWeekSeriesId).toBeTruthy();
  });

  it("rebuilds physical, median, and all-play records exactly from completed results", () => {
    const settings = createRedraftLeagueSettings(); settings.teamCount = 4; settings.schedule.regularSeasonWeeks = 1; settings.schedule.playoffTeams = 2; settings.schedule.gamesPerWeek = 2; settings.schedule.medianOpponent = true; settings.schedule.allPlay = true;
    const schedule = generateDeterministicSchedule({ teams: teams(4), settings, seed: "scores" }); const games = schedule.games.filter((game) => game.awayFranchiseId); const score = { "team-1": 120, "team-2": 110, "team-3": 100, "team-4": 90 } as Record<string, number>;
    const results: MatchupResult[] = games.map((game) => ({ gameId: game.id, week: game.week, homeFranchiseId: game.homeFranchiseId, awayFranchiseId: game.awayFranchiseId!, homeScore: score[game.homeFranchiseId]!, awayScore: score[game.awayFranchiseId!]!, homePotentialPoints: score[game.homeFranchiseId]! + 10, awayPotentialPoints: score[game.awayFranchiseId!]! + 10, status: "final" }));
    const standings = calculateStandings({ teams: teams(4), games: schedule.games, results, settings }); const leader = standings.find((row) => row.franchiseId === "team-1")!;
    expect(leader.wins).toBe(2); expect(leader.medianWins).toBe(1); expect(leader.allPlayWins).toBe(3); expect(leader.pointsFor).toBe(120); expect(leader.potentialPoints).toBe(130); expect(leader.lineupEfficiency).toBeCloseTo(120 / 130, 4); expect(standings.map((row) => row.seed)).toEqual([1, 2, 3, 4]);
  });

  it("uses the published head-to-head tiebreak and explains every seed", () => {
    const settings = createRedraftLeagueSettings(); settings.teamCount = 4; settings.schedule.regularSeasonWeeks = 1; settings.schedule.playoffTeams = 2; settings.schedule.standingsTiebreakers = ["winning_percentage", "head_to_head", "points_for"];
    const schedule = generateDeterministicSchedule({ teams: teams(4), settings, seed: "head-to-head", protectedMatchups: [{ week: 1, homeFranchiseId: "team-1", awayFranchiseId: "team-2" }] }); const games = schedule.games.filter((game) => game.awayFranchiseId); const results = games.map((game): MatchupResult => ({ gameId: game.id, week: 1, homeFranchiseId: game.homeFranchiseId, awayFranchiseId: game.awayFranchiseId!, homeScore: game.homeFranchiseId === "team-1" ? 101 : 90, awayScore: game.awayFranchiseId === "team-2" ? 100 : 80, status: "final" })); const standings = calculateStandings({ teams: teams(4), games: schedule.games, results, settings });
    expect(standings.findIndex((row) => row.franchiseId === "team-1")).toBeLessThan(standings.findIndex((row) => row.franchiseId === "team-2")); expect(standings.every((row) => row.explanation.length >= 2)).toBe(true);
  });

  it("builds a valid seven-team bracket with one bye and configurable placement formats", () => {
    const settings = createRedraftLeagueSettings(); settings.teamCount = 10; settings.schedule.playoffTeams = 7; settings.schedule.playoffRoundWeeks = 2; settings.schedule.toiletBowl = true; settings.schedule.loserAdvances = true;
    const standingRows = teams(10).map((team, index) => ({ franchiseId: team.franchiseId, seed: index + 1 })) as ReturnType<typeof calculateStandings>; const bracket = buildPlayoffBracket({ standings: standingRows, settings, startWeek: 15 });
    expect(bracket.qualifiers).toHaveLength(7); expect(bracket.byeSeeds).toEqual([1]); expect(bracket.games).toContainEqual(expect.objectContaining({ id: "championship-r1-g1", homeFranchiseId: "team-1", awayFranchiseId: null, startWeek: 15, endWeek: 16 })); expect(bracket.games.some((game) => game.bracket === "toilet" && game.loserAdvances)).toBe(true);
  });
});
