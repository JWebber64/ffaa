import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const toolsSource = readFileSync(resolve(projectRoot, "src/screens/tools/ToolsHub.tsx"), "utf8");
const leagueSource = readFileSync(resolve(projectRoot, "src/screens/LeagueHQ.tsx"), "utf8");
const shellSource = readFileSync(resolve(projectRoot, "src/layouts/AppShellV2.tsx"), "utf8");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const toolsCss = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");
const leagueCss = readFileSync(resolve(projectRoot, "src/screens/league-hq.css"), "utf8");

const editorialImages = [
  "tool-auction-room.jpg",
  "tool-player-compare.jpg",
  "tool-team-rater.jpg",
  "tool-schedule-lab.jpg",
  "tool-offensive-line.jpg",
  "league-overview-archive.jpg",
  "results-championship.jpg",
] as const;

describe("editorial image regression guard", () => {
  it("ships every editorial image referenced by the tools, League HQ, and Results", () => {
    editorialImages.forEach((image) => {
      expect(existsSync(resolve(projectRoot, "public/images", image)), image).toBe(true);
    });

    editorialImages.slice(0, 5).forEach((image) => expect(toolsSource).toContain(image));
    expect(leagueSource).toContain("league-overview-archive.jpg");
    expect(shellSource).toContain("results-championship.jpg");
  });

  it("keeps responsive card and archive crops bounded", () => {
    expect(toolsCss).toMatch(/\.tools-card-media img\s*\{[^}]*object-fit:\s*cover[^}]*object-position:\s*center/s);
    expect(toolsCss).toMatch(/\.tools-card-media\s*\{[^}]*overflow:\s*hidden/s);
    expect(leagueCss).toMatch(/\.league-overview-editorial img\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*3\s*\/\s*2[^}]*object-fit:\s*cover[^}]*object-position:\s*center/s);
  });

  it("uses dedicated Results artwork instead of the draft-room image", () => {
    expect(shellSource).toContain("--results-editorial-image");
    expect(refinementCss).toMatch(/\.results-hero\s*\{[^}]*var\(--results-editorial-image\)[^}]*background-size:\s*auto,\s*auto,\s*auto\s+100%/s);
  });
});
