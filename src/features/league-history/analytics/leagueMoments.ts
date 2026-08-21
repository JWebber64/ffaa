import type { LineupPlayer } from "./lineupOptimizer";

export const LEAGUE_MOMENT_CALCULATION_VERSION = "league-moments-v1";

export type GeneratedMomentType =
  | "weekly_team_score_record"
  | "largest_victory_record"
  | "closest_game_record"
  | "highest_scoring_loss_record"
  | "individual_50_point_performance"
  | "team_200_point_performance"
  | "longest_winning_streak_record"
  | "longest_losing_streak_record"
  | "championship_result"
  | "first_championship"
  | "repeat_championship"
  | "back_to_back_championship"
  | "historic_bench_performance"
  | "manager_career_win_milestone";

export interface MomentFranchiseInput {
  providerRosterId: number;
  teamName: string;
  manager: { providerUserId: string; displayName: string } | null;
}

export interface MomentWeeklyResultInput {
  week: number;
  providerRosterId: number;
  score: number;
  isComplete: boolean;
  players: LineupPlayer[];
  analyticsStatus: "valid" | "incomplete" | "unsupported";
}

export interface MomentMatchupInput {
  week: number;
  providerMatchupId: string;
  rosterAId: number;
  rosterBId: number;
  scoreA: number;
  scoreB: number;
  winnerRosterId: number | null;
  margin: number;
  isComplete: boolean;
  isChampionship: boolean;
}

export interface MomentSeasonInput {
  externalLeagueId: string;
  season: number;
  franchises: MomentFranchiseInput[];
  weeklyResults: MomentWeeklyResultInput[];
  matchups: MomentMatchupInput[];
}

export interface GeneratedLeagueMoment {
  sourceKey: string;
  momentType: GeneratedMomentType;
  title: string;
  description: string;
  season: number;
  week: number | null;
  providerRosterIds: number[];
  providerPlayerId: string | null;
  playerName: string;
  sourceType: "weekly_roster_result" | "matchup" | "season";
  sourceProviderMatchupId: string | null;
  previousValue: number | null;
  newValue: number | null;
  calculationVersion: typeof LEAGUE_MOMENT_CALCULATION_VERSION;
}

interface MomentOptions {
  rosterIds?: number[];
  player?: LineupPlayer;
  sourceType?: GeneratedLeagueMoment["sourceType"];
  matchupId?: string;
  previousValue?: number | null;
  newValue?: number | null;
  detailKey?: string;
}

function generatedMoment(
  season: MomentSeasonInput,
  week: number | null,
  type: GeneratedMomentType,
  title: string,
  description: string,
  options: MomentOptions = {},
): GeneratedLeagueMoment {
  const rosterIds = options.rosterIds ?? [];
  const detailKey = options.detailKey || options.player?.providerPlayerId || rosterIds.join("-") || "league";
  return {
    sourceKey: `sleeper:${season.externalLeagueId}:${season.season}:${week ?? "season"}:${type}:${detailKey}`,
    momentType: type,
    title,
    description,
    season: season.season,
    week,
    providerRosterIds: rosterIds,
    providerPlayerId: options.player?.providerPlayerId ?? null,
    playerName: options.player?.playerName ?? "",
    sourceType: options.sourceType ?? "matchup",
    sourceProviderMatchupId: options.matchupId ?? null,
    previousValue: options.previousValue ?? null,
    newValue: options.newValue ?? null,
    calculationVersion: LEAGUE_MOMENT_CALCULATION_VERSION,
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function seasonOrder(left: MomentSeasonInput, right: MomentSeasonInput) {
  return left.season - right.season;
}

function managerKey(season: MomentSeasonInput, rosterId: number) {
  return season.franchises.find((franchise) => franchise.providerRosterId === rosterId)?.manager?.providerUserId ?? "";
}

function managerName(season: MomentSeasonInput, rosterId: number) {
  const franchise = season.franchises.find((row) => row.providerRosterId === rosterId);
  return franchise?.manager?.displayName || franchise?.teamName || `Roster ${rosterId}`;
}

function teamName(season: MomentSeasonInput, rosterId: number) {
  return season.franchises.find((row) => row.providerRosterId === rosterId)?.teamName || managerName(season, rosterId);
}

export function generateLeagueMoments(seasonInputs: MomentSeasonInput[]): GeneratedLeagueMoment[] {
  const seasons = [...seasonInputs].sort(seasonOrder);
  const moments: GeneratedLeagueMoment[] = [];
  let weeklyScoreRecord: number | null = null;
  let largestVictory: number | null = null;
  let closestGame: number | null = null;
  let highestScoringLoss: number | null = null;
  let longestWinningStreak = 0;
  let longestLosingStreak = 0;
  const streaks = new Map<string, { wins: number; losses: number }>();
  const careerWins = new Map<string, number>();
  const championships = new Map<string, number[]>();
  const winMilestones = new Set([25, 50, 75, 100]);

  for (const season of seasons) {
    const completedWeeklyResults = season.weeklyResults
      .filter((result) => result.isComplete && result.analyticsStatus === "valid")
      .sort((left, right) => left.week - right.week || left.providerRosterId - right.providerRosterId);
    for (const result of completedWeeklyResults) {
      if (weeklyScoreRecord != null && result.score > weeklyScoreRecord) {
        moments.push(generatedMoment(
          season,
          result.week,
          "weekly_team_score_record",
          "New all-time weekly team-score record",
          `${teamName(season, result.providerRosterId)} scored ${result.score.toFixed(2)}, passing the previous record of ${weeklyScoreRecord.toFixed(2)}.`,
          { rosterIds: [result.providerRosterId], sourceType: "weekly_roster_result", previousValue: weeklyScoreRecord, newValue: result.score },
        ));
      }
      weeklyScoreRecord = weeklyScoreRecord == null ? result.score : Math.max(weeklyScoreRecord, result.score);
      if (result.score >= 200) {
        moments.push(generatedMoment(
          season,
          result.week,
          "team_200_point_performance",
          "200-point team performance",
          `${teamName(season, result.providerRosterId)} scored ${result.score.toFixed(2)} points.`,
          { rosterIds: [result.providerRosterId], sourceType: "weekly_roster_result", newValue: result.score },
        ));
      }
      for (const player of result.players.filter((row) => Number.isFinite(row.fantasyPoints))) {
        const points = Number(player.fantasyPoints);
        if (points >= 50) {
          moments.push(generatedMoment(
            season,
            result.week,
            "individual_50_point_performance",
            "50-point individual performance",
            `${player.playerName} scored ${points.toFixed(2)} points for ${teamName(season, result.providerRosterId)}.`,
            { rosterIds: [result.providerRosterId], player, sourceType: "weekly_roster_result", newValue: points },
          ));
        }
        if (!player.isStarter && points >= 35) {
          moments.push(generatedMoment(
            season,
            result.week,
            "historic_bench_performance",
            "Historic bench performance",
            `${player.playerName} scored ${points.toFixed(2)} points from the bench for ${teamName(season, result.providerRosterId)}.`,
            { rosterIds: [result.providerRosterId], player, sourceType: "weekly_roster_result", newValue: points },
          ));
        }
      }
    }

    const matchups = season.matchups
      .filter((matchup) => matchup.isComplete)
      .sort((left, right) => left.week - right.week || left.providerMatchupId.localeCompare(right.providerMatchupId));
    for (const matchup of matchups) {
      const loserRosterId = matchup.winnerRosterId == null
        ? null
        : matchup.winnerRosterId === matchup.rosterAId ? matchup.rosterBId : matchup.rosterAId;
      const loserScore = loserRosterId == null
        ? null
        : loserRosterId === matchup.rosterAId ? matchup.scoreA : matchup.scoreB;
      if (largestVictory != null && matchup.margin > largestVictory) {
        moments.push(generatedMoment(
          season,
          matchup.week,
          "largest_victory_record",
          "New largest victory record",
          `${managerName(season, matchup.winnerRosterId!)} won by ${matchup.margin.toFixed(2)}, passing the previous record of ${largestVictory.toFixed(2)}.`,
          { rosterIds: [matchup.winnerRosterId!], matchupId: matchup.providerMatchupId, previousValue: largestVictory, newValue: matchup.margin },
        ));
      }
      if (matchup.margin > 0) largestVictory = largestVictory == null ? matchup.margin : Math.max(largestVictory, matchup.margin);
      if (matchup.margin > 0 && closestGame != null && matchup.margin < closestGame) {
        moments.push(generatedMoment(
          season,
          matchup.week,
          "closest_game_record",
          "New closest-game record",
          `The matchup was decided by ${matchup.margin.toFixed(2)} points, below the previous record of ${closestGame.toFixed(2)}.`,
          { rosterIds: [matchup.rosterAId, matchup.rosterBId], matchupId: matchup.providerMatchupId, previousValue: closestGame, newValue: matchup.margin },
        ));
      }
      if (matchup.margin > 0) closestGame = closestGame == null ? matchup.margin : Math.min(closestGame, matchup.margin);
      if (loserScore != null && highestScoringLoss != null && loserScore > highestScoringLoss) {
        moments.push(generatedMoment(
          season,
          matchup.week,
          "highest_scoring_loss_record",
          "New highest-scoring losing performance",
          `${teamName(season, loserRosterId!)} scored ${loserScore.toFixed(2)} in a loss, passing the previous record of ${highestScoringLoss.toFixed(2)}.`,
          { rosterIds: [loserRosterId!], matchupId: matchup.providerMatchupId, previousValue: highestScoringLoss, newValue: loserScore },
        ));
      }
      if (loserScore != null) highestScoringLoss = highestScoringLoss == null ? loserScore : Math.max(highestScoringLoss, loserScore);

      for (const rosterId of [matchup.rosterAId, matchup.rosterBId]) {
        const key = managerKey(season, rosterId);
        if (!key) continue;
        const state = streaks.get(key) ?? { wins: 0, losses: 0 };
        if (matchup.winnerRosterId === rosterId) {
          state.wins += 1;
          state.losses = 0;
          const wins = (careerWins.get(key) ?? 0) + 1;
          careerWins.set(key, wins);
          if (state.wins > longestWinningStreak) {
            if (longestWinningStreak > 0) moments.push(generatedMoment(
              season,
              matchup.week,
              "longest_winning_streak_record",
              "New longest winning streak",
              `${managerName(season, rosterId)} reached ${state.wins} consecutive wins.`,
              { rosterIds: [rosterId], matchupId: matchup.providerMatchupId, previousValue: longestWinningStreak, newValue: state.wins, detailKey: `${key}:${state.wins}` },
            ));
            longestWinningStreak = state.wins;
          }
          if (winMilestones.has(wins)) moments.push(generatedMoment(
            season,
            matchup.week,
            "manager_career_win_milestone",
            `${wins} career wins`,
            `${managerName(season, rosterId)} recorded career win number ${wins}.`,
            { rosterIds: [rosterId], matchupId: matchup.providerMatchupId, newValue: wins, detailKey: `${key}:${wins}` },
          ));
        } else if (matchup.winnerRosterId == null) {
          state.wins = 0;
          state.losses = 0;
        } else {
          state.losses += 1;
          state.wins = 0;
          if (state.losses > longestLosingStreak) {
            if (longestLosingStreak > 0) moments.push(generatedMoment(
              season,
              matchup.week,
              "longest_losing_streak_record",
              "New longest losing streak",
              `${managerName(season, rosterId)} reached ${state.losses} consecutive losses.`,
              { rosterIds: [rosterId], matchupId: matchup.providerMatchupId, previousValue: longestLosingStreak, newValue: state.losses, detailKey: `${key}:${state.losses}` },
            ));
            longestLosingStreak = state.losses;
          }
        }
        streaks.set(key, state);
      }

      if (matchup.isChampionship && matchup.winnerRosterId != null) {
        const winnerId = matchup.winnerRosterId;
        const key = managerKey(season, winnerId);
        moments.push(generatedMoment(
          season,
          matchup.week,
          "championship_result",
          `${season.season} championship result`,
          `${managerName(season, winnerId)} won the ${season.season} championship.`,
          { rosterIds: [winnerId], matchupId: matchup.providerMatchupId, detailKey: `${winnerId}:champion` },
        ));
        if (key) {
          const titleSeasons = championships.get(key) ?? [];
          if (!titleSeasons.length) {
            moments.push(generatedMoment(
              season,
              matchup.week,
              "first_championship",
              "First championship",
              `${managerName(season, winnerId)} won a first recorded league championship.`,
              { rosterIds: [winnerId], matchupId: matchup.providerMatchupId, detailKey: key },
            ));
          } else {
            moments.push(generatedMoment(
              season,
              matchup.week,
              "repeat_championship",
              "Repeat championship",
              `${managerName(season, winnerId)} won championship number ${titleSeasons.length + 1}.`,
              { rosterIds: [winnerId], matchupId: matchup.providerMatchupId, newValue: titleSeasons.length + 1, detailKey: `${key}:${titleSeasons.length + 1}` },
            ));
            if (titleSeasons.at(-1) === season.season - 1) moments.push(generatedMoment(
              season,
              matchup.week,
              "back_to_back_championship",
              "Back-to-back championships",
              `${managerName(season, winnerId)} won consecutive championships in ${season.season - 1} and ${season.season}.`,
              { rosterIds: [winnerId], matchupId: matchup.providerMatchupId, detailKey: `${key}:${season.season - 1}-${season.season}` },
            ));
          }
          championships.set(key, [...titleSeasons, season.season]);
        }
      }
    }
  }
  return moments.map((moment) => ({
    ...moment,
    previousValue: moment.previousValue == null ? null : round(moment.previousValue),
    newValue: moment.newValue == null ? null : round(moment.newValue),
  }));
}
