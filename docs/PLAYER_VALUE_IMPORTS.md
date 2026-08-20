# Player Value Imports

The app exposes two different dollar concepts:

- `auctionValue`: FFAA fair value, recalculated for the active scoring, team
  count, drafted roster size, and budget.
- `marketValue`: the median of compatible imported published auction-dollar
  sources before FFAA projection and roster-demand adjustments.

The value engine can use these sources:

- Sleeper suggested auction values supplied for import
- ESPN salary-cap values
- FFToday PPR, half-PPR, and standard auction boards
- Sports Illustrated position auction boards
- RT Sports completed-auction AAV
- YAFSB actual Sleeper auction prices
- Draft Sharks public top-25 preview
- Footballguys public top-15 preview
- FantasyNerds public top-10 preview
- SportsBrackets printable consensus board (display-only)
- LeagueLogs Market Index (free API, attribution required)
- WinWithOdds Vegas projections
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
catalogs all 22 researched public auction-value surfaces, including public
dynamic calculators and workbooks that do not expose a stable board. The live
importer currently populates eight of those sources without accounts, cookies,
or subscription access. Preview sources stop at the rows shown to a signed-out
visitor. Derived aggregates such as SportsBrackets, ElBoberto, and CSG are
cataloged or displayed, but do not receive independent consensus weight when
that would double-count their underlying inputs.

The fair-value board is calibrated to the active league's complete auction pool.
Every drafted player retains the $1 minimum. When imported dollar boards leave
a league-wide shortfall, the remaining money is spread evenly across draftable
skill players instead of multiplying already-expensive stars. If the preliminary
board overspends, only above-minimum premiums are reduced proportionally. The
drafted universe is derived from the actual team count and roster size; IR slots
are excluded.

Published auction values are combined with a median. Projection, ADP, rank, and
market-index signals can adjust fair value but never count as additional auction
boards. Confidence is therefore capped at 55% when only one compatible
auction-dollar source is present.

LeagueLogs is a market-index signal rather than a published auction price. It
has limited supporting influence on the model and is displayed as an FFAA
market-derived dollar column, with visible `Powered by LeagueLogs API`
attribution. Direct published auction dollars remain the primary inputs.

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
- Local 2026 player pool, ESPN salary-cap values, and WinWithOdds projection cache
- FantasyPros, RotoWire, Draft Sharks, and Yahoo public page availability
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

## No Commercial API Workflow

We are not integrating paid/commercial or account-backed fantasy-data APIs. The workflow is:

- Keep WinWithOdds automated for Vegas projections.
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
