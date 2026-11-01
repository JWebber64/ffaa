// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsPlayerDetail } from "@/components/stats/StatsPlayerDrawer";
import { summarizeWeeklyPlayerStats, type WeeklyPlayerStatRow, type WeeklyPlayerStatsResult } from "@/data/weeklyPlayerStats";

const mocks = vi.hoisted(() => ({ loadWeeklyPlayerStats: vi.fn() }));
vi.mock('@/data/weeklyPlayerStats', async (importOriginal) => ({ ...await importOriginal<typeof import('@/data/weeklyPlayerStats')>(), loadWeeklyPlayerStats: mocks.loadWeeklyPlayerStats }));

vi.mock("@/components/stats/StatsPlayerDrawer", () => ({
  StatsPlayerDrawer: ({ player, onClose, overviewStatus }: { player: StatsPlayerDetail | null; onClose: () => void; overviewStatus?: { loading: boolean; error: string | null; onRetry: () => void } }) => player ? (
    <div role="dialog" aria-label={`${player.name} profile`}>
      <span>{player.name}</span>
      <span data-testid="season-ppg">{player.overviewMetrics.find((metric) => metric.label === 'Season PPG')?.value}</span>
      {overviewStatus?.loading ? <span role="status">Loading season stats</span> : null}
      {overviewStatus?.error ? <><span role="alert">{overviewStatus.error}</span><button onClick={overviewStatus.onRetry}>Retry history</button></> : null}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

import {
  PlayerProfileButton,
  PlayerProfileProvider,
} from "@/features/player-profile/PlayerProfileProvider";

function result(name = 'Josh Allen', points = 25): WeeklyPlayerStatsResult {
  const row: WeeklyPlayerStatRow = { playerId: name, playerName: name, shortName: name, position: 'QB', positionGroup: 'QB', headshotUrl: null, team: 'BUF', opponent: 'MIA', season: 2026, week: 7, seasonType: 'REG', gameId: name, standardFantasyPoints: points, halfPprFantasyPoints: points, pprFantasyPoints: points, selectedFantasyPoints: points, stats: { carries: 0, targets: 0 } };
  return { rows: [row], summaries: summarizeWeeklyPlayerStats([row]), unavailableSeasons: [] };
}
beforeEach(() => mocks.loadWeeklyPlayerStats.mockReset().mockResolvedValue(result()));
afterEach(cleanup);

describe("PlayerProfileProvider", () => {
  it("opens the shared dialog from a player identity and closes it", () => {
    render(
      <PlayerProfileProvider>
        <PlayerProfileButton player={{ id: "ja", name: "Josh Allen", position: "QB", team: "BUF" }}>
          Josh Allen
        </PlayerProfileButton>
      </PlayerProfileProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Josh Allen" }));
    expect(screen.getByRole("dialog", { name: "Josh Allen profile" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it('loads Overview immediately without opening Game log', async () => {
    render(<PlayerProfileProvider><PlayerProfileButton player={{ name: 'Josh Allen', position: 'QB' }} scoring="ppr" /></PlayerProfileProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Josh Allen' }));
    await waitFor(() => expect(screen.getByTestId('season-ppg').textContent).toBe('25.0'));
    expect(mocks.loadWeeklyPlayerStats).toHaveBeenCalledTimes(1);
    expect(mocks.loadWeeklyPlayerStats).toHaveBeenCalledWith(expect.objectContaining({ seasons: [2026], scoring: 'ppr', seasonType: 'REG' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers retry when the source is unavailable', async () => {
    mocks.loadWeeklyPlayerStats.mockResolvedValueOnce({ rows: [], summaries: [], unavailableSeasons: [2026] });
    render(<PlayerProfileProvider><PlayerProfileButton player={{ name: 'Josh Allen', position: 'QB' }} /></PlayerProfileProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Josh Allen' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
    await waitFor(() => expect(screen.getByTestId('season-ppg').textContent).toBe('25.0'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores a late response after switching players even when the fetch ignores abort', async () => {
    let resolveFirst!: (value: WeeklyPlayerStatsResult) => void;
    mocks.loadWeeklyPlayerStats.mockImplementationOnce(() => new Promise<WeeklyPlayerStatsResult>((resolve) => { resolveFirst = resolve; })).mockResolvedValueOnce(result('Patrick Mahomes', 15));
    render(<PlayerProfileProvider><PlayerProfileButton player={{ name: 'Josh Allen', position: 'QB' }} /><PlayerProfileButton player={{ name: 'Patrick Mahomes', position: 'QB' }} /></PlayerProfileProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Josh Allen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Patrick Mahomes' }));
    await waitFor(() => expect(screen.getByTestId('season-ppg').textContent).toBe('15.0'));
    await act(async () => resolveFirst(result('Josh Allen', 99)));
    expect(screen.getByTestId('season-ppg').textContent).toBe('15.0');
    expect(screen.getByRole('dialog', { name: 'Patrick Mahomes profile' })).toBeTruthy();
  });
});
