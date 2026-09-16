import { generateWeeklyAwards, type GeneratedWeeklyAward } from "../league-history/analytics/weeklyAwards";
import { optimizeLegalLineup } from "../league-history/analytics/lineupOptimizer";
import { completeRecapStarters, recapBenchAnalytics, type MatchupRecap, type RecapTeam } from "./matchupRecap";
import { playerReference, resolveRecapText, type RecapText } from "./recapPresentation";
import type { RecapWeek } from "./recapSource";

export type LeagueRecap = {
  headline: string; lead: string; paragraphs: RecapText[][];
  teams: RecapTeam[]; awards: GeneratedWeeklyAward[]; complete: boolean;
  feature: MatchupRecap | null; caveats: string[];
};

export function buildLeagueRecap(week: RecapWeek): LeagueRecap | null {
  if (week.status !== "final" || !week.recaps.length) return null;
  // Explicit byes are not zero-point competitors. Rank only recorded paired
  // results while the source completeness check still accounts for every row.
  const teams = [...new Map(week.recaps.flatMap((recap) => recap.teams).map((team) => [team.id, team])).values()];
  const ranked = [...teams].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const complete = week.leagueWeekComplete === true && teams.length === week.recaps.length * 2;
  const rosters = teams.map((team) => ({
    providerRosterId: Number(team.id), score: team.score, isComplete: true, starterComplete: completeRecapStarters(team), players: team.players,
    analytics: recapBenchAnalytics(team, week.league.roster_positions) ?? optimizeLegalLineup(team.players, week.league.roster_positions, { isComplete: false }),
  }));
  const awards = generateWeeklyAwards({ leagueExternalId: week.league.league_id, season: Number(week.league.season), week: week.week,
    leagueComplete: complete, includePositionAwards: true, rosters,
    matchups: week.recaps.map((recap) => ({ providerMatchupId: recap.id, rosterAId: Number(recap.teams[0].id), rosterBId: Number(recap.teams[1].id), scoreA: recap.teams[0].score, scoreB: recap.teams[1].score, winnerRosterId: recap.winnerId === null ? null : Number(recap.winnerId), margin: recap.margin, isComplete: true })),
  });
  const byMargin = [...week.recaps].filter((recap) => recap.winnerId !== null).sort((a, b) => a.margin - b.margin || a.id.localeCompare(b.id));
  const closest = byMargin[0];
  const widest = byMargin.at(-1);
  const feature = closest && closest.margin < 5 ? closest : week.recaps.find((recap) => recap.teams.some((team) => team.id === ranked[0]?.id)) ?? week.recaps[0]!;
  const leader = ranked[0]!;
  const sharedLead = ranked.filter((team) => team.score === leader.score);
  const headline = !complete ? "The scores are in. A few pages are still missing."
    : closest && closest.margin < 1 ? "A whole week came down to a fraction."
      : closest && closest.margin < 5 ? "Big scores. Very little breathing room."
        : sharedLead.length > 1 ? "The scoring crown has company."
          : `${leader.name} sets the scoring standard.`;
  const total = teams.reduce((sum, team) => sum + team.score, 0);
  const lead = complete
    ? `${week.league.name}, Week ${week.week}: ${week.recaps.length} matchups, ${total.toFixed(2)} combined points, and a fresh set of receipts for the group chat. ${sharedLead.map((team) => team.name).join(" and ")} ${sharedLead.length > 1 ? "share" : "takes"} the weekly scoring crown at ${leader.score.toFixed(2)}.`
    : `Available final results from ${week.league.name}, Week ${week.week}. Individual stories are ready; league-wide winners and rankings wait for every result.`;
  const paragraphs: string[] = [];
  if (complete && closest) {
    const winner = closest.teams.find((team) => team.id === closest.winnerId)!;
    const loser = closest.teams.find((team) => team.id !== closest.winnerId)!;
    paragraphs.push(`The tightest finish belonged to ${winner.name}, who edged ${loser.name} ${winner.score.toFixed(2)}–${loser.score.toFixed(2)}. The ${closest.margin.toFixed(2)}-point gap ${closest.margin < 5 ? "left almost no room for a quiet starting spot" : "was still the smallest winning cushion on the board"}. ${byMargin.filter((recap) => recap.margin === closest.margin).length > 1 ? "More than one matchup shared that closest margin." : ""}`);
  }
  if (complete && widest && widest !== closest) {
    const winner = widest.teams.find((team) => team.id === widest.winnerId)!;
    paragraphs.push(`At the other end of the scoreboard, ${winner.name} won by ${widest.margin.toFixed(2)}, the week's largest margin. ${widest.margin >= 40 ? "That one came with the volume turned up." : "It was the most breathing room anyone earned this week."} A final margin describes the result, not when the game was decided.`);
  }
  const stars = awards.filter((award) => award.awardType === "top_starting_player");
  if (stars.length) paragraphs.push(`${stars.map((award) => {
    const team = teams.find((candidate) => Number(candidate.id) === award.providerRosterId)!;
    const player = team.players.find((candidate) => candidate.providerPlayerId === award.providerPlayerId)!;
    return `${playerReference(player)} delivered ${award.numericValue.toFixed(2)} for ${team.name}${player.statLine ? ` (${player.statLine})` : ""}`;
  }).join("; ")}. ${stars.length > 1 ? "They share" : "That earns"} the weekly MVP honor. The positional honors below show who set the pace throughout the starting lineups.`);
  const regrets = awards.filter((award) => award.awardType === "bench_disaster");
  if (regrets.length) paragraphs.push(`${regrets.map((award) => `${teams.find((team) => Number(team.id) === award.providerRosterId)!.name} left a possible ${award.numericValue.toFixed(2)}-point upgrade outside the starting lineup`).join("; ")}. That is the largest position-legal improvement, not the sum of everyone's bench. These hindsight ceilings assume recorded bench players were eligible to start; they do not make the decision obvious before kickoff.`);
  const unlucky = awards.filter((award) => award.awardType === "hard_luck");
  if (unlucky.length) paragraphs.push(`${unlucky.map((award) => `${teams.find((team) => Number(team.id) === award.providerRosterId)!.name} scored ${award.numericValue.toFixed(2)} and still lost`).join("; ")}. Each outscored at least half of the other teams. A good score met the wrong opponent: the league's most expensive scheduling inconvenience.`);
  const caveats = ["Awards use this league's actual weekly scoring. Equal results share honors; every player honor uses the player's one recorded starting slot, so a FLEX start cannot also win a natural-position honor."];
  if (complete && teams.length < week.league.total_rosters) caveats.push("Teams with an explicit bye are excluded from scoring ranks and awards; the comparison covers this week's paired competitors.");
  if (!complete) caveats.push("Some league results are missing or unpaired. League-wide awards, superlatives and rankings are withheld.");
  if (teams.some((team) => !completeRecapStarters(team))) caveats.push("Some starter scores are incomplete or do not reconcile to the official total. Player honors are withheld.");
  if (rosters.some((roster) => roster.analytics.status !== "valid")) caveats.push("Complete legal-lineup evidence is unavailable for at least one team. Bench and efficiency honors are withheld.");
  return { headline, lead, paragraphs: paragraphs.map(resolveRecapText), teams: ranked, awards, complete, feature, caveats };
}
