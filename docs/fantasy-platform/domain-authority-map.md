# Domain authority map

Status: proposed ownership contract for the Phase 1 foundation. Existing records remain authoritative for existing behavior until their migration state says otherwise.

## Authority rules

1. `League.id` is a GameHQ-generated UUID and is the only native league identity.
2. Provider IDs identify `ExternalConnection` records. They never become document roots for canonical native state.
3. A provider snapshot is provenance/read data. It grants no GameHQ role and cannot silently enable a write control.
4. A `SettingsVersion` in `published` state governs deterministic league behavior. UI defaults are not rules.
5. An authenticated server-side `LeagueCommandService` is the only writer for canonical authoritative state.
6. Every accepted command and every rejected retry/conflict has a stable command receipt. Every accepted mutation creates an immutable universal `AuditEvent` in the same transaction.
7. Read models may duplicate data for query performance, but they identify their source revision and can be rebuilt. They do not become a second authority.

## Current owner and canonical owner

| Concern | Current owner(s) with evidence | Current conflict | Proposed canonical owner |
|---|---|---|---|
| League identity | Route/Sleeper connection numeric ID in `sleeperConnections.ts`; `leagueSeasons/{leagueId}`; `leagueHistories` route IDs; local `LeagueIdentity` in `leagueHQData.ts` | External, native-season, history, and editorial IDs are peers | `League.id`; external IDs only in `ExternalConnection` and lookup index |
| League name/logo/colors/timezone | Sleeper response; local League HQ data; imported history root | No authoritative/native version and no timezone requirement | `League` for durable identity fields; versioned rule-affecting presentation/settings in `SettingsVersion` where necessary |
| Season identity | One `leagueSeasons/{externalId}` current record; history season IDs are Sleeper season league IDs | No permanent native season ID; history and operation cannot join reliably | `Season.id`, owned by canonical league and linked to exactly one active `SettingsVersion` |
| Franchise identity | Offline draft team IDs; current Sleeper roster IDs; history `${seasonExternalId}-roster-${providerRosterId}` IDs | Seasonal/provider identities cannot carry permanent lineage | `Franchise.id`, permanent within a league; mappings attach seasonal/provider records |
| Seasonal team identity | Embedded offline/published team row; Sleeper roster/user metadata | Permanent identity and seasonal name/branding are combined | `SeasonTeam.id` with `seasonId` + `franchiseId`; seasonal name/logo/colors/division/order/budget |
| Membership | `managerMemberships/{firebaseUid}` under one numeric season | Document key enforces one team per user and cannot represent guests or league membership without team control | `LeagueMembership` for league admission; separate `RoleGrant` records for permissions and optional franchise scope |
| Commissioner/control roles | `commissioner_user_id`; claim approval; Sleeper league owner comparison in `LeagueWorkspaceContext.tsx`; local admin preference | Imported owner identity can affect UI capability; only commissioner/team owner are expressible | `RoleGrant`, resolved only from GameHQ account, membership status, active grant window, and published permissions |
| External connection | Local/cloud `SleeperLeagueConnectionSummary` | Connection is also route/native identity; only Sleeper is modeled | `ExternalConnection` under canonical league plus `externalLeagueMappings` lookup index |
| League settings | Offline draft config embedded in `leagueSeasons.payload`; local League HQ rules/identity; provider settings | No complete settings owner, publication workflow, or effective version | Immutable `SettingsVersion`; `Season.settingsVersionId` selects the active version |
| Rosters | Offline/live draft snapshots; `leagueSeasons.payload.teams[].roster`; Sleeper current roster | No evolving authoritative roster or ledger | `SeasonTeam` roster revision plus universal `RosterTransaction` ledger; mutated only by commands |
| Draft state/results | `offlineDrafts`, `offlineLeagueDrafts`, `drafts`, Zustand `draft-store`, imported history drafts | Separate IDs/results and no native handoff contract | Draft remains its own aggregate but carries league/season/franchise/settings IDs; completed picks emit `RosterTransaction` commands |
| Weekly lineups | `leagueSeasons/{id}/lineups/{franchiseId_week}` | Strong atomic audit but fixed weeks, no settings ID/idempotency/expected revision | Canonical season lineup document written through `LeagueCommandService`; command receipt and universal audit are co-committed |
| Lineup locks | `weekSettings/week-N` whole-week boolean | Fixed 1–18 and no player/game lock model | Lock policy in published settings; derived player locks plus auditable commissioner overrides |
| Schedule | Embedded generated list on `leagueSeasons` using fixed 14 weeks | No schedule ID/version or settings-derived validation | Versioned `ScheduleVersion` selected by `Season.scheduleVersionId` |
| Matchup scores | Projection baselines in `LeagueMatchups`; current/history Sleeper results | Projected data can occupy matchup UI; no native score authority | Replayable scoring event ledger and versioned matchup result/read model, later phase |
| Standings | Sleeper current standings, history analytics, summary cards | No authoritative reproducible native standings | Rebuildable standings read model keyed by season/result/settings revisions, later phase |
| Transactions | Sleeper current/history transactions; draft actions | No native cross-workflow roster ledger | `RosterTransaction` produced by commands, with before/after roster revisions and reversal relation |
| History | `leagueHistories` imported snapshots | Provider-season franchise identity is not canonical; native actions do not feed history | Immutable domain events/audits feed native history read models; imported snapshot retained with mapping/provenance |
| Commissioner settings/editorial state | `useLeagueHQ.ts` localStorage and modal `CommissionerStudio.tsx` | Device-local state appears commissioner-owned and is not publishable/versioned | Settings drafts saved server-side; immutable publish command; editorial content gets a separate typed domain only when migrated |
| Connection preferences | local keys and `fantasyManagerProfiles` | None if kept non-authoritative | Retain as user preference/cache; references canonical and external IDs after migration |
| Research/analytics preferences | local state and public datasets | None | Remain non-authoritative; derive league context from canonical read interface |

## Canonical entities

These types implement the requested concepts without making Firestore shapes leak into screens.

### `League`

```ts
type League = {
  id: string; // UUID
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  timezone: string; // IANA zone
  status: "draft" | "active" | "paused" | "archived";
  currentSeasonId: string | null;
  createdBy: string;
  createdAt: string; // server-generated UTC
  updatedAt: string; // server-generated UTC
  revision: number;
};
```

### `Season`

```ts
type Season = {
  id: string;
  leagueId: string;
  year: number;
  phase: "setup" | "draft" | "regular_season" | "playoffs" | "complete" | "archived";
  revision: number;
  settingsVersionId: string;
  draftId: string | null;
  scheduleVersionId: string | null;
  startAt: string | null;
  endAt: string | null;
};
```

### `Franchise` and `SeasonTeam`

```ts
type Franchise = {
  id: string;
  leagueId: string;
  createdAt: string;
  retiredAt: string | null;
};

type SeasonTeam = {
  id: string;
  leagueId: string;
  seasonId: string;
  franchiseId: string;
  name: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string };
  divisionId: string | null;
  draftPosition: number | null;
  budget: { initial: number; remaining: number; currency: string } | null;
  cap: { limit: number; committed: number; dead: number } | null;
  rosterRevision: number;
};
```

### `LeagueMembership` and `RoleGrant`

Membership says who belongs to a league. A grant says what that user can do. One user can receive multiple grants; one franchise can have multiple team-owner/co-manager grants.

```ts
type LeagueMembership = {
  leagueId: string;
  userId: string;
  status: "invited" | "requested" | "active" | "suspended" | "removed";
  joinedAt: string | null;
  revision: number;
};

type LeagueRole =
  | "commissioner"
  | "co_commissioner"
  | "team_owner"
  | "co_manager"
  | "moderator"
  | "scheduler"
  | "treasurer"
  | "historian"
  | "read_only_guest";

type RoleGrant = {
  id: string;
  leagueId: string;
  userId: string;
  role: LeagueRole;
  franchiseId: string | null;
  permissions: string[];
  effectiveAt: string;
  expiresAt: string | null;
  grantedBy: string;
  revokedAt: string | null;
  revision: number;
};
```

Whether one user may control multiple teams is a published setting validated by the role command. It is not encoded by the membership document key.

### `ExternalConnection`

```ts
type ExternalConnection = {
  id: string;
  leagueId: string;
  provider: "sleeper" | "yahoo" | "espn" | "cbs";
  externalLeagueId: string;
  mode: "read_only" | "mirror" | "migration_preview";
  permissions: string[]; // verified integration capabilities, never inferred
  lastSyncAt: string | null;
  syncStatus: "never" | "syncing" | "ready" | "stale" | "error";
  importMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
```

There is no external `read_write` mode until an authorized provider integration exists and proves that permission. A connected Sleeper league is `read_only`.

### `SettingsVersion`

```ts
type SettingsVersion = {
  id: string;
  leagueId: string;
  seasonId: string;
  revision: number;
  status: "draft" | "published" | "superseded";
  effectiveAt: string;
  settings: LeagueSettings;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

`LeagueSettings` owns league size, multiple-team-control policy, roster slots and eligibility, scoring, schedule length/byes/divisions, playoffs, budget/minimum bid, waivers, trades, locks, timezone/deadlines, and notification rules. No consumer falls back to a domain-significant constant after a version is published.

## Command and audit boundary

### Command envelope

```ts
type LeagueCommand<TType extends string, TPayload> = {
  commandId: string; // also the idempotency key
  commandType: TType;
  actorUserId: string; // asserted by server authentication, not trusted from body
  leagueId: string;
  seasonId: string;
  expectedRevision: number;
  payload: TPayload;
  reason?: string;
  clientCreatedAt: string;
};
```

The server adds `serverProcessedAt`, resolves active settings and permissions, validates the expected aggregate revision, atomically writes state/receipt/audit, and returns the same receipt for a repeated `commandId` with an identical request hash. Reuse of a command ID with a different request is rejected.

### `LeagueCommandService`

The browser depends on an interface, not Firestore mutation functions:

```ts
interface LeagueCommandService {
  execute<TCommand extends LeagueCommand<string, unknown>>(
    command: TCommand,
  ): Promise<LeagueCommandReceipt>;
}
```

The HTTP implementation posts a Firebase ID token and command envelope to the Vercel function. The server implementation owns authentication, permissions, transactions, and audit. Screens may subscribe to read repositories but may not receive canonical Firestore write helpers.

### Universal `AuditEvent`

```ts
type AuditEvent = {
  id: string;
  leagueId: string;
  seasonId: string;
  actorUserId: string;
  action: string;
  target: { type: string; id: string };
  timestamp: string; // server-generated UTC
  previousRevision: number;
  resultingRevision: number;
  before: unknown;
  after: unknown;
  materialDifferences: unknown;
  reason: string | null;
  settingsVersionId: string;
  commandId: string;
  transactionId: string | null;
  publicSummary: string;
  privateMetadata: Record<string, unknown> | null;
  reversalOfAuditEventId: string | null;
};
```

This expands rather than discards the current immutable lineup audit. The first adapter maps current `lineup_saved`/`lineup_override` data to these fields and preserves the legacy event ID.

## Proposed persistence ownership

Logical paths are explicit so adapters and rules can be designed before any data is moved:

```text
leagues/{gamehqLeagueId}
  seasons/{seasonId}
    seasonTeams/{seasonTeamId}
    lineupWeeks/week-{week}
    lineups/{lineupId}
    scheduleVersions/{scheduleVersionId}
    drafts/{draftId}
    assetLocks/player__{playerId}
    rosterTransactions/{transactionId}
  franchises/{franchiseId}
  memberships/{userId}
  roleGrants/{roleGrantId}
  invitations/{invitationId}
  externalConnections/{connectionId}
  settingsVersions/{settingsVersionId}
  commands/{commandId}
  auditEvents/{auditEventId}
  auditPrivate/{auditEventId}
  notificationOutbox/{eventId}
  readModelInvalidations/{eventId}

externalLeagueMappings/{provider__externalLeagueId}
nativeDraftShares/{shareToken}
```

`externalLeagueMappings` is a lookup index, not a second league model. Its only authoritative payload is `{ leagueId, connectionId, provider, externalLeagueId, mappingRevision }`, written atomically with the connection. A uniqueness transaction prevents one provider league from mapping to two canonical leagues unless an explicit migration workflow replaces the mapping.

Read models live in separate, clearly rebuildable collections and store their source revisions, for example `leagueHomeReadModels/{leagueId__userId}` or `standingsReadModels/{seasonId}`. Their exact schemas belong to the phase that introduces them.

## Read interfaces

Screens should consume narrow repositories:

```ts
interface LeagueRepository {
  resolveRouteId(routeId: string): Promise<LeagueRouteResolution>;
  getLeague(leagueId: string): Promise<League | null>;
  getCurrentSeason(leagueId: string): Promise<Season | null>;
  getAuthority(leagueId: string, userId: string | null): Promise<LeagueAuthority>;
  subscribeLineup(input: LineupKey, observer: Observer<LeagueLineup>): Unsubscribe;
}
```

The compatibility implementation may read canonical documents first and fall back to `leagueSeasons`, Sleeper connections, or `leagueHistories`. A fallback object must be marked with provenance and never masquerade as a canonical writable record.

## Authority labels

| Label | Required state | Allowed behavior |
|---|---|---|
| `Native GameHQ League — read/write` | Canonical League exists; current user has an active write grant for the action | Commands allowed according to role/settings |
| `Connected Sleeper League — read-only` | Provider connection/snapshot exists; no migrated native authority | Provider reads, history, research; no native write claim |
| `Migration Preview` | Proposed canonical mapping/settings/teams exist but have not been published | Compare and validate only; no operational mutation |
| `Mirror Mode` | Canonical native league exists and external data is intentionally compared in parallel | Native commands write GameHQ only; provider data is visibly attributed; discrepancies are surfaced |

An imported league owner ID is display context. It never changes these labels or grants a native role.

## Invariants for the first slice

- Native `League.id` validates as a UUID and never with Sleeper's numeric regex.
- External IDs are non-empty provider strings; provider adapters may apply provider-specific validation.
- Every canonical child stores and verifies its parent `leagueId`/`seasonId`.
- Exactly one published settings version governs a season revision.
- Role checks require active GameHQ membership and grant; external identity does not participate.
- The first lineup command checks `expectedRevision` before validation/write.
- One command ID produces at most one state mutation and one audit event.
- State, command receipt, and audit event commit atomically.
- A stale command returns a conflict containing the current revision; it never retries as a fresh overwrite.
- Existing legacy lineups and audits remain readable and are not deleted.
- Direct client writes to new canonical authoritative paths are denied by Firestore rules.

## Implemented Phase 1A authority seam

| Concern | Implemented owner | Compatibility behavior |
|---|---|---|
| Native league/season identity | Server-derived UUIDs in `leagues` and nested `seasons` | Numeric Sleeper IDs remain only in `ExternalConnection` and `externalLeagueMappings` |
| Route identity | `firebaseLeagueRepository` plus `externalLeagueMappings` | Unmapped numeric routes remain readable in compatibility mode; mapped routes replace only the league segment |
| Membership | `leagues/{id}/memberships/{firebaseUid}` | Existing legacy manager memberships are copied on explicit attach; no provider owner field is consulted |
| Write permission | Active, unexpired, unrevoked canonical RoleGrant | Commissioner/co-commissioner manage; team owner/co-manager save only their mapped franchise |
| Settings authority for migrated lineups | Published canonical SettingsVersion | Records the legacy roster/scoring/budget/week constraints used by command validation |
| Weekly lineup state during cutover | Existing `leagueSeasons/{externalId}/lineups` as the single state owner | Browser writes are closed; server command is its only writer and also emits the canonical audit/receipt |
| Idempotency | `leagues/{id}/commands/{commandId}` | Client-created timestamps are excluded from the semantic request hash so a transport retry remains the same command |
| Audit | `leagues/{id}/auditEvents/{auditId}` | A legacy-format audit is co-written only to keep existing readers intact; both are in the same atomic commit |
| Native team seats | Published SettingsVersion plus server reconciliation of `franchises` and seasonal `seasonTeams` | Team count changes never delete franchise identity; assigned seats cannot be retired |
| Manager invitation | `leagues/{id}/invitations/{invitationId}` through authenticated commands | Random token hash, invited Firebase email, expiry, role, and optional franchise are verified before grants are created |
| Manager removal | `remove_league_member` command | Revokes every active grant and the membership in one audited season-revision commit; primary commissioner cannot be removed through this path |
| Native player ownership | `seasonTeams.roster_player_ids` plus one `assetLocks/player__{playerId}` document | Both change in the same server commit; a create/update/delete precondition makes the lock the concurrency authority |
| Roster ledger | `seasons/{seasonId}/rosterTransactions/{transactionId}` | Drafts, waivers, trades, commissioner correction, keepers, and contracts must enter through this model as their phases activate |
| Private audit metadata | `leagues/{id}/auditPrivate/{auditId}` | Current commissioner/co-commissioner read only; ordinary members receive the public audit receipt without administrative source metadata |
| Downstream effects | `notificationOutbox` and `readModelInvalidations` | Durable server-written pending hooks; they are rebuildable/consumable and never a second mutation authority |
| Native draft | `seasons/{seasonId}/drafts/{draftId}` through draft commands | Settings/franchise IDs and exact draft revision govern turns; each result co-commits its universal roster transaction |
| Draft spectator state | `nativeDraftShares/{shareToken}` | Redacted rebuildable projection only; it omits queues/actors and never accepts browser writes |
| Native weekly player/game state | `leagues/{leagueId}/seasons/{seasonId}/lineupWeeks/week-{week}` | Authoritative lock input version; commissioner/scheduler command only |
| Native weekly lineup | `leagues/{leagueId}/seasons/{seasonId}/lineups/{franchiseId}_week-{week}` | Authoritative assignments and ordered fallback trace; exact revisions and server command only |
| Normalized NFL stat event | `seasons/{seasonId}/scoringEvents/{providerEventKey}` plus immutable `scoringEventRevisions` | Provider-neutral input with stable ID, correction lineage, and ingestion version; commissioner/historian command only |
| Native live scoring projection | `seasons/{seasonId}/scoringWeeks/week-{week}` | Rebuildable player/lineup/matchup/Week-standing output tied to the published settings version; member-readable and server-written |
| Native player acquisition state | `seasons/{seasonId}/playerStates/{playerId}` plus `waiverState/current` | Queryable free-agent/waiver/special-state projection reconciled against the unique player asset lock; server-written only |
| Team waiver economy | `seasons/{seasonId}/waiverTeamStates/{franchiseId}` | FAAB, rolling priority, standings rank, weekly counts, and revision under the exact published settings version |
| Conditional waiver claim | `seasons/{seasonId}/waiverClaims/{claimId}` | Ordered alternatives and secret bids; readable only by submitter and current commissioners until converted to a receipt |
| Waiver processing and receipt | `seasons/{seasonId}/waiverRuns/{runId}` and `waiverReceipts/{receiptId}` | Idempotent atomic run trace and member-readable explanation of each claim outcome |
| Native trade offer | `seasons/{seasonId}/tradeOffers/{offerId}` | Two-team proposal/revision authority for send, counter, response, review, league vote, expiry, and completion |
| Accepted-trade reservation | `seasons/{seasonId}/tradeAssetLocks/{assetKey}` | Create-only temporary lock prevents one asset or team FAAB balance from entering two accepted pending-review trades |
| Trade receipt | `seasons/{seasonId}/tradeReceipts/{offerId}` | Immutable member-readable assets, parties, timestamps, policy/votes, disclosed approval, roster/cap effects, settings version, result, and ledger linkage |
| Transferable advanced asset | `seasons/{seasonId}/draftPickStates/{assetId}` or `tradeableAssets/{assetId}` | Explicit ownership authority for picks, salary, contracts, keeper rights, and conditional assets; never inferred by the trade UI |
| Phase 12 permanent future pick | `seasons/{seasonId}/futureDraftPicks/{year__round__originalFranchise}` | Initial owner equals permanent original franchise; only audited commands may transfer current ownership |
| Keeper and contract rules | Active immutable SettingsVersion | Simple keeper controls are separate; advanced controls require the Dynasty type and never activate in redraft |
| Contract/cap authority | `playerContracts`, `deadCapCharges`, and rebuildable `salaryLedgers` | Published multi-season terms, retention, and dead money are validated against every affected season cap |
| Taxi/RFA/tag authority | `taxiAssignments`, `rfaTenders`, and `franchiseTags` | Stable revisioned assets constrained by the active Dynasty settings version |
| Orphan/comp/special-draft authority | `orphanTeamStates`, `compensatoryPicks`, and `advancedDraftPlans` | Commissioner commands require explicit reasons and never replace permanent franchise identity |
| Champion award | `seasons/{seasonId}/seasonAwards/champion` | Exact standings/bracket revisions and active playoff qualifiers; reasoned commissioner command only |
| Season archive | `seasonArchives/{seasonId}` plus archived `Season` | Immutable summary references; original canonical ledgers remain in place |
| League renewal | `League.current_season_id` plus a new UUID `Season` | Permanent franchises carry forward; roster/settings authority restarts as empty seasonal state and a draft rule version |
| Private export | `leagueExports/{exportId}` plus ordered chunks | Commissioner-only read; server command snapshot and browser download, never a second write authority |

The first implementation does not infer authority from `managerProviderUserId`, `leagueOwnerProviderUserId`, Sleeper roster ownership, or any other imported profile field.
