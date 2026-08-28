# Player Value Imports

The app exposes two different dollar concepts:

- `auctionValue`: GameHQ Fair Value, built from one median vote per independent
  publisher and recalculated for the active scoring, team count, drafted roster
  size, and budget.
- `marketValue`: the median of compatible imported published auction-dollar
  sources before FFAA projection and roster-demand adjustments.

The Auction Builder's `Proj` number is a separate scoring-aware median of
independent public season-projection publishers. Each publisher receives one
vote. The row also shows the vote count and low-to-high range.

The value engine can use these sources:

- Sleeper suggested auction values supplied for import
- ESPN salary-cap values
- FFToday PPR, half-PPR, and standard auction boards
- Sports Illustrated position auction boards
- USA TODAY 12-team, one-QB standard, half-PPR, and full-PPR rankings/auction values
- RT Sports completed-auction AAV
- YAFSB actual Sleeper auction prices
- Draft Sharks public top-25 preview
- Footballguys public top-15 preview
- FantasyNerds public top-10 preview
- SportsBrackets printable consensus board (display-only)
- LeagueLogs Market Index (free API, attribution required)
- WinWithOdds Vegas projections
- ESPN Mike Clay season projections
- Sleeper 2026 Season projections read from the public league Players table
- FFToday public season projections
- CBS Sports public season projections
- FantasyPros auction/projection exports
- Draft Sharks projection exports
- RotoWire value/projection exports
- Yahoo salary-cap value or ADP exports
- Sharp Football Analysis projection exports
- 4for4 ADP exports
- Fantasy Football Calculator ADP exports
- RotoBaller cheat sheet exports
- Fantasy Footballers ranking exports
- FantasyNerds public auction-value exports
- FullTime Fantasy / FFToolbox auction-value exports
- BeatADP market ADP exports
- Rank/ADP-derived fallback values

`src/data/publicAuctionValueSources.ts` is the public-source registry. It
catalogs all 23 researched public auction-value surfaces, including public
dynamic calculators and workbooks that do not expose a stable board. The live
importer currently populates nine of those sources without accounts, cookies,
or subscription access. Preview sources stop at the rows shown to a signed-out
visitor. Derived aggregates such as SportsBrackets, ElBoberto, and CSG are
cataloged or displayed, but do not receive independent consensus weight when
that would double-count their underlying inputs.

The fair-value board is calibrated to the active league's complete auction pool.
Every drafted player retains the $1 minimum, and the bottom 15% of the modeled
draft pool forms a replacement-price tier. The remaining premium dollars follow
a mild top-heavy curve so the board reflects how real auction rooms concentrate
spending while still conserving every league dollar. The drafted universe is
derived from the actual team count, roster size, and eligible roster positions;
IR slots are excluded, and K/DST are not valued as draftable when the active
league does not roster them.

When a user connects a public Sleeper league in League HQ, GameHQ stores that
league's scoring, team count, roster template, and auction budget from the
Sleeper draft when available. Stats Auction Values and Build a Team use the most
recently connected league by default and display the active assumptions. When
Sleeper does not publish an auction budget, GameHQ labels and uses the standard
$200 fallback.

Every included season projection is first converted to the active league's
auction-dollar scale. Complete compatible published boards are already in that
scale. Products from the same publisher are collapsed before the final median,
so Sleeper Season plus Sleeper Suggested still receive one Sleeper vote, and
FFToday's projection plus auction board still receive one FFToday vote. The
current publisher set is ESPN, Sleeper, WinWithOdds Vegas, FFToday, CBS, and USA
TODAY. Rank and ADP remain fallbacks when no publisher source matches a player.

The separate published-value median uses Sleeper Suggested, FFToday, and USA
TODAY for 12-team Full PPR. Standard and Half PPR use the compatible FFToday and
USA TODAY boards. Public previews and boards without confirmed league-size
assumptions remain inspectable but do not silently enter this default median.

Season projections are normalized to the selected Standard, Half PPR, or PPR
format before the median is calculated. ESPN Clay and WinWithOdds are rescored
from their stat lines; Sleeper, FFToday, and CBS are normalized by their
published reception totals. FantasyPros is cataloged but is not another vote
because its current consensus is built from ESPN, CBS, and FFToday. Razzball is
also cataloged, but its Cloudflare challenge currently prevents a dependable
unattended refresh, so it is never represented as a populated source.

LeagueLogs and completed-auction AAV are market signals rather than publisher
Fair Value votes. They remain separately attributable and available for market
context without being blended into the default projection consensus.

Use `npm run values:import` to normalize CSV or JSON exports into the source files consumed by `src/data/playerValues.ts`.

## Input Columns

The importer accepts common column names. At minimum, each row needs a player name, position, and at least one value signal.

```csv
name,pos,team,auctionValue,projectedPoints,adp,rank,scoring,budget,teamCount,rosterSize,updatedAt
Ja'Marr Chase,WR,CIN,58,306.05,8.2,1,ppr,200,12,15,2026-08-10
Bijan Robinson,RB,ATL,61,308.90,2.4,2,ppr,200,12,15,2026-08-10
```

Accepted aliases include:

- Name: `name`, `player`, `player name`, `full name`
- Position: `pos`, `position`
- Team: `team`, `nflTeam`, `nfl team`, `tm`
- Auction dollars: `auctionValue`, `auction value`, `salaryCapValue`, `salary`, `avg salary`, `average salary`, `value`, `$`
- Projected points: `projectedPoints`, `projected points`, `projection`, `projections`, `points`, `fantasyPoints`, `fpts`
- ADP: `adp`, `averagePick`, `average pick`, `avg pick`
- Rank: `rank`, `overall rank`, `ovr`, `#`
- Scoring: `scoring`, `format`, `scoring type` (`ppr`, `halfPpr`, or `standard`)
- Source budget: `budget`, `auction budget`, `salary cap`
- League shape: `team count`, `teams`, `league size`, `roster size`

## Commands

Refresh all machine-readable public boards and write a provenance report:

```powershell
npm run values:public:pull
```

This writes:

- `src/data/players-2026-public-auction-values.json`
- `reports/public-auction-value-sources.json`

The refresh fails when a required public scraper errors and warns when a page
returns fewer rows than its public contract. A reachable page is not treated as
a populated import.

Refresh the independent public projection pages and Vegas cache:

```powershell
npm run projections:pull
```

This writes:

- `src/data/players-2026-espn-clay-projections.json`
- `src/data/players-2026-winwithodds.json`
- `src/data/players-2026-public-projections.json`
- `reports/public-projection-sources.json`

Sleeper is captured from the rendered website rather than an undocumented
projection endpoint. Its current public 2026 Season/PPR capture is stored in
`src/data/players-2026-sleeper-projections.json`, with the source URL, scoring,
stat line, and capture date on every row.

Dry-run an import:

```bash
npm run values:import --source=rotowire --input=exports/rotowire.csv --dry-run=true
```

Import source data:

```bash
npm run values:import --source=fantasypros --input=exports/fantasypros-auction.csv
npm run values:import --source=sleeper --input=exports/sleeper-auction.txt --scoring=ppr --budget=200 --updated-at=2026-08-11
npm run values:import --source=draftsharks --input=exports/draftsharks-projections.csv
npm run values:import --source=rotowire --input=exports/rotowire.csv
npm run values:import --source=yahoo --input=exports/yahoo-salary-cap.csv
npm run values:import --source=sharp --input=exports/sharp-projections.csv
npm run values:import --source=4for4 --input=exports/4for4-adp.csv
npm run values:import --source=fantasyfootballcalculator --input=exports/fantasyfootballcalculator-adp.csv
npm run values:import --source=rotoballer --input=exports/rotoballer-cheatsheet.csv
npm run values:import --source=footballers --input=exports/footballers-rankings.csv
npm run values:import --source=fantasynerds --input=exports/fantasynerds-auction.csv
npm run values:import --source=fftoolbox --input=exports/fftoolbox-auction.csv
npm run values:import --source=beatadp --input=exports/beatadp-adp.csv
```

The importer writes to:

- `src/data/players-2026-sleeper-values.json`
- `src/data/players-2026-fantasypros-values.json`
- `src/data/players-2026-draftsharks.json`
- `src/data/players-2026-rotowire.json`
- `src/data/players-2026-yahoo-values.json`
- `src/data/players-2026-sharp.json`
- `src/data/players-2026-4for4.json`
- `src/data/players-2026-fantasyfootballcalculator.json`
- `src/data/players-2026-rotoballer.json`
- `src/data/players-2026-footballers.json`
- `src/data/players-2026-fantasynerds.json`
- `src/data/players-2026-fftoolbox.json`
- `src/data/players-2026-beatadp.json`

After importing, run:

```bash
npm test -- --run src/__tests__/playerValues.test.ts
npm run build
```

## Source Pulse

Use the pulse monitor to check source availability and local import freshness:

```bash
npm run values:pulse
```

The pulse writes:

```txt
reports/value-source-pulse.json
```

It checks:

- WinWithOdds CSV availability and row count
- FFToday and CBS season-projection page availability
- Local ESPN Clay, Sleeper season, public projection, and WinWithOdds caches
- Local 2026 player pool and ESPN salary-cap values
- FantasyPros, RotoWire, Draft Sharks, and Yahoo public page availability
- USA TODAY's syndicated 2026 standard, half-PPR, and PPR value board
- Sharp, 4for4, Fantasy Football Calculator, RotoBaller, Fantasy Footballers, FantasyNerds, FFToolbox, and BeatADP public page availability
- Sleeper NFL state and trending add/drop endpoints
- Local import files for every manual source and Sleeper

Sleeper note: the full Sleeper player map is a large endpoint. The pulse only calls it once per day unless forced:

```bash
npm run values:pulse --force-sleeper-players=true
```

Sleeper's documented draft endpoints are supported for user-directed imports of
actual auction winning bids (`pick.metadata.amount`). Sleeper's separate
suggested-value feed is undocumented and is not republished or blended without
written permission from Sleeper. A board explicitly supplied by the user can be
imported as a distinct suggested-value source; it remains separate from actual
winning bids imported from a completed Sleeper draft.

Sleeper season projections are a different source from suggested auction
values. They are visible under `Players > Projection > 2026 > Season` and are
included as one independent projection vote after scoring normalization.

## No Commercial API Workflow

We are not integrating paid/commercial or account-backed fantasy-data APIs. The workflow is:

- Keep WinWithOdds, FFToday, and CBS automated for projection refreshes.
- Refresh Sleeper season projections from the rendered public league page.
- Pull the ESPN 2026 salary-cap PDF with `npm run espn:pull`.
- Build the active 2026 player pool with `npm run players:pull`. If FantasyPros does not expose a parsable table, this falls back to the current ESPN sheet and refuses to write an empty pool.
- Use Sleeper public data for player IDs, league/draft metadata, and trend signals.
- Use manual CSV/JSON exports for FantasyPros, Draft Sharks, RotoWire, Yahoo, Sharp, 4for4, Fantasy Football Calculator, RotoBaller, Fantasy Footballers, FantasyNerds, FFToolbox, and BeatADP.
- Do not persist or redistribute public preview/API values when the publisher's
  terms require written permission. RTSports currently states that its AAV data
  may not be displayed or used for derivative works without express permission,
  so it is research-only unless that permission is obtained.
- Use `npm run values:pulse` twice per day to flag public-source errors and empty import files.
- Do not import or monitor prior-season pages as current sources. FFToolbox has an import slot, but no public 2026 auction page is currently wired into the pulse.

Source trust is configured in:

```txt
src/config/valueSourceWeights.ts
```
