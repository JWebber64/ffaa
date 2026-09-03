# Native fantasy platform final acceptance matrix

This matrix traces the required final scenarios to authoritative implementation and executable evidence. A UI label alone is not accepted as proof.

## Required scenarios

| Scenario | Authority / implementation | Automated evidence |
|---|---|---|
| Create native league | `create_native_league`; server-derived league/season UUID, membership, commissioner grant, draft settings, audit, receipt | `leagueCommandService.test.ts` |
| Invite manager; assign team/co-manager; revoke access | Expiring token invitation and canonical role grants; team-seat reconciliation; reasoned removal/revoke | `leagueMembershipCommands.test.ts` |
| Create/publish/reject settings | Immutable drafts, full validation, atomic publication/supersession/restore | `leagueSettings.test.ts`, `leagueCommandService.test.ts`, `commissionerSettingsWorkspace.test.tsx` |
| Complete snake and auction drafts | Draft-revision commands; every result co-commits player lock and roster transaction | `nativeDraftCommands.test.ts` |
| Reconnect and revert draft | Persisted draft/queue state; audited inverse roster transaction | `nativeDraftCommands.test.ts`, `nativeDraftWorkspace.test.tsx` |
| Save legal and reject illegal lineup | Published slot/position/roster/IR validation | `nativeLineupCommands.test.ts`, `nativeLineupWorkspace.test.tsx` |
| Individual lock and commissioner override | Player kickoff state, exact lineup revision, written locked-player override | `nativeLineupCommands.test.ts`, `nativeLineupModel.test.ts` |
| Replay scoring and correct stats | Stable provider-event IDs, deterministic replay, immutable corrections and rebuilt projections | `nativeScoringEngine.test.ts`, `nativeScoringCommands.test.ts` |
| Competing/conditional/retry-safe waivers | Ordered alternatives, single-player award, fallback, exact job receipt and idempotent retry | `nativeWaiverCommands.test.ts` |
| Complete trade; prevent double-traded asset | Accepted-review reservations plus final owner recheck and atomic two-team ledger | `nativeTradeCommands.test.ts` |
| Odd schedule; median standings; tiebreak; playoffs | Seeded generator, byes, physical/median/all-play rebuild, explanation trace, arbitrary field bracket | `nativeCompetition.test.ts`, `nativeCompetitionCommands.test.ts` |
| Reverse commissioner action | Immutable inverse roster transaction with original receipt/audit preserved | `rosterTransactionCommands.test.ts`, `commissionerAuditWorkspace.test.tsx` |
| Migrate old route and preserve Sleeper history | Unique provider mapping; compatibility resolver; imported history remains distinct/read-only | `nativeLeagueDomain.test.ts`, `leagueCommandService.test.ts`, `automaticLeagueHistoryImport.test.ts` |
| Mobile manager and commissioner workflows | Stable primary navigation, explicit authority, protected management, no horizontal overflow at 390 x 844 | `e2e/native-league-routing.e2e.ts` |
| Award champion, archive, renew, export | Revision-bound lifecycle commands, permanent franchises, immutable archive, private chunked JSON | `nativeSeasonLifecycleCommands.test.ts`, `nativeLeagueFirestoreRules.test.ts` |

## Required concurrency attempts

| Race | Evidence |
|---|---|
| Two teams add the same player | `rosterTransactionCommands.test.ts` |
| Two trades contain the same player | `nativeTradeCommands.test.ts` |
| Stale lineup save | `leagueCommandService.test.ts`, `nativeLineupCommands.test.ts` |
| Duplicate draft command | `nativeDraftCommands.test.ts` |
| Duplicate waiver job | `nativeWaiverCommands.test.ts` |
| Two commissioners publish the same settings revision | `leagueCommandService.test.ts` |

## Performance and reliability contract

- Native player-market rows are virtualized with `react-window`; the data set is no longer truncated to an arbitrary first 60 players.
- Route-level lazy loading isolates League History, analytics, research, and every heavy league workspace. Native hooks subscribe only to the collections needed by the active route; they retain the previous projection when a listener reports an error.
- `schedule/current`, `standings/current`, `scoringWeeks`, trade/waiver receipts, audit/Pulse projections, and the native Home aggregation are purpose-specific reads rather than page scans of the league root.
- Command `processedAt` is generated server-side and persisted as UTC ISO time. Waiver deadlines show league-local and user-local time when those zones differ.
- Every retryable mutation carries a semantic command ID. Existing receipts are returned for exact retries; stale revisions are surfaced and never silently replaced.
- Loading, stale, cached-last-known, retrying, error, and read-only authority states are visible on their operational surfaces. Dirty commissioner rules trigger unload and in-app-navigation confirmation.
- Direct browser writes to every canonical authority, award, archive, and export path are denied. Export manifests/chunks are readable only by current commissioners.

## Remaining external boundary

GameHQ does not write to Sleeper, Yahoo, ESPN, or CBS. Those providers remain read-only imports/mirrors. A very large JSON snapshot that exceeds the safe atomic export limit requires a future background-object-storage export; the synchronous command fails explicitly rather than returning a partial file.
