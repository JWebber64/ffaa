import { spawnSync } from "node:child_process";

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || "git command failed").trim();
    throw new Error(detail);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
  };
}

function fail(message) {
  console.error(`Production release check failed: ${message}`);
  process.exit(1);
}

try {
  git(["fetch", "origin", "master", "--quiet"]);

  const status = git(["status", "--porcelain"]).stdout;
  if (status) fail("the release worktree is not clean");

  const head = git(["rev-parse", "HEAD"]).stdout;
  const remoteMaster = git(["rev-parse", "origin/master"]).stdout;
  const containsMaster = git(
    ["merge-base", "--is-ancestor", "origin/master", "HEAD"],
    { allowFailure: true },
  );

  if (containsMaster.status !== 0) {
    fail("HEAD does not contain the latest origin/master; reconcile concurrent releases first");
  }

  const postPush = process.argv.includes("--post-push");
  if (postPush && head !== remoteMaster) {
    fail("origin/master does not exactly match HEAD after the push");
  }

  const ahead = git(["rev-list", "--count", "origin/master..HEAD"]).stdout;
  console.log(
    postPush
      ? `Production source verified: origin/master = ${head.slice(0, 12)}`
      : `Release candidate verified: ${head.slice(0, 12)} contains origin/master ${remoteMaster.slice(0, 12)} (${ahead} commit(s) ahead)`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
