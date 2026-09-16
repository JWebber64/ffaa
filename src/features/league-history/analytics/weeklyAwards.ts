import type { LineupOptimizationResult, LineupPlayer } from "./lineupOptimizer";
import { positionColorKey } from "../../../ui/positionColors";

export const WEEKLY_AWARD_CALCULATION_VERSION = "weekly-awards-v3";

export type WeeklyAwardType =
  | "weekly_high_score"
  | "weekly_low_score"
  | "narrow_escape"
  | "biggest_beatdown"
  | "bench_disaster"
  | "lineup_genius"
  | "top_starting_player"
  | "top_bench_player"
  | "top_position_player"
  | "top_flex_player"
  | "hard_luck";

export interface WeeklyAwardRosterInput {
  providerRosterId: number;
  score: number;
  isComplete: boolean;
  starterComplete?: boolean;
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
  calculationVersion: typeof WEEKLY_AWARD_CALCULATION_VERSION | "weekly-awards-v1" | "weekly-awards-v2";
  position?: string;
}

interface Candidate {
  roster: WeeklyAwardRosterInput;
  value: number;
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedPosition(value: string | undefined) {
  return (positionColorKey(value) ?? value?.trim().toUpperCase() ?? "").toUpperCase();
}

function startedInNaturalPosition(player: LineupPlayer) {
  const position = normalizedPosition(player.position);
  const slot = normalizedPosition(player.lineupSlot);
  return Boolean(slot) && slot === position && positionColorKey(player.lineupSlot) !== "flex";
}

function winners<T>(candidates: T[], value: (candidate: T) => number, direction: "asc" | "desc" = "desc") {
  if (!candidates.length) return [];
  const best = candidates.reduce((current, candidate) => direction === "asc" ? Math.min(current, value(candidate)) : Math.max(current, value(candidate)), value(candidates[0]!));
  return candidates.filter((candidate) => Math.abs(value(candidate) - best) < 1e-8);
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
  options: { player?: LineupPlayer; matchupId?: string; position?: string } = {},
): GeneratedWeeklyAward {
  const playerKey = options.player ? `:${options.player.providerPlayerId}` : "";
  return {
    sourceKey: `sleeper:${leagueExternalId}:${season}:${week}:${type}:${rosterId}${playerKey}${options.position ? `:${options.position}` : ""}`,
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
    ...(options.position ? { position: options.position } : {}),
  };
}

export function generateWeeklyAwards(input: {
  leagueExternalId: string;
  season: number;
  week: number;
  rosters: WeeklyAwardRosterInput[];
  matchups: WeeklyAwardMatchupInput[];
  /** Live editions know whether every league result was supplied. */
  leagueComplete?: boolean;
  includePositionAwards?: boolean;
}): GeneratedWeeklyAward[] {
  const { leagueExternalId, season, week } = input;
  const completeRosters = input.rosters.filter((roster) => roster.isComplete && finite(roster.score));
  const rosterById = new Map(completeRosters.map((roster) => [roster.providerRosterId, roster]));
  if (!completeRosters.length || input.leagueComplete === false || rosterById.size !== completeRosters.length) return [];
  const generated: GeneratedWeeklyAward[] = [];
  const scores = completeRosters.map((roster) => ({ roster, value: roster.score }));
  for (const high of winners(scores, (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "weekly_high_score", high.roster.providerRosterId, high.value, "Weekly High Score", `Led the league with ${high.value.toFixed(2)} points.`, "weekly_roster_result"));
  for (const low of winners(scores, (candidate) => candidate.value, "asc")) generated.push(award(leagueExternalId, season, week, "weekly_low_score", low.roster.providerRosterId, low.value, "Weekly Low Score", `Finished the completed week with ${low.value.toFixed(2)} points.`, "weekly_roster_result"));

  const completedMatchups = input.matchups.filter((matchup) => (
    matchup.isComplete && matchup.winnerRosterId != null && matchup.margin > 0 && rosterById.has(matchup.rosterAId) && rosterById.has(matchup.rosterBId)
  ));
  for (const narrow of winners(completedMatchups, (matchup) => matchup.margin, "asc")) generated.push(award(leagueExternalId, season, week, "narrow_escape", narrow.winnerRosterId!, narrow.margin, "Narrow Escape", `Won the closest completed matchup by ${narrow.margin.toFixed(2)} points.`, "matchup", { matchupId: narrow.providerMatchupId }));
  for (const beatdown of winners(completedMatchups, (matchup) => matchup.margin)) generated.push(award(leagueExternalId, season, week, "biggest_beatdown", beatdown.winnerRosterId!, beatdown.margin, "Biggest Beatdown", `Won the week's largest completed margin by ${beatdown.margin.toFixed(2)} points.`, "matchup", { matchupId: beatdown.providerMatchupId }));

  const unlucky = completedMatchups.flatMap((matchup) => {
    const loser = rosterById.get(matchup.winnerRosterId === matchup.rosterAId ? matchup.rosterBId : matchup.rosterAId)!;
    const beaten = completeRosters.filter((roster) => roster.providerRosterId !== loser.providerRosterId && roster.score < loser.score).length;
    return beaten >= Math.ceil((completeRosters.length - 1) / 2) ? [{ roster: loser, value: loser.score, beaten, matchup }] : [];
  });
  for (const candidate of winners(unlucky, (row) => row.value)) generated.push(award(leagueExternalId, season, week, "hard_luck", candidate.roster.providerRosterId, candidate.value, "Wrong Week, Wrong Opponent", `Lost despite outscoring ${candidate.beaten} of the other ${completeRosters.length - 1} teams.`, "matchup", { matchupId: candidate.matchup.providerMatchupId }));

  const validAnalytics = completeRosters.filter((roster) => roster.analytics.status === "valid" && Math.abs(roster.analytics.starterScore - roster.score) <= 0.02);
  const fullAnalytics = input.leagueComplete === undefined || validAnalytics.length === completeRosters.length;
  const benchCandidates = validAnalytics.flatMap((roster): Candidate[] => finite(roster.analytics.pointsLeftOnBench)
    ? [{ roster, value: roster.analytics.pointsLeftOnBench! }]
    : []);
  if (fullAnalytics) for (const bench of winners(benchCandidates, (candidate) => candidate.value).filter((candidate) => candidate.value > 0)) generated.push(award(leagueExternalId, season, week, "bench_disaster", bench.roster.providerRosterId, bench.value, "Bench Disaster", `A position-legal optimal lineup would have added ${bench.value.toFixed(2)} points, if recorded bench players were available to start.`, "weekly_roster_result"));

  const geniusCandidates = validAnalytics.flatMap((roster): Candidate[] => (
    finite(roster.analytics.lineupEfficiency) && (roster.analytics.optimalScore ?? 0) > 0 && roster.analytics.starterScore > 0
      ? [{ roster, value: roster.analytics.lineupEfficiency! }]
      : []
  ));
  if (fullAnalytics) for (const genius of winners(geniusCandidates, (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "lineup_genius", genius.roster.providerRosterId, genius.value, "Lineup Genius", `Used ${(genius.value * 100).toFixed(1)}% of the best position-legal lineup score; historical bench availability is not verified.`, "weekly_roster_result"));

  const starterEvidence = completeRosters.every((roster) => {
    const starters = roster.players.filter((player) => player.isStarter);
    return roster.starterComplete !== false && starters.length > 0 && starters.every((player) => finite(player.fantasyPoints)) && Math.abs(starters.reduce((sum, player) => sum + player.fantasyPoints!, 0) - roster.score) <= 0.02;
  });
  const playerCandidates = completeRosters.flatMap((roster) => roster.players.flatMap((player) => (
    finite(player.fantasyPoints) ? [{ roster, player, value: Number(player.fantasyPoints) }] : []
  )));
  const starters = playerCandidates.filter((candidate) => candidate.player.isStarter);
  if (starterEvidence || input.leagueComplete === undefined) {
    for (const top of winners(starters, (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "top_starting_player", top.roster.providerRosterId, top.value, "Top Starting Player", `${top.player.playerName} scored ${top.value.toFixed(2)} as a starter.`, "weekly_roster_result", { player: top.player }));
    const recordedSlotEvidence = starters.every((candidate) => Boolean(candidate.player.lineupSlot));
    if (input.includePositionAwards && recordedSlotEvidence) {
      // A player's natural eligibility is not the same as the slot they
      // occupied. A TE/RB/WR in FLEX belongs to the FLEX honor only.
      const naturalStarters = starters.filter((candidate) => startedInNaturalPosition(candidate.player));
      const positions = [...new Set(naturalStarters.map((candidate) => normalizedPosition(candidate.player.position)))].filter(Boolean);
      for (const position of positions) {
        const eligible = naturalStarters.filter((candidate) => normalizedPosition(candidate.player.position) === position);
        for (const top of winners(eligible, (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "top_position_player", top.roster.providerRosterId, top.value, `${position} of the Week`, `Highest-scoring starting ${position}: ${top.value.toFixed(2)} points.`, "weekly_roster_result", { player: top.player, position }));
      }
      if (starters.every((candidate) => candidate.player.lineupSlot)) {
        const flexSlots = [...new Set(starters.map((candidate) => candidate.player.lineupSlot!))].filter((slot) => positionColorKey(slot) === "flex" || slot === "WR/RB");
        for (const position of flexSlots) for (const top of winners(starters.filter((candidate) => candidate.player.lineupSlot === position), (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "top_flex_player", top.roster.providerRosterId, top.value, `${position} of the Week`, `Scored ${top.value.toFixed(2)} from the recorded ${position} slot. A separate slot honor, not additional team points.`, "weekly_roster_result", { player: top.player, position }));
      }
    }
  }
  if (fullAnalytics) for (const top of winners(playerCandidates.filter((candidate) => !candidate.player.isStarter), (candidate) => candidate.value)) generated.push(award(leagueExternalId, season, week, "top_bench_player", top.roster.providerRosterId, top.value, "Top Bench Player", `${top.player.playerName} scored ${top.value.toFixed(2)} from the recorded bench.`, "weekly_roster_result", { player: top.player }));
  return generated.sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
}
