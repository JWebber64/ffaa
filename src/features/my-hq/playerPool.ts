import { buildCurrentToolPlayers } from "../../data/toolPlayerData";
import { loadSleeperPlayerDirectory } from "../../data/sleeperPlayerDirectory";
import type { SleeperLeagueConnectionSummary } from "../league-hq/sleeperConnections";

const playerPools = new Map<string, Promise<ReturnType<typeof buildCurrentToolPlayers>>>();

export function loadPlayersForConnection(connection: SleeperLeagueConnectionSummary) {
  const scoring = connection.auctionSettings?.scoring ?? "halfPpr";
  const existing = playerPools.get(scoring);
  if (existing) return existing;
  const players = loadSleeperPlayerDirectory()
    .then((sleeperRows) => buildCurrentToolPlayers(scoring, [], {}, sleeperRows))
    .catch((error) => {
      playerPools.delete(scoring);
      throw error;
    });
  playerPools.set(scoring, players);
  return players;
}
