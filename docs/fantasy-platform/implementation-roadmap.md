# Fantasy platform implementation roadmap

The roadmap follows the requested phases in order. Each phase is a bounded change set with schema, compatibility, automated verification, and an honest limitation report. No later engine starts because an earlier screen exists.

## Phase status

| Phase | Scope | Status | Exit gate |
|---|---|---|---|
| 0 | Exact current-state, authority, route, persistence, migration, and implementation audit | Complete in this document set | Six documents present; no application/schema mutation |
| 1A | First vertical native-league foundation | Implemented; exact Preview verified; Production unchanged | First-slice evidence and limits below |
| 2 | Creation wizard and full Commissioner workspace/settings publication | Native redraft exit gate implemented locally through 2A and 2B | Valid native redraft league, immutable settings, and assigned managers |
| 3 | Universal command, roster transaction, and audit expansion | Implemented for canonical player ownership, commissioner correction/reversal, and pipeline hooks | Concurrent ownership is atomic and every roster mutation has a receipt |
| 4 | Native-league draft integration | Implemented for authoritative auction, snake, linear, and third-round-reversal rooms | Draft completion creates roster transactions |
| 5 | Weekly operation and player-level locks | Implemented for native lineups, week game states, ordered fallbacks, and emergency reopenings | Cross-device lineups and settings-derived lock behavior |
| 6 | Provider-agnostic scoring | Implemented with normalized events, deterministic replay, corrections, freshness, and native live matchup UI | Deterministic replay/corrections and live freshness UI |
| 7 | Free agents and waivers | Implemented with canonical player states, complete redraft waiver settings, ordered claim groups, atomic processing, and receipts | Atomic reproducible processing and receipts |
| 8 | Two-team trades | Implemented with two-team offers/counters, atomic player and extensible asset transfers, review/voting, conflict controls, and receipts | Atomic asset locks/review/receipts |
| 9 | Schedule, standings, playoffs | Implemented | Reproducible standings, explainable seeds, valid brackets |
| 10 | Operational UI consolidation | Implemented | Desktop/mobile parity and dense operational surfaces |
| 11 | League Pulse, native history, decision tools, mirror/migrate | Implemented | Native actions feed history and explainable activity |
| 12 | Keeper, dynasty, salary cap | Blocked on reliable native redraft | Advanced assets/contracts without burdening redraft |

## Phase 0 deliverables

- `docs/fantasy-platform/current-state-audit.md`
- `docs/fantasy-platform/domain-authority-map.md`
- `docs/fantasy-platform/route-map.md`
- `docs/fantasy-platform/persistence-inventory.md`
- `docs/fantasy-platform/migration-plan.md`
- `docs/fantasy-platform/implementation-roadmap.md`

Phase 0 changes documentation only. It does not create collections, migrate data, deploy, or change Production behavior.

## Phase 1A — first vertical native-league foundation

### Outcome

Create the canonical identity and permission seam, preserve old connections/routes, render an operational League Home with explicit authority, and prove the server command architecture by moving weekly lineup save behind it.

### Exact files to add

#### Shared/domain client

- `src/features/league-domain/types.ts` — League, Season, Franchise, SeasonTeam, LeagueMembership, RoleGrant, ExternalConnection, SettingsVersion, LeagueAuthority, AuditEvent, command receipt types.
- `src/features/league-domain/authority.ts` — pure role/permission and authority-label resolver. Provider identity is not an input to write permission.
- `src/features/league-domain/LeagueRepository.ts` — read/route-resolution interface.
- `src/features/league-domain/firebaseLeagueRepository.ts` — canonical Firestore reads and subscriptions.
- `src/features/league-domain/legacyLeagueAdapters.ts` — adapters for connection, `leagueSeasons`, and history provenance.
- `src/features/league-domain/legacyLeagueRouteAdapter.ts` — canonical UUID/provider mapping/legacy route resolution.
- `src/features/league-domain/LeagueCommandService.ts` — browser-facing command interface.
- `src/features/league-domain/httpLeagueCommandService.ts` — authenticated HTTP implementation; no direct canonical writes.
- `src/config/featureFlags.ts` — `nativeLeagueFoundation` parsing with a default-off safe path.
- `src/screens/LeagueHome.tsx` — compact operational home using verified existing data and explicit unavailable states.

#### Shared/server command path

- `shared/leagueCommandProtocol.ts` — command envelope, response/error contract, request hashing rules, endpoint constant.
- `server/league-commands/authenticateFirebaseUser.ts` — verifies Firebase ID tokens and supplies the server actor.
- `server/league-commands/handler.ts` — authenticated Vercel HTTP entry, method/body/error handling.
- `server/league-commands/executeLeagueCommand.ts` — idempotency lookup, permission/settings/revision checks, dispatch, atomic receipt/audit contract.
- `server/league-commands/saveWeeklyLineup.ts` — first command implementation, including legacy-backed and canonical storage adapters.
- `server/league-commands/firestoreAdmin.ts` — server Firestore transaction adapter and server timestamps.
- `api/league-commands/execute.js` — CommonJS wrapper matching the existing generated-function convention.
- `scripts/build-league-command-function.mjs` — bundles the server handler for Vercel.
- `scripts/migrate-native-league-foundation.ts` — explicit dry-run/apply migration with idempotency key, source/target counts, hashes, and report output.

#### Tests

- `src/__tests__/nativeLeagueDomain.test.ts`
- `src/__tests__/nativeLeagueAuthority.test.ts`
- `src/__tests__/nativeLeagueMigration.test.ts`
- `src/__tests__/nativeLeagueRoutes.test.tsx`
- `src/__tests__/leagueCommandService.test.ts`
- `src/__tests__/saveWeeklyLineupCommand.test.ts`
- `src/__tests__/nativeLeagueFirestoreRules.test.ts`
- `e2e/native-league-routing.e2e.ts`

### Exact existing files to change

#### Build/deployment/security

- `package.json` — build both Vercel functions, add migration/test commands, and add the server Firebase dependency selected during implementation.
- `package-lock.json` — lock dependency/script changes.
- `vercel.json` — `/ff/api/league-commands/execute` rewrite, function include/max-duration declaration.
- `firestore.rules` — deny direct clients on canonical authoritative paths; retain compatible reads; close activated legacy lineup writes to clients.
- `firestore.indexes.json` — only indexes proved necessary by the repository implementation.
- `firebase.json` — add emulator/test target only if the new rules test requires a distinct command.

#### Routing/workspace/UI

- `src/App.tsx` — League Home index, canonical target aliases, mapping-aware legacy redirects.
- `src/layouts/AppShellV2.tsx` — global Leagues/Draft/Research/Profile grouping without deleting routes.
- `src/layouts/LeagueWorkspaceLayout.tsx` — target league navigation and persistent authority label.
- `src/features/league-workspace/LeagueWorkspaceContext.tsx` — separate canonical identity, external connection, read provenance, and GameHQ permissions.
- `src/features/league-workspace/leagueWorkspaceState.ts` — new resolved workspace state types.
- `src/lib/routeMetadata.ts` — League Home/commissioner canonical metadata.
- `src/screens/LeagueHQ.tsx` — map/attach a connection without treating its ID/owner as native authority; show read-only/migration states.
- `src/screens/LeagueManage.tsx` — use canonical permission resolution and canonical commissioner route entry.
- `src/screens/LeagueLineup.tsx` — submit command ID and exact expected revision; display pending, conflict, retry, and receipt states.

#### Persistence and compatibility

- `src/features/league-season/leagueSeasonPersistence.ts` — remove browser lineup mutation from the exported screen contract; retain parsers/subscriptions and a clearly named legacy adapter.
- `src/features/league-season/useLeagueWeekLineups.ts` — canonical/legacy read repository and revision exposure.
- `src/features/league-season/useLeagueSeasonManagement.ts` — derive permissions from canonical roles when mapped; preserve legacy reads.
- `src/features/league-hq/sleeperConnections.ts` — connection schema/parser can retain optional canonical mapping metadata; provider numeric validation remains provider-specific.
- `src/features/league-hq/SleeperConnectionsCloudSync.tsx` — sync the versioned preference shape without granting permissions.

#### Existing tests to update

- `src/__tests__/productionRouteContract.test.ts`
- `src/__tests__/routeMetadata.test.ts`
- `src/__tests__/leagueSeasonPersistence.test.ts`
- `src/__tests__/leagueSeasonRules.test.ts`
- `src/__tests__/leagueSeasonFirestoreRules.test.ts`
- `src/__tests__/leagueLineupLocks.test.tsx`
- `src/__tests__/sleeperConnections.test.ts`
- `src/__tests__/sleeperConnectionsHook.test.tsx`

If implementation proves that an exact listed file is not required, the phase change report must say why. If an additional file is required, it must be named and justified before broadening the slice.

### Schema additions

Initial canonical paths:

```text
leagues/{gamehqLeagueId}
leagues/{gamehqLeagueId}/seasons/{seasonId}
leagues/{gamehqLeagueId}/franchises/{franchiseId}
leagues/{gamehqLeagueId}/seasons/{seasonId}/seasonTeams/{seasonTeamId}
leagues/{gamehqLeagueId}/memberships/{userId}
leagues/{gamehqLeagueId}/roleGrants/{roleGrantId}
leagues/{gamehqLeagueId}/externalConnections/{connectionId}
leagues/{gamehqLeagueId}/settingsVersions/{settingsVersionId}
leagues/{gamehqLeagueId}/commands/{commandId}
leagues/{gamehqLeagueId}/auditEvents/{auditEventId}
leagues/{gamehqLeagueId}/seasons/{seasonId}/lineups/{lineupId}  # new native seasons
externalLeagueMappings/{provider__externalLeagueId}
```

Existing published seasons use a recorded legacy persistence pointer until their lineup cutover. No current collection is deleted or renamed.

### Required tests

#### Identity/migration/routing

- Native UUID creation without external connection.
- Connect/remove Sleeper while League UUID remains stable.
- One unique mapping under two concurrent connect requests.
- Old numeric route, suffix, query, and hash redirect to canonical UUID.
- Unmapped saved Sleeper connection remains accessible read-only.
- Imported history remains available through old and canonical route.
- `/league/:gamehqLeagueId` renders Home, not History.
- Labels cover native read/write, connected read-only, migration preview, and mirror.

#### Permissions

- Commissioner, co-commissioner, team owner, co-manager, specialist role, guest, expired/revoked grant, and anonymous cases.
- Multiple users control one franchise when settings allow it.
- One user can control multiple franchises only when settings allow it.
- Sleeper owner/co-owner without GameHQ grant cannot write.
- Direct browser write to canonical lineup/role/settings/audit is denied.

#### Command/concurrency

- Legal lineup save.
- Position/duplicate/required-slot/roster violation.
- Locked lineup and commissioner override with required reason.
- Same command retried before/after response loss returns one receipt, one revision, one audit.
- Same command ID with different payload is rejected.
- Stale expected revision returns conflict and does not mutate.
- Two clients save from the same revision; exactly one succeeds.
- Actor comes from verified token, not request body.
- State, receipt, and audit fail/commit together.

#### UI/E2E

- Desktop and mobile League Home and authority label.
- Legacy link transition.
- Lineup pending, conflict, retry, locked, and receipt states.
- Existing Offline Draft, live draft, history, research, auction values, analytics, and tools smoke routes remain reachable.

### Verification commands

Run from a clean, scoped checkout based on the current release commit when implementation begins:

```powershell
npm run lint
npx vitest run src/__tests__/nativeLeagueDomain.test.ts src/__tests__/nativeLeagueAuthority.test.ts src/__tests__/nativeLeagueMigration.test.ts src/__tests__/nativeLeagueRoutes.test.tsx src/__tests__/leagueCommandService.test.ts src/__tests__/saveWeeklyLineupCommand.test.ts
npm run test:firestore-rules
npx vitest run --pool=threads --maxWorkers=2
npm run build:vercel:artifact
npm run test:e2e
```

Then render and verify the important canonical/mapped routes at desktop and mobile widths. A Vercel `READY` state alone is not acceptance; the exact deployed commit and rendered behavior must be proven.

### First-slice definition of done

- New native league has a server-generated permanent GameHQ UUID.
- Sleeper is an attached read-only ExternalConnection; removing it does not remove the league.
- Saved connections/history/published seasons remain accessible.
- GameHQ membership/roles, not provider identity, decide permissions.
- Native, read-only imported, migration-preview, and mirror authority are persistent and visible.
- The league index is operational Home.
- Browser code cannot directly write activated lineup state.
- A lineup save uses authenticated server command, expected revision, settings reference, idempotency, server timestamp, receipt, and immutable audit.
- Duplicate commands do not duplicate; stale commands do not overwrite.
- No new authoritative native state relies on localStorage.
- Type checking, lint, targeted/full relevant tests, build, and desktop/mobile route checks pass.
- All six Phase 0 documents are revised from proposed to implemented facts.

## Phase 2 — creation and Commissioner workspace

- Full-page Commissioner overview and section routes; retire modal-only editing after compatibility migration.
- Redraft creation wizard and only functional templates.
- Server-side settings drafts, validation, preview impact, atomic publish, immutable version history, restore command.
- Machine-readable settings produce linked plain-English constitution.
- Deterministic rules simulator and validation engine.
- Roles/invitations/multiple managers implemented through commands.

Gate: a commissioner creates and publishes a valid native redraft league; invalid settings cannot publish; no partial field publication.

### Implemented Phase 2A — native rulebook and publication

- Native creation now lands in the full-page commissioner rulebook with a functional redraft template.
- `save_settings_draft`, `publish_settings`, and `restore_settings_version` use the authenticated command boundary, exact season revision, idempotency receipt, audit event, and one atomic Firestore commit.
- Drafts are immutable documents. Publishing creates a new active version, supersedes only the prior version status, advances the season pointer, and activates the league. Restore is a forward publication, not a history rewrite.
- Full-document server validation blocks invalid publication without changing the season, league, version pointer, receipt, or audit state.
- The deterministic rule-impact preview calculates roster size, draft population, matchups, byes, and auction pool. The same settings generate `/league/:gamehqLeagueId/rules` as a plain-English constitution.
- Firestore permits active canonical members to list settings history and continues to deny every direct browser settings write.

Phase 2A verification: TypeScript application/API checks, lint, focused settings/command tests, Firestore emulator rules tests, and the Vercel artifact build pass. Midseason publication is intentionally locked until the required material-impact reason workflow exists.

### Implemented Phase 2B — teams, invitations, and setup health

- Publishing a native rules version now provisions permanent franchises and active season-team seats from the published team count in the same atomic commit. Restoring a larger version reactivates the canonical seats; shrinking is blocked when a removed seat still has an active manager grant or pending invitation.
- `create_league_invitation`, `accept_league_invitation`, `revoke_league_invitation`, `remove_league_member`, and `provision_season_teams` use the authenticated command boundary, exact season revision, idempotent receipt, immutable audit, and one atomic Firestore commit.
- Invitations are seven-day, random-token, hash-at-rest, and email-bound. The browser receives the token only in the create receipt; acceptance verifies the authenticated Firebase email before creating membership and role grants.
- Primary commissioner and co-commissioner authority are separate from team ownership. A primary commissioner can appoint or remove a co-commissioner. A co-commissioner can invite team managers but cannot appoint league authority. Published co-manager and multi-team rules are enforced server-side.
- `/league/:gamehqLeagueId/commissioner/teams` is a compact teams-and-roles workspace for invites, owner/co-manager state, pending invitation revocation, and audited removal/replacement. `/league/:gamehqLeagueId/join` is the signed-in acceptance route.
- The commissioner index now uses canonical team, membership, invitation, connection, and audit data for setup gates and its action queue. Unfinished engines are labeled `Not active` or `Not configured`; no synthetic counts are displayed.
- Firestore lets canonical managers read the membership/role/invitation administration views while continuing to deny all direct browser writes.

Phase 2B rollback is code/flag based and never deletes canonical teams, memberships, grants, invitations, commands, or audits. Existing Sleeper connections, legacy claims, and legacy team membership paths are not migrated or removed by these commands.

## Phase 3 — command, transaction, and audit expansion

- Generalize the lineup proof to membership/settings/schedule/roster/commissioner commands.
- Add universal `RosterTransaction`, asset locks, reversal links, public/private audit views, notification/read-model hooks.
- Remove direct browser writes to all canonical roster/score/standings/playoff state.

Gate: concurrent/duplicate/stale mutations are deterministic, every action has a receipt, and one player cannot be placed on two teams.

### Implemented Phase 3 — universal roster ledger and audit boundary

- `apply_roster_transaction` and `reverse_roster_transaction` extend the authenticated `LeagueCommandService` contract. Direct browser use is limited to reasoned commissioner add/drop and correction types; draft, waiver, and trade phases must call the same server ledger rather than claim those command types from the client.
- Canonical `seasonTeams` now hold the authoritative sorted `roster_player_ids` and `roster_revision`. Each player also has one update-time-guarded `assetLocks/player__{playerId}` ownership document, so concurrent acquisitions cannot put one player on two teams.
- An accepted command atomically updates every affected roster and lock, the season revision, immutable `rosterTransactions/{transactionId}`, public audit, commissioner-only audit metadata, command receipt, notification outbox event, and read-model invalidation.
- Roster transactions preserve assets leaving/entering, exact settings version, actor, effective time, before/after roster revisions, approval/review state, audit ID, and reversal lineage. The schema names future pick, FAAB, keeper, contract, and salary-cap assets without enabling unfinished engines.
- Reversal creates a new inverse transaction and audit receipt. It never edits the original command receipt, and it fails safely if any asset has moved since the original transaction.
- `/league/:gamehqLeagueId/commissioner/audit` renders a dense immutable ledger with actor, command receipt, transaction, revision delta, reason, and eligible reversal action. Mobile collapses the table into labeled rows.
- Public `auditEvents` no longer receive private source metadata for new lineup/roster commands. `auditPrivate/{auditId}` is readable only by an active commissioner or co-commissioner; browser writes remain denied.

Exact Phase 3 implementation files: `shared/leagueCommandProtocol.ts`; `server/league-commands/commandSupport.ts`, `executeLeagueCommand.ts`, `rosterTransactionCommands.ts`, `saveWeeklyLineup.ts`, `teamProvisioning.ts`, and `connectExternalLeague.ts`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/features/league-membership/CommissionerAuditWorkspace.tsx`, `commissionerAudit.ts`, `leaguePeople.ts`, and `league-people.css`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/screens/LeagueManage.tsx`; `src/lib/routeMetadata.ts`; and `firestore.rules`. Phase-specific coverage is in `src/__tests__/rosterTransactionCommands.test.ts`, `commissionerAuditWorkspace.test.tsx`, `nativeLeagueFirestoreRules.test.ts`, `routeMetadata.test.ts`, and the updated command/UI fixtures.

Phase 3 compatibility/rollback: existing legacy published rosters remain authoritative for `legacy_backed_native` seasons and are not copied into the native asset-lock index. Disabling the native feature returns to compatibility reads without deleting canonical transactions. Notification and read-model outbox records are durable pending hooks; their consumers arrive with the operational domains.

## Phase 4 — native draft integration

- Attach native IDs/settings/franchise map to existing live and offline draft aggregates.
- Add snake, auction, linear, third-round reversal, slow draft, reconnect/revert/co-host commands incrementally.
- Each accepted pick/auction win creates a roster transaction.
- Preserve standalone Offline Draft and Showdown.

Gate: completed native draft publishes authoritative rosters without manual JSON and survives reconnect.

### Implemented Phase 4 — canonical native draft handoff

- `create_native_draft`, `start_native_draft`, `apply_native_draft_action`, and `revert_native_draft_action` run through the authenticated league command service with exact season and draft revisions. Duplicate commands return one receipt; concurrent stale clients cannot both select the current player.
- The native draft aggregate stores the active settings version, permanent franchise order, auction budgets, roster capacity, pick/nomination/bid/anti-snipe clocks, slow-draft mode, team queues, immutable result references, and current turn. Snake, linear, third-round reversal, and auction ordering are server-derived.
- Every accepted pick, autopick, or expired auction sale creates the Phase 3 asset lock, team roster revision, `RosterTransaction`, public/private audit records, receipt, and downstream invalidations in the same commit as the draft state. The last legal result can be reverted only by a commissioner with a reason; the inverse roster transaction pauses the room.
- Completing every roster automatically marks the draft complete, publishes the canonical rosters, advances the season to `regular_season`, and activates the league. Refresh and reconnect subscribe to the same server document; no manual JSON handoff exists.
- `/league/:gamehqLeagueId/draft` is the mobile/desktop manager room. `/commissioner/draft` configures order and clocks, starts the room, pauses/resumes, settles auctions, and performs guarded correction. Co-commissioners inherit host controls. Public spectators use a tokenized, read-only `nativeDraftShares` projection that omits private queues and actor data.
- Existing top-level live rooms, Offline Draft, practice/CPU modes, Draft Order Showdown, roster builder, and standalone result routes remain unchanged. They do not acquire native authority merely because they contain the same external league ID.

Exact Phase 4 implementation files: `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeDraftCommands.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-draft/NativeDraftBoard.tsx`, `CommissionerDraftWorkspace.tsx`, `nativeDraft.ts`, `useNativeDraft.ts`, and `native-draft.css`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/screens/LeagueDraft.tsx` and `LeagueManage.tsx`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/layouts/LeagueWorkspaceLayout.tsx`; `src/App.tsx`; `src/lib/routeMetadata.ts`; and `firestore.rules`. Coverage is in `nativeDraftCommands.test.ts`, `nativeDraftWorkspace.test.tsx`, `nativeLeagueFirestoreRules.test.ts`, and `routeMetadata.test.ts`.

Phase 4 compatibility/rollback: route/UI entry can be disabled without deleting an accepted draft, roster transaction, or receipt. Legacy `drafts`, `offlineDrafts`, and `offlineLeagueDrafts` remain separate compatibility aggregates; no saved standalone result is silently imported into canonical ownership. A future explicit import must prove franchise/player parity before emitting native transactions.

## Phase 5 — weekly lineups and player locks

- Replace fixed week limits and whole-week-only locks with settings-derived NFL-game/player locks.
- Validate roster/settings revisions, eligibility, required slots, IR, and league lock policy.
- Add exact UI reasons, deadline/timezone, unsaved state, and commissioner audited override.

Gate: Thursday and Sunday locks behave according to the published policy across multiple managers/devices.

Exact Phase 5 implementation files: `shared/leagueSettings.ts` and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeLineupCommands.ts`, `saveWeeklyLineup.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-lineup/NativeLineupWorkspace.tsx`, `nativeLineup.ts`, `useNativeLineup.ts`, and `native-lineup.css`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/screens/LeagueLineup.tsx`; and `firestore.rules`. Coverage is in `nativeLineupCommands.test.ts`, `nativeLineupModel.test.ts`, `nativeLineupWorkspace.test.tsx`, `nativeLeagueFirestoreRules.test.ts`, and the existing legacy lineup/settings suites.

Phase 5 compatibility/rollback: canonical native seasons use season-scoped `lineupWeeks` and `lineups`; `legacy_backed_native` seasons continue through their existing numeric `leagueSeasons` adapter and whole-week compatibility rules. Disabling the native UI does not rewrite or delete either owner. Published settings accept the earlier `player_start` value as a scheduled-kickoff alias.

## Phase 6 — live scoring

- Implemented a provider-neutral adapter contract and authenticated fixture/manual ingress; no undocumented external provider is hard-coded.
- Provider event IDs, immutable event revisions, normalized stats, scoring-rule IDs, deltas, correction lineage, ingestion version, fallback provider, and freshness are persisted.
- Every ingestion or explicit replay deterministically rebuilds player/game totals, lineup/bench/optimal totals, matchup totals, lead changes, and the Week standings projection against the exact active settings version.
- Native Matchup renders sticky current scores, live/projected and stale/cached states, win probability, remaining players/points, active games, projected finals, scoring explanations, lead chronology, active performer, bench/optimal comparison, corrections, and provider update time.

Gate: complete fixture replay is deterministic; duplicates/corrections propagate without silent changes.

Exact Phase 6 implementation files: `shared/nativeScoring.ts` and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeScoringCommands.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-scoring/**`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/screens/LeagueMatchups.tsx`; and `firestore.rules`. Coverage is in `nativeScoringEngine.test.ts`, `nativeScoringCommands.test.ts`, `nativeLiveMatchupWorkspace.test.tsx`, and `nativeLeagueFirestoreRules.test.ts`.

Phase 6 compatibility/rollback: native scoring reads only canonical `lineupWeeks`, `lineups`, and `seasonTeams`; connected Sleeper matchups retain their existing adapter. Disabling the native matchup branch leaves the normalized ledger and rebuildable read models intact. No external source is contacted by the engine; an approved adapter can implement the published contract later without changing score calculation.

## Phase 7 — free agents and waivers

- Implemented canonical free-agent, waiver, owned, locked, ineligible, protected, and trade-block player states reconciled against the existing player asset locks.
- Published settings now support FAAB, rolling, reverse standings, weekly reset, continuous, and first-come-first-served modes; zero-dollar bids; league-timezone processing days/time; dropped-player holds; weekly and position limits; tiebreakers; commissioner review; and next-highest-bid disclosure.
- Manager claim groups preserve up to 12 ordered add/drop/bid alternatives and the exact roster/settings snapshot. An illegal or unavailable alternative records its reason and advances without poisoning later valid fallbacks.
- A protected server scheduler processes due ordinary claims idempotently; commissioner-review claims remain pending until an explicit commissioner run. The current Vercel Hobby deployment invokes the scheduler as a daily recovery sweep because sub-daily cron expressions are rejected by that plan; commissioners retain an immediate due-queue action, and moving the same endpoint to a sub-daily scheduler requires no domain change. One player cannot be won twice, rolling priority and FAAB are updated deterministically, every ownership move uses the Phase 3 lock/transaction ledger, and each claim gets an explainable receipt.
- Native Players renders the canonical market, conditional claim builder, FAAB/priority/deadline context, pending claims, commissioner run control, and receipts. Connected leagues retain their read-only research surface.

Gate: competing/conditional/retry scenarios reproduce exactly.

Exact Phase 7 implementation files: `shared/leagueSettings.ts` and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeWaiverCommands.ts`, `nativeWaiverScheduler.ts`, `waiverCronHandler.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `api/league-commands/waiver-cron.js`, `vercel.json`, and the function bundler; `src/features/native-waivers/**`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/screens/LeaguePlayers.tsx`; and `firestore.rules`. Coverage is in `nativeWaiverCommands.test.ts`, `nativeWaiverWorkspace.test.tsx`, `leagueSettings.test.ts`, and `nativeLeagueFirestoreRules.test.ts`.

Phase 7 compatibility/rollback: no connected-provider roster, waiver, or FAAB data is copied or written. Removing the native Players branch restores the existing connected research UI while canonical player states, claim receipts, universal roster transactions, and audits remain intact as immutable evidence.

## Phase 8 — trades

- Implemented two-team offers, counters, rejection, explicit expiry, acceptance, fixed-period review, commissioner/co-commissioner review, majority league voting, asset reservations, and atomic completion.
- Player and FAAB transfers are available in the native Trade Center. The server ledger also accepts owned current/future draft picks, salary, contracts, keeper rights, and conditional assets once those advanced states exist.
- Published settings can directly disable trades, choose the review path, enforce post-trade roster legality by rejection, grace period, immediate cuts, or commissioner review, set a deadline, and require an uninvolved secondary approval when a commissioner-controlled team participates.
- Accepted-review assets receive unique preconditioned locks, so the same player, pick, FAAB balance, or advanced right cannot enter two accepted trades. Finalization rechecks ownership, live-game locks, deadline, FAAB, roster size, position limits, and the exact settings version before one commit updates both rosters, ownership projections, asset locks, balances, season revision, transaction ledger, audit, notifications, invalidations, and the immutable trade receipt.
- The native Transactions route renders the two-team builder, roster/FAAB selections, counters, accept/reject controls, review reasons/vote totals, active states, and completed receipts. Connected leagues keep the imported history route.

Gate: assets cannot be double-traded and all reviews/commissioner involvement are visible.

Exact Phase 8 implementation files: `shared/leagueSettings.ts` and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeTradeCommands.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-trades/**`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/screens/LeagueTransactions.tsx`; `src/App.tsx`; and `firestore.rules`. Coverage is in `nativeTradeCommands.test.ts`, `nativeTradeWorkspace.test.tsx`, `leagueSettings.test.ts`, and `nativeLeagueFirestoreRules.test.ts`.

Phase 8 compatibility/rollback: connected-provider transactions remain read-only and retain the existing normalized history adapter. Removing the native Transactions branch restores that route without deleting accepted offers, trade receipts, roster transactions, asset locks, or audits. Phase 8 does not infer advanced asset ownership; those assets become transferable only when an explicit authoritative state exists.

## Phase 9 — schedule, standings, playoffs

- Versioned deterministic schedules supporting odd teams/byes/divisions/rivalries/doubleheaders/median.
- Reproducible standings and explanation trace for every tiebreak/seed.
- Versioned configurable bracket engine and audited corrections.

Implemented Phase 9:

- Published schedule rules now cover odd/even leagues, one or more games per team each week, scheduled/full-week and generated slot byes, balanced/division-weighted/custom construction, division/conference targets, protected rivalries, optional two-week series, median opponents, all-play, configurable regular-season length, and an ordered standings tiebreak list.
- The deterministic generator uses an explicit seed. Validation rejects missing teams, self-matchups, repeated IDs/pairs, team slot conflicts, incomplete doubleheader slots, bye/game conflicts, and games outside the regular season; it warns on materially uneven games, byes, division games, and repeat opponents.
- Weekly final/corrected result records are the sole standings inputs. Rebuilds derive overall/division/median/all-play records, PF, PA, potential points, lineup efficiency, streak, remaining schedule strength, playoff probability/state, and a human-readable first-separating tiebreak explanation. Doubleheaders change physical records without double-counting a team's weekly PF or median result.
- Playoffs support arbitrary field sizes including seven, computed byes, fixed or reseeded configuration, one/two-week rounds, consolation or toilet formats, loser-advances display, third-place games, and audited manual qualifiers. Current schedules, standings, results, and brackets are member-readable; immutable schedule/bracket versions and score-correction revisions are commissioner-only.
- Native `/schedule` is the versioned commissioner schedule/results workspace and native `/standings` is the official table and published bracket. Connected providers retain their prior read-only matchups and overview routes.

Gate: odd-team, median, tiebreak, and playoff fixtures reproduce exact results.

Exact Phase 9 implementation files: `shared/leagueSettings.ts`, `shared/nativeCompetition.ts`, and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativeCompetitionCommands.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-competition/**`; `src/features/league-domain/leagueCommands.ts` and `types.ts`; `src/features/league-settings/CommissionerSettingsWorkspace.tsx`; `src/screens/LeagueSchedule.tsx`, `LeagueOverview.tsx`, and `App.tsx`; and `firestore.rules`. Coverage is in `nativeCompetition.test.ts`, `nativeCompetitionCommands.test.ts`, `nativeCompetitionWorkspace.test.tsx`, `leagueSettings.test.ts`, and `nativeLeagueFirestoreRules.test.ts`.

Phase 9 compatibility/rollback: no connected-provider schedule, score, standing, or bracket is copied or dual-written. Removing the native branches for `/schedule` and `/standings` restores the existing connected views while canonical versions, results, corrections, brackets, commands, and audits remain immutable evidence.

## Phase 10 — operational UI consolidation

- Apply dense tables/rows to rosters, players, standings, claims, scoring, schedules, audit.
- Shared player side sheet and semantic state system.
- League Home action queue and verified status/deadlines.
- Full desktop/mobile parity, focus/reduced motion/stable live rows.

Gate: complete manager and commissioner workflows pass at desktop and mobile widths. No invented metrics or decorative empty pages.

Implemented Phase 10:

- Native League Home is now an operational dashboard: the current week, controlled team, opponent, position-valid lineup state, nearest published deadline, data freshness, and required action queue appear before matchup, activity, roster-health, playoff-race, and deadline detail.
- Native Team is the authoritative weekly lineup workspace. Native Transactions now has route-stable Activity, Waivers, Trades, and Trade Market tabs while connected-provider routes retain their existing adapters.
- One accessible player side sheet is shared by native lineup, matchup, draft, waiver, and trade surfaces. It exposes identity/status, projections and source context, NFL schedule, recent production, ownership, roster fit, and the next valid league action; Escape/backdrop dismissal, focus return, visible focus, and reduced-motion behavior are consistent.
- Mobile league navigation is exactly Home, Matchup, Team, Players, and More. Operational data uses compact tables/rows, explicit labels plus color for state, stable row geometry, and freshness timestamps rather than editorial heroes or invented summary metrics.

Exact Phase 10 implementation files: `src/features/league-home/**`, `src/features/native-transactions/**`, `src/features/player-sheet/**`, `src/features/native-lineup/NativeLineupWorkspace.tsx`, `src/features/native-scoring/NativeLiveMatchupWorkspace.tsx`, `src/features/native-draft/NativeDraftBoard.tsx`, `src/features/native-waivers/NativeWaiverWorkspace.tsx`, `src/features/native-trades/NativeTradeWorkspace.tsx`, `src/layouts/AppShellV2.tsx`, `src/layouts/LeagueWorkspaceLayout.tsx`, `src/screens/LeagueHome.tsx`, `src/screens/LeagueTeam.tsx`, `src/screens/LeagueTransactions.tsx`, and `src/App.tsx`. Coverage is in `nativeOperationalUi.test.tsx` plus the existing native domain workspace and app-shell suites.

Phase 10 compatibility/rollback: this phase introduces no new persistence and performs no data copy. Authority routing remains the rollback seam: removing the native Home, Team, or Transactions branch restores the connected-provider surface, while every native command and stored projection remains untouched. The player sheet consumes current read models only and never mutates league state itself.

## Phase 11 — Pulse, native history, and decision systems

- Rebuildable event stream from commands/transactions/audits/scoring.
- Permanent franchise lineage joins native and imported history.
- Formal rule proposals/votes.
- Recommendations use exact league state and explain evidence/uncertainty; deterministic rules decide mutations.
- Mirror/migrate compares external and native read models without obscuring authority.

Gate: native actions automatically feed history/activity and no AI action silently changes state.

Implemented Phase 11:

- `/league/:gamehqLeagueId/pulse` combines member chat, polls, commissioner announcements/reminders, trade-block notes, waiver/trade/draft audit evidence, final scores, rivalry milestones, lead changes, awards, records, and formal rule proposals in one filterable stream. Persisted cards support revision-safe reactions and replies; derived cards rebuild from canonical audit/results/scoring inputs.
- Native `/history` derives career records, head-to-head and rivalry summaries, championships, draft/trade and waiver/lineup efficiency, bench totals, records, milestones, season yearbooks, franchise tendencies, permanent franchise lineage, Hall of Fame candidates, and last-place finishes. A permanent franchise key is presented separately from current manager role grants and seasonal team names.
- Rule proposals preserve current/proposed language, effective season, threshold, voting window, named votes, result, and commissioner explanation. Publishing and voting remain authenticated, idempotent server commands with immutable receipts and audits.
- The waiver decision panel consumes exact published settings, ownership, FAAB, lineup/opponent/bye state and reports evidence plus uncertainty. Its recommendation is read-only and exposes `mutation: null`; only deterministic commands can change league state.
- Commissioner safe mode enumerates preview, reason, impact, restore, and audit guarantees for every supported intervention. Mirror parity compares explicit native/import sources and reports unavailable evidence or mismatches without changing authority.

Exact Phase 11 implementation files: `shared/nativeLeagueIntelligence.ts` and `shared/leagueCommandProtocol.ts`; `server/league-commands/nativePulseCommands.ts`, `executeLeagueCommand.ts`, and `commandSupport.ts`; `src/features/native-pulse/**`, `src/features/native-history/**`, `src/features/league-settings/CommissionerSafetyPanel.tsx`, `src/features/native-waivers/NativeWaiverWorkspace.tsx`, `src/screens/LeaguePulse.tsx`, `src/screens/LeagueHistory.tsx`, `src/layouts/LeagueWorkspaceLayout.tsx`, `src/App.tsx`, and `firestore.rules`. Coverage is in `nativeLeagueIntelligence.test.ts`, `nativePulseCommands.test.ts`, `nativePulseWorkspace.test.tsx`, `nativeWaiverWorkspace.test.tsx`, and `nativeLeagueFirestoreRules.test.ts`.

Phase 11 compatibility/rollback: connected leagues keep their imported History workspace and provider read adapters. Hiding the native Pulse/History branches removes only projections; it does not delete Pulse conversation, proposals, command receipts, audits, or canonical league data. Mirror comparisons are read-only and no page view copies or promotes provider state.

## Phase 12 — keeper, dynasty, salary cap

- Extend asset/settings/transaction models for picks, taxi, keepers, contracts, cap/dead money, tags, orphans, dispersal.
- Separate simple keeper configuration from advanced contract controls.

Gate: native redraft remains stable and simple while advanced fixtures satisfy contract/asset invariants.

## Change-management rule for every implementation phase

Every phase report must include:

1. exact files and schema paths changed;
2. compatibility adapters and migration report;
3. flags/cohort and rollback behavior;
4. tests added and exact commands/results;
5. lint, type check, targeted/full relevant tests, and build;
6. rendered desktop/mobile route evidence;
7. deployment commit/ID if Production was requested;
8. limitations and next blocked dependency.

Unrelated phases and unrelated dirty-worktree changes stay out of the phase release.

## Phase 1A implementation report

Implemented scope:

- Canonical server-derived league/season UUIDs, typed repository/domain/authority contracts, and unique external mappings.
- Explicit native/read-only/migration-preview/mirror authority labels with GameHQ-only role evaluation.
- Authenticated Vercel command function with origin gate, verified Firebase actor, deterministic command IDs, semantic request hashing, exact expected revision, atomic Firestore commit, receipt, and universal audit.
- On-demand legacy published-season migration into `legacy_backed_native` without deleting or dual-owning lineup state.
- Mapping-aware workspace routes, persistent authority label, operational League Home, and canonical route aliases.
- Weekly lineup screen cut over from direct browser mutation to the command service. Direct legacy lineup/audit client writes and all canonical authoritative client writes are denied.
- Feature entry is enabled in development or by `VITE_NATIVE_LEAGUE_FOUNDATION`; rollback does not require deleting data.

Verification added:

- `nativeLeagueDomain.test.ts`: UUID/provider identity separation, route-tail preservation, active/revoked/expired/read-only authority.
- `leagueCommandAuthentication.test.ts`: verified Firebase local ID and permanent-provider requirement.
- `leagueCommandService.test.ts`: verified actor mismatch, server UUID creation, duplicate receipt, reused-key rejection, legacy migration/role provenance, permission denial, exact two-client stale conflict, and atomic audit/receipt behavior through the memory-store precondition model.
- `nativeLeagueFirestoreRules.test.ts` plus updated legacy rules tests: resolver reads, membership privacy, and direct-write denial.
- Existing lineup-lock, typography, native numeric-input, lint, and type contracts were updated/preserved.

Current verification evidence:

- `npm run lint` passed.
- Vercel's bounded release verifier passed: 116 test files passed and 2 skipped; 428 tests passed and 5 skipped. A local unbounded run timed out two unrelated Offline Draft drag tests under parallel load; the same file passed 3 of 3 alone and passed in the bounded verifier.
- `npm run build:vercel:artifact` passed, including application/API type checking, both server-function bundles, and the Vite production build.
- Rendered desktop and 390 x 844 mobile checks passed for `/leagues` and a legacy numeric league Home: no horizontal overflow, no error overlay, and no console warnings/errors in fresh sessions.
- The League disclosure navigated to the canonical Schedule alias and dismissed after selection.
- The Firestore emulator suite passed with an isolated Temurin 21 runtime: 2 test files and 5 tests passed.
- Initial Preview deployment `dpl_CYL6JWeqikyBsDx8B5RoQvjvYcQN` reached `READY`; desktop and mobile checks confirmed the feature flag, compatibility route, read-only authority label, Schedule alias, expected unauthenticated command rejection, and clean runtime logs.

Implementation differences from the proposed file list:

- `legacyLeagueRouteAdapter.ts` lives under `src/features/league-workspace` because it operates only on router paths; data mapping remains in `firebaseLeagueRepository.ts` and the server attach command.
- `store.ts` plus the existing OIDC Firestore REST gateway replace a new Firebase Admin dependency and `firestoreAdmin.ts`; this preserves the repository's secretless Vercel workload-identity convention.
- A bulk migration script was not added because safe account ownership cannot be inferred. The explicit attach command is the idempotent migration unit.
- AppShell regrouping, connection-profile schema changes, and unrelated management hooks were not needed for this vertical slice and were not churned. Route metadata was extended only for the new Home and canonical aliases.

Known limits:

- No waivers, trades, live scoring, native standings, playoffs, chat, or provider writes were introduced.
- Native leagues can publish the Phase 2A rulebook and complete the Phase 2B invitation/team-assignment gate. Draft, waiver, trade, scoring, standings, playoff, and advanced specialist-role workflows remain in their ordered phases.
- Legacy season publication, team-claim administration, and whole-week lock mutation still use their existing direct rules and are Phase 3 command-expansion work.
- The Firestore emulator test files passed locally with the isolated Java runtime; the host still has no system-wide Java installation or `PATH` change.
- Preview was deployed for review on September 3, 2026. Production was not promoted or changed.
