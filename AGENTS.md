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

- `src/styles/tokens.css` is the only owner of football position color values: QB red, RB green, WR blue, TE orange, FLEX cyan, K purple, DST/DEF slate, and bench/reserve gray.
- Use `src/ui/positionColors.ts` to normalize labels and resolve color tokens. It intentionally maps numbered slots and aliases such as `RB1`, `WR3`, `BN2`, `D/ST`, `SUPER_FLEX`, and `IDP_FLEX`.
- Use `src/ui/PositionBadge.tsx` for visible position markers. Do not construct `pos-${label}` classes in feature code, maintain a page-local position color map, or pass generic component-library color schemes for position identity.
- Position color is a semantic exception to the green-led interface palette. WR blue and FLEX cyan must not be replaced by the general green accent.
- Keep the visible position abbreviation with every colored marker so meaning never depends on color alone.
- Run `vitest run src/__tests__/positionColorSystem.test.tsx src/__tests__/positionToggle.test.tsx src/__tests__/visualSystemTokens.test.ts` after changing position UI, roster slots, player badges, shared tokens, or `DESIGN.md`.
- Before a Production release, verify rendered QB, RB, WR, TE, FLEX, K, DEF/DST, and bench examples. For numbered roster slots, verify that `RB1` resolves to RB green and `WR1` resolves to WR blue.
