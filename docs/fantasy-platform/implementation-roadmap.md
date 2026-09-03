# Fantasy platform implementation roadmap

The roadmap follows the requested phases in order. Each phase is a bounded change set with schema, compatibility, automated verification, and an honest limitation report. No later engine starts because an earlier screen exists.

## Phase status

| Phase | Scope | Status | Exit gate |
|---|---|---|---|
| 0 | Exact current-state, authority, route, persistence, migration, and implementation audit | Complete in this document set | Six documents present; no application/schema mutation |
| 1A | First vertical native-league foundation | Implemented; exact Preview verified; Production unchanged | First-slice evidence and limits below |
| 2 | Creation wizard and full Commissioner workspace/settings publication | Settings publication implemented locally; roles/invitations remain | Valid native redraft league and immutable settings publication |
| 3 | Universal command, roster transaction, and audit expansion | Blocked on 2; lineup proof begins in 1A | All authoritative mutations use command boundary |
| 4 | Native-league draft integration | Blocked on commands/settings | Draft completion creates roster transactions |
| 5 | Weekly operation and player-level locks | Blocked on settings/commands | Cross-device lineups and settings-derived lock behavior |
| 6 | Provider-agnostic scoring | Blocked on settings/schedule/lineups | Deterministic replay/corrections and live freshness UI |
| 7 | Free agents and waivers | Blocked on roster/scoring state | Atomic reproducible processing and receipts |
| 8 | Two-team trades | Blocked on roster transaction ledger | Atomic asset locks/review/receipts |
| 9 | Schedule, standings, playoffs | Blocked on scoring/results/settings | Reproducible standings, explainable seeds, valid brackets |
| 10 | Operational UI consolidation | Iterative after each operational domain, final pass after 9 | Desktop/mobile parity and dense operational surfaces |
| 11 | League Pulse, native history, decision tools, mirror/migrate | Blocked on event/audit/read models | Native actions feed history and explainable activity |
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

Phase 2A verification: TypeScript application/API checks, lint, focused settings/command tests, Firestore emulator rules tests, and the Vercel artifact build pass. Roles, invitations, team assignment, and the remaining commissioner domains stay in Phase 2B; no empty placeholder pages were added. Midseason publication is intentionally locked until the required material-impact reason workflow exists.

## Phase 3 — command, transaction, and audit expansion

- Generalize the lineup proof to membership/settings/schedule/roster/commissioner commands.
- Add universal `RosterTransaction`, asset locks, reversal links, public/private audit views, notification/read-model hooks.
- Remove direct browser writes to all canonical roster/score/standings/playoff state.

Gate: concurrent/duplicate/stale mutations are deterministic, every action has a receipt, and one player cannot be placed on two teams.

## Phase 4 — native draft integration

- Attach native IDs/settings/franchise map to existing live and offline draft aggregates.
- Add snake, auction, linear, third-round reversal, slow draft, reconnect/revert/co-host commands incrementally.
- Each accepted pick/auction win creates a roster transaction.
- Preserve standalone Offline Draft and Showdown.

Gate: completed native draft publishes authoritative rosters without manual JSON and survives reconnect.

## Phase 5 — weekly lineups and player locks

- Replace fixed week limits and whole-week-only locks with settings-derived NFL-game/player locks.
- Validate roster/settings revisions, eligibility, required slots, IR, and league lock policy.
- Add exact UI reasons, deadline/timezone, unsaved state, and commissioner audited override.

Gate: Thursday and Sunday locks behave according to the published policy across multiple managers/devices.

## Phase 6 — live scoring

- Approve/provider-contract a normalized NFL event source.
- Persist provider event IDs, normalized stats, scoring-rule IDs, deltas, correction lineage, freshness.
- Replay deterministic scores and update matchup/standings read models.
- Build live UI with clear live/projected/stale states and calculation explanations.

Gate: complete fixture replay is deterministic; duplicates/corrections propagate without silent changes.

## Phase 7 — free agents and waivers

- Canonical player ownership/waiver state.
- Settings-derived FAAB/priority/processing/conditional claims.
- Server scheduled job with job idempotency and atomic asset acquisition.
- Manager and commissioner receipts.

Gate: competing/conditional/retry scenarios reproduce exactly.

## Phase 8 — trades

- Two-team offers, counters, expiry, acceptance, review, asset locks, atomic transactions.
- Direct disable setting and commissioner conflict/secondary approval policy.
- Add roster/cap effects and reversal receipts.

Gate: assets cannot be double-traded and all reviews/commissioner involvement are visible.

## Phase 9 — schedule, standings, playoffs

- Versioned deterministic schedules supporting odd teams/byes/divisions/rivalries/doubleheaders/median.
- Reproducible standings and explanation trace for every tiebreak/seed.
- Versioned configurable bracket engine and audited corrections.

Gate: odd-team, median, tiebreak, and playoff fixtures reproduce exact results.

## Phase 10 — operational UI consolidation

- Apply dense tables/rows to rosters, players, standings, claims, scoring, schedules, audit.
- Shared player side sheet and semantic state system.
- League Home action queue and verified status/deadlines.
- Full desktop/mobile parity, focus/reduced motion/stable live rows.

Gate: complete manager and commissioner workflows pass at desktop and mobile widths. No invented metrics or decorative empty pages.

## Phase 11 — Pulse, native history, and decision systems

- Rebuildable event stream from commands/transactions/audits/scoring.
- Permanent franchise lineage joins native and imported history.
- Formal rule proposals/votes.
- Recommendations use exact league state and explain evidence/uncertainty; deterministic rules decide mutations.
- Mirror/migrate compares external and native read models without obscuring authority.

Gate: native actions automatically feed history/activity and no AI action silently changes state.

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
- Native leagues now continue directly into the Phase 2A rulebook and can atomically publish a playable redraft rules version. Team invitations and role assignment remain Phase 2B.
- Legacy season publication, team-claim administration, and whole-week lock mutation still use their existing direct rules and are Phase 3 command-expansion work.
- The Firestore emulator test files passed locally with the isolated Java runtime; the host still has no system-wide Java installation or `PATH` change.
- Preview was deployed for review on September 3, 2026. Production was not promoted or changed.
