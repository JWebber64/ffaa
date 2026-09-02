# Production release

FFAA Production is serialized through Git: the canonical release source is `origin/master`, and Vercel deploys that branch through its Git integration. Feature branches are Preview-only. Assemble every release in an isolated worktree created from the latest `origin/master`; the dirty root checkout is development state and must never be deployed or used as a whole-file source.

## Release checklist

```powershell
git fetch origin
git merge-base --is-ancestor origin/master HEAD
npm run release:check
npm run release:preflight
git push origin HEAD:master
npm run release:check -- --post-push
```

Do not use `Copy-Item`, `cp`, or another whole-file synchronization from the root checkout. Apply only the intended patch or commit, review `git diff origin/master...HEAD`, and confirm every changed file belongs to the requested release. `release:preflight` runs lint, the complete Vitest suite, the Production artifact build, and desktop/mobile Playwright checks.

Do not force-push `master`. If the push is rejected, another release landed first; fetch and reconcile that new `origin/master`, then rerun the checks.

For a validated artifact promotion, deploy a preview, run `PLAYWRIGHT_BASE_URL=https://<preview>/ff/ npm run test:e2e`, and promote that same artifact without rebuilding. After promotion, verify the deployment URL and canonical `https://gamehqhub.com/ff/` route, including asset references, browser console, and the responsive header.
