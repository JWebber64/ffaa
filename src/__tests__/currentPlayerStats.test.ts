import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FANTASY_SEASON } from '@/config/fantasySeason';
import { loadPlayerCareerStats, NFLVERSE_CAREER_LATEST_SEASON } from '@/data/playerCareerStats';
import { loadWeeklyPlayerStats } from '@/data/weeklyPlayerStats';

afterEach(() => vi.unstubAllGlobals());

describe('current-season career coverage', () => {
  it('includes verified 2026 totals in career PPG while retaining completed seasons', async () => {
    const bundle = readFileSync(new URL('../../public/data/nflverse-player-careers.json', import.meta.url), 'utf8');
    const weekly = readFileSync(new URL(`../../public/data/nflverse-player-stats/stats_player_week_${FANTASY_SEASON}.csv`, import.meta.url), 'utf8');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(url.includes('.csv') ? weekly : bundle)));
    const result = await loadPlayerCareerStats({ playerName: 'Brock Bowers', position: 'TE', scoring: 'ppr' });
    const weeklyResult = await loadWeeklyPlayerStats({ seasons: [FANTASY_SEASON], seasonType: 'REG', scoring: 'ppr' });
    const summary = weeklyResult.summaries.find((row) => row.playerName === 'Brock Bowers')!;
    expect(NFLVERSE_CAREER_LATEST_SEASON).toBe(FANTASY_SEASON);
    expect(result.coverageEnd).toBe(FANTASY_SEASON);
    expect(result.seasons.map((row) => row.season)).toEqual([FANTASY_SEASON, 2025, 2024]);
    expect(result.seasons[0]?.games).toBe(summary.games);
    expect(result.seasons[0]?.fantasyPoints).toBeCloseTo(summary.selectedFantasyPoints);
    expect(result.seasons[0]?.fantasyPointsPerGame).toBeCloseTo(summary.selectedFantasyPointsPerGame);
    expect(result.seasons.reduce((total, row) => total + row.games, 0)).toBe(29 + summary.games);
    expect(result.seasons.reduce((total, row) => total + row.fantasyPoints, 0)).toBeCloseTo(438.9 + summary.selectedFantasyPoints);
  });
});
