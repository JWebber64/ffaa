# Turn auction history into transparent Draft Receipts and Manager Draft DNA

## Implementation status

Implemented in `e898f72` on 2026-09-01. Rendered G.O.A.T. League verification at 1440px and 390px confirmed URL-restored Intelligence/Ledger tabs, 136 provisional 2025 receipts with 131 measured outcomes, responsive receipt cards, correct ordinal percentiles, and JWebber64's eight filtered receipts plus matching manager-profile Draft DNA. The focused 50-test set, TypeScript, ESLint, and `npm run build:vercel` passed from the clean release checkout.

Written against: `f03d414fcb530809d9cfa773973207e9e129fda9`

Dependency: implement `design-plans/2026-09-01-league-history-health.md` first. This plan consumes its persisted coverage manifest and metric-level eligibility rules.

## Evidence chain

- Surface: public `/league/:leagueId/history/drafts`, public manager profiles under `/league/:leagueId/history/managers/:managerId`, normalized draft/weekly result data, and the future historical-tendencies consumer described in the fantasy roadmap.
- Problem:
  - FFAA already has a strong raw auction ledger with spend, pick counts, source evidence, and position totals (`src/features/league-history/ui/pages/ActivityPage.tsx:72-142`), but it does not answer what each purchase produced or how each manager habitually builds a roster.
  - Manager profiles reduce draft history to a stored-pick count (`src/features/league-history/ui/pages/ManagersPage.tsx:50-67`, `src/features/league-history/ui/pages/ManagersPage.tsx:120`). That is accurate but not useful enough to identify spending style, repeat targets, or observed returns.
  - The normalized model can link a draft pick's `providerPlayerId` and `franchiseId` (`src/features/league-history/domain/types.ts:205-220`) to weekly roster ownership and starter results (`src/features/league-history/domain/types.ts:83-120`). That supports transparent observed outcomes without inventing retrospective market values.
  - Live G.O.A.T. League verification on 2026-09-01 found usable but partial 2024 and 2025 auction ledgers and no usable 2023 picks. Nomination order is unavailable. The first release therefore cannot honestly claim nomination tendencies or a complete multi-year grade.
- Design evidence:
  - The roadmap already calls for team-level spend pace, position demand, nomination pattern, and historical tendencies, while naming manager identity and draft-history normalization as dependencies (`docs/FANTASY_PRODUCT_ROADMAP.md:32`). This plan delivers the historically supported subset and explicitly suppresses nomination analysis when order is unknown.
  - Advice must show source and freshness (`docs/FANTASY_PRODUCT_ROADMAP.md:3`). Every receipt and aggregate must carry its season, observed-week range, ledger status, and excluded-data count.
  - FFAA prohibits invented metrics and fake dashboard patterns (`DESIGN.md:140-142`). The first release uses descriptive measures and league-relative comparisons, not opaque A-F grades, unsupported “steal/reach” claims, or a decorative KPI wall.
  - The interface should remain dense and useful (`DESIGN.md:106`, `DESIGN.md:150`): a compact summary plus sortable receipt table is the primary composition.
- Owner: pure League History analytics owns calculations; Draft History owns the full intelligence surface; Manager Profile owns a compact filtered summary and link back to the canonical surface.
- Scope and affected surfaces: deterministic analytics and types, URL-addressable Intelligence/Ledger views, manager filtering, manager-profile summary, styling, focused tests, and later design documentation.
- Uncertainty: weekly player rows prove that a player appeared on a franchise in an observed week; they do not prove continuous ownership between observations. Receipts must count only linked observed weeks. Injury adjustment and historical market-value baselines are unavailable and are not inferred.

## Design decision

Create “Draft Receipts” as auditable purchase outcomes and “Manager Draft DNA” as descriptive roster-construction tendencies. They share one pure analytics result and one coverage contract.

### Draft Receipt contract

For each recorded non-keeper auction purchase, expose:

- season, manager/franchise, player, position, NFL team, and paid price;
- source-ledger status and exact recorded/expected counts when known;
- observed roster weeks on the drafting franchise;
- observed starter weeks, started fantasy points, and all rostered fantasy points;
- started points per auction dollar, with the raw numerator and denominator visible;
- league-season percentile only among eligible purchases with the same position and a disclosed comparable price band;
- an exclusion/reason state when the draft pick, franchise, player result, or observed-week link is missing.

Do not assume a drafted player stayed on the original franchise. Join `WeeklyPlayerResult.weeklyRosterResultId` to `WeeklyRosterResult.franchiseId`, and count only rows whose franchise matches the drafting franchise. A later trade naturally ends the original team's observed receipt unless the player returns.

Keepers are shown in a separate recorded-keeper group. They do not enter price-efficiency comparisons because retained price rules vary by league and season.

### Manager Draft DNA contract

For each manager and eligible season, calculate only from recorded purchases:

- spend share by position;
- purchase count and spend by disclosed price bands;
- concentration: share of recorded spend used by the top three purchases;
- average and median paid price;
- observed starter points per dollar and observed starter weeks per purchase;
- repeat-player targets across seasons when provider player IDs are stable;
- number of eligible, excluded, keeper, and unlinked purchases.

Normalize prices by the season's per-team auction budget before cross-season comparisons. Define price bands in the analytics module and disclose their dollar equivalents in the UI. Initial bands should be budget-relative, not hard-coded to a `$200` league; for example, minimum/value, core, and premium boundaries are expressed as percentages of that season's team budget and rendered with the corresponding dollar cutoff.

Partial ledgers may produce a clearly labeled descriptive profile and individual observed receipts. They may not produce an unqualified manager grade or definitive league rank. The UI uses “provisional among recorded purchases” when comparisons include a partial source.

The first release explicitly excludes:

- A-F or 0-100 draft grades;
- retrospective “fair value,” “steal,” or “reach” claims without a dated historical market source;
- injury-adjusted scoring;
- nomination-order, bidding-war, or timing tendencies when `orderKnown` is false;
- predictions or recommendations in the live draft room.

## Reuse

- Consume coverage and `isHistoryMetricEligible` from `src/features/league-history/coverage/historyCoverage.ts`; do not create a second completeness system.
- Reuse the normalized draft, franchise, manager, weekly roster, and weekly player rows in `LeagueHistorySnapshot`.
- Reuse `createHistoryIndexes` patterns from `src/features/league-history/analytics/helpers.ts`; keep all calculations pure and UI-independent.
- Reuse `StatsDataTable` for sortable receipts and the accessible roving-tab behavior demonstrated by `src/components/stats/StatsViewTabs.tsx:10-45` for Intelligence/Ledger switching.
- Preserve the raw ledger, source workbook link, existing manager filter, and generic current-URL sharing. Encode view, season, and manager filters in the URL so the existing share action captures a reproducible state.
- Keep `/league/:leagueId/history/drafts` as the canonical full surface and Manager Profile as a compact consumer, consistent with `design-plans/2026-09-01-manager-team-first-information-architecture.md`.

## Changes

### Stage 0 — Enforce the data-trust dependency

1. `design-plans/2026-09-01-league-history-health.md`
   - Change: complete and validate the coverage manifest before enabling Draft Receipts or Manager Draft DNA in Production.
   - Preserve: the metric-level eligibility contract and conservative status vocabulary.
   - Verify: 2025 and 2024 are partial with exact evidence; 2023 is missing and cannot generate intelligence.

2. `src/features/league-history/coverage/historyCoverage.ts`
   - Change: register separate requirements for `draft-dna-descriptive`, `draft-receipt-observed-return`, and `draft-dna-comparison`. Descriptive output may tolerate a labeled partial ledger; comparisons require valid manager mapping, budget, weekly player linkage, and comparable observations.
   - Preserve: one central source of eligibility decisions.
   - Verify: missing nomination order suppresses only order-based output; it does not block price/spend or observed-return measures.

### Stage 1 — Build the deterministic intelligence engine

3. `src/features/league-history/analytics/draftIntelligence.ts` (new)
   - Change: implement `buildDraftIntelligence(snapshot, coverage, filters)` returning receipts, manager profiles, comparison populations, exclusions, observation windows, and source labels. Index rows once by season, draft, franchise, manager, weekly result, and provider player ID.
   - Preserve: immutable inputs and deterministic ordering for ties.
   - Verify: no network, current player value, UI state, or clock affects the result.

4. `src/features/league-history/analytics/draftIntelligenceTypes.ts` (new; keep beside the engine unless domain-wide reuse emerges)
   - Change: define `DraftReceipt`, `DraftReceiptOutcome`, `ManagerDraftDNA`, `DraftPriceBand`, `DraftIntelligenceExclusion`, and comparison-status types. Include raw components alongside every derived ratio or percentile.
   - Preserve: `LeagueHistorySnapshot` as the persisted normalized history contract; intelligence remains derived and is not written back to Firestore in the first release.
   - Verify: every unavailable field has a reason code rather than a fabricated zero.

5. `src/features/league-history/analytics/draftPriceBands.ts` (new only if the band logic makes `draftIntelligence.ts` difficult to test)
   - Change: convert budget-relative band boundaries to season-specific dollar labels and classify paid prices. Treat zero/null prices as ineligible unless league rules explicitly support them.
   - Preserve: raw auction price and budget values.
   - Verify: the same construction compares consistently between `$200` and non-`$200` seasons without comparing raw dollar amounts across budgets.

6. `src/__tests__/draftIntelligence.test.ts` (new)
   - Change: cover complete and partial ledgers, missing seasons, keeper separation, manager identity mismatch, missing price/budget, zero-dollar rows, stable tie ordering, repeated player targets, and budget normalization.
   - Preserve: compact, explicit fixture data.
   - Verify: include a player traded after Week 3 and prove only Weeks 1-3 on the drafting franchise count; include a later return and count only the matching observed weeks; include an unlinked weekly player and expose the exclusion.

7. `src/__tests__/draftIntelligenceCoverage.test.ts` (new or folded into `draftIntelligence.test.ts` if it remains readable)
   - Change: assert metric gating for 2025 partial, 2024 partial, 2023 missing, and unknown nomination order.
   - Preserve: History Health as the source of truth.
   - Verify: no A-F grade, unqualified rank, nomination tendency, or `NaN`/infinite ratio can be emitted.

### Stage 2 — Add Intelligence and Receipts to Draft History

8. `src/features/league-history/ui/pages/ActivityPage.tsx`
   - Change: split Draft History into URL-backed `Intelligence` and `Ledger` tabs. Keep `Ledger` as the unchanged factual fallback. Default to Intelligence only when at least one season is eligible; otherwise land on Ledger and explain what evidence is missing.
   - Preserve: season selection, manager selection, source workbook access, position totals, and every raw draft row.
   - Verify: `?view=intelligence&season=2025&manager=<stable-manager-id>` restores the exact surface after refresh and is captured by `ShareButton`.

9. `src/features/league-history/ui/draft/DraftIntelligenceSummary.tsx` (new)
   - Change: render one compact summary band for the selected scope: recorded spend, eligible purchases, observation window, position allocation, top-three concentration, and exclusions. The coverage/source sentence sits above the measures, not in a tooltip.
   - Preserve: useful density and ordinary body copy of at least 16px.
   - Verify: partial sources say “provisional among recorded purchases” and show exact missing evidence.

10. `src/features/league-history/ui/draft/DraftReceiptsTable.tsx` (new)
    - Change: render sortable columns for player, manager, paid, observed weeks, starter weeks, started points, points/$, comparable percentile, and evidence state. Provide a mobile row summary with explicit labels instead of forcing a page-wide horizontal scroll.
    - Preserve: `StatsDataTable` table semantics, numeric alignment, and one table scroll container on desktop when needed.
    - Verify: sorting is stable, null results sort after measured results, and the evidence/state column is understandable without color.

11. `src/features/league-history/ui/draft/ManagerDraftDNAView.tsx` (new)
    - Change: show position spend as a compact labeled distribution, price-band construction, concentration, repeated targets, and observed-return summary for the selected manager. Always pair percentages with dollars/counts.
    - Preserve: the selected season/manager URL state and direct access to the underlying receipts.
    - Verify: selecting “All managers” shows league distributions; selecting one manager changes both summary and receipts without duplicating a second filter system.

12. `src/features/league-history/ui/league-history.css`
    - Change: add a restrained two-level composition—evidence header, compact summary/distribution, then data table. Reuse current History borders, typography, and state colors.
    - Preserve: the existing raw-ledger styling at `src/features/league-history/ui/league-history.css:539-553` and responsive behavior at `src/features/league-history/ui/league-history.css:621-673`.
    - Verify: no repetitive equal-card grid, decorative progress rings, invented score gauge, clipped table, nested page scrollbar, or touch target below the shared minimum.

13. `src/__tests__/draftHistoryIntelligencePage.test.tsx` (new)
    - Change: test tab keyboard behavior, URL restoration, partial/missing copy, manager filtering, sorting, share-state compatibility, and Ledger fallback.
    - Preserve: semantic roles and user-visible labels in assertions.
    - Verify: the 2023 missing season never renders a receipt or aggregate constructed from zero rows.

### Stage 3 — Add a compact Manager Profile entry point

14. `src/features/league-history/ui/pages/ManagersPage.tsx`
    - Change: replace the bare stored-pick sentence with a compact `Draft DNA` section for the selected manager: eligible seasons, recorded spend mix, top-three concentration, observed starter-points/$, repeat targets, and exclusions. Link to the canonical Draft Intelligence URL filtered to the stable manager ID.
    - Preserve: career overview, season-by-season table, transaction count/link, and public profile access.
    - Verify: if no eligible season exists, show “No supported auction receipt yet” plus the exact coverage reason; do not show a zero-value profile.

15. `src/features/league-history/ui/draft/ManagerDraftDNASummary.tsx` (new only if shared with Draft History)
    - Change: share calculation formatting and evidence wording while allowing a compact profile variant.
    - Preserve: one analytics result; do not duplicate formulas in components.
    - Verify: Manager Profile and Draft History report identical values for the same manager/season filters.

16. `src/__tests__/managerDraftDNAProfile.test.tsx` (new)
    - Change: cover eligible, partial, missing, keeper-only, and manager-identity-mismatch profiles plus the filtered link target.
    - Preserve: existing manager profile tests and public route behavior.
    - Verify: the summary remains factual and does not imply league-wide completeness from a partial ledger.

### Stage 4 — Validate, document, and establish the future consumer contract

17. `docs/FANTASY_PRODUCT_ROADMAP.md`
    - Change after acceptance: mark the historical portion of opponent budget/roster tendencies as delivered and state that nomination-pattern and live-draft recommendations remain blocked on order data and a separately approved consumer design.
    - Preserve: the roadmap's identity, freshness, and source requirements.
    - Verify: this plan does not silently expand into `src/screens_v2/DraftRoomV2.tsx`.

18. `DESIGN.md`
    - Change after acceptance: document Draft Receipt terminology, raw-component disclosure, provisional comparison wording, keeper separation, and prohibited unsupported grades.
    - Preserve: the global no-invented-metrics rule.
    - Verify: future consumers can distinguish descriptive history from predictive advice.

## Scope

- Inherit: normalized League History IDs, public/shareable History, accepted team-first navigation, History Health coverage, workbook evidence, manager filtering, table primitives, and semantic design tokens.
- Verify: joins count only observed ownership on the drafting franchise; partial/missing states remain visible; cross-season prices are budget-normalized; keepers are excluded from price efficiency; raw components accompany ratios; shared URLs restore the view.
- Exclude: live DraftRoom integration, AI-generated scouting copy, A-F grades, external historical ADP/value acquisition, injury adjustment, nomination/bid timing without order data, keeper-value modeling, Sleeper writes, and persistence of derived intelligence.

## Validation

- Product:
  - On `/league/1385319428408774656/history/drafts`, verify 2024 and 2025 can show provisional recorded-purchase intelligence with exact partial labels; verify 2023 shows no supported receipt.
  - Select a known manager such as JWebber64 and confirm the Draft History totals match the manager-profile summary and underlying raw ledger.
  - Manually trace at least three purchases from draft row → drafting franchise → weekly roster rows → weekly player rows → displayed receipt.
  - Confirm keeper rows appear separately and do not affect non-keeper efficiency.
- Interface:
  - Capture Intelligence and Ledger at 1440px and 390px, plus one manager profile at both widths.
  - Verify tab arrow/Home/End behavior, filter labels, focus visibility, sortable headers, mobile row labels, non-color evidence states, and sole page-scroll ownership.
  - Verify changing the URL filters and refreshing reconstructs the same state; use the current Share action and open the copied URL in a clean session.
- System:
  - Compare engine output against hand-calculated fixtures for spend shares, top-three concentration, observed starter points, price normalization, and percentiles.
  - Run a fixture with sparse weekly data and confirm missing observations reduce eligibility rather than becoming zero performance.
- Repository: `npx vitest run src/__tests__/draftIntelligence.test.ts src/__tests__/draftIntelligenceCoverage.test.ts src/__tests__/draftHistoryIntelligencePage.test.tsx src/__tests__/managerDraftDNAProfile.test.tsx src/__tests__/leagueHistoryCoverage.test.ts --pool=threads --maxWorkers=1` → all calculation, gating, URL, and profile cases pass.
- Repository: `npm run lint` → no new lint errors.
- Repository: `npm run build:vercel` → Production-base TypeScript and Vite build succeeds.

## Stop conditions

- Stop if History Health is not implemented or the selected season lacks a trustworthy source/coverage state.
- Stop if a draft pick cannot be linked confidently to a stable manager/franchise and weekly roster ownership; expose it as excluded.
- Stop if an outcome calculation would treat missing weekly rows as zero points.
- Stop if a cross-season comparison uses raw dollars without a known season budget.
- Stop if the sample is too small for a comparison population; show the raw receipt without a percentile.
- Stop if stakeholders request a grade, steal/reach label, injury adjustment, or nomination tendency before its historical source and methodology are approved.
- Stop if the interface begins to duplicate the raw ledger, coverage rules, or manager filter calculations in React.

## Design documentation

- After acceptance and validation: add the Draft Receipt and Manager Draft DNA contracts to `DESIGN.md`, including evidence labels, provisional language, keeper treatment, and excluded claims.
- After acceptance and validation: update `docs/FANTASY_PRODUCT_ROADMAP.md` with delivered historical tendencies and the explicit remaining blockers for nomination/live-draft use.
- After acceptance and validation: mark this plan implemented with the validating commit and browser evidence. Retain `/league/:leagueId/history/drafts` as the canonical intelligence surface established by the accepted team-first information architecture.

