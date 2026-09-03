# Fantasy platform route map

All client paths below are React Router paths. Production serves them beneath the Vite basename `/ff`, established by `src/lib/appBasePath.ts` and `vite build --base=/ff/`.

## Edge and API routing

`vercel.json` currently defines:

| Request | Destination/behavior |
|---|---|
| `/` | Temporary redirect to `/ff/` |
| `/ff` | Permanent redirect to `/ff/` |
| `/ff/api/league-history/import` | Vercel function `/api/league-history/import` |
| `/ff/sleeper-api/:path*` | Public Sleeper API proxy |
| `/ff/ffc-api/:path*`, `/ffc-api/:path*` | Fantasy Football Calculator proxy |
| `/ff/assets`, `/ff/images`, `/ff/sounds`, `/ff/data` | Built static assets |
| `/ff/`, `/ff/:path*`, `/:path*` | SPA fallback to `index.html` |

The first slice must add an explicit `/ff/api/league-commands/execute` rewrite and Vercel function configuration. It must not overload the unauthenticated League History import endpoint.

## Current application routes

### Global/product routes from `src/App.tsx:68-163`

| Route | Current element | Current role |
|---|---|---|
| `/` | `ConnectedHome` | Landing when no connection; otherwise redirects to `/teams` |
| `/teams` | `MyTeams` | Connected Sleeper league/team portfolio |
| `/leagues` | `LeagueHQ` | Connect/select Sleeper leagues and League HQ |
| `/stats` | `StatsExplorer` | Player research |
| `/auction-values` | `AuctionValuesPage` | Auction values |
| `/auction-values/source/:sourceId` | `AuctionValuesPage` | Selected value source |
| `/auction-values/print` | `AuctionValuesPage` | Print view |
| `/analytics` | `AnalyticsLab` | Player/league research analytics |
| `/tools/*` | `Tools` | Tool hub and nested tools |
| `/draft-order` | `DraftOrderShowdown` | Draft Order Showdown |
| `/offline-draft` | `OfflineDraftV2` | Standalone Offline Draft; no route parameter in Production |

`src/screens/Tools.tsx:33-38` dispatches the `/tools/*` catch-all without nested `<Route>` elements: `/tools/player-compare`, `/tools/auction-builder`, `/tools/team-rater`, `/tools/schedule`, and `/tools/offensive-line` render their named tool; `/tools` and any other suffix render `ToolsHub`.

### Current compatibility routes from `src/App.tsx:110-115`

| Incoming route | Current resolution |
|---|---|
| `/league` | `/leagues` |
| `/league/teams` | `/league/{activeSleeperLeagueId}/teams`; `/leagues` if no active connection |
| `/league/teams/:teamId` | `/league/{activeSleeperLeagueId}/teams/:teamId` |
| `/league/matchups` | `/league/{activeSleeperLeagueId}/matchups` |
| `/league/lineup` | `/league/{activeSleeperLeagueId}/team/roster` |
| `/my-hq` | `/league/{activeSleeperLeagueId}/team` |

The active ID comes from `useSleeperLeagueConnections`, which currently reads `ffaa.activeSleeperLeague.v1`. The redirect therefore cannot resolve a native league without the new mapping repository.

### Current league workspace from `src/App.tsx:117-142`

| Route relative to `/league/:leagueId` | Current element/redirect | Data meaning |
|---|---|---|
| index | Redirect to `history` | This is the behavior that must change |
| `team` | `MyHQ` | Imported Sleeper current team |
| `team/roster` | `LeagueLineup` | Native published-season lineup |
| `team/matchup` | `LeagueMatchups personalOnly` | Generated matchup/projection view |
| `players` | `LeaguePlayers` | Research plus Sleeper ownership context |
| `standings` | `LeagueOverview` | Summary/destination cards, not true standings |
| `teams` | `LeagueTeams` | Published/preview teams and membership claims |
| `teams/:teamId` | `LeagueTeams` | Selected team on same surface |
| `matchups` | `LeagueMatchups` | Generated schedule/projection view |
| `transactions` | Redirect to `history/transactions` | Imported transaction history |
| `history/*` | `LeagueHistoryApp` | Imported historical workspace |
| `manage` | `LeagueManage` | Capability-gated League HQ/Commissioner Studio |
| `managers/*` | Redirect to `history/managers/*` | Legacy history link |
| `h2h/*` | Redirect to `history/h2h/*` | Legacy history link |
| `records/*` | Redirect to `history/records/*` | Legacy history link |
| `seasons/*` | Redirect to `history/seasons/*` | Legacy history link |
| `week/*` | Redirect to `history/week/*` | Legacy history link |
| `leaderboards/*` | Redirect to `history/leaderboards/*` | Legacy history link |
| `drafts/*` | Redirect to `history/drafts/*` | Legacy history link |
| `payouts/*` | Redirect to `history/payouts/*` | Legacy history link |
| `trades/*` | Redirect to `history/trades/*` | Legacy history link |
| `waivers/*` | Redirect to `history/waivers/*` | Legacy history link |
| `rivalries/*` | Redirect to `history/rivalries/*` | Legacy history link |
| `transactions/*` | Redirect to `history/transactions/*` | Legacy history link |

Unknown public league paths fall back to `/leagues` through `AppRoutes.publicFallback`; they do not render an explicit not-found state.

### Current League History routes from `LeagueHistoryApp.tsx:175-198`

All are relative to `/league/:leagueId/history`:

| Route | Element |
|---|---|
| index | `LeagueDashboardPage` |
| `week` | `WeekPage` |
| `managers` | `ManagersPage` |
| `managers/:managerId` | `ManagerProfilePage` |
| `h2h` | `HeadToHeadMatrixPage` |
| `rivalries/:managerAId/:managerBId` | `RivalryPage` |
| `archive` | `HistoryPage` |
| `champions` | `ChampionsPage` |
| `records` | `RecordsPage` |
| `seasons` | `SeasonsPage` |
| `seasons/:season` | `SeasonArchivePage` |
| `leaderboards` | `LeaderboardsPage` |
| `drafts` | `DraftHistoryPage` |
| `payouts` | `PayoutsPage` |
| `transactions` | `TransactionHistoryPage` |
| `trades` | `TransactionHistoryPage` filtered to trades |
| `waivers` | `TransactionHistoryPage` filtered to waivers |
| `*` | `recoverLeagueHistoryPath` fallback |

`src/features/league-history/ui/leagueRoutes.ts` canonicalizes a requested History subpath named `history` to `archive` and preserves recoverable older suffixes. Manager IDs also accept provider aliases.

### Authenticated live-draft and legacy routes from `src/routes/AuthenticatedApp.tsx:89-133`

| Route | Element |
|---|---|
| `/host/setup` | `HostSetupV2` |
| `/host` | `HostLobbyV2` |
| `/join` | `JoinLobbyV2` |
| `/draft/:draftId` | `DraftRoomV2` |
| `/results/:draftId` | `ResultsV2` |
| `/legacy` | Legacy `Home` |
| `/legacy/host` | `LobbyHost` |
| `/legacy/join` | `LobbyJoin` |
| `/legacy/ping` | `PingTest` |
| `/legacy/setup` | `Setup` |
| `/legacy/player-pool` | Guarded `PlayerPool` |
| `/legacy/stats` | Legacy `StatsExplorer` |
| `/legacy/board` | Guarded `DraftBoard` |
| `/legacy/auctioneer` | Guarded `Auctioneer` |
| `/legacy/results` | Legacy `Results` |
| unmatched authenticated route | Redirect to `/host` |

`App.tsx` routes any path starting with the public prefixes before it reaches `AuthenticatedApp`. Offline Draft is its own branch. This ordering must be preserved while the global navigation is simplified.

## Live route verification

On 2026-09-02:

- `/ff/league/1385319428408774656` rendered and settled at `/ff/league/1385319428408774656/history`.
- It displayed `G.O.A.T. League`, `Sleeper source`, 2023–2026, and history metrics.
- The visible league navigation included Team, Matchup, Players, League, Standings, All teams, All matchups, Transactions, History, and Manage.
- None of `Native GameHQ League`, `Connected Sleeper League`, `Migration Preview`, `Mirror Mode`, `read/write`, or `read-only` appeared.
- `/ff/league/lineup` resolved to the active connected league's `/team/roster` route.
- `/ff/league/teams` resolved to the active connected league's `/teams` route.

## Target canonical routes

The canonical path parameter is always `gamehqLeagueId`, never a provider ID.

### Primary league routes

| Route | Intended responsibility | First-slice state |
|---|---|---|
| `/league/:gamehqLeagueId` | Operational League Home | Implement |
| `/league/:gamehqLeagueId/matchup` | Current user's matchup | Redirect/adapter to existing matchup initially |
| `/league/:gamehqLeagueId/team` | Current team | Adapter; imported league may use current My HQ |
| `/league/:gamehqLeagueId/players` | League-aware player research/actions | Reuse read surface; authority-aware actions later |
| `/league/:gamehqLeagueId/transactions` | Native/imported activity with provenance | Imported redirect/read adapter initially |
| `/league/:gamehqLeagueId/standings` | Native standings | Existing summary only until standings phase; label limitation |
| `/league/:gamehqLeagueId/schedule` | Season schedule | Adapter to existing generated schedule initially |
| `/league/:gamehqLeagueId/teams` | Teams/franchises | Compatibility route retained |
| `/league/:gamehqLeagueId/chat` | League chat | Planned; do not add a decorative empty page |
| `/league/:gamehqLeagueId/rules` | Published settings/constitution | Implemented from the active immutable settings version |
| `/league/:gamehqLeagueId/history/*` | Native/imported history | Reuse current history with canonical mapping |

The requested inside-league nav is Home, Matchup, Team, Players, Transactions, and League; the League disclosure contains Standings, Schedule, Teams, Chat, Rules, and History. Mobile exposes Home, Matchup, Team, Players, and More without removing any action.

### Commissioner routes

| Route | Planned page |
|---|---|
| `/league/:gamehqLeagueId/commissioner` | Implemented commissioner overview with active/draft revision state |
| `/league/:gamehqLeagueId/commissioner/settings` | Implemented redraft rulebook, validation, impact preview, publication, and restore history |
| `/league/:gamehqLeagueId/commissioner/teams` | Teams, memberships, and roles |
| `/league/:gamehqLeagueId/commissioner/scoring` | Scoring settings |
| `/league/:gamehqLeagueId/commissioner/schedule` | Schedule settings/editor |
| `/league/:gamehqLeagueId/commissioner/transactions` | Reviews/corrections |
| `/league/:gamehqLeagueId/commissioner/imports` | Provider import/mirror status |
| `/league/:gamehqLeagueId/commissioner/audit` | Universal audit log |

Only the overview shell and route contract need to exist in the first vertical slice. Empty feature pages must not be added ahead of their domains.

## Compatibility resolution algorithm

`LeagueRepository.resolveRouteId` owns resolution before the workspace renders:

1. If `routeId` is a canonical UUID and `leagues/{routeId}` exists, return it.
2. Otherwise query the exact provider lookup key `externalLeagueMappings/sleeper__{routeId}`.
3. If a unique mapping exists, replace-navigate to the same suffix under `/league/{gamehqLeagueId}` while preserving query parameters and hash.
4. If no mapping exists but the current Sleeper connection or imported history exists, create an **in-memory legacy imported resolution** with `Connected Sleeper League — read-only`; do not create or mutate a canonical league merely by visiting.
5. If a migration preview mapping exists, route to its canonical league and display `Migration Preview`.
6. If the lookup is absent or invalid, render an explicit unavailable/not-connected state with a route back to `/leagues`; do not redirect silently to another active league.

Legacy active-league routes first resolve `ffaa.activeSleeperLeague.v1` through the same mapping. An unmapped existing connection continues to open its read-only legacy workspace. This preserves saved connections without allowing localStorage to select native authority.

## First-slice route changes

Exact existing files:

- `src/App.tsx` — make the league index render `LeagueHome`; add target aliases; replace direct active-Sleeper redirects with mapping-aware resolution.
- `src/layouts/LeagueWorkspaceLayout.tsx` — new operational nav and persistent authority label.
- `src/features/league-workspace/LeagueWorkspaceContext.tsx` and `leagueWorkspaceState.ts` — resolve canonical route identity, external connection, roles, and authority separately.
- `src/lib/routeMetadata.ts` — canonical League Home and commissioner route metadata.

Exact new files:

- `src/screens/LeagueHome.tsx` — compact operational home using existing read data; no fake scores/standings.
- `src/features/league-domain/legacyLeagueRouteAdapter.ts` — old numeric route and active-connection resolver.
- `src/__tests__/nativeLeagueRoutes.test.tsx` — canonical, mapped legacy, unmapped imported, suffix/query preservation, index behavior, and authority labels.
- `e2e/native-league-routing.e2e.ts` — desktop/mobile route smoke checks behind the feature flag.

## Global navigation migration

The target global labels are Leagues, Draft, Research, and Profile. Existing routes remain valid:

- **Leagues** points to `/leagues`.
- **Draft** groups `/host/setup`, `/host`, `/join`, `/offline-draft`, and `/draft-order` without removing direct links.
- **Research** groups `/stats`, `/auction-values`, `/analytics`, and `/tools`.
- **Profile** initially exposes authentication/account and connected-team preferences; it does not become a permission authority.

This navigation change follows the canonical workspace seam and is not permission to remove existing routes.

## Implemented Phase 1A routes

| Route | Implemented behavior |
|---|---|
| `/league/:gamehqLeagueId` | Operational League Home with real league/season/team/role/source state and explicit unavailable states |
| `/league/:numericSleeperId/*` | Resolves `externalLeagueMappings/sleeper__{id}`; mapped routes replace the league segment and preserve suffix, query, and hash |
| `/league/:gamehqLeagueId/matchup` | Personal matchup alias |
| `/league/:gamehqLeagueId/team` | Existing team workspace through the external-source adapter when present |
| `/league/:gamehqLeagueId/team/roster` | Weekly lineup editor; mutations use the server command boundary |
| `/league/:gamehqLeagueId/players` | Existing player research surface |
| `/league/:gamehqLeagueId/transactions` | Existing imported transaction/history compatibility route |
| `/league/:gamehqLeagueId/schedule` | Existing all-matchups schedule alias |
| `/league/:gamehqLeagueId/{standings,teams,history}` | Existing league readers under canonical identity |
| `/league/:gamehqLeagueId/commissioner/*` | Existing management surface behind canonical GameHQ capability resolution |

The league workspace navigation now exposes Home, Matchup, Team, Players, Transactions, and a real disclosure menu for Standings, Schedule, Teams, History, Rules, and Commissioner. Existing legacy aliases remain valid; no route was deleted.

Global AppShell regrouping was not required to prove the identity/command slice and was intentionally left unchanged to avoid broad navigation churn.
