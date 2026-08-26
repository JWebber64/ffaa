import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const globalsCss = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
const toolsCss = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");
const leagueCss = readFileSync(resolve(projectRoot, "src/screens/league-hq.css"), "utf8");
const leagueSource = readFileSync(resolve(projectRoot, "src/screens/LeagueHQ.tsx"), "utf8");

describe("card spacing regression guard", () => {
  it("keeps shorter tool cards from stretching to tall siblings", () => {
    expect(toolsCss).toMatch(/\.team-rater-grid\s*\{[^}]*align-items:\s*start/s);
    expect(toolsCss).toMatch(/\.auction-board\s*\{[^}]*align-self:\s*start[^}]*align-content:\s*start/s);
  });

  it("keeps short setup and join cards at their natural height", () => {
    expect(globalsCss).toMatch(/\.offline-setup-teams\s*\{[^}]*align-self:\s*start/s);
    expect(globalsCss).toMatch(/\.join-grid\s*\{[^}]*align-items:\s*start/s);
  });

  it("stacks compact League HQ cards in a natural-height side column", () => {
    expect(leagueSource).toContain('className="league-overview-side"');
    expect(leagueCss).toMatch(/\.league-overview-side\s*\{[^}]*align-content:\s*start/s);
    expect(leagueCss).not.toMatch(/\.league-standings-panel\s*\{[^}]*grid-row:\s*span/s);
  });
});
