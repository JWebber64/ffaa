import { optimizeLegalLineup, type LineupPlayer } from "../league-history/analytics/lineupOptimizer";
import { positionColorKey } from "../../ui/positionColors";

export const RECAP_VERSION = "matchup-recap-v1";

export interface RecapPlayer extends LineupPlayer {
  statLine?: string | undefined;
}

export interface RecapTeam {
  id: string;
  name: string;
  managerIds: string[];
  score: number;
  players: RecapPlayer[];
  lineupComplete: boolean;
  record?: string;
  benchEligibilityKnown?: boolean;
}

export interface RecapMatchup {
  id: string;
  leagueName: string;
  season: number;
  week: number;
  status: "final" | "pending";
  teams: [RecapTeam, RecapTeam];
  rosterPositions: string[];
  weekScores: Array<{ id: string; score: number }>;
  leagueWeekComplete: boolean;
  sourceUrl: string;
  updatedAt: string;
}

export interface MatchupRecap {
  id: string;
  version: string;
  season: number;
  week: number;
  leagueName: string;
  headline: string;
  label: string;
  lead: string;
  margin: number;
  teams: [RecapTeam, RecapTeam];
  winnerId: string | null;
  spotlight: { player: RecapPlayer; teamName: string } | null;
  positions: Array<{ position: string; left: number; right: number }>;
  sections: Array<{ id: string; title: string; paragraphs: string[] }>;
  caveats: string[];
  sourceUrl: string;
  updatedAt: string;
  wordCount: number;
}

const points = (value: number) => value.toFixed(2);
const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const normalizePositionLabel = (position: string) => (positionColorKey(position) ?? position).toUpperCase();
const scored = (player: RecapPlayer) => player.fantasyPoints !== null && Number.isFinite(player.fantasyPoints);

function starters(team: RecapTeam) {
  return team.players.filter((player) => player.isStarter && scored(player))
    .sort((a, b) => b.fantasyPoints! - a.fantasyPoints! || a.providerPlayerId.localeCompare(b.providerPlayerId));
}

function completeStarters(team: RecapTeam) {
  const starting = team.players.filter((player) => player.isStarter);
  return team.lineupComplete && starting.length > 0 && starting.every(scored)
    && Math.abs(starting.reduce((sum, player) => sum + player.fantasyPoints!, 0) - team.score) <= 0.02;
}

function performanceParagraph(team: RecapTeam) {
  const players = starters(team);
  const best = players[0];
  if (!best) return `${team.name} posted ${points(team.score)} points. Individual starter scores are missing from this week's source, so the team result is the available story for now.`;
  const named = players.slice(1, 3);
  const topSum = rounded([best, ...named].reduce((sum, player) => sum + player.fantasyPoints!, 0));
  const share = completeStarters(team) && team.score > 0 && topSum > 0 && topSum <= team.score ? `—${Math.round(topSum / team.score * 100)}% of the team's score` : "";
  const line = best.statLine ? ` The NFL stat line: ${best.statLine}.` : "";
  const support = named.length
    ? ` ${named.map((player) => `${player.playerName} (${points(player.fantasyPoints!)})`).join(" and ")} supplied the supporting cast. Those ${named.length + 1} starters combined for ${points(topSum)} points${share}.`
    : "";
  const depth = players.slice(3);
  const depthScore = rounded(depth.reduce((sum, player) => sum + player.fantasyPoints!, 0));
  const depthStory = depth.length && completeStarters(team)
    ? ` Beyond the headliners, the other ${depth.length} starters supplied ${points(depthScore)} points. ${depth.slice(0, 2).map((player) => `${player.playerName} added ${points(player.fantasyPoints!)}`).join(" and ")}${depth.length > 2 ? ", keeping the score moving outside the top three" : ""}.`
    : "";
  const zeroes = players.filter((player) => player.fantasyPoints === 0);
  const low = players.at(-1);
  const finish = zeroes.length
    ? ` ${zeroes.map((player) => player.playerName).join(" and ")} finished on zero; ${zeroes.length === 1 ? "that starting spot" : "those starting spots"} left the rest of the lineup doing the heavy lifting.`
    : low && low !== best && low.fantasyPoints! < 5
      ? ` At the other end, ${low.playerName}'s ${points(low.fantasyPoints!)} points made that spot a quiet corner of the box score.`
      : "";
  return `${best.playerName} set the pace for ${team.name} with ${points(best.fantasyPoints!)} points.${line}${support}${depthStory}${finish}`;
}

function benchParagraph(team: RecapTeam, opponent: RecapTeam, slots: string[]) {
  if (!team.lineupComplete || !team.players.every(scored)) {
    return `${team.name}'s bench verdict is on hold: the recorded roster or individual scores are incomplete. Missing points are not treated as zero, and today's roster is not used to rewrite last week's decisions.`;
  }
  // Matchup overrides are kept in the official result. Do not call a player-only
  // optimization an alternative official result when it cannot reconcile.
  const analytics = optimizeLegalLineup(team.players, slots, { isComplete: true });
  if (analytics.status !== "valid" || !analytics.actualAssignments.length) {
    return `${team.name}'s recorded lineup cannot be fully evaluated under the stored roster slots. The final score stands; a bench-swap verdict needs a complete, supported legal lineup.`;
  }
  if (Math.abs(analytics.starterScore - team.score) > 0.02) {
    return `${team.name}'s official ${points(team.score)} differs from the ${points(analytics.starterScore)} total of recorded starters. A scoring adjustment or source difference may explain the gap, so no hypothetical win is claimed from this box score.`;
  }
  const gain = analytics.pointsLeftOnBench ?? 0;
  if (gain <= 0) {
    return `${team.name} squeezed every available point out of the recorded roster: the best legal lineup also scored ${points(analytics.optimalScore!)}. The bench supplied no scoring upgrade. The Monday-morning coaching department can take this one off.`;
  }
  const swap = analytics.bestMissedSubstitution;
  const swapSentence = swap
    ? ` The best one-player change was ${swap.incomingPlayerName} (${points(swap.incomingPoints)}) for ${swap.outgoingPlayerName} (${points(swap.outgoingPoints)}), worth ${points(swap.gain)} extra points with any necessary flex rearrangement.`
    : "";
  const hypothetical = swap ? rounded(team.score + swap.gain) : null;
  const lost = team.score < opponent.score;
  const verdict = lost && hypothetical !== null && hypothetical > opponent.score
    ? ` That single change would have flipped the score to ${points(hypothetical)}–${points(opponent.score)}. The bench had a winning answer.`
    : lost && hypothetical === opponent.score
      ? ` That change would have tied the score at ${points(opponent.score)}; it would not have produced an outright win.`
      : lost && analytics.optimalScore! > opponent.score
        ? " A combination of legal changes could have overturned the result, but no single substitution was enough."
        : lost && analytics.optimalScore === opponent.score
          ? " Even the best legal lineup would only have tied the opponent's actual score."
          : lost
            ? ` Even the best legal lineup would still have finished ${points(opponent.score - analytics.optimalScore!)} points behind. This loss cannot be pinned on the bench.`
            : team.score === opponent.score
              ? " That extra scoring could have broken the tie."
              : " There was room for a bigger score, even with the result already secured.";
  const eligibility = team.benchEligibilityKnown ? "" : "If all recorded bench players were available to start, ";
  return `${eligibility}${team.name} could have gained ${points(gain)} points; its highest-scoring position-legal lineup reached ${points(analytics.optimalScore!)}.${swapSentence}${verdict}`;
}

function leagueParagraph(team: RecapTeam, opponent: RecapTeam, matchup: RecapMatchup) {
  const otherScores = matchup.weekScores.filter((row) => row.id !== team.id);
  if (!matchup.leagueWeekComplete || !otherScores.length) return "League-wide scoring ranks are unavailable: a full set of scored matchups is not recorded for this week.";
  const above = otherScores.filter((row) => row.score > team.score).length;
  const tied = otherScores.filter((row) => row.score === team.score).length;
  const beaten = otherScores.filter((row) => team.score > row.score).length;
  const rank = `${tied ? "joint " : ""}#${above + 1} of ${otherScores.length + 1}`;
  const result = team.score < opponent.score && beaten >= Math.ceil(otherScores.length / 2)
    ? " A strong score ran into an even stronger opponent: an awkward week for the schedule to choose violence."
    : team.score > opponent.score && above >= Math.ceil(otherScores.length / 2)
      ? " The schedule offered a little breathing room this time, and the win counts all the same."
      : above === 0 && tied === 0
        ? " Nobody in the league put up more. This was the week's scoring standard."
        : "";
  return `${team.name} ranked ${rank} in weekly scoring. Against every other team's score, it would have gone ${beaten}–${above}${tied ? `–${tied}` : ""}.${result}`;
}

export function buildMatchupRecap(matchup: RecapMatchup): MatchupRecap | null {
  if (matchup.status !== "final" || matchup.teams.some((team) => !Number.isFinite(team.score))) return null;
  const [left, right] = matchup.teams;
  const margin = rounded(Math.abs(left.score - right.score));
  const tied = left.score === right.score;
  const winner = left.score >= right.score ? left : right;
  const loser = winner.id === left.id ? right : left;
  const best = starters(winner)[0];
  const label = tied ? "Dead even" : margin < 1 ? "Photo finish" : margin < 5 ? "Narrow escape" : margin >= 40 ? "Statement win" : "The final word";
  const headline = tied
    ? `${left.name} & ${right.name}: absolutely nothing between them`
    : margin < 1
      ? `${winner.name} wins by a decimal point's worth of breathing room`
      : margin < 5
        ? `${winner.name} survives the close shave`
        : margin >= 40
          ? `${winner.name} makes a very loud statement`
          : best && best.fantasyPoints! >= 30
            ? [
              `${best.playerName} brings the fireworks. ${winner.name} takes the win.`,
              `${winner.name} rides a big week from ${best.playerName}`,
              `${best.playerName} delivers. ${winner.name} cashes in.`,
            ][Number(matchup.id.replace(/\D/g, "").slice(-3) || 0) % 3]!
            : `${winner.name} gets the last word in Week ${matchup.week}`;
  const lead = tied
    ? `${left.name} and ${right.name} finished Week ${matchup.week} locked at ${points(left.score)} apiece. All those lineup decisions, all those points, and neither side gets an outright victory. The box score still has plenty to say about how they got there.`
    : `${winner.name} beat ${loser.name} ${points(winner.score)}–${points(loser.score)} in Week ${matchup.week}, a ${points(margin)}-point margin. ${margin < 5 ? "Every fraction mattered in this one; a small swing would have told a very different story." : margin >= 40 ? "That is a result with some volume behind it. The winning lineup left plenty for the group chat to discuss." : "The final score settles the result. The players and lineup choices explain where the separation came from."}`;
  const positions: MatchupRecap["positions"] = [];
  if (completeStarters(left) && completeStarters(right)) {
    const allPositions = [...new Set([...left.players, ...right.players].filter((p) => p.isStarter).map((p) => normalizePositionLabel(p.position)))];
    for (const position of allPositions) {
      const total = (team: RecapTeam) => rounded(starters(team).filter((p) => normalizePositionLabel(p.position) === position).reduce((sum, p) => sum + p.fantasyPoints!, 0));
      positions.push({ position, left: total(left), right: total(right) });
    }
    const order = ["QB", "RB", "WR", "TE", "K", "DST"];
    positions.sort((a, b) => (order.indexOf(a.position) + 1 || 99) - (order.indexOf(b.position) + 1 || 99));
  }
  const edge = [...positions].sort((a, b) => Math.abs(b.left - b.right) - Math.abs(a.left - a.right))[0];
  const sections: MatchupRecap["sections"] = [];
  if (edge && edge.left !== edge.right) {
    const leader = edge.left > edge.right ? left : right;
    const other = leader.id === left.id ? right : left;
    const difference = rounded(Math.abs(edge.left - edge.right));
    const edgePlayers = starters(leader).filter((p) => normalizePositionLabel(p.position) === edge.position);
    sections.push({ id: "separation", title: tied || leader.id !== winner.id ? "The positional tug-of-war" : "Where the game was won", paragraphs: [
      `The largest positional gap came at ${edge.position}: ${leader.name} got ${points(Math.max(edge.left, edge.right))} from those starters, against ${points(Math.min(edge.left, edge.right))} for ${other.name}. ${edgePlayers.map((p) => `${p.playerName} (${points(p.fantasyPoints!)})`).join(" and ")} built that ${points(difference)}-point edge. ${tied ? "The other positions brought the two teams back level." : leader.id !== winner.id ? "That advantage was real, but the rest of the lineup could not turn it into a win." : difference > margin ? "That position's advantage was larger than the final margin; the rest of the scoring narrowed the gap." : "It was the biggest positional contribution to the winning margin."} Flex starters are counted at their player position.`,
    ] });
    const counter = [...positions].filter((row) => row !== edge && row.left !== row.right)
      .sort((a, b) => Math.abs(b.left - b.right) - Math.abs(a.left - a.right))[0];
    if (counter) {
      const counterLeader = counter.left > counter.right ? left : right;
      const contribution = starters(counterLeader).filter((p) => normalizePositionLabel(p.position) === counter.position)
        .map((p) => `${p.playerName} (${points(p.fantasyPoints!)})`).join(" and ");
      sections[0]!.paragraphs.push(`${counterLeader.id === leader.id ? "There was another useful edge" : "The counterpunch came"} at ${counter.position}. ${counterLeader.name} outscored the other side ${points(Math.max(counter.left, counter.right))}–${points(Math.min(counter.left, counter.right))} there, led by ${contribution}. That was a ${points(Math.abs(counter.left - counter.right))}-point positional difference ${counterLeader.id === winner.id && !tied ? "in the winner's favor" : "for a lineup that still had work to do elsewhere"}. Position totals describe the final scoring balance, not the order in which those points arrived.`);
    }
  }
  sections.push({ id: "performances", title: "The headliners & the supporting cast", paragraphs: [performanceParagraph(winner), performanceParagraph(loser)] });
  sections.push({ id: "bench", title: "The Monday-morning coaching department", paragraphs: [
    benchParagraph(loser, winner, matchup.rosterPositions),
    benchParagraph(winner, loser, matchup.rosterPositions),
    `These are hindsight comparisons using the recorded weekly roster and position rules, holding the opponent's actual score fixed. ${matchup.teams.every((team) => team.benchEligibilityKnown) ? "" : "Historical IR/taxi availability is not supplied, so roster upgrades are conditional on those players being available to start. "}They are not claims that the better play was obvious before kickoff.`,
  ] });
  sections.push({ id: "league", title: "Around the league", paragraphs: [leagueParagraph(winner, loser, matchup), leagueParagraph(loser, winner, matchup)].filter((p, i, all) => all.indexOf(p) === i) });
  const records = matchup.teams.filter((team) => team.record).map((team) => `${team.name}: ${team.record}`);
  if (records.length) sections.push({ id: "record", title: "What goes in the book", paragraphs: [`Head-to-head records through Week ${matchup.week}: ${records.join("; ")}. These records count completed head-to-head games, with any league-median bonus result excluded.`] });
  const caveats = ["Scores use the league's Sleeper scoring and can change with official corrections. No saved pregame projection is available for this report; no upset or projection-beating claim is made."];
  if (!completeStarters(left) || !completeStarters(right)) caveats.push("Some recorded lineup details are incomplete or player totals differ from the official score. Player highlights cover only the available evidence; positional comparisons are withheld.");
  const text = [lead, ...sections.flatMap((section) => section.paragraphs)].join(" ");
  return {
    id: matchup.id, version: RECAP_VERSION, leagueName: matchup.leagueName,
    season: matchup.season, week: matchup.week, headline, label, lead, margin,
    teams: matchup.teams, winnerId: tied ? null : winner.id,
    spotlight: best ? { player: best, teamName: winner.name } : null,
    positions, sections, caveats, sourceUrl: matchup.sourceUrl, updatedAt: matchup.updatedAt,
    wordCount: text.split(/\s+/u).length,
  };
}
