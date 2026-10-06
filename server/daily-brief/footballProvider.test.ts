// @vitest-environment node
import { describe, expect, it } from "vitest";
import { footballBrief, footballStats } from "./footballProvider";
import { sourceReader, csvRecords } from "./fetchSource";
describe("free football provider", () => {
  it("parses quoted CSV, preserves unavailable metrics and maps scoring keys", () => {
    expect(csvRecords('name,description\n"Player, One","A ""quoted"" note"\n')[0]).toEqual({ name: "Player, One", description: 'A "quoted" note' });
    expect(footballStats({ receptions: "0", receiving_yards: "NA", carries: "12" })).toMatchObject({ rec: 0, carries: 12 });
    expect(footballStats({ receptions: "" }).rec).toBeUndefined();
    expect(footballStats({ def_fumbles_forced: "0", fumble_recovery_own: "0", fumble_recovery_opp: "0", fumble_recovery_tds: "0" })).toMatchObject({ st_ff: 0, st_fum_rec: 0, fum_rec_td: 0 });
    expect(footballStats({ def_fumbles_forced: "1", fumble_recovery_own: "1", fumble_recovery_opp: "0" }).st_ff).toBeUndefined();
    expect(footballStats({ def_fumbles_forced: "1", fumble_recovery_own: "1", fumble_recovery_opp: "0" }).st_fum_rec).toBeUndefined();
  });
  it("requires explicit final status, joins by game identity, and uses stable crosswalk IDs", async () => {
    const events = [{ id: "event1", date: "2026-10-05T23:00:00Z", status: { type: { completed: true } }, competitions: [{ competitors: [{ homeAway: "home", team: { abbreviation: "BUF" }, score: "24" }, { homeAway: "away", team: { abbreviation: "NYJ" }, score: "10" }] }] }];
    events.push({ ...events[0]!, id: "future", date: "2026-10-06T23:00:00Z" });
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      const text = url.includes("scoreboard") ? JSON.stringify({ events }) : url.includes("games.csv") ? "game_id,season,game_type,week,gameday,away_team,home_team\ng1,2026,REG,5,2026-10-05,NYJ,BUF\n" :
        url.includes("db_playerids") ? "gsis_id,sleeper_id\n00-1,100\n" :
        "player_id,player_display_name,position,season,game_id,team,receptions,receiving_yards,targets,passing_yards,rushing_yards\n00-1,Test Player,WR,2026,g1,BUF,5,70,8,0,0\n";
      return new Response(text);
    }) as typeof fetch;
    const report = await footballBrief("2026-10-05", "2026-10-06T12:00:00Z", sourceReader(fetcher));
    expect(report.games[0]?.final).toBe(true);
    expect(report.observations[0]?.providerId).toBe("100");
    expect(report.observations[0]?.stats.rec).toBe(5);
    expect(report.status).toBe("complete");
    expect(report.games).toHaveLength(1);
    events[0]!.status.type.completed = false;
    const unfinished = await footballBrief("2026-10-05", "2026-10-06T12:00:00Z", sourceReader(fetcher));
    expect(unfinished.observations).toHaveLength(0);
    expect(unfinished.status).toBe("partial");
  });
});
