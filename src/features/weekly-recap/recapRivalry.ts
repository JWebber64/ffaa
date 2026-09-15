import { calculateHeadToHead } from "../league-history/analytics/headToHead";
import type { LeagueHistorySnapshot } from "../league-history/domain/types";
import type { SleeperMatchupRow } from "../league-history/provider/sleeperTypes";
import type { MatchupRecap } from "./matchupRecap";

export type RecapRivalryWeek = { week: number; rows: SleeperMatchupRow[] };
type Meeting = { season: number; week: number; scoreA: number; scoreB: number };
type Section = MatchupRecap["sections"][number];
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const score = (row: SleeperMatchupRow) => finite(row.custom_points) ? row.custom_points : finite(row.points) ? row.points : null;
const possessive = (name: string) => /s$/iu.test(name) ? `${name}'` : `${name}'s`;

export function unavailableRivalry(reason = "The league history could not be loaded."): Section {
  return { id: "rivalry", title: "The rivalry ledger", paragraphs: [`${reason} The final result above still stands; the historical head-to-head record will appear when the archive is available.`] };
}

export function buildRecapRivalry(
  recap: MatchupRecap,
  snapshot: LeagueHistorySnapshot,
  previousWeeks: RecapRivalryWeek[],
): Section {
  const [a, b] = recap.teams;
  const ownerA = a.primaryManagerId;
  const ownerB = b.primaryManagerId;
  if (!ownerA || !ownerB || ownerA === ownerB) return unavailableRivalry("Both teams need distinct, verified manager identities to trace this rivalry.");
  const matchesA = snapshot.managers.filter((manager) => manager.provider === "sleeper" && manager.providerUserId === ownerA);
  const matchesB = snapshot.managers.filter((manager) => manager.provider === "sleeper" && manager.providerUserId === ownerB);
  if (matchesA.length > 1 || matchesB.length > 1) return unavailableRivalry("The archive contains conflicting manager identities for this matchup.");

  // Reuse the historical manager/franchise mapping. Roster IDs and team names
  // are deliberately never used to join managers across different seasons.
  const seasonYears = new Map(snapshot.seasons.map((season) => [season.id, season.season]));
  const seenHistory = new Set<string>();
  const archivedMatchups = [...snapshot.matchups].sort((x, y) => y.importedAt.localeCompare(x.importedAt)).filter((matchup) => {
    const year = seasonYears.get(matchup.leagueSeasonId);
    if (year === undefined || year >= recap.season || !matchup.isComplete || !finite(matchup.scoreA) || !finite(matchup.scoreB)) return false;
    const key = `${year}/${matchup.week}/${[matchup.franchiseAId, matchup.franchiseBId].sort().join("/")}`;
    if (seenHistory.has(key)) return false;
    seenHistory.add(key);
    return true;
  });
  const prior = matchesA[0] && matchesB[0]
    ? calculateHeadToHead({ ...snapshot, matchups: archivedMatchups }, matchesA[0].id, matchesB[0].id)
    : null;
  const meetings: Meeting[] = (prior?.meetings ?? []).map((meeting) => ({
    season: meeting.season, week: meeting.matchup.week, scoreA: meeting.managerAScore, scoreB: meeting.managerBScore,
  }));

  // The persisted current season can lag behind the live season. Read earlier
  // completed weeks from this season, then add this report's corrected result
  // exactly once. Never include this week from the stored snapshot as well.
  const seenWeeks = new Set<number>();
  for (const week of previousWeeks) {
    if (week.week >= recap.week || seenWeeks.has(week.week)) continue;
    seenWeeks.add(week.week);
    const rowsA = week.rows.filter((row) => String(row.roster_id) === a.id);
    const rowsB = week.rows.filter((row) => String(row.roster_id) === b.id);
    if (rowsA.length !== 1 || rowsB.length !== 1) return unavailableRivalry("Some earlier weekly box scores are incomplete, so a reliable rivalry total is not available yet.");
    const rowA = rowsA[0]!;
    const rowB = rowsB[0]!;
    if (rowA.matchup_id == null || rowA.matchup_id !== rowB.matchup_id) continue;
    if (week.rows.filter((row) => row.matchup_id === rowA.matchup_id).length !== 2) return unavailableRivalry("An earlier matchup has an ambiguous pairing in the source.");
    const scoreA = score(rowA);
    const scoreB = score(rowB);
    if (scoreA === null || scoreB === null) return unavailableRivalry("An earlier meeting is missing a final score, so the rivalry total is withheld.");
    meetings.push({ season: recap.season, week: week.week, scoreA, scoreB });
  }
  meetings.sort((x, y) => x.season - y.season || x.week - y.week);
  const lastMeeting = meetings.at(-1);
  meetings.push({ season: recap.season, week: recap.week, scoreA: a.score, scoreB: b.score });
  const winsA = meetings.filter((meeting) => meeting.scoreA > meeting.scoreB).length;
  const winsB = meetings.filter((meeting) => meeting.scoreB > meeting.scoreA).length;
  const ties = meetings.length - winsA - winsB;
  const seasons = [...new Set(meetings.map((meeting) => meeting.season))].sort((x, y) => x - y);
  const years = seasons.length === 1 ? `in ${seasons[0]}` : `across ${seasons.length} seasons (${seasons[0]}–${seasons.at(-1)})`;
  const winner = recap.winnerId === a.id ? a : b;
  const loser = winner.id === a.id ? b : a;
  const winnerWins = winner.id === a.id ? winsA : winsB;
  const loserWins = winner.id === a.id ? winsB : winsA;
  const record = (wins: number, losses: number) => `${wins}–${losses}${ties ? `–${ties}` : ""}`;
  const opening = recap.winnerId
    ? `This win brings ${possessive(winner.name)} recorded head-to-head record against ${loser.name} to ${record(winnerWins, loserWins)} ${years}${ties ? " (wins–losses–ties)" : ""}.`
    : `This tie brings ${possessive(a.name)} recorded head-to-head record against ${b.name} to ${record(winsA, winsB)} ${years} (wins–losses–ties).`;
  let stakes: string;
  if (!lastMeeting) {
    stakes = " This is their first meeting in the available league archive. The rivalry has its opening chapter.";
  } else if (recap.winnerId) {
    stakes = winnerWins === loserWins ? " The win levels the rivalry. Bragging rights are officially back up for grabs."
      : winnerWins > loserWins ? winnerWins - 1 === loserWins ? " The win breaks the deadlock and puts them ahead in the rivalry." : " Another win extends their lead in the rivalry ledger."
        : " They still trail the overall series, but this win closes the gap. One less result for the opponent to bring up.";
  } else {
    stakes = " Neither manager adds a win to the ledger this time.";
  }
  const paragraphs = [opening + stakes];
  if (lastMeeting) {
    const previousWinner = lastMeeting.scoreA > lastMeeting.scoreB ? a : b;
    const previousLoser = previousWinner.id === a.id ? b : a;
    const last = lastMeeting.scoreA === lastMeeting.scoreB
      ? `Their previous meeting, in ${lastMeeting.season} Week ${lastMeeting.week}, ended level at ${lastMeeting.scoreA.toFixed(2)}.`
      : `Their previous meeting was ${lastMeeting.season} Week ${lastMeeting.week}: ${previousWinner.name} beat ${previousLoser.name} ${Math.max(lastMeeting.scoreA, lastMeeting.scoreB).toFixed(2)}–${Math.min(lastMeeting.scoreA, lastMeeting.scoreB).toFixed(2)}.`;
    let streak = 0;
    if (recap.winnerId) {
      for (const meeting of [...meetings].reverse()) {
        const won = winner.id === a.id ? meeting.scoreA > meeting.scoreB : meeting.scoreB > meeting.scoreA;
        if (!won) break;
        streak += 1;
      }
    }
    paragraphs.push(last + (streak >= 2 ? ` ${winner.name} has now won ${streak} straight recorded meetings. The receipts are piling up.` : ""));
  }
  paragraphs.push(`Includes this result and recorded regular-season and playoff weekly meetings through ${recap.season} Week ${recap.week}. The record follows the managers through team-name changes; names here match this recap. It is based on the available league archive, not unrecorded seasons.`);
  return { id: "rivalry", title: "The rivalry ledger", paragraphs };
}

export function withRivalrySection(recap: MatchupRecap, section: Section): MatchupRecap {
  const sections = recap.sections.filter((candidate) => candidate.id !== "rivalry");
  sections.splice(sections[0]?.id === "separation" ? 1 : 0, 0, section);
  return { ...recap, sections, wordCount: [recap.lead, ...sections.flatMap((candidate) => candidate.paragraphs)].join(" ").split(/\s+/u).length };
}
