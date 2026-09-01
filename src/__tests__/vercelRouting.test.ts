import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Rewrite = {
  source: string;
  destination: string;
};

describe("Vercel fantasy routes", () => {
  it("serves the My Teams page before matching helmet assets", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as { rewrites: Rewrite[] };
    const teamsPageIndex = config.rewrites.findIndex(
      (rewrite) => rewrite.source === "/ff/teams" && rewrite.destination === "/index.html",
    );
    const helmetAssetIndex = config.rewrites.findIndex(
      (rewrite) => rewrite.source === "/ff/teams/:path*" && rewrite.destination === "/teams/:path*",
    );

    expect(teamsPageIndex).toBeGreaterThanOrEqual(0);
    expect(helmetAssetIndex).toBeGreaterThan(teamsPageIndex);
  });
});
