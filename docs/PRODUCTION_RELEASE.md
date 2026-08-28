# Production release

FFAA Production is serialized through Git: the canonical release source is `origin/master`, and Vercel deploys that branch through its Git integration. Feature branches are Preview-only.

## Release checklist

```powershell
git fetch origin
git merge-base --is-ancestor origin/master HEAD
npm run release:check
npm run lint
npm run build:vercel
git push origin HEAD:master
npm run release:check -- --post-push
```

Run the feature-specific tests before the build. Do not force-push `master`. If the push is rejected, another release landed first; fetch and reconcile that new `origin/master`, then rerun the checks.

Do not use `vercel --prod`, `vercel deploy --prod`, or `vercel promote` for a normal release. After the push, locate the Vercel Git deployment whose commit SHA exactly matches `origin/master`, wait for `READY`, and verify both that deployment URL and the canonical `/ff/` routes.
