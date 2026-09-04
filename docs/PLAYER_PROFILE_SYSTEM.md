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
