# Silver gray palette

Approved on 2026-09-08: option 03, Silver gray, replaces the former beige throughout FFAA. `src/styles/tokens.css` owns the palette. Existing role names containing `warm` are retained for compatibility and now resolve to Silver gray; feature code must use the roles rather than reintroduce beige literals.

| Role | Before | After |
| --- | --- | --- |
| Base surface and former beige accents | `#D8C6A8` | `#E0E5E3` (`--brand-silver`) |
| Alternating research and schedule rows | Beige mixed with paper | `#D4DDDA` |
| Hover research and schedule rows | Beige mixed with green | `#C8D5CF` |
| Main text and chart axes on light surfaces | `#171A18` | `#18251F` |
| Secondary text and muted chart axes | `#454A46` | `#3F5047` |
| Light-surface dividers | 24% ink | `#BAC7C0` |
| Neutral chart lines, endpoints, and research rank pills | Existing green shades | `#30513D` |

Shared text, border, focus, history, scrollbar, and background tints formerly derived from beige now derive from Silver gray at their existing strengths. The selected change does not alter the remaining paper foreground, Bosco green, Ruggine actions, Fumo header, team imagery, status colors, or football position fills and foregrounds.

## Consumers

- `src/screens_v2/landing-v2.css`: platform hero copy panel.
- `src/styles/refinement.css`: Stats source panel, Analytics attribution, Stats table body, neutral rank pills, and the shared page tint.
- `src/styles/globals.css`: Analytics scatter and ranked-bar canvases, chart axes, and sparklines. Stats-table sparklines inherit the alternating or hovered row color.
- `src/screens/tools/tools.css`: tool principles, summary and methodology panels, and the complete Schedule Lab body including rank, team, summary, weekly cells, alternation, and hover.
- `src/features/auction-values/auction-values.css`: auction source methodology.
- `src/screens/league-hq.css`: league model explanation and subtle summary band.
- Every consumer of `--gray-200`, the old warm semantic roles, `--accent-history`, focus rings, scrollbars, and chart roles inherits the replacement from the shared owner.

## Verification

The visual-system guard rejects the retired beige literal and primitive anywhere in runtime CSS/TS/TSX and protects the approved palette and connected consumers. Run the position-system suite listed in `docs/POSITION_COLOR_SYSTEM.md`, lint, and `npm run build:vercel` before release.

Render desktop and mobile examples of the home hero, Stats body and expanded sources, Analytics plots and attribution, Auction Values sources, Tools panels, Schedule Lab, and league explanation. Check exact computed base/alternating/hover fills, sticky cells after horizontal scrolling, text contrast, and visible position labels and colors. Base, alternating, and hover rows must retain at least 4.5:1 contrast for ordinary text.

Release only from a clean worktree containing the latest `origin/master`. Run `npm run release:check`, push the verified commit to `master`, wait for its Vercel Git deployment to reach `READY`, then verify that deployment and the canonical `/ff/` routes.
