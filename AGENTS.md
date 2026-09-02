# FFAA release policy

## Production source of truth

- `origin/master` is the only source allowed to own FFAA Production.
- Vercel Git integration is the only normal Production deployment path.
- Never run `vercel --prod`, `vercel deploy --prod`, or `vercel promote` from a feature or release branch. Do not manually re-alias a feature deployment to Production.
- Feature tasks may push their own branch and use its Preview deployment, but they must not update Production.

## Production release sequence

1. Fetch `origin` and use a clean release worktree based on the latest `origin/master`.
2. Merge or cherry-pick only the approved changes. Preserve every commit already on `origin/master`.
3. Run `npm run release:check`, the relevant tests, lint, and `npm run build:vercel`.
4. Push with `git push origin HEAD:master` and never force-push. A non-fast-forward rejection means another release won; fetch, reconcile, rerun verification, and retry.
5. Wait for the Vercel Git deployment for the exact pushed `master` SHA to reach `READY`.
6. Verify the exact deployment and the canonical `https://gamehqhub.com/ff/` routes before reporting Production complete.

Emergency rollback is the only exception to the Git-only path. It requires an explicitly identified known-good deployment and must be reconciled back into `master` immediately.

## Position color contract

- `src/styles/tokens.css` is the only owner of football position fills and accessible foreground roles: QB red, RB green, WR blue, TE orange, FLEX cyan, K purple, DST/DEF slate, and bench/reserve gray.
- Use `src/ui/positionColors.ts` to normalize labels and resolve color tokens. It intentionally maps numbered slots and aliases such as `RB1`, `WR3`, `BN2`, `D/ST`, `SUPER_FLEX`, and `IDP_FLEX`.
- Every position encoding—including badges, chart points, chart legends, select swatches, filters, roster lanes, borders, and glows—must resolve its base color with `src/ui/positionColors.ts`. Use `src/ui/PositionBadge.tsx` whenever the abbreviation is inside a filled badge. Do not construct `pos-${label}` classes in feature code, maintain a page-local position color map, or pass generic component-library color schemes for position identity.
- `PositionBadge` owns the exact opaque semantic fill and its contrast-safe foreground. Feature modifier classes may change size, spacing, radius, border, and typography, but they must not tint, alpha-mix, surface-mix, replace the background, or force a foreground color.
- Contextual surfaces may tint a position color only after their base token comes from `positionColorVar()`. The position abbreviation must remain visible beside chart marks, swatches, and tinted containers so meaning never depends on color alone.
- Position color is a semantic exception to the green-led interface palette. WR blue and FLEX cyan must not be replaced by the general green accent.
- Keep the visible position abbreviation with every colored marker so meaning never depends on color alone.
- The complete implementation and release checklist lives in `docs/POSITION_COLOR_SYSTEM.md`; update it with any new position-bearing surface.
- Run `vitest run src/__tests__/positionColorSystem.test.tsx src/__tests__/positionToggle.test.tsx src/__tests__/positionSelectionConsistency.test.ts src/__tests__/visualSystemTokens.test.ts` after changing position UI, charts, legends, roster slots, player badges, shared tokens, or `DESIGN.md`.
- Before a Production release, verify rendered QB, RB, WR, TE, FLEX, K, DEF/DST, bench, and IR examples on every changed position-bearing surface, including Analytics plots and legends, Build a Team, Auction Values, player lists, roster configuration, and draft team details. Inspect computed fills and foregrounds, not only classes or source tokens. For numbered roster slots, verify that `RB1` resolves to the exact RB fill and dark foreground and that `WR1` resolves to the exact WR fill and light foreground.
