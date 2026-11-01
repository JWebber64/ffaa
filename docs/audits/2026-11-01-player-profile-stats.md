# Shared player profile statistics repair

The shared profile previously built Overview without loading weekly summaries. Career PPG loaded independently, leaving season production, trends, and usage blank. Historical coverage and the Game log selector also stopped at 2025 despite available 2026 source data.

Opening a shared profile now loads 2026 nflverse regular-season summaries, using the selected reception scoring. All season metrics use one coherent sample, with year, game count, and latest recorded week shown. Game log reuses complete profile samples; filtered Stats Explorer samples retain their independent full-season loader. Connected-league weekly scores are preserved, including legitimate zero scores.

The release includes the current nflverse weekly CSV and appends 2026 to career totals. Every existing career season through 2025 was compared with origin/master and preserved unchanged. `npm run stats:refresh` supports subsequent current-season refreshes without rebuilding completed seasons.

Missing ADP can resolve to the existing imported Sleeper PPR draft snapshot, explicitly dated 2026-08-27. Missing position rank is derived within the existing overall rankings and labeled accordingly. Unsupported values remain unavailable with an explanation. Source failures provide retry; canceled or stale responses cannot overwrite another selection.

At this release's source snapshot, Brock Bowers has five 2026 games through Week 7: 95.5 PPR points, 19.1 PPG, 15.8 over the last three, 10.2 targets/game, and zero carries/game. His career sample is 34 games across 2024–2026, averaging 15.7 PPR points. His draft ADP is 23.0; his rank within the imported overall rankings is TE2. These are source-snapshot values, not a promise of a live statistical feed.

Validation covers selected scoring, zero values, multi-season isolation, HTML fallback rejection, immediate Overview loading, source retry, stale player responses, current-week score preservation, weekly/career source consistency, and the existing position-color contracts. Desktop and phone browser checks exercise Overview, Game log, Career, Sources, Escape/focus return, source-failure recovery, and horizontal fit. Production release follows origin/master and Vercel Git integration.
