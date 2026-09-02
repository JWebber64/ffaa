import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function source(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("team and matchup information hierarchy", () => {
  it("opens the active team on its roster instead of a promotional hero", () => {
    const team = source("src/screens/MyHQ.tsx");
    const rosterIndex = team.indexOf("<TeamRoster data={data} />");
    const decisionsIndex = team.indexOf("hq-decisions");

    expect(team).not.toContain("hq-hero");
    expect(team).not.toContain("hq-matchup-card");
    expect(team).toContain("hq-team-bar");
    expect(rosterIndex).toBeGreaterThan(-1);
    expect(rosterIndex).toBeLessThan(decisionsIndex);
  });

  it("compares both connected Sleeper lineups without the editorial matchup hero", () => {
    const matchup = source("src/screens/LeagueMatchups.tsx");

    expect(matchup).not.toContain("LeagueSeasonHero");
    expect(matchup).toContain("ConnectedTeamMatchup");
    expect(matchup).toContain("data.starterLineup");
    expect(matchup).toContain("data.opponentStarterLineup");
    expect(matchup).toContain("data.opponentBench");
  });

  it("keeps both layouts compact and row-driven at mobile width", () => {
    const teamStyles = source("src/screens/my-hq.css");
    const matchupStyles = source("src/screens/league-season.css");

    expect(teamStyles).toContain(".hq-roster-row");
    expect(teamStyles).not.toContain(".hq-hero");
    expect(matchupStyles).toContain(".league-h2h-row");
    expect(matchupStyles).toContain("grid-template-columns: minmax(0, 1fr) 42px minmax(0, 1fr)");
  });
});
