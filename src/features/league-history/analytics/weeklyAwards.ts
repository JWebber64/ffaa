import type { LineupOptimizationResult, LineupPlayer } from "./lineupOptimizer";

export const WEEKLY_AWARD_CALCULATION_VERSION = "weekly-awards-v1";

export type WeeklyAwardType =
  | "weekly_high_score"
  | "weekly_low_score"
  | "narrow_escape"
  | "biggest_beatdown"
  | "bench_disaster"
  | "lineup_genius"
  | "top_starting_player"
  | "top_bench_player";

export interface WeeklyAwardRosterInput {
  providerRosterId: number;
  score: number;
  isComplete: boolean;
  players: LineupPlayer[];
  analytics: LineupOptimizationResult;
}

export interface WeeklyAwardMatchupInput {
  providerMatchupId: string;
  rosterAId: number;
  rosterBId: number;
  scoreA: number;
  scoreB: number;
  winnerRosterId: number | null;
  margin: number;
  isComplete: boolean;
}

export interface GeneratedWeeklyAward {
  sourceKey: string;
  awardType: WeeklyAwardType;
  title: string;
  description: string;
  week: number;
  providerRosterId: number;
  providerPlayerId: string | null;
  playerName: string;
  numericValue: number;
  sourceType: "weekly_roster_result" | "matchup";
  sourceProviderMatchupId: string | null;
  calculationVersion: typeof WEEKLY_AWARD_CALCULATION_VERSION;
}

interface Candidate {
  roster: WeeklyAwardRosterInput;
  value: number;
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function ordered(candidates: Candidate[], direction: "asc" | "desc") {
  return [...candidates].sort((left, right) => {
    const difference = direction === "asc" ? left.value - right.value : right.value - left.value;
    return difference || left.roster.providerRosterId - right.roster.providerRosterId;
  });
}

function award(
  leagueExternalId: string,
  season: number,
  week: number,
  type: WeeklyAwardType,
  rosterId: number,
  value: number,
  title: string,
  description: string,
  sourceType: GeneratedWeeklyAward["sourceType"],
  options: { player?: LineupPlayer; matchupId?: string } = {},
): GeneratedWeeklyAward {
  const playerKey = options.player ? `:${options.player.providerPlayerId}` : "";
  return {
    sourceKey: `sleeper:${leagueExternalId}:${season}:${week}:${type}:${rosterId}${playerKey}`,
    awardType: type,
    title,
    description,
    week,
    providerRosterId: rosterId,
    providerPlayerId: options.player?.providerPlayerId ?? null,
    playerName: options.player?.playerName ?? "",
    numericValue: value,
    sourceType,
    sourceProviderMatchupId: options.matchupId ?? null,
    calculationVersion: WEEKLY_AWARD_CALCULATION_VERSION,
  };
}

export function generateWeeklyAwards(input: {
  leagueExternalId: string;
  season: number;
  week: number;
  rosters: WeeklyAwardRosterInput[];
  matchups: WeeklyAwardMatchupInput[];
}): GeneratedWeeklyAward[] {
  const { leagueExternalId, season, week } = input;
  const completeRosters = input.rosters.filter((roster) => roster.isComplete && finite(roster.score));
  const rosterById = new Map(completeRosters.map((roster) => [roster.providerRosterId, roster]));
  if (!completeRosters.length) return [];
  const generated: GeneratedWeeklyAward[] = [];

  const high = ordered(completeRosters.map((roster) => ({ roster, value: roster.score })), "desc")[0];
  const low = ordered(completeRosters.map((roster) => ({ roster, value: roster.score })), "asc")[0];
  if (high) generated.push(award(leagueExternalId, season, week, "weekly_high_score", high.roster.providerRosterId, high.value, "Weekly High Score", `Led the league with ${high.value.toFixed(2)} points.`, "weekly_roster_result"));
  if (low) generated.push(award(leagueExternalId, season, week, "weekly_low_score", low.roster.providerRosterId, low.value, "Weekly Low Score", `Finished the completed week with ${low.value.toFixed(2)} points.`, "weekly_roster_result"));

  const completedMatchups = input.matchups.filter((matchup) => (
    matchup.isComplete && matchup.winnerRosterId != null && matchup.margin > 0 && rosterById.has(matchup.winnerRosterId)
  ));
  const narrow = [...completedMatchups].sort((left, right) => left.margin - right.margin || left.providerMatchupId.localeCompare(right.providerMatchupId))[0];
  const beatdown = [...completedMatchups].sort((left, right) => right.margin - left.margin || left.providerMatchupId.localeCompare(right.providerMatchupId))[0];
  if (narrow?.winnerRosterId != null) generated.push(award(leagueExternalId, season, week, "narrow_escape", narrow.winnerRosterId, narrow.margin, "Narrow Escape", `Won the closest completed matchup by ${narrow.margin.toFixed(2)} points.`, "matchup", { matchupId: narrow.providerMatchupId }));
  if (beatdown?.winnerRosterId != null) generated.push(award(leagueExternalId, season, week, "biggest_beatdown", beatdown.winnerRosterId, beatdown.margin, "Biggest Beatdown", `Won the week's largest completed margin by ${beatdown.margin.toFixed(2)} points.`, "matchup", { matchupId: beatdown.providerMatchupId }));

  const validAnalytics = completeRosters.filter((roster) => roster.analytics.status === "valid");
  const bench = ordered(validAnalytics.flatMap((roster): Candidate[] => finite(roster.analytics.pointsLeftOnBench)
    ? [{ roster, value: roster.analytics.pointsLeftOnBench! }]
    : []), "desc")[0];
  if (bench) generated.push(award(leagueExternalId, season, week, "bench_disaster", bench.roster.providerRosterId, bench.value, "Bench Disaster", `A legal optimal lineup would have added ${bench.value.toFixed(2)} points.`, "weekly_roster_result"));

  const genius = ordered(validAnalytics.flatMap((roster): Candidate[] => (
    finite(roster.analytics.lineupEfficiency) && (roster.analytics.optimalScore ?? 0) > 0 && roster.analytics.starterScore > 0
      ? [{ roster, value: roster.analytics.lineupEfficiency! }]
      : []
  )), "desc")[0];
  if (genius) generated.push(award(leagueExternalId, season, week, "lineup_genius", genius.roster.providerRosterId, genius.value, "Lineup Genius", `Used ${(genius.value * 100).toFixed(1)}% of the best legal lineup score.`, "weekly_roster_result"));

  const playerCandidates = validAnalytics.flatMap((roster) => roster.players.flatMap((player) => (
    finite(player.fantasyPoints) ? [{ roster, player, value: Number(player.fantasyPoints) }] : []
  )));
  const topPlayer = (isStarter: boolean) => [...playerCandidates]
    .filter((candidate) => candidate.player.isStarter === isStarter)
    .sort((left, right) => right.value - left.value
      || left.player.providerPlayerId.localeCompare(right.player.providerPlayerId)
      || left.roster.providerRosterId - right.roster.providerRosterId)[0];
  const topStarter = topPlayer(true);
  const topBench = topPlayer(false);
  if (topStarter) generated.push(award(leagueExternalId, season, week, "top_starting_player", topStarter.roster.providerRosterId, topStarter.value, "Top Starting Player", `${topStarter.player.playerName} scored ${topStarter.value.toFixed(2)} as a starter.`, "weekly_roster_result", { player: topStarter.player }));
  if (topBench) generated.push(award(leagueExternalId, season, week, "top_bench_player", topBench.roster.providerRosterId, topBench.value, "Top Bench Player", `${topBench.player.playerName} scored ${topBench.value.toFixed(2)} from the bench.`, "weekly_roster_result", { player: topBench.player }));

  return generated;
}
