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
