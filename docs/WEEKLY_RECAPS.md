# Weekly matchup write-ups

## Product contract

- Connected Sleeper matchups show the latest completed weekly recap directly below the score header. The headline and opening paragraph are always visible; the full article is a native keyboard-accessible disclosure.
- When the live board advances, retain the latest completed report with an explicit “Last completed matchup” label. Never silently attach last week's story to this week's result.
- `/league/:canonicalLeagueId/history/recaps?season=2026&week=1&matchup=5` is the addressable archive. Omit `matchup` to browse all paired games; omit season/week to open the latest completed week. This read-only route does not depend on a history import finishing.
- The canonical GameHQ UUID owns navigation. Resolved `dataLeagueId` owns Sleeper reads and legacy history imports. Historical week hydration uses the snapshot's `currentExternalLeagueId`, never a canonical route UUID.
- Native-authority league behavior is unchanged. This implementation uses the existing Sleeper-connected data path.

## Writing and visual contract

`matchupRecap.ts` is a deterministic, versioned narrative read model. Each report covers the result and margin, the biggest positional edge and counterpunch, both teams' leading and supporting players, a legal-position bench comparison, and all-play scoring context when the full league week is available. Complete eight-starter reports typically take about three minutes to read; do not pad incomplete evidence to reach a word quota.

Tone: lively sports-column copy with light bench regret, close-shave, and group-chat humor. No personal insults, fabricated news, lead changes, invented injuries, or unsourced “upset” claims. Headline variations must remain deterministic and fact-based. No external text-generation service is needed.

The article uses the existing Silver editorial cover, dark-green reading surface, strong score typography, and a small spotlight/position notebook. The compact live matchup board remains intact. At narrow widths the story and notebook stack; position colors come only from `PositionBadge` and the shared color resolver. No animation or decorative image dependency.

## Evidence and finality

- Use the selected week's `matchups/:week` **players and starters**, not today's roster. Current/season roster and user metadata identify teams only.
- A scored leg alone is not enough: for the active season, require both `last_scored_leg >= week` and `state.week > week`. `display_week` may intentionally remain on the previous matchup. Complete/older seasons use the archived scored-through bound. Positive points and calendar guesses never finalize a recap.
- Group exactly two distinct rosters by `matchup_id`. Exclude byes, unmatched rows, and missing/nonfinite official scores. Preserve real zeroes, negative player scores, and numeric commissioner overrides including zero.
- `players_points` already uses the league's scoring settings. Do not rescore with a generic PPR setting. Missing player points stay missing, not zero.
- Positional-result explanations require complete starter evidence that reconciles to the official team score. Overrides or mismatched totals withhold that attribution.
- The existing `optimizeLegalLineup` handles repeated positions and flex rearrangement. Do not calculate bench verdicts with missing scores, incomplete lineups, unsupported slots, or unreconciled totals. Separate one-change wins, hypothetical ties, multi-change ceilings, and losses even at the ceiling.
- Sleeper does not supply a historical IR/taxi eligibility ledger in weekly matchup rows. Bench ceilings are explicitly conditional on those recorded players being available; they are not assertions of an executable historical lineup or obvious pregame choices.
- Weekly projections are not frozen pregame baselines. Reports do not claim an upset or beat-versus-projection margin. No season average is substituted for weekly data.
- Historical team names, ownership metadata, and player positions may reflect the currently available provider/directory metadata, not an immutable kickoff snapshot.

## Availability and corrections

Reports are rebuilt on read from the provider's retained weekly evidence, with stable season/week/matchup URLs. This is **not** a new permanent cloud store of article text, a scheduled publishing job, or a notification subscription. If Sleeper removes historical records, this archive cannot reconstruct them independently; immutable article snapshots would require a separate persistence contract.

Reads are deduplicated for 30 seconds; the visible page checks each minute. Errors have retry actions, and old requests cannot replace a newly selected league/week. Player directory/stat-feed failures degrade the optional detail, not the official result. Season selection follows `previous_league_id`; future weeks and missing pairings have explicit empty states. Refreshing can revise a narrative after an official score correction.

## Verification

```powershell
npx vitest run src/__tests__/matchupRecap.test.ts src/__tests__/weeklyRecapUi.test.tsx src/__tests__/useRecapWeek.test.tsx src/__tests__/leagueHistoryImportingState.test.tsx src/__tests__/teamAndMatchupLayout.test.ts src/__tests__/lineupOptimizer.test.ts src/__tests__/sleeperWeeklyStats.test.ts --pool=threads --maxWorkers=2
npx vitest run src/__tests__/positionColorSystem.test.tsx src/__tests__/positionToggle.test.tsx src/__tests__/positionSelectionConsistency.test.ts src/__tests__/visualSystemTokens.test.ts
npm run lint
npm run build:vercel
```

Browser checks: actual final personal matchup, expanded article, previous-season report, all-matchup archive, future-week empty state, error retry, keyboard disclosure/selectors, canonical-ID navigation, 1440×900, 390×844, and 844×390. Inspect exact rendered position fills/foregrounds and horizontal overflow. Follow `AGENTS.md` for release; feature validation is not Production deployment.

Provider reference: [Sleeper league and weekly matchup API](https://docs.sleeper.com/#getting-matchups-in-a-league).
