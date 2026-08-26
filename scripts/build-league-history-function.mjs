import { mkdir } from "node:fs/promises";

import { build } from "esbuild";

await mkdir("api/league-history/.generated", { recursive: true });
await build({
  entryPoints: ["server/league-history/handler.ts"],
  outfile: "api/league-history/.generated/import.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  minify: true,
  legalComments: "none",
  logLevel: "info",
  footer: { js: "module.exports = module.exports.default;" },
});
