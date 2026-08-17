export type SleeperLeagueDraftType = "auction" | "snake";

const GOAT_LEAGUE_IDS = new Set([
  "992455063442423808",
  "1108587587780022272",
  "1254300099715018753",
  "1385319428408774656",
]);

/**
 * Sleeper identifies several G.O.A.T. League draft records as snake drafts even
 * though the league has always used an auction. Keep the raw provider payload
 * intact, but normalize the league-wide format for presentation and history.
 */
export function getSleeperLeagueDraftTypeOverride(
  leagueIds: Iterable<string>,
): SleeperLeagueDraftType | null {
  for (const leagueId of leagueIds) {
    if (GOAT_LEAGUE_IDS.has(leagueId)) return "auction";
  }
  return null;
}
