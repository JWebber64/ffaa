import type { RecapTeam } from "./matchupRecap";
import type { RecapWeek } from "./recapSource";
import type { RecapRivalryWeek } from "./recapRivalry";
import type { SleeperMatchupRow } from "../league-history/provider/sleeperTypes";

export type RecapRecordChange = { team: RecapTeam; before: string; after: string };
export type RecapNextMatchup = { id: number; left: RecapTeam; right: RecapTeam };
const score = (row: SleeperMatchupRow) => Number.isFinite(row.custom_points) ? row.custom_points! : Number.isFinite(row.points) ? row.points! : null;

export function recapRecordChanges(data: RecapWeek, previous: RecapRivalryWeek[]): RecapRecordChange[] {
  if (!data.leagueWeekComplete || !data.teams?.length) return [];
  const start = typeof data.league.settings.start_week === "number" ? Math.max(1, data.league.settings.start_week) : 1;
  const records = new Map(data.teams.map((team) => [team.id, { wins: 0, losses: 0, ties: 0 }]));
  for (let week = start; week < data.week; week++) {
    const source = previous.filter((candidate) => candidate.week === week);
    if (source.length !== 1) return [];
    const rows = source[0]!.rows;
    if (rows.length !== data.teams.length || new Set(rows.map((row) => row.roster_id)).size !== rows.length) return [];
    for (const row of rows) {
      const record = records.get(String(row.roster_id));
      if (!record) return [];
      if (row.matchup_id === null) continue;
      const pair = rows.filter((candidate) => candidate.matchup_id === row.matchup_id);
      const opponent = pair.find((candidate) => candidate.roster_id !== row.roster_id);
      const own = score(row);
      const other = opponent ? score(opponent) : null;
      if (pair.length !== 2 || own === null || other === null) return [];
      if (own > other) record.wins++;
      else if (own < other) record.losses++;
      else record.ties++;
    }
  }
  const label = (record: { wins: number; losses: number; ties: number }) => `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`;
  return data.teams.map((team) => {
    const record = records.get(team.id)!;
    const before = label(record);
    const matchup = data.recaps.find((recap) => recap.teams.some((candidate) => candidate.id === team.id));
    if (matchup) {
      if (!matchup.winnerId) record.ties++;
      else if (matchup.winnerId === team.id) record.wins++;
      else record.losses++;
    }
    return { team, before, after: label(record) };
  });
}

export function recapNextMatchups(teams: RecapTeam[], rows: SleeperMatchupRow[]): RecapNextMatchup[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const groups = new Map<number, SleeperMatchupRow[]>();
  for (const row of rows) {
    if (row.matchup_id === null || rows.filter((candidate) => candidate.roster_id === row.roster_id).length !== 1) continue;
    groups.set(row.matchup_id, [...(groups.get(row.matchup_id) ?? []), row]);
  }
  return [...groups].flatMap(([id, pair]) => {
    if (pair.length !== 2) return [];
    const left = byId.get(String(pair[0]!.roster_id));
    const right = byId.get(String(pair[1]!.roster_id));
    return left && right && left.id !== right.id ? [{ id, left, right }] : [];
  });
}
