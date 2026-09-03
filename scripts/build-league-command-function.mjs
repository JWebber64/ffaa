import { mkdir } from "node:fs/promises";

import { build } from "esbuild";

await mkdir("api/league-commands/.generated", { recursive: true });
await build({
  entryPoints: ["server/league-commands/handler.ts"],
  outfile: "api/league-commands/.generated/execute.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  minify: true,
  legalComments: "none",
  logLevel: "info",
  footer: { js: "module.exports = module.exports.default;" },
});
