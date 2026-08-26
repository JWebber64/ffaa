/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "../features/league-hq/sleeperConnections";

function connection(leagueId: string, leagueName: string, lastUsedAt: string): SleeperLeagueConnectionSummary {
  return {
    leagueId,
    leagueName,
    season: "2026",
    status: "pre_draft",
    totalRosters: 12,
    sourceUrl: `https://sleeper.com/leagues/${leagueId}`,
    lastUsedAt,
  };
}

describe("useSleeperLeagueConnections", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shares the active league across hook consumers and falls back after removal", () => {
    const alpha = connection("111111111111", "Alpha", "2026-08-10T00:00:00.000Z");
    const beta = connection("222222222222", "Beta", "2026-08-09T00:00:00.000Z");
    const first = renderHook(() => useSleeperLeagueConnections());
    const second = renderHook(() => useSleeperLeagueConnections());

    act(() => first.result.current.rememberConnections([alpha, beta]));
    expect(first.result.current.connections.map((item) => item.leagueName)).toEqual(["Alpha", "Beta"]);
    expect(second.result.current.activeLeagueId).toBe(alpha.leagueId);

    act(() => second.result.current.setActiveLeagueId(beta.leagueId));
    expect(first.result.current.activeLeagueId).toBe(beta.leagueId);

    act(() => first.result.current.forgetConnection(beta.leagueId));
    expect(first.result.current.activeLeagueId).toBe(alpha.leagueId);
    expect(second.result.current.connections.map((item) => item.leagueName)).toEqual(["Alpha"]);
  });
});
