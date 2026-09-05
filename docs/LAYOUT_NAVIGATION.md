# Layout and navigation contract

Implemented September 5, 2026 from source baseline `05822b7891cf4fbde08e79f5d4a05395866414fa`. The audit traced 91 route declarations, 402 reachable files, and 127 overlay/control use sites, including registered legacy routes. Those counts include wrappers, aliases, and repeated consumers; they are not counts of distinct populated pages. The five Tools children resolve inside `Tools.tsx`.

The complete [baseline coverage ledger](audits/layout-20260905/baseline-coverage.md) and [source inventory](audits/layout-20260905/source-inventory.json) preserve the original scope. This document records the implemented corrections and their acceptance contract. It does not establish a Production release.

## Navigation

- The product brand and global Home always lead to `/ff/`, even with connected teams. Preserve the router basename's trailing slash so Home can reload at the canonical hosted address. The existing Vercel redirect also canonicalizes `/ff`.
- Global desktop navigation is Home, My Teams, Research, and Draft. The connected landing page offers My Teams without discarding the selected connection.
- Outside a league, mobile navigation stays global. Inside a league, it becomes League home, Matchup, Team, Players, and More. More contains Home, My Teams, Manage leagues, all grouped destinations, and the team switcher.
- The route's league ID owns native workspace navigation; a remembered Sleeper team must not replace it. Team and Matchup expose only one current-page state, including the old team/matchup alias.
- Use one visible context switcher per breakpoint. On mobile, local league navigation adds Transactions and League rather than duplicating the bottom bar.
- Menu disclosures dismiss on selection, outside pointer input, and Escape. Content disclosures such as source methodology remain open while their controls are edited.
- Product, League, and History navigation panels opt into `data-viewport-menu`. The shared disclosure hook measures the actual anchor and viewport, opens above when needed, clamps horizontal placement, and updates on scrolling, resizing, or visual-viewport changes. It reserves the fixed header and mobile navigation. Do not replace this with a guessed fixed header offset on an individual page.

## Density and scroll ownership

| Surface | Implemented behavior | Preserve |
| --- | --- | --- |
| My Teams | Compact heading and status band; each row owns its decision and action; account sync follows the list. | Cross-league exposure, urgency/evidence, connection identity, sync action. |
| Shared working screens | Section-size titles, natural-height headers, compact padding and gaps. | Landing artwork/display scale, useful charts, draft interaction surfaces. |
| Stats and League Players | Compact standalone/embedded headings, complete desktop filter rows in every mode, two-column mobile controls, labeled source/import/recommendation disclosures. Fixed draft/trend years remain in the heading instead of inert selects. | Primary filters, active value profile and budget, source warnings, methodology, league eligibility, export, source distinctions. |
| Auction Values | Natural-height header, source methodology and advanced comparisons in labeled disclosures, visible scoring/budget/search/position controls. | Normalization and comparable-source rules, source sheets, print, source selection, fair value versus market distinction. |
| Tools | Compact shared context/header; hub groups lead with their task; independent builder columns align to their own content. | All five tools and their calculations, league context, existing imagery. |
| League History | One outer gutter/context, compact masthead, four overview metrics in one complete desktop row, independent columns aligned at the top. | All routes, histories, manager data, share action, source attribution. |
| Player profile | Natural-height metric cells in two mobile columns, one section gap, bounded drawer body. | Overview, logs, career, news, sources, position semantics. |
| Shared modals | ModalLite and compatibility modal use bounded flex bodies with visible headers/actions. | Existing dialog content and callbacks. |
| Commissioner Studio | Dynamic viewport height, scrollable tab list and panel, reachable footer and last tab on short screens. | All editors and commissioner save behavior. |
| More and navigation popups | Bound to the available dynamic viewport with internal scrolling and safe-area spacing. | Every destination and full touch targets. |

Ordinary pages use `html` as their document scroller. Horizontal scrolling belongs inside wide data tables. Bounded modal, drawer, menu, and select bodies are intentional internal scrollers. Do not stretch ordinary cards to fill a short page, remove chart interaction height, or hide errors to create artificial density.

## Verification

Run the local app with `npm run dev -- --host 127.0.0.1 --port 5278 --base=/ff/ --mode=test`. On Windows use `npm.cmd` if a PowerShell npm shim consumes the flags. These fixture scripts refuse non-local origins and never save to an external account.

```sh
node scripts/verify-layout.mjs
LAYOUT_WIDTHS=1024 LAYOUT_CASES=stats,auction,teams node scripts/verify-layout.mjs
LAYOUT_EXTENDED=1 node scripts/verify-layout.mjs
LAYOUT_WIDTHS=844,390 LAYOUT_HEIGHT=390 LAYOUT_CASES=history LAYOUT_MENUS=1 node scripts/verify-layout.mjs
node scripts/verify-layout-overlays.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5278/ff/ npx playwright test e2e/home-navigation.e2e.ts e2e/native-league-routing.e2e.ts
npx vitest run --pool=threads --maxWorkers=2
npm run lint
npm run build:vercel
```

In PowerShell set environment variables using `$env:NAME='value'` before each command and remove optional selectors afterward. Reports and actual viewport screenshots are generated under `reports/layout-20260905/` and remain ignored by Git.

The base rendering run covers 18 route cases at 1440×900 and 390×844 plus the mobile More menu and five player-profile tabs (43 captures). Tablet checks cover My Teams, Stats, and Auction Values at 1024×900. Extended checks cover the other six Stats modes, Auction print/source/settings states, and the History subpages. Sleeper teams and normalized History use deterministic fixtures; the renderer waits for populated Team and Matchup surfaces rather than accepting loading placeholders.

The overlay run checks eight mechanisms at 1440×900, 390×844, 844×390, and 390×480: ModalLite, compatibility modal, result dialog, selects near both viewport edges, dropdown, Commissioner Studio, and native player sheet. All five Studio tabs are opened. The scripts measure horizontal page overflow, ordinary-page nested scrollers, runtime errors, and overlay viewport bounds. Screenshots still require human visual inspection; geometry alone does not establish a good layout.

The completed local run produced 43 base captures, 3 tablet captures, 54 extended captures, and 32 passing shared-overlay checks. Follow-up captures verify the final Stats filter/import changes and 10 Product/League/History menu placements at short heights. The Stats Auction table moved from approximately 998px to 730px from the viewport top at 1440×900. My Teams shows two complete team rows and sync actions within roughly 580px in the two-team desktop fixture. These measurements describe those fixtures, not a promise that every data state has identical height.

The full suite passed 574 tests with eight skips before the final narrow follow-ups. The final navigation/menu group passed 16 tests, and the final Stats/position-contract group passed 40 tests, validating those follow-ups and one additional navigation regression. Lint and `build:vercel` passed after the final edits. All 10 browser navigation tests passed, including Home reload, native routing, short-screen menu placement, resize, and dismissal. Concurrent local verification briefly exceeded two test time limits; the serialized final rerun passed without increasing those limits.

Navigation regression tests cover connected Home and refresh, preservation of selected league, current-route mobile navigation, native league identity, Matchup aliases, menu bounds and dismissal, and native unavailable-state authority gates. The standard suite includes the required position-color and shared density contracts. No position palette or data model changed.

## Evidence limits and release acceptance

These are local implementation checks. The original audit also inspected live routes, but those captures predate this change. Do not describe this feature as deployed until the exact master Git deployment and canonical routes have been verified.

Local fixtures exercise layout with populated Sleeper teams and historical records. The canonical League home reader uses account-backed storage and renders its unavailable state in the dummy local project. Authenticated native league writes, live draft rooms, commissioner mutations, emulator-only tests, and every historical dataset combination remain separate release acceptance. Shared owner inspection covers their inherited layout, not successful live transactions. Eight emulator/environment-dependent tests are skipped by the normal suite.

Before Production, use the repository's clean latest-master release sequence, run the required checks, verify actual position fills and foregrounds on changed position-bearing screens, and inspect the exact preview with a connected account. Publish only through the master Git integration, then verify the canonical `/ff/` Home, teams, research, league, and overlay flows on that exact deployment.
