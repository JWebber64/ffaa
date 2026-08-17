export type SleeperLeagueDraftType = "auction" | "snake";

const GOAT_LEAGUE_IDS = new Set([
  "992455063442423808",
  "1108587587780022272",
  "1254300099715018753",
  "1385319428408774656",
]);

const IGNORED_SLEEPER_DRAFT_IDS = new Set([
  // Sleeper exposes this six-minute CPU mock board as a completed 2026 draft,
  // but its 144 picks do not match the league's current rosters.
  "1385319428417142784",
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

export function isIgnoredSleeperDraft(draftId: string): boolean {
  return IGNORED_SLEEPER_DRAFT_IDS.has(draftId);
}
