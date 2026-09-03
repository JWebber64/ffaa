# Fantasy platform current-state audit

Status: Phase 0 baseline plus Phases 1–5 implementation deltas, 2026-09-03. The baseline audit remains below for provenance; the implemented branch facts are recorded at the end.

## Evidence boundary

This audit uses three explicitly separate sources:

1. **Production source** — `origin/master` at `c69abc68c266271ee9b45510944fd08e677d76a0`. Vercel deployment `dpl_J3qAsRmUxYy8J3yniZvK7SwXdjcC` is `READY` and `PROMOTED` from that commit.
2. **Live behavior** — `https://gamehqhub.com/ff/` and the G.O.A.T. League route were rendered in a browser. `/ff/league/1385319428408774656` settled at `/history`; the page displayed `Sleeper source`. No native/import/mirror authority label was present. Legacy `/ff/league/lineup` redirected to `/ff/league/1385319428408774656/team/roster`, and `/ff/league/teams` redirected to `/ff/league/1385319428408774656/teams`.
3. **Local checkout** — the checked-out commit is `f03d414fcb530809d9cfa773973207e9e129fda9`, 109 commits behind `origin/master`, with extensive user-owned modified and untracked work. All code findings below refer to `origin/master` unless explicitly marked local. This prevents older checkout state from being reported as Production state.

The repository has no root or ancestor `AGENTS.md` within `C:\Users\JW\FFAA`, `C:\Users\JW`, or `C:\`. The global desktop instructions supplied with the task govern this audit.

## Executive finding

GameHQ currently has useful native building blocks, but it does not yet have one native league aggregate.

- A route `leagueId` is treated as a numeric Sleeper ID by the connection, workspace, offline-draft synchronization, published-season, and automatic-history-import paths.
- Native weekly lineups, claims, memberships, a generated schedule, and immutable lineup audit events exist in Firestore under `leagueSeasons/{numericSleeperLeagueId}`.
- Imported current-league data and My HQ are read from Sleeper. Imported historical data is normalized into public `leagueHistories` documents.
- League HQ commissioner content and ballots are device-local `localStorage` records, not authoritative or versioned server state.
- Live and offline drafts have their own identities and persistence. Neither produces a canonical native `League`, `Season`, `Franchise`, or roster transaction ledger.
- Browser clients directly write all existing native authoritative records. Firestore rules validate those writes, but there is no authenticated command service, idempotency receipt, universal audit format, or stale-revision rejection.
- `/league/:leagueId` defaults to History, not an operational league home.

The correct first move is an identity/authority seam and one server-side command proof, not a screen-by-screen rewrite.

## Current league lifecycle

### Connected Sleeper lifecycle

1. `src/screens/LeagueHQ.tsx` accepts a numeric Sleeper league or manager lookup.
2. `src/features/league-hq/sleeperLeague.ts` calls Sleeper's public API and builds current league, manager, roster, standings, matchup, transaction, and display models.
3. `src/features/league-hq/sleeperConnections.ts` stores the connection and active numeric ID in `localStorage`.
4. `src/features/league-hq/SleeperConnectionsCloudSync.tsx` mirrors the connection portfolio to `fantasyManagerProfiles/{firebaseUid}` for permanent users. Firestore rules state that this document grants no permissions.
5. `src/features/league-workspace/LeagueWorkspaceContext.tsx` equates the route `leagueId` with `SleeperLeagueConnectionSummary.leagueId`, loads `MyHQ` from Sleeper, and also subscribes to `leagueSeasons/{leagueId}`.
6. `src/layouts/LeagueWorkspaceLayout.tsx` supplies the connected workspace navigation.
7. `src/features/league-history/automaticImport.ts` invokes `/ff/api/league-history/import` when normalized history is absent. The server loads up to 20 linked Sleeper seasons and persists `leagueHistories`.

This path is imported/read-only for Sleeper itself. GameHQ never writes back to Sleeper.

### Offline draft to published native season

1. `src/screens_v2/OfflineDraftV2.tsx` owns the standalone offline draft UI.
2. An unfinished draft is recoverable from `ffaa.offlineDraft.v1` or `ffaa.offlineDraft.v1:<offlineDraftId>`.
3. A shareable standalone draft is persisted to `offlineDrafts/{offlineDraftId}` by `src/features/offline-draft/offlineDraftPersistence.ts`.
4. If an active numeric Sleeper league is selected, the draft is mirrored to `offlineLeagueDrafts/{sleeperLeagueId}` by `src/features/offline-draft/offlineLeagueDraftPersistence.ts`.
5. `src/features/offline-draft/offlineDraftSync.ts` deliberately adapts the current `state`/`version` record into the older `payload`/`revision` interface consumed by the season publisher.
6. `src/features/league-season/leagueSeasonPersistence.ts::publishLeagueSeason` requires a permanent Firebase user, reads `offlineLeagueDrafts/{numericLeagueId}`, generates a 14-week round-robin schedule, and writes `leagueSeasons/{numericLeagueId}` in a browser Firestore transaction.
7. `src/screens/LeagueTeams.tsx` exposes publish, franchise request, approval, assignment, and removal workflows.
8. `src/screens/LeagueLineup.tsx` reads the published roster snapshot and saves weekly lineup assignments.

This is the strongest native path, but its primary identity is still the external Sleeper ID, its roster is embedded in the published payload, and it has no post-draft roster ledger.

### Live draft lifecycle

1. `src/routes/AuthenticatedApp.tsx` serves `/host/setup`, `/host`, `/join`, `/draft/:draftId`, and `/results/:draftId`.
2. `src/screens_v2/HostSetupV2.tsx`, `HostLobbyV2.tsx`, `JoinLobbyV2.tsx`, and `DraftRoomV2.tsx` use `src/multiplayer/firebaseBackend.ts`.
3. Firestore `drafts/{draftId}` stores settings and a mutable full snapshot; subcollections store participants, actions, and `auctionState/current`.
4. The host browser consumes action documents and writes the authoritative draft snapshot. Auction bids use a transaction and action-ID duplicate check. Other snapshot updates use direct `updateDoc` without an expected revision.
5. `src/screens_v2/ResultsV2.tsx` and `src/features/draft-results/draftResults.ts` present results.

The live draft is native GameHQ functionality, but the record contains no canonical league ID, season ID, franchise IDs, settings-version ID, or roster transactions. Completion does not publish authoritative league rosters.

### Draft Order Showdown lifecycle

`src/features/draft-order/DraftOrderShowdown.tsx` and its engine modules create a draft order. Local active/saved state is stored in `localStorage`; official draws and share tokens use `draftOrderDraws` and `draftOrderShares`. `offlineDraftHandoff.ts` passes a recoverable local handoff into Offline Draft. The result is not a canonical schedule/draft-order version on a native season.

### Weekly operation lifecycle

- **Team/My HQ:** `src/screens/MyHQ.tsx` is current Sleeper roster, opponent, transactions, and recommendations. It is read-only provider data.
- **Lineup:** `src/screens/LeagueLineup.tsx` is native Firestore state for a published season.
- **Matchup:** `src/screens/LeagueMatchups.tsx` uses the generated schedule but displays projection baselines; it explicitly does not represent live weekly scoring.
- **Players:** `src/screens/LeaguePlayers.tsx` wraps research/Stats Explorer and adds connected Sleeper ownership context. It has no native add/claim command.
- **Standings:** `src/screens/LeagueOverview.tsx` is a navigation/summary surface, not a reproducible native standings table.
- **Transactions:** current activity is imported from Sleeper or imported history. There is no native roster transaction model.
- **History:** `src/features/league-history/**` supplies normalized, public, read-only historical analysis.

## Component and module inventory

| Surface | Exact source | Present responsibility | Authority |
|---|---|---|---|
| Global app routing | `src/App.tsx` | Public/research routes, league workspace routes, legacy redirects, Offline Draft | Router only |
| Authenticated draft routing | `src/routes/AuthenticatedApp.tsx` | Host, join, live room, results, legacy draft UI | Router/session gate |
| League workspace shell | `src/layouts/LeagueWorkspaceLayout.tsx` | League nav and workspace framing | Derived UI |
| Workspace state | `src/features/league-workspace/LeagueWorkspaceContext.tsx`, `leagueWorkspaceState.ts` | Joins route ID, Sleeper connection, My HQ, native season, capabilities | Derived; currently conflates provider and native IDs |
| League overview | `src/screens/LeagueOverview.tsx` | Destination cards and current summary | Derived; not native standings |
| League HQ/connections | `src/screens/LeagueHQ.tsx` | Connect/select Sleeper leagues; League HQ views; Commissioner Studio entry | Mixed imported and local editor state |
| Commissioner editor | `src/features/league-hq/CommissionerStudio.tsx` | Modal editor for identity, rules, managers, stories, odds | Device-local draft promoted directly to device-local saved state |
| League HQ model/store | `src/features/league-hq/leagueHQData.ts`, `useLeagueHQ.ts` | Display/editor model and ballots | `localStorage` |
| League management | `src/screens/LeagueManage.tsx` | Capability gate around League HQ/Commissioner Studio | Derived gate; not a command boundary |
| Teams/claims | `src/screens/LeagueTeams.tsx` | Published teams, publish season, request/approve/remove access | Firestore `leagueSeasons` subtree |
| Lineup | `src/screens/LeagueLineup.tsx` | Weekly assignment editor and whole-week lock | Firestore `lineups`, `weekSettings`, `auditEvents` |
| Matchups | `src/screens/LeagueMatchups.tsx` | Generated schedule and projected matchup cards | Published schedule plus projections |
| Players | `src/screens/LeaguePlayers.tsx`, `src/screens/StatsExplorer.tsx` | Research, values, connected ownership context | Public/local datasets plus Sleeper reads |
| My HQ | `src/screens/MyHQ.tsx`, `src/features/my-hq/myHQ.ts`, `playerPool.ts` | Connected roster, matchup, transaction and recommendation view | Sleeper read model |
| My Teams | `src/screens/MyTeams.tsx` | Portfolio of connected Sleeper leagues | Connection preference/profile |
| League History | `src/features/league-history/ui/LeagueHistoryApp.tsx` and pages | Overview, week, people, records, seasons, drafts, payouts, transactions | Imported `leagueHistories` read model |
| History domain/mapping | `src/features/league-history/domain/types.ts`, `provider/sleeperMapper.ts`, `persistence/firestoreLeagueHistoryModel.ts` | Normalized historical snapshot | Imported external snapshot; not native aggregate |
| History loader/import client | `src/features/league-history/useLeagueHistory.ts`, `persistence/firebaseLeagueHistory.ts`, `automaticImport.ts` | Load, cache, trigger automatic import | Read-only client plus server import request |
| History import service | `server/league-history/handler.ts`, `automaticImport.ts`, `importWorkflow.ts`, `firestoreRest.ts`, `googleFederation.ts`; `shared/leagueHistoryImportProtocol.ts`; `api/league-history/import.js` | Origin-gated import and status API; server OIDC Firestore writes | Trusted import writer, not user-authorized league command service |
| Offline Draft | `src/screens_v2/OfflineDraftV2.tsx`; `src/features/offline-draft/**` | Standalone auction board, sharing, connected second-screen sync | Local recoverable draft and owner-controlled Firestore draft |
| Live drafts | `src/screens_v2/HostSetupV2.tsx`, `HostLobbyV2.tsx`, `JoinLobbyV2.tsx`, `DraftRoomV2.tsx`, `ResultsV2.tsx`; `src/multiplayer/**` | Auction/snake room, participants, actions, results | Separate draft aggregate, browser-host authority |
| Draft store | `src/store/draftStore.ts` | Legacy/client draft state, teams, roster, auction state | Zustand `draft-store` local persistence |
| Draft Order Showdown | `src/features/draft-order/**` | Draw engine, official draw persistence, shares, Offline Draft handoff | Separate draw aggregate |
| Auction values | `src/features/auction-values/**`, `src/data/playerValues.ts` | Source-aware research and league-sized auction values | Research data/preferences, not league authority |
| Analytics/tools | `src/screens/AnalyticsLab.tsx`, `src/screens/Tools.tsx`, `src/screens/tools/**` | Research and decision support | Local/public data; no authoritative mutation |
| Authentication | `src/lib/authSession.ts`, `src/hooks/useEnsureFirebaseSession.ts` | Anonymous session for drafts; permanent Google session for season control | Firebase Auth identity |
| Firebase client | `src/lib/firebase.ts` | Browser Firebase/Firestore initialization | Uses default in-memory cache; no durable IndexedDB persistence configured |

### Exact feature-file inventory

The table above names the screen owners. These are the supporting league feature files present in the audited commit:

- Native season: `src/features/league-season/LeagueAccountPanel.tsx`, `LeagueSeasonHero.tsx`, `LeagueSeasonNav.tsx`, `leagueProjectionFreshness.ts`, `leagueSeasonModel.ts`, `leagueSeasonPersistence.ts`, `useLeagueSeasonDraft.ts`, `useLeagueSeasonManagement.ts`, and `useLeagueWeekLineups.ts`.
- League workspace: `src/features/league-workspace/LeagueWorkspaceContext.tsx`, `ManagerIdentityForm.tsx`, and `leagueWorkspaceState.ts`.
- Connected League HQ: `src/features/league-hq/CommissionerStudio.tsx`, `SleeperConnectionsCloudSync.tsx`, `leagueHQData.ts`, `leagueOddsNavigation.ts`, `sleeperConnections.ts`, `sleeperLeague.ts`, and `useLeagueHQ.ts`.
- My HQ/portfolio: `src/features/my-hq/myHQ.ts`, `playerPool.ts`, and `useMyTeamsPortfolio.ts`.
- League History UI: `src/features/league-history/ui/LeagueHistoryApp.tsx`, `LeagueHistoryImportingState.tsx`, `HistoryHealthPanel.tsx`; `ui/pages/ActivityPage.tsx`, `HeadToHeadPage.tsx`, `HistoryPage.tsx`, `LeaderboardsPage.tsx`, `LeagueDashboardPage.tsx`, `ManagersPage.tsx`, `PayoutsPage.tsx`, `RecordsPage.tsx`, `SeasonsPage.tsx`, and `WeekPage.tsx`; `ui/week/DecisionLab.tsx`, `WeekHeader.tsx`, `WeeklyAwards.tsx`, `WeeklyScoreboard.tsx`, and `WeeklyStandings.tsx`; `ui/draft/DraftIntelligencePanel.tsx`, `ManagerDraftDNASummary.tsx`; and `ui/roster/RosterLegacySummary.tsx`.
- League History domain/services: `src/features/league-history/domain/types.ts`; `provider/sleeperClient.ts`, `sleeperMapper.ts`, `sleeperTypes.ts`, `spreadsheetAuction.ts`; `persistence/firebaseLeagueHistory.ts`, `firestoreLeagueHistoryModel.ts`; `automaticImport.ts`, `useLeagueHistory.ts`, `useLeagueHistoryWeeks.ts`, `useLeagueWeek.ts`; `coverage/historyCoverage.ts`; and every analytics module under `src/features/league-history/analytics/`.
- Offline Draft persistence: `src/features/offline-draft/offlineDraftIdentity.ts`, `offlineDraftPersistence.ts`, `offlineDraftSync.ts`, and `offlineLeagueDraftPersistence.ts`; screen helpers `src/screens_v2/offlineDraftLeagueProfile.ts`, `offlineDraftPlayerOrder.ts`, and `offlineDraftTurn.ts`.
- Live draft engine/services: `src/multiplayer/api.ts`, `auctionClock.ts`, `auctionState.ts`, `bidRules.ts`, `cloudflareGateway.ts`, `draftSnapshot.ts`, `firebaseBackend.ts`, `hostEngine.ts`, `localMode.ts`, `realtime.ts`, and `useDraftSnapshotSubscription.ts`.
- Draft Order Showdown: `src/features/draft-order/DraftOrderShowdown.tsx`, `ModeArtwork.tsx`, `ModeSelector.tsx`, `ParticipantSetup.tsx`, `ResultDialog.tsx`, `ResultPanel.tsx`, `ShowdownRenderer.tsx`, `VerificationPanel.tsx`; the three components under `renderers/`; and `draftOrderEngine.ts`, `draftOrderLeagueAdapter.ts`, `draftOrderPersistence.ts`, `offlineDraftHandoff.ts`, `showdownMachine.ts`, `types.ts`, and `useShowdownAudio.ts`.
- Draft result adapter: `src/features/draft-results/draftResults.ts`.

CSS and purely presentational assets do not own league state. They remain consumers of the components above.

## Current ownership findings

The field-by-field map and replacement owner are in `domain-authority-map.md`. The critical conflicts are:

1. **League identity has four owners:** numeric `SleeperLeagueConnectionSummary.leagueId`, `leagueSeasons.league_id`, `leagueHistories` route IDs, and device-local `LeagueIdentity` in `leagueHQData.ts`.
2. **Team identity has four incompatible shapes:** offline/native `teamId`, live draft `t<teamNumber>`, current Sleeper `roster_id`, and history `${externalSeasonId}-roster-${providerRosterId}`.
3. **Rosters are snapshots in three aggregates:** Offline Draft state, live draft snapshot, and `leagueSeasons.payload`. Sleeper current rosters and historical rosters are separate imported read models.
4. **Permissions conflict:** native control is Firebase UID based, while workspace management also treats a matched Sleeper manager ID equal to the external league owner ID as a management capability. Imported identity therefore affects UI access even though Firestore rules do not grant native writes.
5. **Commissioner settings conflict:** `leagueSeasons.payload.config` affects roster/schedule parsing, while League HQ identity/rules/editorial settings and ballots live under `ffaa-league-hq-v2:*` and `ffaa-league-ballot-v2:*`.
6. **History franchises are seasonal provider records:** they are not permanent GameHQ franchises and cannot own future native records without an explicit mapping.

## Direct authoritative browser writes

| Mutation | Exact code | Current guard | Missing command property |
|---|---|---|---|
| Publish/republish season | `src/features/league-season/leagueSeasonPersistence.ts::publishLeagueSeason` | Browser Firestore transaction and rules | No command ID, settings version, server timestamp, or receipt |
| Request/assign/approve/remove franchise access | Same file: `requestFranchiseClaim`, `assignFranchiseToSelf`, `approveFranchiseClaim`, `removeFranchiseClaim` | Browser transactions and paired claim/membership rules | No role grants, multi-manager model, idempotency, or universal audit |
| Lock/reopen week | Same file: `setLeagueWeekLocked` | Commissioner UID and transaction | No reason, command receipt, settings version, or immutable audit event |
| Save lineup | Same file: `saveLeagueLineup` | Transaction, permission, eligibility, whole-week lock, paired immutable audit | No caller `expectedRevision`; no idempotency key; transaction retries on the newest document and can overwrite a newer lineup |
| Offline standalone/league drafts | `offlineDraftPersistence.ts`, `offlineLeagueDraftPersistence.ts` | Owner UID and `version + 1` rules | Intended recoverable draft, but whole-record last writer wins for the same owner on two clients |
| Live draft root/snapshot | `src/multiplayer/firebaseBackend.ts` | Host/participant rules | Host browser is authority; most snapshot updates have no revision precondition |
| Live auction bid | `firebaseBackend.ts::placeFirebaseBid` | Firestore transaction, action ID duplicate check | Draft-local idempotency only; no league command/audit/roster transaction |
| Draft participant/ready state | `firebaseBackend.ts` | Signed-in participant/host rules | Direct write by design; separate aggregate |
| Draft order draw/share | `src/features/draft-order/draftOrderPersistence.ts` | Firestore rules and immutable/owner shapes | Separate from league season/settings |
| Connection profile | `SleeperConnectionsCloudSync.tsx` | Self-only permanent UID | Preference/cache only; correctly non-authoritative |
| League HQ settings/ballots | `useLeagueHQ.ts` | None beyond same browser | Authoritative-looking commissioner content is local-only |

## Concurrency behavior today

- **Lineups:** Firestore serializes transactions. `saveLeagueLineup` reads the current record inside the transaction and writes `existing.revision + 1`, but the client supplies no expected revision. A stale form is retried against the newest record and its whole assignment map can overwrite the newer lineup. Repeating the same user action creates another audit ID and revision.
- **Season publish:** concurrent publishes by the same commissioner serialize and each accepted transaction increments from the latest revision. The later full payload wins. Older lineup documents remain but are filtered by `season_revision`.
- **Claims/memberships:** document IDs (`franchiseId` for claims and `userId` for memberships) plus atomic paired writes enforce at most one approved/requested user per franchise and one franchise per user.
- **Offline drafts:** Firestore requires exact `version + 1`, but the save function reads the latest record in the transaction and writes the caller's whole state. Two devices using the same owner account serialize; the later caller overwrites the earlier state rather than receiving a stale-state conflict.
- **Live auction bids:** `placeFirebaseBid` is transactional and recognizes the same action ID. Competing bids serialize. General host snapshot writes use `updateDoc` and have no expected revision, so host tabs can overwrite one another.
- **League HQ/local ballots:** no cross-device synchronization, revision, merge, or conflict response exists. `useLeagueHQ.ts` does not subscribe to browser `storage` events; two tabs keep independent in-memory copies and the last save wins locally.
- **Sleeper connection sync:** local and cloud portfolios are merged using connection timestamps. They are preferences, not permission records.

## Offline, retry, and stale-data behavior

- `src/lib/firebase.ts` calls `getFirestore` and does not enable persistent local cache. Firestore's in-memory client cache can retain reads during a tab session; it does not provide durable refresh/restart recovery.
- Firestore transactions require a network connection. Lineup, publish, claim, lock, and owner draft saves expose errors; there is no durable command outbox, idempotent retry, or retry-status UI.
- Offline Draft deliberately persists unfinished state in `localStorage`; this use fits the allowed recoverable-client-state category.
- Live draft queues are local preferences under `ffaa.playerQueue.<draftId>.<teamId>`; authoritative room state remains Firestore.
- Sleeper/provider fetches expose errors and some in-memory/local caches. No canonical last-known operational league read model survives a provider outage.
- League History is durable in Firestore once imported. The automatic import uses a 10-minute Firestore lock and returns importing/ready/error states.

## Hard-coded league assumptions

| Assumption | Exact evidence | Effect |
|---|---|---|
| Numeric Sleeper league identity | `shared/leagueHistoryImportProtocol.ts:15`; `sleeperClient.ts:87`; `sleeperConnections.ts:95,279`; `sleeperLeague.ts:210-212,364,1028`; `leagueSeasonPersistence.ts:115,205,233,261,286,318`; `offlineLeagueDraftPersistence.ts:36,67`; `LeagueHQ.tsx:149,211,226,244,276`; `OfflineDraftV2.tsx:1038,1128`; `firestore.rules:193,196` | Native seasons and routes cannot exist without an external-style numeric ID. Validation in provider-specific import/connection code remains correct after native identity changes |
| Maximum 16 published teams | `leagueSeasonModel.ts:183` truncates with `teams.slice(0, 16)`; `firestore.rules:284-285` limits `franchise_ids` to 2–16 | Data beyond 16 is silently excluded during parsing; rules reject it |
| 14 regular-season weeks | `leagueSeasonModel.ts:4`; `LeagueMatchups.tsx:26,158,172,208,211` | Published schedule generation and matchup navigation are fixed at 14 |
| 18 lineup weeks | `leagueSeasonPersistence.ts:173,188,289,320`; `firestore.rules:443-493,528-530,600-602` | Rules enumerate week keys 1–18; not settings-derived |
| $200 auction default | `OfflineDraftV2.tsx:66,223,321`; `draftStore.ts:214`; `sleeperLeague.ts` budget fallback; public value profiles | A configurable value often exists, but multiple fallbacks assume $200 |
| 12-team default | `OfflineDraftV2.tsx:65,222`; `draftStore.ts:214`; `draftSnapshot.ts:128`; `draftConfig.ts`; auction-value preferences | Several draft/research entry states default to 12 |
| Even team choices in Offline Draft UI | `OfflineDraftV2.tsx:67` lists `[8,10,12,14,16]` | Parser supports 2–32 and round robin supports byes, but the normal selector excludes odd counts |
| Even team choices in live Draft V2 | `src/types/draftConfig.ts` exports `TEAM_COUNTS = [8,10,12,14,16]` and types `teamCount` from that tuple | Host setup cannot represent odd or out-of-list counts even though other code accepts broader numbers |
| Full-PPR default | `leagueSeasonModel.ts` default scoring; `OfflineDraftV2.tsx` default configuration; `draftStore.ts`/`draftConfig.ts`; auction preferences | Configurable in several tools, but the domain has no required versioned active setting |
| Fixed scoring vocabulary in current draft/season models | `leagueSeasonModel.ts` and `src/types/draftConfig.ts` accept only standard, half-PPR, and PPR | Custom scoring rules cannot be expressed by these types |
| Fixed roster defaults and vocabulary | `leagueSeasonModel.ts:238-240` hard-codes FLEX/IDP_FLEX/SUPER_FLEX eligibility; `src/types/draftConfig.ts` exports fixed `SLOT_TYPES` and `DEFAULT_ROSTER_SLOTS`; `src/data/teamRater.ts` has separate defaults | Drafts can configure counts from the supported vocabulary, but published operation has no immutable settings-version owner |
| Research league-size choices/default | `StatsExplorer.tsx:216,1344,2374` uses `[8,10,12,14]`; `src/data/playerValues.ts:34` defaults to 12; auction-value preferences default to 12-team/$200 PPR | These are tool inputs/source defaults, not operational settings, but a native league adapter must supply its actual settings instead of inheriting them |
| One user/one franchise | `leagueSeasonPersistence.ts:471,520`; `LeagueTeams.tsx:225,293`; `managerMemberships/{userId}` and `franchiseClaims/{franchiseId}` in rules | Co-managers and multiple team control cannot be represented |
| Playoffs | No native playoff entity, settings version, bracket engine, or route exists | Playoff size/rules are absent rather than configurable |

Research-source defaults such as a public auction source's documented 12-team/$200 format are not league-domain constraints. They must remain source metadata and must not become canonical settings.

## Security-rule dependencies

`firestore.rules` is part of the current application contract:

- `fantasyManagerProfiles` is permanent-user/self only and explicitly non-authoritative (`firestore.rules:14-40`).
- `leagueHistories` is public read and client write-denied (`:45-54`); the import service writes with Vercel OIDC federation.
- `offlineDrafts` and `offlineLeagueDrafts` are browser-owner aggregates. The latter accepts 2–32 teams and exact `version + 1` (`:156-213`).
- `leagueSeasons` requires a permanent user and a source `offlineLeagueDrafts` owner on create; root reads require any signed-in user (`:216-302`).
- Claim and membership writes must be paired with `getAfter`, enforcing a one-to-one user/franchise relationship (`:304-441`).
- Week settings and lineups enumerate weeks 1–18 (`:443-570`).
- A lineup write must create a matching immutable audit event in the same atomic operation (`:501-569`, `:572-636`). This is valuable and must be preserved.
- Commissioners may delete season roots, week settings, and lineups. Audit events cannot be updated or deleted. A future command layer should prefer reversals and tighten direct client writes.
- Live `drafts` rules authorize host/participants and their action/auction documents (`:640` onward). They do not connect the draft to a league permission model.

The automatic history handler in `server/league-history/handler.ts` checks allowed origins and numeric IDs, but does not authenticate a GameHQ user. Requests without an `Origin` header pass the origin helper. It is suitable only for importing public Sleeper history; it is not a model for authoritative user commands.

## Native versus imported capability matrix

| Capability | Native GameHQ today | Imported/read-only today |
|---|---|---|
| Sleeper connection portfolio | Preference/profile storage | Sleeper league/manager metadata |
| League identity | No independent native identity | Numeric Sleeper league ID drives route/workspace |
| Teams/rosters | Offline/published draft snapshot | Current Sleeper rosters and historical season rosters |
| Membership | Firebase claim/membership for one published season | Sleeper owner/co-owner IDs used for read context and a UI capability signal |
| Weekly lineups | Native Firestore assignments and immutable audit | Sleeper lineup is not written |
| Schedule | Native generated 14-week schedule | Sleeper current/history matchups |
| Matchup scores | No live native scoring; projections only | Sleeper/history completed scores |
| Standings | No authoritative native standings engine | Sleeper standings and imported historical results |
| Transactions | Draft-local action log only | Sleeper current/history transactions |
| Drafts | Native standalone Offline Draft and live rooms | Sleeper draft history import |
| History | No native event-to-history pipeline | Durable normalized Sleeper history |
| Commissioner settings | Device-local League HQ editor plus published draft config | Imported display settings from Sleeper |
| Research/analytics | Native tools and local/public datasets | Sleeper ownership context where connected |

## Existing automated coverage

Current relevant tests include:

- Native season/rules: `leagueSeasonModel.test.ts`, `leagueSeasonPersistence.test.ts`, `leagueSeasonRules.test.ts`, `leagueSeasonFirestoreRules.test.ts`, `leagueLineupLocks.test.tsx`, `leagueProjectionFreshness.test.ts`.
- Sleeper/League HQ: `sleeperConnections.test.ts`, `sleeperConnectionsHook.test.tsx`, `sleeperLeague.test.ts`, `leagueHQ.test.ts`, `useLeagueHQ.test.tsx`, `myHQRecommendations.test.ts`.
- History/import: `automaticLeagueHistoryImport.test.ts`, `firestoreLeagueHistoryModel.test.ts`, `leagueHistory.test.ts`, `leagueHistoryCoverage.test.ts`, `leagueHistoryImportingState.test.tsx`, history page/analytics tests.
- Offline Draft: identity, sharing, league profile, connected sync, assignment removal, price editing/sort, handoff, and turn tests under `src/__tests__/offlineDraft*.test.*` and `offlineLeagueDraftSync.test.tsx`.
- Live draft: `multiplayer.test.ts`, `draftConfig.test.ts`, `draftResults.test.ts`, plus draft UI tests.
- Routing: `productionRouteContract.test.ts`, `routeMetadata.test.ts`, and navigation tests.
- Draft Order: engine, state, league adapter/apply, official order, field layout, and Showdown UI tests.

The current suite tests the existing behavior, including fixed week ranges and one-franchise membership. It does not establish the requested target invariants.

### Required gaps for the first slice

- Native UUID league IDs independent of all provider IDs.
- Uniqueness and resolution of external-provider mappings.
- Old numeric route to canonical GameHQ route migration, including absent/ambiguous mapping behavior.
- Authority label matrix for native read/write, connected read-only, migration preview, and mirror mode.
- Membership/role permission matrix, co-manager control, revocation, expiry, and separation from imported identity.
- Immutable settings versions and simultaneous-publish conflict.
- Authenticated server command boundary and proof that clients cannot write canonical authoritative collections.
- Lineup command idempotency, stale expected-revision rejection, retry receipt, and commissioner override reason.
- Server timestamps and universal audit fields.
- Two-client stale lineup integration test.
- Desktop and mobile operational League Home route.

## Exact architectural conflicts to resolve

| Current model | Decision | Reason |
|---|---|---|
| `leagueSeasons/{numericId}` root with embedded payload | **Retain as legacy source; migrate into canonical League/Season/Franchise/SeasonTeam; then make read-only compatibility data** | Contains published seasons, rosters, claims, lineups, and audits that cannot be discarded |
| `leagueHQData.ts` + `ffaa-league-hq-v2:*` | **Split and merge** | Commissioner identity/rules move to versioned settings; editorial history content can migrate separately; device state remains only an unfinished draft until published |
| Sleeper connection summaries/profile | **Retain as connection preferences and migration input** | Useful existing connections; must not define authority or league identity |
| `leagueHistories` snapshot | **Retain as imported read model; map to canonical league/franchise identities without rewriting source snapshots in place** | Valuable normalized history; provider IDs remain provenance |
| Offline Draft models | **Retain standalone aggregate; add native league/season/franchise handoff adapter** | Existing product must remain usable and drafts are legitimately recoverable client state before publish |
| Live `drafts` aggregate | **Retain, then attach canonical IDs and command/transaction output** | Strong current draft capability; browser-host roster mutation cannot remain final authority |
| Draft Order aggregate | **Retain as draft input; later publish a versioned order to a season** | Existing draw and share functionality remains useful |
| Current Sleeper My HQ model | **Retain as imported read model** | Provides current connected experience; never claim provider writes |
| `LeagueIdentity`, history `FantasyLeague`, Sleeper league summary, and `leagueSeasons.league_id` as peer identities | **Replace with one canonical `League.id`; preserve the others as settings/projection/external mappings** | Eliminates route and ownership ambiguity |

## Phase 0 conclusion

The repository already proves that a narrow migration is viable: it has Firebase Auth, Firestore transactions and rules, a server-side Vercel function build convention, normalized provider adapters, route compatibility redirects, and an immutable paired lineup audit. The first slice should reuse those strengths while changing who owns identity and mutations.

No persisted collection should be deleted or rewritten in place in the first slice. Canonical documents, mapping indexes, adapters, command receipts, and explicit authority UI must be introduced behind a feature flag; existing numeric routes, connection keys, imported history, saved drafts, and published seasons remain readable throughout migration.

## Phase 1A implementation delta

Implementation branch: `codex/native-league-foundation`, based on `origin/master` commit `aa49324bff348fa9d07dcc9e33b4fe54589d980f`. This branch is not deployed to Production.

- `src/features/league-domain/**` now defines canonical League, Season, Franchise, SeasonTeam, membership, role-grant, external-connection, settings-version, authority, command, receipt, and audit contracts.
- `server/league-commands/**` and `/ff/api/league-commands/execute` now form an authenticated command boundary. Firebase ID tokens are verified server-side; anonymous identities and request-body actor substitution are rejected.
- New league and mapped-connection UUIDs are deterministically derived by the server from the verified actor and command ID. Sleeper's numeric check remains only in the Sleeper connection command and legacy adapters.
- `externalLeagueMappings/{provider__externalLeagueId}` resolves old provider routes to the permanent GameHQ league UUID. The route adapter preserves the remaining path, query, and hash.
- `/league/:gamehqLeagueId` now renders `LeagueHome`, not History. The workspace header persistently shows Native read/write, Connected read-only, Migration Preview, or Mirror Mode authority.
- Existing published `leagueSeasons/{sleeperLeagueId}` records migrate on first explicit attach into a `legacy_backed_native` canonical workspace. GameHQ commissioner and approved-membership data produces canonical role grants; Sleeper owner identity never does.
- Weekly lineup saves no longer call a browser Firestore transaction. The screen sends a command ID and exact expected revision; the server validates current settings, role scope, franchise mapping, lineup legality, and lock state, then atomically writes legacy-backed state, canonical audit, legacy-compatible audit, and command receipt.
- Direct browser creates/updates/deletes for activated legacy lineups/audits and all canonical commands/lineups/audits/roles/settings are denied in `firestore.rules`.
- No new authoritative localStorage key was added. Existing Sleeper connection preferences remain compatibility input only.

Deliberate remaining direct legacy writes are season publication, claims/membership approval, and whole-week locking. They are outside the one-command lineup proof and remain scheduled for command expansion; the UI and documentation do not claim the entire legacy management surface has moved server-side.

## Phase 2 implementation delta

- Native settings drafts, publication, and forward-only restoration now use the authenticated command boundary and immutable `settingsVersions` documents. The active season pointer is the only rules authority.
- Publishing reconciles native `franchises` and seasonal `seasonTeams` in the same commit, rather than asking commissioners to create local team records.
- Canonical manager invitations, acceptance, revocation, and membership removal use email-bound expiring tokens and canonical role grants. Provider ownership is not consulted.
- `/league/:gamehqLeagueId/commissioner/teams` and `/league/:gamehqLeagueId/join` expose the native administration/acceptance workflows. The commissioner overview calculates setup health from actual canonical reads.
- Existing `franchiseClaims`, `managerMemberships`, and Sleeper connection storage remain compatibility data. Phase 2 does not delete, rewrite, or use them to silently grant canonical access.

## Phase 3 implementation delta

- Native player ownership now has one atomic authority: `seasonTeams.roster_player_ids` plus update-time-guarded `assetLocks/player__{playerId}` documents. Duplicate and stale acquisitions fail instead of creating split ownership.
- `apply_roster_transaction` and `reverse_roster_transaction` atomically persist roster revisions, the immutable transaction ledger, season revision, command receipt, public audit, commissioner-private audit metadata, notification outbox, and read-model invalidation.
- Reversals create inverse transactions and preserve the original receipt and audit lineage. A reversal is rejected when the current asset state no longer matches the original transaction result.
- `/league/:gamehqLeagueId/commissioner/audit` is the operational ledger view. Browser writes to canonical rosters, locks, transactions, private audit metadata, and pipeline hooks are denied by `firestore.rules`.
- Legacy-backed roster snapshots remain compatibility authority until an explicit native draft/import cutover. Phase 3 does not infer locks from imported provider rosters.

## Phase 4 implementation delta

- Native drafts now live under the canonical season and reference the published settings version and permanent franchise IDs. Live and slow clocks, draft order, team queues, auction state, results, and revisions survive refresh/reconnect.
- Snake, linear, third-round reversal, and auction actions are server commands. A pick or sale and its roster lock/transaction are one commit; two stale clients cannot both win the same turn or player.
- Commissioner and co-commissioner controls pause/resume, settle expired auctions, and revert the last untouched result with a required reason and inverse roster receipt.
- Manager and commissioner routes use the canonical draft subscription. Tokenized public spectator projections omit manager queues and actor identity; direct browser writes to drafts and projections are denied.
- Existing live-room and offline-draft collections remain usable and unchanged. They remain non-authoritative until a commissioner explicitly chooses a future validated import workflow.

## Phase 5 implementation delta

- Canonical native seasons now own weekly game/player state under `lineupWeeks/week-{week}` and team assignments under `lineups/{franchiseId}_week-{week}`. Both are member-readable and server-command-only.
- Published settings select scheduled kickoff, actual start, first-game, or Thursday-split behavior plus postponed/canceled handling, late swap, ordered inactive fallback, and manual/best-ball mode. The earlier `player_start` value remains a supported compatibility alias.
- Native lineup saves validate authenticated franchise control, lineup/season/roster/week/settings revisions, active roster ownership, every required starter, duplicates, position eligibility, IR separation, and the derived lock of every changed player.
- A locked Thursday player can remain fixed while an unlocked Sunday player changes. Postponed games use original, rescheduled, or actual-start timing; canceled games lock or unlock according to the active settings.
- Commissioner emergency reopenings are player-scoped, time-bounded, reason-required, and immutable in the universal audit. Multiple managers subscribe to the same authoritative week and lineup documents.
- The manager UI shows legality, starter count, bye/injury warnings, projected total, exact per-player lock reason/time in league timezone, next deadline, roster/settings revisions, save state, and ordered fallbacks. Commissioner controls publish kickoff groups without JSON and expose audited emergency reopening.

## Phase 6 implementation delta

- Native leagues now have a provider-neutral NFL event contract. The release does not call or name an undocumented live-data source; an authenticated fixture/manual ingress and fallback-provider field prove the boundary without pretending an unapproved feed is live.
- Each stable provider event is normalized once, scored by the exact published settings version, and preserved through immutable revisions. Duplicate semantic retries do not add points. Reordered source events are sorted deterministically; replacement and superseding corrections require a reason and remain visible.
- Every accepted batch and explicit full replay rebuilds player/game totals, lineup and bench totals, optimal comparison, matchup totals, win probabilities, scoring feed, lead changes, active-game context, and Week standings projection in one server commit.
- Native `/matchup`, `/team/matchup`, `/matchups`, and `/schedule` consumers use the canonical realtime scoring projection. Connected Sleeper leagues keep their existing read-only path.
- The matchup UI distinguishes current score from projected final, never labels season PPG as a weekly score, and explicitly identifies delayed/stale data and cached last-known totals. Stat corrections include count and replay disclosure.

## Phase 7 implementation delta

- Canonical native seasons now own the player market through queryable player/waiver/team/run/receipt documents layered over the unique roster asset locks. Initialization preserves current owners and special locked/protected/ineligible/trade-block states.
- Published redraft settings cover all requested acquisition modes, FAAB/zero bids, league-timezone run cadence, dropped-player holds, weekly and positional limits, deterministic tiebreakers, optional commissioner review, and optional runner-up bid disclosure.
- Claim submission stores ordered conditional alternatives and an exact settings/roster snapshot. Structural errors reject the command, while an individually illegal alternative is preserved with a reason so later fallbacks can still be evaluated.
- Processing compares claims deterministically, prevents duplicate awards, applies multiple winning groups for a franchise through one final roster/team-state write, and enters every successful add/drop through the universal transaction and lock ledger.
- The protected scheduler endpoint is cadence-independent and has deterministic retry IDs. Vercel Hobby currently permits only the configured daily recovery invocation; the Players screen exposes immediate commissioner processing at each league's stored custom due time. Exact unattended sub-daily cadence requires upgrading the scheduler host/plan, not rewriting claim logic.
- Pending bids are readable only by the submitting account and commissioners. Completed receipts show the outcome and allowed explanation fields to league members; all player-market browser writes remain denied.
- Native `/players` is now an operational player market. Connected leagues keep the existing read-only recommendation and Stats Explorer behavior.

## Phase 8 implementation delta

- Canonical native seasons now own the full two-team offer lifecycle: create, counter, reject, expire, accept, review, vote, process, and receipt. Connected-provider transaction history remains unchanged and read-only.
- Every new offer snapshots its teams, Week, expiry, published settings version, message, and complete assets for both sides. The server revalidates ownership on creation and again at acceptance/final processing.
- Accepted trades awaiting review reserve every asset with create-only locks. Concurrent acceptance involving the same player, pick, FAAB balance, contract, keeper right, salary, or conditional asset fails without partial roster mutation.
- Immediate, commissioner, co-commissioner, fixed-period, and majority league-vote paths are explicit. Commissioner-controlled-team conflicts are derived across the league's active authority and team-control grants; configured conflicts require an uninvolved reviewer and remain disclosed in the offer and receipt.
- Atomic completion transfers players and FAAB now, supports the advanced asset ledger when those states are initialized, rechecks live player locks and the trade deadline, applies the configured roster policy, and co-commits the universal transaction, public/private audit, season revision, notifications, read-model invalidation, and immutable receipt.
- Native `/transactions` and `/trades` render an operational Trade Center. The connected-league path still resolves to normalized imported transactions.

## Phase 9 implementation delta

- Native season schedules are deterministic, seed-addressable, revisioned, and backed by immutable published versions. Odd-team byes, protected rivalries, multiple weekly slots, division/conference context, and two-week series are first-class schedule records rather than UI-only previews.
- The command boundary validates schedule completeness and conflicts, records score corrections as new immutable revisions with a reason, and reconstructs the entire standing table from current final result records after each result command.
- Standings expose physical, division, median, and all-play records plus PF, PA, potential points, efficiency, streak, remaining SOS, playoff probability/state, and the rule that first separated each seed.
- The playoff builder publishes arbitrary-size fields, byes, fixed/reseeded rules, round duration, placement formats, and manual qualifier disclosure into a current bracket plus an immutable bracket version.
- Native `/schedule` and `/standings` now own operations and display respectively. Existing connected-league readers remain the compatibility path and are not promoted by viewing either route.

## Phase 10 implementation delta

- Native League Home answers the five immediate manager questions from canonical competition, lineup, scoring, waiver, trade, draft, membership, and authority state. Its lineup status validates every required slot, unique assignment, and player-position eligibility.
- Native Team no longer falls through to the connected My HQ screen. It owns weekly lineup work while the connected provider keeps its existing route behavior.
- Native Transactions consolidates the activity ledger, waiver workspace, trade workspace, and a current team/FAAB market table under keyboard-operable tabs whose selected state is reflected in the URL.
- A single league player side sheet is available from lineup, live matchup, draft, waiver, and trade rows. The sheet provides the same evidence structure and dismissal/focus contract in every consumer.
- League mobile navigation is Home, Matchup, Team, Players, and More. State is never conveyed by color alone; live/status surfaces expose source/freshness language and retain the last rendered projection while hooks refresh.
- Phase 10 adds no datastore and grants no new client write capability. It is a projection and route consolidation over Phase 1–9 authority.

## Phase 11 implementation delta

- Native League Pulse is the league conversation and evidence surface. Human posts, reactions, replies, polls, announcements, reminders, trade-block updates, and formal proposals persist through authenticated commands; transaction/audit, score, rivalry, lead-change, record, and award cards are rebuildable projections.
- Native History derives its ledger from permanent franchise IDs, season teams, final results, lineups, drafts, waivers, trades, and audits. Manager accounts and seasonal names remain attributes around the permanent franchise identity rather than becoming history keys.
- Formal proposals preserve both rule-language versions, effective season, threshold, voting window, voter choices, result, and explanation. Votes use exact proposal revision checks so concurrent stale submissions cannot overwrite another vote.
- The decision engine is read-only: it identifies the exact settings/ownership/FAAB/lineup/opponent/bye facts it used, labels unavailable evidence and uncertainty, and returns no mutation. Domain commands remain the only write authority.
- Commissioner safe mode documents preview, required reason, impact, restore/reversal, and audit behavior. The mirror parity panel names native and imported sources, mismatches, and unavailable evidence while leaving the league's explicit authority mode untouched.
