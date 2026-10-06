# Daily Fantasy Brief

The brief publishes completed-game scores, Who's Hot, low-rostered discovery candidates, your roster's results, and candidates who are unrostered in the selected league. Public discovery works without a connected league and also with incomplete imports. League advice uses actual league scoring and measured recent usage. Rankings are heuristics, not projections. Claims and roster changes stay in the existing league workflow.

## Public discovery and platform coverage

- Platform, scoring preset, position and a strict rostered-below threshold (10%, 25% or 50%; default 25%) persist separately for each sport in this browser. Who's Hot retains popular stars and highlights low-rostered performers. On days without scheduled NFL games it labels the last observed completed slate; pending current games never silently fall back to an older slate.
- Low-Rostered Standouts prioritizes the selected day's performers, followed by football's rolling seven-day candidates. Recent usage and scoring drive recommendations; a single strong game does not establish an Add now label. Public lists do not imply availability in the user's league. Private league rankings continue to exclude every verified owner by exact provider identity, including native market restrictions.
- Football discovery offers standard, half PPR and PPR with displayed weights, including interceptions, lost fumbles and two-point conversions. Verified league scoring is an optional choice. Missing applicable scoring stats never become zeros.
- ESPN public `players_wl` pools were verified without credentials or league IDs. NFL mapping uses a unique GSIS/ESPN provider crosswalk; conflicting and unmatched identities remain unknown. Sleeper football's public research endpoint returned numeric `owned` percentages. This endpoint is undocumented and best-effort; trending add counts are not ownership percentages. Sleeper documents free noncommercial API use and requires contacting it about commercial licensing. No commercial license is implied by public reachability.
- Yahoo and CBS remain selectable with explicit unavailable status and a performance watchlist whose percentages are unknown. Yahoo needs authorized ingestion configured for a public feed; CBS automated access has not been verified. No platform silently borrows another provider's percentages. No paid data feed, protected-page scraping or manager credential reuse is introduced.
- Scheduled generation enriches public editions once globally and caches requests across the three correction dates. Saved reads never ingest. Ownership failure leaves game status intact. Last verified same-season snapshots survive source failure with their original retrieval times; stale snapshots are marked, including figures older than 48 hours or future timestamps. Retrieval time is not a guarantee of upstream freshness. Source notes and URLs are in Sources and coverage. Snapshot content participates in revisions; renewing retrieval time records renewed provenance.
- The additive optional `rostership` field preserves version-1 archive compatibility. Existing records with no field render unknown percentages and remain readable.

## Schedule and persistence

- One edition per sport and Eastern game date. The daily job is configured at 12:00 UTC / 20:00 Taipei. Vercel Hobby runs daily jobs within the scheduled hour; exact-minute execution is not guaranteed.
- Each run rechecks the previous two game dates for late stats and corrections. Every football edition uses a rolling seven-day shortlist, including days without games. Tuesday retains its waiver-priority notice.
- Reports are generated once globally. All league filtering happens in the signed-in browser; private rosters are not persisted in public editions.
- The 60 most recent dates appear in the archive. Immutable content revisions are saved separately. This is an archive index limit, not an automatic deletion policy.
- A content hash avoids duplicate revisions. Atomic writes and a ten-minute lease protect against overlapping runs. A failed run keeps the previous edition; a partial refresh never replaces a complete edition.
- Public reads load saved reports and do not trigger source ingestion. Missing stats, partial editions, delayed publication, incomplete roster coverage and unsupported scoring are shown explicitly.
- Generating an edition requires the scheduler's Bearer CRON_SECRET. Missing authorization returns 401 before touching storage. Storage failure returns 503; source-generation failure returns 502 and is logged. Concurrent runs return 202. Cron does not automatically retry failed runs; use a protected manual rerun or the next daily correction pass.

## Ranking and availability

Owned players on every league roster are excluded by exact provider identity, not name matching. Incomplete league coverage withholds league-specific recommendations; public discovery remains available. Points scoring requires all applicable nonzero rules to be supported for each recent observation; missing values stay missing. Hockey categories use the selected categories, with missing category coverage disclosed.

An Add now label requires at least three recent completed games and sustained usage (NHL skater 17 minutes, NFL QB 28 attempts, RB 12 carries, WR/TE six targets per game) or usage growth above 15% versus the preceding two games. Football scoring comparisons are made within position against the median of up to ten available candidates, so raw QB points do not dominate. Hockey streamers need at least three games in the next week including a slate of eight or fewer NHL games. Partial editions and isolated strong games stay on Watch. These are initial, documented thresholds; they do not imply a confirmed injury replacement or starting goalie.

Recommendations are limited to NHL skaters/goalies and NFL QB/RB/WR/TE. Kicker and team-defense recommendations are outside this first version. Confirm health, locks, claim deadlines and current availability before acting. Older editions use the latest selected league snapshot, whose timestamp is shown.

## Roster decisions and follow-up

- Hockey identity coverage shows missing teams, empty rosters, duplicate NHL IDs and the unresolved players to review. A unique exact normalized name-and-team catalogue match can resolve a missing ID for this view; ambiguous matches and known ID/name conflicts remain unresolved. Imported roster, salary and keeper records are never changed by the brief.
- Bench comparisons require verified ownership, compatible active-slot eligibility and at least two supported observations for both players. Starters, reserves and recorded protected/keeper players are excluded. The automatic points benchmark is the weakest comparable bench scorer; the manager can select another eligible bench player. Category comparisons retain separate units and disclose observed samples. Recorded salary is shown when available; candidate acquisition and keeper prices are not invented.
- Hockey usable starts reuse the existing maximum matching allocator with the exact repeated active slots. They count additional skater appearances after fitting scheduled incumbents into eligible positions. Selecting a replacement also counts lost existing starts on other dates and shows the net change. Verified upcoming schedule coverage and daily lineups are required. Goalie starts and weekly lineup changes are not predicted. Candidate eligibility defaults conservatively to the NHL primary position; provider eligibility, health, acquisition timing, transaction limits and locks still require review.
- The acquisition assumption is the publication day, or the following day for a daily-tomorrow transaction setting. Historical plans use their historical schedule window; they do not promise a currently claimable player. An open-spot scenario assumes roster capacity is available. It is a lineup comparison, not approval of a transaction.
- Shortlist-change alerts are opt-in, in-app and local to the selected league/team/browser. The undated latest-report view polls the saved endpoint every 15 minutes while visible. Archived selections require manual reload. Alerts need complete reports and roster reads no older than 48 hours; first enablement and changes to own roster/scoring establish a quiet baseline. New entries, departures, recommendation-label changes and scoring-comparison improvements above both one ranking-score unit and 20 percent are meaningful changes. Duplicate report revisions are suppressed. There is no email, push or delivery while the brief is closed.
- Track results saves a recommendation, its selected bench benchmark and the scoring/category rules at that moment. Subsequent observations through 14 days are accumulated as editions are loaded. Player/game IDs deduplicate observations, newer generated reports apply corrections, and older reports cannot reverse those corrections. The UI reports observed game counts and incomplete coverage, never fills missed games with zero, and does not call these projections or a complete backtest. Tracking is limited to 30 records; removal is available. Browser storage failures are shown.

## Local operation

```powershell
npm run brief:generate
npm run brief:generate -- --date=2026-10-05
```

This CLI writes only the ignored .local/daily-brief directory. It does not publish to the hosted database. Vite's development endpoint reads that local store. No credentials, generated source snapshots or build output should be copied between the hockey and football apps.

Desktop and 390-by-844 mobile views were checked against real locally generated editions for October 3–5, 2026. Unit and component tests cover all-roster filtering, native market restrictions, custom scoring, incomplete coverage, archive selection, provider joins, corrections, retries, storage failure and concurrency. This confirms local behavior, not a Production scheduler invocation or authenticated Production database write.

## Release activation

Set CRON_SECRET independently in the app's Production environment using a strong random value. Keep it out of Git, client code and logs. Use the existing app-specific server database credentials. After an approved Production release, verify the exact deployment, canonical page and saved-report endpoint; invoke the authorized scheduler once and verify durable reads, revisions and logs. The cron configuration becomes active only in Production.

Do not present an unconfigured scheduler, a Preview build, or local generated editions as a live scheduled service. Review upstream terms for the application's intended use; these are free public feeds, not paid subscriptions or trials. Hosting and existing database usage remain subject to their own quotas.

References: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Sleeper API](https://docs.sleeper.com/), [nflverse player identity loader](https://nflreadr.nflverse.com/reference/load_ff_playerids.html), [Sleeper special teams scoring](https://support.sleeper.com/en/articles/3278982-special-teams-scoring-options).

## Football integration

- Page: /ff/daily-brief; a selected league opens /ff/league/:leagueId/daily-brief. Research and league navigation link to it.
- Free sources: ESPN public final-game status; nflverse schedules and weekly player statistics; the DynastyProcess GSIS-to-Sleeper identity crosswalk used by nflreadr. These avoid paid reads and full player-map downloads for every brief.
- Recent window: 28 calendar days; upcoming schedule: 14 days, with ranking comparisons using the next seven. Final status and schedule identity must agree before a stat row is included. Unmapped or ambiguous provider IDs cannot become waiver candidates.
- Actual Sleeper scoring and every retrieved league roster come from the existing My HQ load. Roster counts must match the league's declared team count. Applicable individual special-team rules remain distinct from kicker and team-defense rules. A zero combined fumble total can establish a zero special-team subset; positive totals without play attribution stay unsupported. See [nflfastR calculation source](https://github.com/nflverse/nflfastR/blob/master/R/calculate_stats.R).
- Native leagues use existing authenticated settings and player-market subscriptions. Only verified free_agent/on_waivers entries without an owner are eligible; protected and locked players are excluded. No claim command is issued. Authenticated native-market browser behavior still needs Production verification.
- Native bench comparisons additionally require the next scheduled week's published manual lineup, matching season/settings/roster revisions, a synchronized canonical roster and mapped identities. Protected market entries and reserve/injury records are excluded. Best-ball and native keeper/dynasty comparisons are withheld until the necessary protection and cost evidence exists. Custom published flex eligibility is respected. These checks are covered by unit tests; authenticated native subscriptions remain a separate release verification requirement.
- Sleeper reads retain raw own-roster and starting IDs, plus reserve/taxi IDs, alongside player enrichment. The brief never turns an unknown starter into a bench option or a reserve into a suggested drop. A Refresh league rosters action reloads the existing workspace. Sleeper roster reads do not establish keeper protection or salary; those limitations are shown beside the availability note.
- Player links and position badges reuse the established primitives. The browser-local watchlist has its own ffaa.dailyBrief.watchlist.v1 key and supports cross-tab changes.
- Durable collection: footballDailyBriefs through the existing FFAA Firestore REST/OIDC server boundary. Client rules deny direct writes. Public endpoint: /ff/api/daily-brief. Scheduled endpoint: /api/daily-brief/cron. Existing native-waiver cron remains intact.
- Builds generate the CommonJS API bundle with build:functions; build:vercel includes it. The Vite /ff/ browser preview was checked using existing test-mode Firebase placeholders because this isolated worktree intentionally contains no copied environment credentials. Public real NFL reports are verified locally; this is not a live account test.
- Release only through the origin/master Git integration sequence in AGENTS.md. The original FFAA working tree and its uncommitted changes are untouched. This feature checkout began from origin/master at 68493f0 on codex/daily-fantasy-brief-20261006.
- Verification: 62 focused tests cover ranking, provider joins, persistence, comparisons, alerts, results, native lineup safeguards, My HQ and the position-color contract. Full repository lint and build:vercel passed. The earlier public 12-team Sleeper check excluded 161 rostered players with zero ownership leaks; 1,290 of 1,343 saved stat rows supported its applicable scoring rules. Current headless browser checks exercised the public read-only league route, bench selection, alert opt-in, tracked results and persistence after reload. Desktop and 390-by-844 mobile views had no page errors or horizontal overflow. Firebase test-mode placeholders were used; this does not verify an authenticated native account.



## Public discovery verification - October 6, 2026

### Brief graphics

Scoreboards use free ESPN team logos beside text abbreviations, with franchise aliases resolved to ESPN codes and a blank decorative slot on failure. Scoring sparklines use three to five completed, deduplicated observations in the selected scoring format. The expanded advice lists exact dates and points. Missing scoring or shorter histories withhold the line; category scoring never receives a combined point trend. These plots describe observed games, not forecasts or a complete game log.

Usage bars compare the latest two or three games with the preceding two, using targets for WR/TE, carries for RB and passing attempts for QB. Dates, sample counts, numeric averages and absolute changes remain visible. Both bars start at zero and share a scale. Missing or negative usage and fewer than four observations withhold the comparison. Zero baselines never produce infinite percentage changes. Numeric graphics use the feature accent independently of the shared position-color system. No paid data service or chart dependency is added.

### Earlier public discovery verification

Verified real locally regenerated October 3-5 editions, ESPN pools in both sports and Sleeper football ownership. October 5 matched ESPN percentages for 494 NHL and 451 NFL players, plus Sleeper percentages for 261 NFL players. Unsupported joins remain unknown. Hockey game coverage is still partial; that condition is independent of percentage coverage. Browser checks covered desktop 1440-by-1100 and mobile 390-by-844, unconnected football, incomplete hockey ownership, platform switching, preference persistence and absence of horizontal overflow or application errors. The mobile review corrected a stretched football position badge in public rows. Focused tests passed (43 hockey; 68 football including the position contract). Changed feature lint and both production builds passed. No Production deployment or live scheduler activation is claimed.
