# Persistence inventory

Status: Phase 0 inventory of Production commit `c69abc68c266271ee9b45510944fd08e677d76a0`. No data is deleted, copied, or rewritten by this audit.

## Authority classification

- **Authoritative:** accepted by current application behavior as the source of an operational record.
- **Imported read model:** durable external facts with provenance; GameHQ does not control the provider.
- **Recoverable draft:** unfinished user work that may live locally without becoming published league state.
- **Preference/cache:** safe to discard and rebuild; never grants permission or decides league results.
- **Derived read model:** rebuildable output whose source and revision must remain known.

## Firestore collections

### `fantasyManagerProfiles/{userId}`

Writer: `src/features/league-hq/SleeperConnectionsCloudSync.tsx`.

Fields enforced by `firestore.rules:17-40`: `version`, `user_id`, `active_league_id`, serialized `connections_json`, `updated_at`. Reads/writes are limited to the same permanent Firebase UID; `updated_at` must equal `request.time`.

Classification: **preference/cache**. The rule comment explicitly says it grants no lineup or commissioner permission.

Migration: retain. Extend its connection preference format only through a versioned parser so old `connections_json` remains readable. Store canonical league IDs as convenience references after mappings exist, never roles.

### `leagueHistories/{historyId}`

Writers:

- `server/league-history/automaticImport.ts` through the Firestore REST API and Vercel OIDC federation.
- `scripts/import-sleeper-league-history.ts` for privileged administrative imports.

Readers: `src/features/league-history/persistence/firebaseLeagueHistory.ts` and League History hooks/UI.

Shape owner: `src/features/league-history/persistence/firestoreLeagueHistoryModel.ts`.

Subcollections:

- `snapshotChunks/{chunkId}` — normalized managers, franchises, seasons, drafts, picks, transactions, and other chunked history data.
- `weeks/{weekId}` — normalized weekly records loaded on demand.

The root includes route aliases and counts. `historyId` is currently the input/current Sleeper league ID; season IDs and franchise IDs retain provider identity.

Classification: **imported read model**. Firestore allows public reads and denies all client writes (`firestore.rules:45-54`).

Migration: retain byte-for-byte until a validated reindex exists. Add canonical league/franchise mapping metadata outside the imported snapshot. Do not turn imported rows into native commands retroactively.

### `leagueHistoryImports/{numericSleeperLeagueId}`

Writer/reader: server-only `server/league-history/automaticImport.ts` through Firestore REST.

Fields include `leagueId`, `status`, `startedAt`, `updatedAt`, `message`, optional `historyId`, and counts. A status `importing` with a start time less than ten minutes old acts as the lock.

Classification: **job state**.

Migration: retain. Later attach a canonical league ID in import metadata without changing the public-provider import key.

### `draftOrderDraws/{drawId}`

Writer: `src/features/draft-order/draftOrderPersistence.ts`.

Classification: **authoritative draw artifact within the standalone Draft Order tool**, not canonical league settings.

Migration: retain. A later command may attach/publish an official result as a season draft-order version.

### `draftOrderShares/{shareToken}`

Writer/reader: `draftOrderPersistence.ts`.

Classification: **share projection** of a draw.

Migration: retain; never make a share token authoritative.

### `offlineDrafts/{offlineDraftId}`

Writer/reader: `src/features/offline-draft/offlineDraftPersistence.ts`.

Fields include owner UID, schema/version metadata, and full `state`. IDs are generated share IDs, not league IDs. The owner edits; signed-in viewers can read according to rules.

Classification: **recoverable/shareable draft**.

Concurrency: transaction reads latest record and increments version, but has no caller expected version. Same-owner devices serialize and last full state wins.

Migration: retain standalone behavior. Add optional canonical league/season handoff metadata only; a draft does not become a league merely because it is shared.

### `offlineLeagueDrafts/{numericSleeperLeagueId}`

Writer/reader: `src/features/offline-draft/offlineLeagueDraftPersistence.ts`; compatibility adapter `offlineDraftSync.ts`; publisher `leagueSeasonPersistence.ts`.

Fields enforced at `firestore.rules:156-213`:

- `owner_user_id`
- `schema_version: 1`
- `league_id`
- `state: { teams, config, lastAssignment }`
- `created_at`, `updated_at`
- `version`

The rules accept 2–32 teams and require exact `version + 1`. The adapter exposes `{ payload: { config, teams }, revision }` to the season publisher.

Classification: **recoverable connected draft and publication input**.

Migration: retain. Add a mapping adapter from the numeric external key to canonical league/season/franchise IDs. Do not rename documents or delete the adapter in the first slice.

### `leagueSeasons/{numericSleeperLeagueId}`

Writer/reader: `src/features/league-season/leagueSeasonPersistence.ts` and its hooks.

Root fields:

- `version`
- `league_id`
- `commissioner_user_id`
- `source_draft_revision`
- `payload` containing draft config and embedded team/roster state
- `schedule`
- `franchise_ids`
- `revision`
- `created_at`, `published_at`, `updated_at`

Classification: **current native published-season authority**, despite its external primary key and embedded aggregate.

Concurrency: publish/republish is a client transaction. A later full publish increments the latest revision and wins. Lineups tied to older `season_revision` are ignored by current readers but remain persisted.

Migration: freeze in place as a legacy source. Materialize canonical League, Season, Franchise, SeasonTeam, membership/grant, lineup, and audit records through an idempotent migration job. Record migration status/checksums before any canonical route becomes writable. Keep dual-read compatibility until parity checks pass.

#### `franchiseClaims/{franchiseId}`

Contains the requested franchise, requesting Firebase UID/name, status, approved UID, and timestamps. The document ID makes one claim current per franchise.

Classification: **current permission workflow authority**.

Migration: translate approved/requested claims into membership plus role-grant commands. Preserve original IDs/timestamps as migration provenance. The one-franchise constraint is not copied into the canonical model.

#### `managerMemberships/{userId}`

Contains league, user, franchise, display name, status, and timestamps. The document ID enforces one franchise per user. Rules require paired claim state with `getAfter`.

Classification: **current permission workflow authority**.

Migration: translate into one `LeagueMembership` and a franchise-scoped owner/co-manager `RoleGrant`. Do not use it directly after canonical permission activation.

#### `weekSettings/week-{1..18}`

Contains week, lock boolean, updating user, and timestamps.

Classification: **current whole-week lineup-lock authority**.

Migration: retain through the lineup compatibility adapter. The canonical setting owns lock policy; migration records the current manual lock state without treating 18 as a universal maximum.

#### `lineups/{franchiseId}_week-{week}`

Contains league/franchise/week keys, season revision, assignment map, lineup revision, paired audit ID, updating UID, and timestamps.

Classification: **current weekly-lineup authority**.

Migration: first proof case. Canonical reads fall back to legacy lineups. New writes go through the server command service with expected revision and idempotency; an explicit migration link preserves legacy lineup/audit IDs. No dual client writes.

#### `auditEvents/{eventId}`

Contains type `lineup_saved` or `lineup_override`, actor, franchise, week, season revision, before/after assignments, reason, and created time. Rules make events immutable and require atomic correspondence with the lineup document.

Classification: **immutable current lineup audit**.

Migration: retain permanently. Project each event into the universal `AuditEvent` format or store an adapter reference. Never delete or update the source event.

### `drafts/{draftId}`

Writer/reader: `src/multiplayer/firebaseBackend.ts`, `src/multiplayer/hostEngine.ts`, live room screens/hooks.

Root fields include room code, host UID, settings, draft type, team count, status, mutable full snapshot, and timestamps.

Subcollections:

- `participants/{firebaseUid}` — display name, team number/ID, ready state.
- `actions/{actionId}` — user, action type/payload, timestamp. `setDoc` by action ID permits caller-level duplicate suppression.
- `auctionState/current` — high bid/team, timers, action ID, and version. Bids use a Firestore transaction.

Classification: **authoritative standalone live-draft aggregate**. The host browser, not a league command service, owns general snapshot progression.

Migration: preserve. Add canonical league/season/franchise/settings references for native launches. Completed picks/wins must later emit idempotent roster transactions; until then they remain draft results only.

## Browser localStorage

### Required keys from the brief

| Key | Source | Contents/classification | Migration decision |
|---|---|---|---|
| `ffaa.sleeperLeagueConnections.v1` | `src/features/league-hq/sleeperConnections.ts:5,201-253` | Up to 12 normalized Sleeper connection summaries; **preference/cache** | Retain parser and data. Add canonical mapping references after lookup; never use for roles |
| `ffaa.activeSleeperLeague.v1` | Same file | Active external numeric ID; **preference** | Retain for old links. Resolve through external mapping; do not use as canonical identity |
| `ffaa-league-hq-v2:<scope>` | `src/features/league-hq/useLeagueHQ.ts:5,20-102` | League identity/rules/editorial manager data; currently **authoritative-looking device state** | Treat as an unfinished migration/settings draft only. Import explicitly, validate, then publish server-side; never silently promote |
| `ffaa-league-ballot-v2:<scope>` | Same file | Ballot/vote state; currently device-local | Preserve for export/migration preview. Do not claim it as a league vote until a canonical proposal/vote domain exists |
| `ffaa.offlineDraft.v1` | `leagueSeasonModel.ts:3`, `OfflineDraftV2.tsx` | Default unfinished Offline Draft; **recoverable draft** | Retain |
| `ffaa.offlineDraft.v1:<offlineDraftId>` | `offlineDraftIdentity.ts`, `OfflineDraftV2.tsx` | Per-share unfinished/local draft cache | Retain |

### Other draft and league-adjacent keys

| Key | Source | Classification/decision |
|---|---|---|
| `draft-store` | `src/store/draftStore.ts:1189` | Zustand-persisted legacy/client draft. Retain while legacy/results consumers exist; not league authority |
| `ffaa.localMultiplayer.drafts.v1` | `src/multiplayer/localMode.ts:32` | Local multiplayer draft records. Recoverable/local mode |
| `ffaa.playerQueue.<draftId>.<teamId>` or `.spectator` | `DraftRoomV2.tsx:416-431` | Personal nomination/pick queue preference |
| `ffaa.draftOrder.saved.v1` | `draftOrderPersistence.ts:9` | Saved local Showdown draws |
| `ffaa.draftOrder.active.v1` | `showdownMachine.ts:142` | Recoverable active draw state |
| `ffaa.offlineDraft.handoff.v1` | `offlineDraftHandoff.ts:3` | One-time recoverable handoff into Offline Draft |
| `ffaa.draftOrder.soundMuted` | `useShowdownAudio.ts:3` | Preference |
| `ffaa.auctionAudioMuted` | `soundEffects.ts`, `useShowdownAudio.ts` | Preference |
| `ffaa_admin_mode` | `src/contexts/RoleContext.tsx:4` | UI preference explicitly marked “NOT security”; must never enter permission resolution |
| `ffaa.auctionValues.preferences.v1` | `useAuctionValueState.ts:7` | Research preference: format/budget/league size |
| `sleeper_players_v2` | `useSleeperPlayers.ts` | 24-hour player cache |
| `adpConfig` and `ffc-adp-*` | `src/config/adp.ts`, `src/services/FfcAdp.ts` | Research configuration/cache |
| `ffaa.recentDecisionTools.v1` | `src/screens/Tools.tsx` | Recent-tool preference |

### sessionStorage

| Key | Source | Purpose |
|---|---|---|
| `hostLobbyV2` | `HostSetupV2.tsx`, `HostLobbyV2.tsx`, `DraftRoomV2.tsx` | Recoverable host navigation/session context |
| `joinLobbyV2` | `JoinLobbyV2.tsx`, `DraftRoomV2.tsx` | Recoverable join context |
| `draftConfigV2` | `HostLobbyV2.tsx` | Temporary host draft configuration |
| `ffaa.localMultiplayer.user.v1` | `src/multiplayer/localMode.ts:33` | Local-mode user identity for the tab/session |

None of these session keys may grant canonical league permissions.

## In-memory and derived stores

| Store/cache | Source | Current role | Target treatment |
|---|---|---|---|
| Zustand draft store | `src/store/draftStore.ts` | Legacy/local draft configuration, teams, rosters, auction state | Preserve for standalone/legacy; adapt native completion to commands later |
| League HQ React store | `src/features/league-hq/useLeagueHQ.ts` | In-memory copy of scoped local data/ballot | Convert to a settings-draft client only after server draft endpoint exists |
| Workspace context | `src/features/league-workspace/LeagueWorkspaceContext.tsx` | Joins provider and native season reads | Replace identity conflation with repository resolution and explicit provenance |
| League History module caches | `firebaseLeagueHistory.ts`, hooks | Avoid repeated immutable snapshot loads | Keep as read cache; include history/canonical mapping revision where needed |
| Sleeper data hooks | `sleeperLeague.ts`, My HQ hooks | Current external read model | Keep provider-specific adapter behind canonical authority label |
| Player/research caches | data hooks/services | Performance and offline fallback for research | Keep non-authoritative |

## Hooks, repositories, and services that touch persisted league state

| Source | Persistence interaction |
|---|---|
| `useSleeperLeagueConnections` in `sleeperConnections.ts` | Reads/writes local connection portfolio and active external ID; listens for storage changes |
| `SleeperConnectionsCloudSync.tsx` | Merges local portfolio with `fantasyManagerProfiles` |
| `useLeagueHQ.ts` | Reads/writes local League HQ and ballot records |
| `useLeagueSeasonDraft.ts` | Subscribes to `offlineLeagueDrafts`; falls back to local Offline Draft preview |
| `useLeagueSeasonManagement.ts` / `leagueSeasonPersistence.ts` | Subscribes to season, claims, membership; exposes current client mutations |
| `useLeagueWeekLineups.ts` | Subscribes to lineups/week settings and filters active season revision |
| `offlineDraftPersistence.ts` | Shareable `offlineDrafts` transactions/subscriptions |
| `offlineLeagueDraftPersistence.ts` | Connected `offlineLeagueDrafts` transactions/subscriptions |
| `firebaseBackend.ts` | Live `drafts` aggregate and subscriptions |
| `draftOrderPersistence.ts` | Draw/share writes and reads |
| `firebaseLeagueHistory.ts` | Public history lookup by document ID or route alias |
| `useLeagueHistory.ts`, `useLeagueHistoryWeeks.ts`, `useLeagueWeek.ts` | History snapshot/week loading and derived analytics |
| `automaticImport.ts` (client) | POST/status polling for automatic history import |
| `server/league-history/**` | Trusted public-provider import/job writes |

## Network/API persistence boundaries

| Endpoint/source | Direction | Writes GameHQ state? | Authority constraint |
|---|---|---|---|
| `/ff/api/league-history/import` | Browser/server to Vercel function | Yes: imported history/job documents | Origin-gated, not user-authenticated; public provider import only |
| `/ff/sleeper-api/:path*` and direct Sleeper API calls | Read | No Sleeper writes | Public read-only external data |
| `/ff/ffc-api/:path*` | Read | No league writes | Research only |
| Browser Firebase SDK | Read/write | Yes, all current native Firestore aggregates | Rules are current trust boundary; canonical writes must move server-side |

## Timestamp and retry findings

- `fantasyManagerProfiles.updated_at` uses Firestore `request.time`.
- Most existing league/draft code stores browser `new Date().toISOString()` values. Client clocks therefore determine persisted timestamps.
- Canonical commands must use server UTC timestamps. `clientCreatedAt` is retained only as input metadata.
- No durable command outbox exists.
- No canonical idempotency collection exists.
- Firestore transactions retry internally, but current save functions do not distinguish a retry from a new user command.

## Migration safety rules

1. Do not delete any key or collection listed above in the first slice.
2. Never bulk-convert on a client page load.
3. Each legacy source gets a schema parser, deterministic migration key, checksum/count report, and canonical provenance link.
4. Canonical reads may fall back to legacy sources; canonical writes never dual-write back into a full legacy aggregate.
5. A migrated league remains behind a per-league feature state until identity, team, permission, lineup, and audit parity checks pass.
6. Rollback disables canonical routing/commands and returns to legacy reads; it does not require deleting canonical records.

## Implemented Phase 1A persistence

The following paths are now produced by accepted commands:

```text
externalLeagueMappings/{provider__externalLeagueId}
leagues/{gamehqLeagueId}
leagues/{gamehqLeagueId}/seasons/{seasonId}
leagues/{gamehqLeagueId}/franchises/{franchiseId}
leagues/{gamehqLeagueId}/seasons/{seasonId}/seasonTeams/{seasonTeamId}
leagues/{gamehqLeagueId}/memberships/{firebaseUid}
leagues/{gamehqLeagueId}/roleGrants/{roleGrantId}
leagues/{gamehqLeagueId}/externalConnections/sleeper
leagues/{gamehqLeagueId}/settingsVersions/{settingsVersionId}
leagues/{gamehqLeagueId}/commands/{commandId}
leagues/{gamehqLeagueId}/auditEvents/{auditEventId}
```

For `legacy_backed_native`, weekly lineup state deliberately remains at `leagueSeasons/{externalLeagueId}/lineups/{legacyFranchiseId}_week-{week}` until a future canonical lineup cutover. That path has one writer: the server command. Its current document update-time is an atomic precondition, while the caller's `expectedRevision` is checked before validation. The same commit creates the canonical receipt and audit plus the compatibility audit.

`ffaa.sleeperLeagueConnections.v1`, `ffaa.activeSleeperLeague.v1`, imported history, Offline Draft keys, and all existing Firestore collections remain intact. No batch data mutation or Production write was run from this branch.
