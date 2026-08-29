import type { OfflineDraftType } from "../features/draft-order/offlineDraftHandoff";

export type OfflineDraftTurn = {
  complete: boolean;
  direction: 1 | -1;
  round: number;
  selectionNumber: number;
  teamIndex: number | null;
};

export function getOfflineDraftTurn(
  draftType: OfflineDraftType,
  completedSelections: number,
  teamCount: number,
  rosterSlotsPerTeam: number,
): OfflineDraftTurn {
  const normalizedTeamCount = Math.max(0, Math.round(teamCount));
  const normalizedCompleted = Math.max(0, Math.round(completedSelections));
  const totalSelections = normalizedTeamCount * Math.max(0, Math.round(rosterSlotsPerTeam));
  const round = normalizedTeamCount > 0 ? Math.floor(normalizedCompleted / normalizedTeamCount) + 1 : 1;
  const direction: 1 | -1 = draftType === "snake" && round % 2 === 0 ? -1 : 1;

  if (!normalizedTeamCount || (totalSelections > 0 && normalizedCompleted >= totalSelections)) {
    return {
      complete: true,
      direction,
      round,
      selectionNumber: normalizedCompleted + 1,
      teamIndex: null,
    };
  }

  const indexInRound = normalizedCompleted % normalizedTeamCount;
  return {
    complete: false,
    direction,
    round,
    selectionNumber: normalizedCompleted + 1,
    teamIndex: direction === 1 ? indexInRound : normalizedTeamCount - indexInRound - 1,
  };
}
