# Selected-stat ranking in Fantasy leaders

Actual and projected Fantasy leaders show a compact rank column before Player for the selected numeric statistic. The header follows the metric (for example FPG RK or Last 3 RK), the selected metric header is highlighted, and the table introduction names the ranking metric and position/team scope. Total-points position ranks remain independent and are labeled FPTS Pos Rk (Proj FPTS Pos Rk for projections).

- Rank all players eligible for the position, team, season, scoring, and game filters before applying text search or the visible row limit.
- Rank the highest underlying numeric value first, irrespective of ascending/descending display order. Equal values share competition ranks (1, 2, 2, 4); use unrounded source precision. Missing/non-finite values display a dash and do not consume ranks.
- Recent uses its existing Last 3 sorting value and labels the rank accordingly. Sorting Player or the existing position rank hides the selected-stat rank because these are not a selected performance statistic.
- CSV exports include the selected metric's rank and current table order, including filtered results beyond the visible row limit.
- Rank and player identity stay adjacent and visible during horizontal scrolling; keep page width contained at desktop and mobile sizes. Rank numbers are plain tabular numerals with no position-color encoding.

Implementation: `src/components/stats/statRanks.ts`, the optional `ranking` prop on `StatsDataTable`, and the Leaders integration in `StatsExplorer`. Other Stats Hub views retain their existing tables.

Verification: `statRanks.test.ts` covers ties, missing values, zero/negative numbers, and precision; `statsExplorerLeaders.test.tsx` covers metric changes, reversed sorting, search, row limits, and position scope. Run these alongside the table-scroll and position-system guards, the release preflight, and rendered desktop/mobile checks before release.
