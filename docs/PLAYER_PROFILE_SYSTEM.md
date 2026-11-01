# Player profile surface contract

Every repeated player identity that supports inspection must open a profile without forcing the user to leave the current workflow. The profile must expose the best available identity, status, projections, game log, career context, news/status evidence, and league action context. Missing data is an explicit empty state, never invented copy.

## Shared surfaces

- General research, draft, auction, history, and tool screens use `PlayerProfileButton` from `src/features/player-profile/PlayerProfileProvider.tsx`. The provider is mounted once in `src/App.tsx`.
- Native league lineup, matchup, draft, waiver, and trade screens use `useLeaguePlayerSheet`. `LeaguePlayerSheetProvider` is mounted around the league workspace in `src/layouts/LeagueWorkspaceLayout.tsx` so ownership and roster-fit context remain available.
- Stats Explorer keeps its purpose-built `StatsPlayerDrawer`; it is the only documented exception because that drawer owns the page's selected-stat and historical-series context.

## Adding or changing a player surface

1. Use the appropriate shared trigger; do not create a page-local profile modal.
2. Keep the visible player name as the trigger's accessible name. Preserve keyboard activation and focus return.
3. Pass a stable GameHQ or Sleeper player ID plus position/team context. League surfaces must also pass ownership, roster fit, and the next valid action when known.
4. Add the consumer file to `src/__tests__/playerProfileCoverage.test.ts`. If a specialized surface genuinely needs its own drawer, document the context it owns and add an explicit guarded exception.
5. Run `npx vitest run src/__tests__/playerProfileCoverage.test.ts src/__tests__/playerProfileProvider.test.tsx src/__tests__/nativeOperationalUi.test.tsx` and verify one desktop and one mobile rendered trigger.

The coverage test is intentionally explicit: deleting a trigger or adding a known consumer without updating the contract must be a reviewed change, not an accidental regression.

## Season statistics and source context

- Opening a shared profile loads the configured current season's regular-season weekly rows immediately. Overview does not depend on visiting Game log. Season PPG, recent form, quartiles, usage, and the sampled-game count all use the same season and selected scoring. Connected-league week scores remain authoritative and may legitimately be zero.
- Overview identifies the season, sample size, and latest recorded week. A missing player sample is distinct from a source failure; failures expose an accessible retry. Late or aborted requests must never replace another player's data.
- Game log may reuse profile rows only when `weeksCoverFullSeason` is true. Stats Explorer's filtered historical series must continue loading a complete season when Game log opens.
- Missing position rank may be derived within the existing overall rankings and is labeled as such. Missing ADP may use the imported Sleeper PPR draft snapshot, with its scoring, season, and update date visible. Never substitute an overall rank for ADP or label preseason draft ADP as current in-season rank.
- `FANTASY_SEASON` sets the supported career/game-log season. `npm run stats:refresh` refreshes that season's nflverse weekly CSV and career totals while preserving completed career seasons; `npm run career-data:pull` rebuilds all career seasons. Commit refreshed assets through the normal master-only release process.
- Run the profile data/provider, weekly player stats, current-season career, and career statistics tests plus `e2e/player-profile-stats.e2e.ts` on desktop and mobile after changing this flow.
