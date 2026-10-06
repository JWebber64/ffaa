import type { NativeWaiverPlayerState, NativeWeeklyLineup, SeasonTeam } from "../league-domain/types";
import type { ToolPlayer } from "../../data/toolPlayerData";
import type { BriefRosterPlayer } from "./model";

type Inputs = {
  team: Pick<SeasonTeam, "franchiseId" | "rosterRevision" | "rosterPlayerIds"> | null;
  players: Pick<NativeWaiverPlayerState, "playerId" | "state" | "ownerFranchiseId">[] | null;
  lineups: Pick<NativeWeeklyLineup, "franchiseId" | "week" | "settingsVersionId" | "rosterRevision" | "seasonRevision" | "assignments" | "selectionMode">[] | null;
  directory: Map<string, Pick<ToolPlayer, "name" | "sleeperId" | "position" | "team" | "status" | "injuryStatus">>;
  week: number | null | undefined; settingsVersionId: string; seasonRevision: number; leagueType: string | undefined;
};
export function nativeComparisonRoster(input: Inputs): BriefRosterPlayer[] {
  const { team, players, directory } = input;
  if (!team || !players || !input.week || input.leagueType !== "redraft") return [];
  const lineup = input.lineups?.find(row => row.franchiseId === team.franchiseId && row.week === input.week && row.settingsVersionId === input.settingsVersionId && row.rosterRevision === team.rosterRevision && row.seasonRevision === input.seasonRevision && row.selectionMode !== "best_ball");
  if (!lineup) return [];
  const owned = players.filter(row => row.ownerFranchiseId === team.franchiseId);
  // A synchronized published roster is required before interpreting someone as bench.
  const ownedIds = new Set(owned.map(row => row.playerId)), rosterIds = new Set(team.rosterPlayerIds);
  if (ownedIds.size !== owned.length || ownedIds.size !== rosterIds.size || [...rosterIds].some(id => !ownedIds.has(id))) return [];
  const starters = new Set(Object.values(lineup.assignments));
  if ([...starters].some(id => !rosterIds.has(id))) return [];
  if (owned.some(row => !directory.get(row.playerId)?.sleeperId)) return [];
  return owned.map(row => {
    const player = directory.get(row.playerId)!;
    const reserve = /\bir\b|reserve/i.test(`${player.status ?? ""} ${player.injuryStatus ?? ""}`);
    return { id: player.sleeperId!, name: player.name, team: player.team, positions: [player.position],
      slot: starters.has(row.playerId) ? player.position : reserve ? "RESERVE" : "BENCH",
      protected: row.state !== "owned" || /keeper|protected/i.test(player.status ?? ""), cost: null };
  });
}
