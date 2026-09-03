# Native league migration and compatibility plan

This plan preserves existing Sleeper connections, imported history, standalone/live drafts, draft-order results, published seasons, claims, lineups, and audit events. It introduces canonical ownership without a flag-day rewrite.

## Migration principles

1. **Add, map, verify, activate, retire.** No source record is deleted or mutated to make the migration appear complete.
2. **One active owner per concern.** Compatibility adapters can read old or new storage, but a league's migration state identifies exactly one write owner for each aggregate.
3. **No migration on page view.** Visiting a numeric route may resolve an existing mapping or open a legacy read-only workspace. It never creates a league, role, or write authority.
4. **Imported identity grants nothing.** Sleeper owner/co-owner/user IDs are provenance. Only an existing GameHQ permission record or an authenticated native command can create a GameHQ grant.
5. **Server-created mappings.** A transaction creates the UUID League, ExternalConnection, unique provider lookup, command receipt, and audit together.
6. **Checks before activation.** Counts, IDs, revisions, checksums, permission assignments, and route resolution must match the migration report.
7. **No silent local promotion.** League HQ local records and ballots are only explicit import previews until a user validates and publishes them.

## Feature and migration states

There is no current feature-flag module. The first slice adds `src/config/featureFlags.ts` and server-side matching configuration for `nativeLeagueFoundation`.

Per league, use an explicit migration state:

```ts
type LeagueMigrationState =
  | "legacy_unmapped"
  | "mapped_read_only"
  | "migration_preview"
  | "legacy_backed_native"
  | "canonical_active"
  | "migration_failed";
```

- `legacy_unmapped`: no canonical document; old connection/history/season remains accessible.
- `mapped_read_only`: UUID League and external mapping exist; provider is authoritative/read-only.
- `migration_preview`: candidate teams/settings/history mappings exist but are not operational.
- `legacy_backed_native`: canonical identity/permissions exist, while a named legacy adapter still owns selected persisted aggregates such as the current lineup.
- `canonical_active`: canonical storage and commands own operational state.
- `migration_failed`: no activation; report contains the blocking mismatch and safe retry key.

The global flag controls code exposure. Per-league state controls data authority. Disabling a UI flag does not make the application read stale data; compatibility repositories still resolve the active owner.

## Source-to-canonical mapping

### Existing Sleeper connection only

Source: `ffaa.sleeperLeagueConnections.v1`, optional `fantasyManagerProfiles`, and live Sleeper reads.

Process:

1. Keep the source connection untouched.
2. An authenticated, explicit connect/migrate command asks the server to create or resolve `externalLeagueMappings/sleeper__{externalLeagueId}`.
3. If absent, atomically create a random GameHQ UUID League, a `read_only` Sleeper ExternalConnection, the lookup document, command receipt, and audit.
4. Set `createdBy` to the authenticated initiator. Do not create a commissioner grant from Sleeper ownership.
5. Resolve old numeric links to the UUID route and display `Connected Sleeper League — read-only`.

Race rule: two users connecting the same provider league receive the same mapping result. The lookup document precondition prevents two canonical leagues.

### Existing published `leagueSeasons` record

Source: `leagueSeasons/{numericId}` plus claims, memberships, week settings, lineups, and audit events.

Process:

1. Resolve/create the Sleeper ExternalConnection mapping using the numeric source ID. If a canonical mapping already exists, reuse it.
2. Create a canonical Season with a random ID and a provenance pointer `{ collection: "leagueSeasons", documentId, sourceRevision }`.
3. Create one permanent Franchise and one SeasonTeam for every source franchise ID. Store legacy team/franchise IDs as mapping metadata.
4. Create the existing `commissioner_user_id` membership and commissioner grant. This is based on existing GameHQ/Firebase authority, not provider ownership.
5. Translate each current membership/claim to a league membership plus franchise-scoped role grant. Requested state stays requested; approved state becomes active/granted.
6. Do not copy the old one-user/one-franchise constraint. Validate assignments against the migrated settings policy.
7. Create an initial immutable SettingsVersion from the source draft config plus explicit migration defaults. Any missing rule is marked unresolved; unresolved material settings prevent `canonical_active`.
8. Preserve the embedded roster and schedule as migration input. Record counts and hashes.
9. Keep current lineups and audits on their legacy paths while the season is `legacy_backed_native`. The command service, not the browser, becomes their writer.
10. Copy lineups into canonical storage only in a later idempotent cutover. Change the season's persistence owner after parity checks; never dual-write two lineup authorities indefinitely.

The first slice's lineup proof uses this legacy-backed mode for existing seasons. `SaveWeeklyLineup` authenticates and authorizes through canonical membership/grants, checks the legacy lineup's exact expected revision, writes the legacy lineup and immutable legacy audit needed by current readers, and stores the canonical command receipt/universal audit reference atomically. New native seasons use the canonical lineup path directly. Both go through the same `LeagueCommandService` interface.

### Existing imported League History

Source: `leagueHistories/{historyId}` and its chunks/weeks.

Process:

1. Never rewrite imported snapshot IDs in place.
2. Attach the root history ID to the matching ExternalConnection import metadata.
3. Create a mapping table from provider season/franchise/manager IDs to canonical Season/Franchise/user identities.
4. Auto-map only exact, non-ambiguous provider keys. Surface name-based or ownership-change matches for human validation.
5. Preserve unmatched historical franchises as imported entities until the historian/commissioner confirms lineage.
6. Continue to render the source snapshot during migration; canonical history pages can join mappings at read time.

### League HQ and ballot local records

Source: `ffaa-league-hq-v2:<scope>` and `ffaa-league-ballot-v2:<scope>`.

Process:

1. Keep keys untouched and exportable.
2. Offer an explicit import-preview action only to a user with canonical settings/history permission.
3. Parse and validate the local schema, display exact differences, and save a server-side settings/editorial draft.
4. Require a publish command for settings. Ballots remain archival preview data until the rule-proposal/vote domain exists.
5. After successful publication, mark the local record as imported in harmless local metadata; do not remove it automatically.

### Offline Draft and live drafts

- `offlineDrafts`, `offlineLeagueDrafts`, local draft keys, `draft-store`, `drafts`, participants, actions, and auction state remain readable and writable under current contracts.
- Add optional canonical league, season, franchise, and settings-version references through schema-versioned adapters.
- Do not reinterpret prior standalone drafts as league drafts.
- A future native launch snapshots the governing settings and franchise map. A future completion command emits roster transactions.
- The first slice changes only identity/handoff plumbing needed to preserve access; it does not migrate draft results into rosters.

### Draft Order Showdown

Keep current local, official draw, share, and handoff records. Later, a commissioner command publishes a selected draw as a season draft-order version. Existing draws remain standalone artifacts.

## Identity and route migration

### Canonical creation

- Native creation uses a server-generated random UUID.
- The UUID never changes if all external connections are removed.
- External IDs are provider strings and are validated by provider adapters, not by `League.id` parsing.

### Old links

For `/league/{oldId}/{suffix}?query#hash`:

1. Test the canonical League document.
2. Test `externalLeagueMappings/sleeper__{oldId}`.
3. Replace-navigate to `/league/{gamehqLeagueId}/{suffix}?query#hash` when mapped.
4. If unmapped but the connection/history exists, render the legacy imported workspace with a read-only label.
5. If no source exists, render an explicit unavailable state.

The old active-league shortcuts resolve `ffaa.activeSleeperLeague.v1` through the same function. They never select a native league solely from localStorage.

## Permission migration

| Current signal | Canonical result |
|---|---|
| `leagueSeasons.commissioner_user_id` | Active membership plus commissioner grant |
| Approved `managerMemberships/{uid}` + matching claim | Active membership plus team-owner grant scoped to mapped Franchise |
| Requested membership/claim | Requested membership; no active write grant |
| Sleeper `owner_id` or `co_owners` | External display/mapping candidate only; no grant |
| `ffaa_admin_mode` | No canonical effect |
| Local League HQ commissioner edits | Draft import input only |

The first slice adds permission tests for commissioner, co-commissioner, team owner, co-manager, scoped roles, guest, expired/revoked grant, provider owner without grant, and anonymous user.

## First command cutover: weekly lineup save

### Before activation

1. Read current season, franchise, membership/claim, lineup, week lock, and legacy audit.
2. Generate a migration report with IDs, active revisions, assignment hashes, and permissions.
3. Create canonical identity/membership/settings records and the legacy persistence pointer.
4. Deny direct browser create/update/delete of lineups for leagues activated on the command path. Existing read permission remains during compatibility.
5. Enable the command client for only that league/flag cohort.

### Command processing

1. Verify Firebase ID token server-side; ignore any body-supplied actor.
2. Load `commands/{commandId}`. Return the existing receipt for an identical request hash; reject mismatched reuse.
3. Resolve canonical league, season, settings, membership, role grants, and storage owner.
4. Compare `expectedRevision` to the stored lineup revision. Return HTTP 409 and current revision on mismatch.
5. Validate franchise control, roster ownership, slot eligibility, duplicates, required slots, active season/settings revision, and current legacy week lock. Commissioner locked-week override requires a reason.
6. Atomically write the one active lineup owner, command receipt, and universal audit. For a legacy-backed season, also preserve the legacy audit contract needed by current readers.
7. Return actor, previous/resulting revisions, audit ID, command ID, and server timestamp.

### Retry behavior

- Network failure before commit: caller safely retries the same command ID.
- Network failure after commit: retry returns the existing receipt, not a second lineup revision.
- Stale expected revision: do not retry automatically with a new revision. Refresh, show the material differences, and let the manager reapply changes.
- Offline: save remains visibly unsent; no optimistic success. The first slice does not add a durable offline command queue.

## Verification gates

Each migrated league report must pass:

- one canonical League UUID and one unique provider lookup;
- source and target season/team/franchise counts;
- every source franchise has a stable mapping;
- commissioner and approved/requested membership parity;
- roster player/price/budget hashes;
- schedule matchup count/hash;
- lineup count, assignment hash, and latest revision parity;
- every legacy lineup audit remains readable;
- settings validation identifies every defaulted or unresolved rule;
- old and new routes render the same connected/history data with different authority labels only as intended;
- no client write succeeds against canonical authoritative paths;
- duplicate and stale lineup command tests pass.

## Rollout sequence

1. Deploy types, read repositories, mapping lookup, flags, and denied-write rules with no route activation.
2. Run emulator migration and permission tests.
3. Create a migration preview for a test fixture and compare reports.
4. Activate canonical route resolution for mapped read-only connections.
5. Activate canonical identity/permissions for one published test season in `legacy_backed_native` mode.
6. Enable the lineup command proof for that season; verify two clients, duplicate retry, stale rejection, locked override, desktop, and mobile.
7. Expand cohort only after audit/receipt and rollback checks.
8. Move remaining aggregates one at a time in later phases.

## Rollback

- Disable `nativeLeagueFoundation` route/UI exposure.
- Leave canonical records and receipts intact for diagnosis.
- Compatibility repositories continue to resolve the declared active persistence owner; they never switch to a stale copy.
- For a `legacy_backed_native` season, legacy lineup state is already current, so the old UI can read it.
- For a future `canonical_active` season, rollback uses a canonical-to-legacy **read adapter**, not a destructive reverse migration.
- Reverting a command creates a new reversal command/audit when the domain supports reversal; it never deletes the original receipt.

## Explicit non-goals of the first migration

- No Sleeper/Yahoo/ESPN/CBS write integration.
- No waivers, trades, live scoring, standings, playoffs, chat, or native history event pipeline.
- No conversion of live/standalone draft results into rosters.
- No removal of browser keys or Firestore collections.
- No automatic authority based on provider identity.
- No broad Commissioner Studio redesign beyond the route/authority seam required for later work.

## Implemented Phase 1A migration path

Migration is explicit and on-demand, not a page-load bulk conversion.

1. A permanent Firebase account chooses **Create GameHQ mapping** for a saved Sleeper connection, or attempts the first legacy-backed lineup save.
2. `connect_external_league` atomically claims the unique provider mapping and creates the canonical league aggregate.
3. When `leagueSeasons/{externalLeagueId}` exists, the command records `mirror` / `legacy_backed_native`, creates the canonical season, frozen compatibility SettingsVersion, franchises, season teams, memberships, and role grants, and preserves the legacy source pointer.
4. Phase 2B invitations apply only to canonical native membership. They do not infer access from Sleeper owner/co-owner fields or rewrite legacy `managerMemberships`/`franchiseClaims`.
4. When no published legacy season exists, the command records `connected_read_only` / `mapped_read_only`; the actor receives membership but no write role.
5. Concurrent attach commands race on the mapping precondition. The winner's GameHQ league ID becomes canonical; the loser returns an idempotent receipt pointing to that same winner.
6. Old numeric routes resolve through the mapping; an unmapped route still loads compatibility readers.

A standalone bulk migration script was intentionally not added in this slice: bulk attachment cannot safely infer which permanent GameHQ account should initiate a connection, and it would expand authority scope beyond the user's explicit action. The command itself is the idempotent backfill unit and can be orchestrated by a separately authorized batch job later without changing the schema.

Rollback is flag-based for entry UI and routing adapters; legacy readers and persisted records were not deleted. Accepted command receipts/audits are immutable and remain as evidence even if canonical routing is disabled.
