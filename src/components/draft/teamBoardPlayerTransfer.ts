export type TeamBoardPlayerTransfer = {
  sourceTeamId: string;
  playerId: string;
  playerName: string;
};

export const TEAM_BOARD_PLAYER_TRANSFER_TYPE = "application/x-ffaa-roster-player";

export function writeTeamBoardPlayerTransfer(
  dataTransfer: DataTransfer,
  transfer: TeamBoardPlayerTransfer,
) {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(TEAM_BOARD_PLAYER_TRANSFER_TYPE, JSON.stringify(transfer));
  dataTransfer.setData("text/plain", transfer.playerId);
}

export function readTeamBoardPlayerTransfer(dataTransfer: DataTransfer) {
  const raw = dataTransfer.getData(TEAM_BOARD_PLAYER_TRANSFER_TYPE);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TeamBoardPlayerTransfer>;
    if (
      typeof parsed.sourceTeamId !== "string" ||
      typeof parsed.playerId !== "string" ||
      typeof parsed.playerName !== "string"
    ) {
      return null;
    }
    return {
      sourceTeamId: parsed.sourceTeamId,
      playerId: parsed.playerId,
      playerName: parsed.playerName,
    } satisfies TeamBoardPlayerTransfer;
  } catch {
    return null;
  }
}
