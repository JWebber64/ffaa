# Make League History completeness visible and actionable

Written against: `f03d414fcb530809d9cfa773973207e9e129fda9`

## Evidence chain

- Surface: commissioner-only `/league/:leagueId/manage`, public `/league/:leagueId/history/drafts` and `/league/:leagueId/history/seasons`, the Sleeper/spreadsheet history importer, and the Firestore League History root document.
- Problem:
  - The public draft archive currently treats a draft source workbook as complete only when its embedded `auctionLedger.isComplete` flag is true, but falls back to the provider's generic `draft.status` when no workbook is present (`src/features/league-history/ui/pages/ActivityPage.tsx:124-141`). That fallback can describe a zero-pick season as “complete.”
  - Live G.O.A.T. League verification on 2026-09-01 showed 2025 as 136/144 and partial, 2024 as 135/144 and partial, and 2023 as 0 picks while displaying “complete.” The UI therefore cannot currently distinguish provider workflow status from imported-data completeness.
  - The importer already calculates auction sales, spend, expected roster spots, expected budget, manager matches, and warnings (`src/features/league-history/provider/spreadsheetAuction.ts:52-63`, `src/features/league-history/provider/spreadsheetAuction.ts:390-405`), but the Firestore root persists only aggregate counts (`src/features/league-history/persistence/firestoreLeagueHistoryModel.ts:41-48`, `src/features/league-history/persistence/firestoreLeagueHistoryModel.ts:519-527`). The client discards even that root metadata when assembling the snapshot (`src/features/league-history/persistence/firebaseLeagueHistory.ts:60-70`).
- Design evidence:
  - FFAA is an information-dense workspace (`DESIGN.md:106`, `DESIGN.md:150`), so this should be a compact status table rather than a grid of oversized cards.
  - FFAA prohibits fake dashboards, decorative pills, and invented metrics (`DESIGN.md:140-142`). Coverage percentages may appear only when the expected denominator is explicit and auditable.
  - The fantasy roadmap requires modeled advice to expose source and freshness (`docs/FANTASY_PRODUCT_ROADMAP.md:3`). Coverage is the prerequisite for trustworthy historical analytics.
  - `design-plans/2026-09-01-manager-team-first-information-architecture.md` already makes `/league/:leagueId/manage` the owner of commissioner operations and keeps `/league/:leagueId/history/*` public and read-only. This plan extends that accepted architecture; it does not create another navigation system or move public History behind authentication.
- Owner: League History import/persistence owns the coverage truth; League Manage owns remediation; public History pages are read-only consumers.
- Scope and affected surfaces: import payload and validation, Firestore schema/read compatibility, history loading/context, a commissioner History Health view, draft and season status summaries, focused tests, and design documentation after acceptance.
- Uncertainty: Sleeper does not provide a reliable expected denominator for every historical domain. Transactions in particular can be observed without proving completeness. Those domains must remain “completeness unknown,” even when rows exist.

## Design decision

Persist a versioned, per-season coverage manifest produced by the import pipeline. Do not infer authoritative completeness independently in each page.

Use the following status vocabulary everywhere:

- `complete`: observed data matches a documented expected denominator or another domain-specific invariant defined and tested by the coverage engine.
- `partial`: some data is present and a documented expectation proves that rows or spend are missing.
- `missing`: zero usable rows are present for a domain expected to exist.
- `unknown`: data may be present, but no reliable expected denominator exists.
- `not_applicable`: the domain does not apply to the season or draft format.

Every domain result includes `observed`, `expected: number | null`, `status`, `source`, `sourceUrl`, `importedAt`, and `reasons`. Draft evidence also includes recorded/expected spend, manager-mapping state, and whether order or nomination sequence is known. UI labels use plain language such as “Available; completeness unknown” rather than presenting `unknown` as an error.

Provider lifecycle values such as `pre_draft`, `drafting`, or `complete` remain raw source metadata. They never directly determine coverage.

Coverage rules are conservative and domain-specific:

- Franchises: compare observed franchises with the season's declared `totalRosters`; report manager identity mapping separately.
- Draft picks: require an explicit expected-pick/sale count. For spreadsheet auctions, also retain the existing expected-spend check. A provider-complete draft with zero picks is `missing`, not `complete`.
- Weekly rosters and player results: calculate expected rows only for completed weeks whose roster population can be established; do not count future/current partial weeks as missing.
- Matchups: use completed schedule weeks and the expected roster population only when the schedule invariant is valid.
- Transactions: show observed rows and freshness, but retain `unknown` unless an authoritative source supplies a denominator.
- Manager mapping: expose mapped/expected franchises plus low-confidence matches. Do not bury identity warnings inside a generic season status.

Add a metric-level eligibility helper. Later analytics ask whether their exact required domains are usable; they do not rely on one broad “season complete” boolean.

## Reuse

- Keep commissioner authorization and the shared league context in `src/screens/LeagueManage.tsx`; do not add a second role gate.
- Extend the existing query-driven `LeagueHQ` views and sync bar in `src/screens/LeagueHQ.tsx:64-92` and `src/screens/LeagueHQ.tsx:405-455`.
- Retain `SpreadsheetAuctionValidation` as the source of auction-specific evidence instead of recalculating workbook totals in React.
- Reuse `StatsDataTable` (`src/components/stats/StatsDataTable.tsx:46`) or the same compact table shell for desktop; use row labels and a single-column disclosure layout on narrow screens.
- Keep the current public League History routes and the shared league workspace established by `design-plans/2026-09-01-manager-team-first-information-architecture.md`.
- Preserve source workbook links and the existing generic `ShareButton`; do not create public links to the commissioner-only health page.

## Changes

### Stage 1 — Define and persist authoritative coverage

1. `src/features/league-history/domain/types.ts`
   - Change: add `HistoryCoverageStatus`, `HistoryDomainCoverage`, `LeagueSeasonCoverage`, and `LeagueHistoryCoverage`. Add an optional `coverage` field to `LeagueHistorySnapshot` during the schema transition so existing test fixtures and cached version-1 data remain readable.
   - Preserve: normalized historical row types and their existing IDs.
   - Verify: a coverage object can represent a partial draft, an observed-but-unknown transaction set, and a missing zero-pick draft without invented percentages.

2. `src/features/league-history/coverage/historyCoverage.ts` (new)
   - Change: implement deterministic domain counters, expectation rules, reason codes, summary labels, and `isHistoryMetricEligible(metricId, seasonCoverage)`. Keep display copy out of persisted reason codes.
   - Preserve: raw provider statuses as evidence only.
   - Verify: the same input always produces the same manifest; no React component owns completeness logic.

3. `src/features/league-history/provider/sleeperMapper.ts`
   - Change: retain the source facts needed by the coverage builder, including total rosters, completed weeks, draft format/settings, and source lifecycle status.
   - Preserve: existing Sleeper normalization and historical identifiers.
   - Verify: current/future weeks are not counted as missing historical results.

4. `src/features/league-history/provider/spreadsheetAuction.ts`
   - Change: pass `SpreadsheetAuctionValidation` evidence into the manifest builder, including source label/URL, sales, spend, expected totals, manager matches, warnings, and order-known state.
   - Preserve: the existing validation rules and Week 1 roster-overlap manager mapping; do not weaken a mismatch into a warning when the importer currently stops.
   - Verify: partial ledgers retain their exact numerator and denominator after persistence.

5. `scripts/import-sleeper-league-history.ts`
   - Change: build the coverage manifest after all Sleeper and spreadsheet merges, include it in `--auction-report`, and print a concise per-season coverage summary before writing.
   - Preserve: `--only-seasons`, `--drafts-only`, route aliases, and the current explicit source configuration (`scripts/import-sleeper-league-history.ts:260-320`).
   - Verify: a drafts-only refresh updates draft evidence without falsely zeroing unrelated domain coverage; if prior coverage cannot be merged safely, stop before writing.

6. `src/features/league-history/persistence/firestoreLeagueHistoryModel.ts`
   - Change: increment the writer schema to version 2 and persist `coverage` on `FirestoreLeagueHistoryRoot`. Keep counts as a low-level audit aid. Make bundle assembly attach normalized coverage to the returned snapshot.
   - Preserve: chunk sizing, week documents, route aliases, and version-1 snapshot rows.
   - Verify: version-2 round-trip preserves every evidence field and version-1 roots normalize to conservative `unknown`/`missing` states without a destructive migration.

7. `src/features/league-history/persistence/firebaseLeagueHistory.ts`
   - Change: accept both version 1 and version 2 roots during rollout. Normalize version 1 through the same coverage engine; reject only truly unsupported schemas. Cache snapshot plus coverage together.
   - Preserve: alias resolution, refresh semantics, week loading, and the public missing-import error.
   - Verify: an existing version-1 Production document remains readable before it is re-imported.

### Stage 2 — Add commissioner History Health

8. `src/screens/LeagueHQ.tsx`
   - Change: add `history-health` to the existing Manage views and render it at `/league/:leagueId/manage?view=history-health`. Put its entry adjacent to the existing sync/import controls. The view summary states one of: “Ready for supported analytics,” “Some analytics are limited,” or “History source data is missing.”
   - Preserve: the current Overview, Rules, Managers, Records, Season archive, Rivalries, Draft Central, and Futures views, and the accepted `/manage` route owner.
   - Verify: changing leagues preserves `view=history-health`, just as current views are preserved at `src/screens/LeagueHQ.tsx:201-218`.

9. `src/features/league-history/ui/HistoryHealthPanel.tsx` (new)
   - Change: render one compact row per season with columns for season, franchises/identity, matchups, weekly player results, draft ledger, transactions, source/freshness, and remediation. Use text plus an icon/state word; color is supplementary.
   - Preserve: minimum 16px ordinary body copy and compact density. On mobile, each row becomes a labeled disclosure block with one scroll owner and full-width actions.
   - Verify: keyboard and screen-reader users receive the status, numerator/denominator when known, reasons, last import time, and action name.

10. `src/features/league-history/ui/HistoryHealthAction.tsx` (new, only if more than one surface consumes the actions)
    - Change: map persisted source metadata to supported actions: refresh the connected Sleeper league, open the verified source workbook, or show the exact existing admin/CLI remediation instruction. Do not invent a browser upload flow.
    - Preserve: external links open explicitly and retain safe `rel` attributes.
    - Verify: users never see a nonfunctional “Fix” button.

11. `src/screens/league-hq.css` and `src/styles/refinement.css`
    - Change: style the compact health table and narrow-screen disclosures using existing field, border, text, and state tokens.
    - Preserve: shared League HQ hierarchy and later semantic refinements; do not add decorative rails, status-pill clouds, or an equal-card dashboard.
    - Verify: 1440px desktop and 390px mobile have no clipped columns, nested page scrollbar, or undersized controls.

### Stage 3 — Make public History honest

12. `src/features/league-history/ui/pages/ActivityPage.tsx`
    - Change: replace the local `sourceUrl ? isComplete : draft.status` rule with the persisted draft coverage result. Show observed/expected picks and spend only when those expectations exist. Explain missing order separately from ledger completeness.
    - Preserve: source workbook links, position-spend summary, manager filtering, and the raw ledger.
    - Verify: G.O.A.T. League renders 2025 as partial 136/144, 2024 as partial 135/144, and 2023 as missing 0—not complete.

13. `src/features/league-history/ui/pages/SeasonsPage.tsx`
    - Change: consume the same coverage manifest for season archive readiness and draft-ledger summaries; link commissioners to Manage History Health while anonymous viewers receive a neutral explanation without a private-route call to action.
    - Preserve: existing season navigation and public read access.
    - Verify: no page derives a conflicting status from `HistoricalDraft.status` or `auctionLedger.isComplete` alone.

14. `src/features/league-history/ui/league-history.css`
    - Change: add compact coverage copy, evidence rows, and missing/partial states within the current History visual language.
    - Preserve: the existing dense draft summary and responsive breakpoint behavior (`src/features/league-history/ui/league-history.css:539-553`, `src/features/league-history/ui/league-history.css:621-673`).
    - Verify: state remains understandable without color and source/freshness text does not overflow at 390px.

### Stage 4 — Lock the trust contract with tests

15. `src/__tests__/leagueHistoryCoverage.test.ts` (new)
    - Change: cover every status, unknown denominators, current-week exclusion, manager mapping, source reasons, and metric-level eligibility.
    - Preserve: small deterministic fixtures with no network dependency.
    - Verify: explicitly include 136/144 partial, 135/144 partial, provider-complete with 0 picks as missing, and transactions with rows but no denominator as unknown.

16. `src/__tests__/spreadsheetAuction.test.ts`
    - Change: assert that validation evidence survives merge and is handed to coverage unchanged.
    - Preserve: manager-match and spend validation cases.
    - Verify: partial spend and partial sales produce distinct reason codes.

17. `src/__tests__/firestoreLeagueHistoryModel.test.ts`
    - Change: add version-2 round-trip and version-1 compatibility coverage.
    - Preserve: chunk and weekly-document assertions.
    - Verify: importing only selected seasons cannot erase unaffected coverage.

18. `src/__tests__/seasonArchivePage.test.tsx` and `src/__tests__/historyHealthPanel.test.tsx` (new)
    - Change: assert public wording, commissioner actions, mobile labels, and anonymous behavior.
    - Preserve: semantic queries rather than class-name snapshots.
    - Verify: no rendered path describes an empty draft as complete.

## Scope

- Inherit: team-first league navigation, public History routes, commissioner authorization, current importer flags, workbook validation, generic sharing, semantic color roles, and minimum typography from the existing product.
- Verify: source/freshness is visible; public and commissioner surfaces agree; version-1 data remains readable; the exact G.O.A.T. League cases are correct; unknown denominators never produce percentages.
- Exclude: a new file-upload workflow, automated writes to Sleeper, cross-platform ESPN/Yahoo/CBS import, new historical analytics, changes to public canonical URLs, and a redesign of Commissioner Studio's editable league JSON.

## Validation

- Product:
  - Import or fixture the G.O.A.T. League and prove 2025 `partial 136/144`, 2024 `partial 135/144`, and 2023 `missing 0` on both Manage and public Draft History.
  - Confirm a commissioner sees remediation while an anonymous public visitor sees evidence without private actions.
  - Confirm transactions with rows but no authoritative denominator say “Available; completeness unknown.”
- Interface:
  - Capture `/league/1385319428408774656/manage?view=history-health` and `/league/1385319428408774656/history/drafts` at 1440px and 390px.
  - Check keyboard traversal, disclosure state, focus visibility, non-color status labels, external-link naming, and sole page-scroll ownership.
- System:
  - Load an unmodified version-1 Firestore root, then a version-2 root, and compare normalized snapshots.
  - Exercise full, `--only-seasons`, and `--drafts-only` bundle construction without Production writes before any live import.
- Repository: `npx vitest run src/__tests__/leagueHistoryCoverage.test.ts src/__tests__/spreadsheetAuction.test.ts src/__tests__/firestoreLeagueHistoryModel.test.ts src/__tests__/seasonArchivePage.test.tsx src/__tests__/historyHealthPanel.test.tsx --pool=threads --maxWorkers=1` → all focused coverage, persistence, and UI cases pass.
- Repository: `npm run lint` → no new lint errors.
- Repository: `npm run build:vercel` → Production-base TypeScript and Vite build succeeds.

## Stop conditions

- Stop if a proposed `complete` state has no documented denominator or invariant; use `unknown` instead.
- Stop before a partial-season or drafts-only import can overwrite coverage for domains it did not fetch.
- Stop if version-1 Production history becomes unreadable during the schema transition.
- Stop if manager identity mapping is ambiguous; expose the mismatch and block identity-dependent analytics rather than assigning it heuristically in the UI.
- Stop if adding Manage status requires authenticating previously public History routes.

## Design documentation

- After acceptance and validation: update `DESIGN.md` with the canonical coverage vocabulary, evidence/freshness presentation, and rule that provider lifecycle status is not completeness.
- After acceptance and validation: update `docs/FANTASY_PRODUCT_ROADMAP.md` to name History Health as the data-trust prerequisite for draft and manager tendencies.
- After acceptance and validation: mark this plan implemented with the validating commit and exact browser evidence; do not modify the accepted route ownership in `design-plans/2026-09-01-manager-team-first-information-architecture.md`.


