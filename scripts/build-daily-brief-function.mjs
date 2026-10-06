import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
await mkdir("api/daily-brief/.generated", { recursive: true });
await build({ entryPoints: ["server/daily-brief/apiHandler.ts"], outfile: "api/daily-brief/.generated/index.js", bundle: true,
  platform: "node", target: "node20", format: "cjs", minify: true, legalComments: "none" });
