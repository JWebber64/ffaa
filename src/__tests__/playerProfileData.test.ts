import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPlayerProfileDetail } from "@/features/player-profile/playerProfileData";
import { loadWeeklyPlayerStats, summarizeWeeklyPlayerStats } from "@/data/weeklyPlayerStats";

afterEach(() => vi.unstubAllGlobals());

describe("shared player profile data", () => {
  it("builds the same complete profile contract from a roster-style player", () => {
    const profile = buildPlayerProfileDetail({
      id: "custom-player",
      sleeperId: "12345",
      name: "Profile Player",
      position: "RB",
      team: "BUF",
      byeWeek: 7,
      projectedPoints: 245.6,
      weeklyProjectedPoints: 15.4,
      targetsPerGame: 5.2,
      carriesPerGame: 13.7,
      status: "Active",
    }, "halfPpr");

    expect(profile).toMatchObject({
      id: "custom-player",
      sleeperId: "12345",
      name: "Profile Player",
      position: "RB",
      team: "BUF",
      status: "Active",
      career: {
        playerName: "Profile Player",
        position: "RB",
        scoring: "halfPpr",
      },
    });
    expect(profile.headshotUrl).toContain("/12345.jpg");
    expect(profile.overviewMetrics.find((metric) => metric.label === "Season projection")?.value).toBe("245.6");
    expect(profile.usageMetrics.find((metric) => metric.label === "Targets/G")?.value).toBe("5.2");
    expect(profile.sources.map((source) => source.name)).toEqual(expect.arrayContaining(["nflverse", "Sleeper", "ESPN NFL headlines"]));
  });

  it("prefers a connected Sleeper Week score over the pregame projection", () => {
    const profile = buildPlayerProfileDetail({
      id: "live-player",
      sleeperId: "7523",
      name: "Live Player",
      position: "QB",
      team: "BUF",
      weeklyProjectedPoints: 18.6,
      weeklyActualPoints: 26.1,
      weeklyActualPointsWeek: 1,
    });

    expect(profile.overviewMetrics.find((metric) => metric.label === "Week score")).toMatchObject({
      value: "26.10",
      helper: "Sleeper Week 1 scoring",
    });
  });

  it.each([['ppr', '19.1'], ['halfPpr', '15.7'], ['standard', '12.3']] as const)("fills Bowers's current season from verified weekly rows in %s scoring", async (scoring, ppg) => {
    const csv = [
      'player_id,player_display_name,position,season,week,season_type,team,opponent_team,carries,targets,receptions,fantasy_points,fantasy_points_ppr',
      'bowers,Brock Bowers,TE,2026,3,REG,LV,NO,0,13,10,17.6,27.6',
      'bowers,Brock Bowers,TE,2026,4,REG,LV,KC,0,11,6,14.6,20.6',
      'bowers,Brock Bowers,TE,2026,5,REG,LV,NE,0,10,8,15,23',
      'bowers,Brock Bowers,TE,2026,6,REG,LV,DEN,0,9,4,7,11',
      'bowers,Brock Bowers,TE,2026,7,REG,LV,LA,0,8,6,7.3,13.3',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(csv)));
    const result = await loadWeeklyPlayerStats({ seasons: [2026], seasonType: 'REG', scoring });
    const summary = result.summaries.find((row) => row.playerName === 'Brock Bowers')!;
    const profile = buildPlayerProfileDetail({ name: 'Brock Bowers', position: 'TE', historicalPointsPerGame: 999, weeklyActualPoints: 0, weeklyActualPointsWeek: 8 }, scoring, summary);
    expect(profile.overviewMetrics.find((metric) => metric.label === 'Season PPG')).toMatchObject({ value: ppg, helper: '2026 · 5 games · through Week 7' });
    expect(profile.overviewMetrics.find((metric) => metric.label === 'Week score')?.value).toBe('0.00');
    expect(profile.usageMetrics.find((metric) => metric.label === 'Targets/G')?.value).toBe('10.2');
    expect(profile.usageMetrics.find((metric) => metric.label === 'Carries/G')?.value).toBe('0.0');
    expect(profile.weeks).toHaveLength(5);
    expect(profile.weeks.every((row) => row.season === 2026)).toBe(true);
    expect(profile.overviewMetrics.find((metric) => metric.label === 'ADP')).toMatchObject({ value: '23.0', helper: 'Sleeper PPR · 2026 · 2026-08-27' });
    expect(profile.overviewMetrics.find((metric) => metric.label === 'Position rank')).toMatchObject({ value: 'TE2', helper: 'Within current overall rankings' });
    if (scoring === 'ppr') expect(profile.overviewMetrics.find((metric) => metric.label === 'Last 3')?.value).toBe('15.8');
    const oldSeason = { ...summary.weeklyRows[0]!, season: 2025, selectedFantasyPoints: 1000 };
    const combined = summarizeWeeklyPlayerStats([oldSeason, ...summary.weeklyRows])[0]!;
    expect(buildPlayerProfileDetail({ name: 'Brock Bowers', position: 'TE' }, scoring, combined).overviewMetrics.find((metric) => metric.label === 'Season PPG')?.value).toBe(ppg);
  });

  it('explains unavailable data without fabricating statistics or ADP', () => {
    const profile = buildPlayerProfileDetail({ name: 'New Player', position: 'WR', historicalPointsPerGame: 99 }, 'ppr', null);
    expect(profile.overviewMetrics.find((metric) => metric.label === 'Season PPG')).toMatchObject({ value: '—', helper: 'No 2026 regular-season sample' });
    expect(profile.overviewMetrics.find((metric) => metric.label === 'ADP')).toMatchObject({ value: '—', helper: 'No sourced draft ADP available' });
    expect(profile.usageMetrics.find((metric) => metric.label === 'Target share')?.value).toBe('—');
  });
});
