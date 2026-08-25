# Firebase League History

Permanent league history lives in Cloud Firestore under:

- `leagueHistories/{currentSleeperLeagueId}`: league metadata, route aliases, schema version, and verified counts.
- `snapshotChunks/*`: size-bounded chunks for seasons, managers, franchises, matchups, playoffs, drafts, picks, completed transactions, and transaction assets.
- `weeks/{seasonLeagueId}-{week}`: lineup results, player results, weekly awards, and moments for one week.

The browser can read these documents but cannot write them. Live draft-room permissions remain independently scoped under `drafts` in `firestore.rules`.

## Validate an import

```bash
npm run league:history:goat:validate -- --firestore-plan
```

This refreshes the normalized Sleeper and auction-ledger payload, validates ledger coverage, reports Firestore document sizes, and does not write remote data.

## Guarded import

```bash
npm run league:history:import -- --league=<current-sleeper-league-id> --auction-sources=scripts/config/goat-auction-sources.json --route-aliases=<legacy-route-id>
```

The importer signs in anonymously, prints its one-time Firebase UID, and pauses. To complete a manual import:

1. Temporarily allow writes to `leagueHistories` and its descendants for only that exact UID.
2. Deploy only the temporary Firestore rules.
3. Continue the paused importer. It writes in batches, removes stale chunk/week documents, reads everything back, and requires a matching SHA-256 content hash.
4. Restore the checked-in `allow write: if false` rules immediately and deploy them before changing application code or Production configuration.

Never allow general anonymous writes to League History. A future unattended import should use Firebase Admin with Application Default Credentials and IAM rather than a browser credential or a checked-in service-account key.

## Rollback boundary

The former Supabase database and SQL migrations are retained as a temporary rollback source. They are not part of the application runtime, and Production must not contain `VITE_SUPABASE_*` variables.
