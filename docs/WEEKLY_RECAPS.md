# Weekly matchup write-ups

## Product contract

- Connected Sleeper matchups show the latest completed weekly recap directly below the score header. The headline and opening paragraph are always visible; the full article is a native keyboard-accessible disclosure.
- When the live board advances, retain the latest completed report with an explicit “Last completed matchup” label. Never silently attach last week's story to this week's result.
- `/league/:canonicalLeagueId/history/recaps?season=2026&week=1&matchup=5` is the addressable matchup archive. Omit `matchup` for the **league edition**; use `edition=matchups` to browse individual reports. Omit season/week to open the latest completed week. This read-only route does not depend on a history import finishing. My Matchup and This Week link to the league edition and awards.
- The canonical GameHQ UUID owns navigation. Resolved `dataLeagueId` owns Sleeper reads and legacy history imports. Historical week hydration uses the snapshot's `currentExternalLeagueId`, never a canonical route UUID.
- Native-authority league behavior is unchanged. This implementation uses the existing Sleeper-connected data path.

## Writing and visual contract

`matchupRecap.ts` is a deterministic, versioned narrative read model. Each report covers the result and margin, the biggest positional edge and counterpunch, both teams' leading and supporting players, a legal-position bench comparison, and all-play scoring context when the full league week is available. Complete eight-starter reports typically take about three minutes to read; do not pad incomplete evidence to reach a word quota.

Tone: lively sports-column copy with light bench regret, close-shave, and group-chat humor. No personal insults, fabricated news, lead changes, invented injuries, or unsourced “upset” claims. Headline variations must remain deterministic and fact-based. No external text-generation service is needed.

The illustrated article uses the existing Silver editorial cover, dark-green reading surface, and strong score typography. Each major section owns a meaningful graphic: paired slot bars; opposing headliner portraits with NFL helmets and stat lines; a rivalry ledger; actual/optimal bench comparisons and pictured swaps; and a scoring ladder. Plot canvases use exact Silver. The compact live matchup board remains intact; comparisons stack on phones. Position colors come only from `PositionBadge` and `positionColorVar()`; no badge tint or foreground override is allowed. No animation or generated decorative artwork is needed.

`recapPresentation.ts` creates ID-addressed player segments while composing prose. It never finds player identities by matching names in finished text. `RecapProse` enriches the first mention per section with a portrait/helmet and leaves later mentions as profile links. `RecapPlayerLink` reuses `PlayerProfileButton`; the drawer receives the original Sleeper ID, week score, and reception-scoring mode. `TeamMark` and `TeamIdentityMark` own real artwork and avatar fallbacks. Missing portraits retain a silhouette, helmet where available, readable name, and working profile action. Current directory images and NFL teams are explicitly not historical snapshots.

## League edition and awards

`leagueRecap.ts` builds a deterministic full-league column from the same `RecapWeek` as matchup reports. `LeagueRecapArticle` includes the week in words, a featured final score comparison, illustrated Team of the Week honors, awards desk, full scoring ladder, a short write-up for every matchup, rivalry receipts, weekly H2H record changes, and next-week pairings when supplied. It never invents live lead changes, pregame projections, or official standings movement.

- Reuse `generateWeeklyAwards` (`weekly-awards-v2`), retaining read compatibility with v1 persisted records. No award/import writes are initiated by reading an edition.
- High/low team scores, closest/largest margin, legal bench points left, lineup efficiency, top starter, top bench player, and high-scoring loser honors share this engine. Position honors are opt-in for the illustrated edition. Ties retain **all** winners in stable source-key order. Zero missed points do not earn a bench-mistake award.
- Natural-position awards consider starters only. FLEX/SFLEX/restricted-flex honors require the actual recorded slot; they are separate honors, not extra points. Unknown slots suppress slot honors. A player can win both a natural-position honor and a FLEX honor.
- Require the complete league's paired official results for league-wide awards and ranks. Missing/unreconciled starters suppress player honors. Missing/unsupported legal-lineup evidence for any team suppresses bench and efficiency honors. Complete team-score awards can remain available when optional player detail is missing.
- Account for every expected provider row, but exclude explicit byes (`matchup_id: null`) from the scoring/award population. A bye is never a zero-point competitor. Missing rows, missing paired scores, or ambiguous/unmatched assigned pairings still withhold league-wide superlatives. The scoring ladder and all-play copy identify paired competitors as their denominator.
- Bench gains are the best **legal lineup minus actual lineup**, not all bench points added together. IR/taxi eligibility remains conditional and visible. An isolated top bench player is a distinct award.
- Weekly H2H changes use complete earlier weeks plus this result exactly once. They exclude league-median bonus wins and count weekly playoff meetings, not aggregate playoff series. They are explicitly not official standings ranks. Next-week pairing reads use identities only, never future scores in this edition.

## The rivalry ledger

`recapRivalry.ts` adds a written head-to-head section immediately after the matchup breakdown. It gives the updated win–loss–tie record, number of recorded seasons, whether the result extends a lead or closes a gap, the previous meeting's score, and consecutive wins when there are at least two. Example: “This win brings Alpha's recorded head-to-head record against Beta to 5–2 across 3 seasons (2024–2026).” This example is illustrative, not a hard-coded league result.

- Follow stable Sleeper **primary owner IDs** through the existing normalized manager/season-franchise history. Never join different seasons by team name or roster number, and do not substitute a co-owner when the primary identity is missing or ambiguous. Ownership metadata is the available season mapping, not proof of ownership on every historical date.
- Reuse the read-only Firestore archive and existing head-to-head analytics for **prior seasons**. Count completed, finite-score regular-season and playoff weekly meetings; deduplicate repeated imports. This counts weekly meetings, not aggregate multi-week playoff series wins.
- For the selected season, read every earlier week from Sleeper in batches of four, shared by all reports. This avoids relying on a lagging imported season. Respect `start_week`, ignore byes/other opponents, and withhold the total if a requested earlier week or relevant score/pairing is incomplete.
- Add the report's official corrected score exactly once. Never count later weeks or later seasons in an older recap. The current stored matchup cannot duplicate or override the report's result.
- `RivalryGraphic` comes from the same calculation as the paragraph: oriented wins/losses/ties, recorded season span, chronological meeting results, and consecutive wins. Render team avatars, a large series record, one timeline segment per meeting, the last four dated scorecards, and a streak callout only at two or more wins. Never parse the paragraph to recover graphic data or show a fake 0–0 fallback when history fails.
- Say **recorded** head-to-head record and identify the season/week cutoff. Missing archived seasons are not invented or presented as a complete all-time career. An empty available ledger means “first meeting in the available league archive,” not “first ever.” Team names in the paragraph match the report, including when describing older meetings.
- Load the main story first; enrich it with the rivalry afterward. History is deduplicated for five minutes and has a 12-second read timeout. A failure shows an explicit history-unavailable paragraph without hiding the final score or article, and never starts an import or writes to the archive. Late enrichment cannot replace a different selection or a newer score correction.

## Evidence and finality

- Use the selected week's `matchups/:week` **players and starters**, not today's roster. Current/season roster and user metadata identify teams only.
- A scored leg alone is not enough: for the active season, require both `last_scored_leg >= week` and `state.week > week`. `display_week` may intentionally remain on the previous matchup. Complete/older seasons use the archived scored-through bound. Positive points and calendar guesses never finalize a recap.
- Group exactly two distinct rosters by `matchup_id`. Exclude byes, unmatched rows, and missing/nonfinite official scores. Preserve real zeroes, negative player scores, and numeric commissioner overrides including zero.
- `players_points` already uses the league's scoring settings. Do not rescore with a generic PPR setting. Missing player points stay missing, not zero.
- Positional-result explanations require complete starter evidence that reconciles to the official team score. Overrides or mismatched totals withhold that attribution.
- Preserve the provider's ordered `starters` indexes against configured starting slots **before filtering empty IDs**. `lineupSlot` is separate from natural `position`; missing slot evidence withholds the slot battle rather than inferring FLEX. Repeated RB/WR/FLEX slots aggregate once; SFLEX and restricted flex remain distinct. Zero and negative scores stay visible. The graphic and position-edge story use this same grouping.
- The existing `optimizeLegalLineup` handles repeated positions and flex rearrangement. Do not calculate bench verdicts with missing scores, incomplete lineups, unsupported slots, or unreconciled totals. Separate one-change wins, hypothetical ties, multi-change ceilings, and losses even at the ceiling.
- Sleeper does not supply a historical IR/taxi eligibility ledger in weekly matchup rows. Bench ceilings are explicitly conditional on those recorded players being available; they are not assertions of an executable historical lineup or obvious pregame choices.
- Weekly projections are not frozen pregame baselines. Reports do not claim an upset or beat-versus-projection margin. No season average is substituted for weekly data.
- Historical team names, ownership metadata, and player positions may reflect the currently available provider/directory metadata, not an immutable kickoff snapshot.

## Availability and corrections

Reports are rebuilt on read from the provider's retained weekly evidence, with stable season/week/matchup URLs. This is **not** a new permanent cloud store of article text, a scheduled publishing job, or a notification subscription. If Sleeper removes historical records, this archive cannot reconstruct them independently; immutable article snapshots would require a separate persistence contract.

Reads are deduplicated for 30 seconds; the visible page checks each minute. Errors have retry actions, and old requests cannot replace a newly selected league/week. Player directory/stat-feed failures degrade the optional detail, not the official result. Season selection follows `previous_league_id`; future weeks and missing pairings have explicit empty states. Refreshing can revise a narrative after an official score correction.

Optional enrichment uses independently settled history, earlier-week, and next-schedule reads. History and schedule failure do not suppress the main story or each other's usable facts. Earlier-week requests remain batched at four; one parallel next-week request may bring total source concurrency to five. Schedule reads have the existing 15-second timeout. No cron, notification subscription, or permanent article store is added.

## Verification

```powershell
npx vitest run src/__tests__/recapIllustrated.test.tsx src/__tests__/weeklyAwards.test.ts --pool=threads --maxWorkers=2
npx vitest run src/__tests__/matchupRecap.test.ts src/__tests__/recapRivalry.test.ts src/__tests__/recapRivalrySource.test.ts src/__tests__/weeklyRecapUi.test.tsx src/__tests__/useRecapWeek.test.tsx src/__tests__/leagueHistoryImportingState.test.tsx src/__tests__/teamAndMatchupLayout.test.ts src/__tests__/lineupOptimizer.test.ts src/__tests__/sleeperWeeklyStats.test.ts --pool=threads --maxWorkers=2
npx vitest run src/__tests__/positionColorSystem.test.tsx src/__tests__/positionToggle.test.tsx src/__tests__/positionSelectionConsistency.test.ts src/__tests__/visualSystemTokens.test.ts
npx vitest run src/__tests__/typographyGuard.test.ts src/__tests__/appHeaderAlignment.test.ts src/__tests__/brandMarkGuard.test.ts
npm run lint
npm run build:vercel
```

Browser checks: actual final personal matchup, expanded article, previous-season report, all-matchup archive, future-week empty state, error retry, keyboard disclosure/selectors, canonical-ID navigation, 1440×900, 390×844, and 844×390. Inspect exact rendered position fills/foregrounds and horizontal overflow. Follow `AGENTS.md` for release; feature validation is not Production deployment.

Local rivalry verification, 2026-09-15: G.O.A.T. League's 2026 Week 1 Better call Hall / Unsolicited Nix Pics report renders 2–2 across 2024–2026 and two straight wins for Nix Pics. An independent read of the public 2023–2026 season chain found exactly four meetings: 2024 W1 (109.08–74.78), 2024 W12 (99.70–89.46), 2025 W5 (68.02–127.16), and 2026 W1 (122.20–138.44), with Hall's score first. The 2025 W5 archive correctly uses the name Brock Hard and stops at a 1–2 record across two seasons. These are local-browser/source checks, not Production-release evidence.

Provider reference: [Sleeper league and weekly matchup API](https://docs.sleeper.com/#getting-matchups-in-a-league).
