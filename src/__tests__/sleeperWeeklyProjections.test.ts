import { describe, expect, it, vi } from "vitest";

import { buildPlayerStatRows } from "../data/playerStatCategories";
import {
  indexSleeperWeeklyProjections,
  loadSleeperWeeklyProjections,
} from "../features/my-hq/sleeperWeeklyProjections";
import type { Player } from "../types/draft";

describe("Sleeper weekly matchup projections", () => {
  it("indexes the requested scoring format by Sleeper player ID", () => {
    const rows = [{
      player_id: "5872",
      opponent: "LAR",
      week: 1,
      season: "2026",
      updated_at: 1788438644181,
      stats: {
        pts_std: 6.81,
        pts_half_ppr: 8.47,
        pts_ppr: 10.13,
      },
    }];

    expect(indexSleeperWeeklyProjections(rows, "standard").get("5872")?.points).toBe(6.81);
    expect(indexSleeperWeeklyProjections(rows, "halfPpr").get("5872")?.points).toBe(8.47);
    expect(indexSleeperWeeklyProjections(rows, "ppr").get("5872")?.points).toBe(10.13);
  });

  it("requests the selected season and week and ignores rows without fantasy points", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => new Response(JSON.stringify([
      { player_id: "5872", week: 3, season: "2026", stats: { pts_half_ppr: 9.25 } },
      { player_id: "missing", week: 3, season: "2026", stats: {} },
    ])));

    const projections = await loadSleeperWeeklyProjections(
      "2026",
      3,
      "regular",
      "halfPpr",
      fetcher as unknown as typeof fetch,
    );

    expect(projections.get("5872")?.points).toBe(9.25);
    expect(projections.has("missing")).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/projections/nfl/2026/3?");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("season_type=regular");
  });

  it("links a uniquely named Sleeper player even when a source has a stale team", () => {
    const players: Player[] = [{
      id: "2026-WR-deebo-samuel",
      name: "Deebo Samuel Sr.",
      pos: "WR",
      nflTeam: "FA",
      rank: 203,
      search_rank: 203,
      search_rank_ppr: 203,
    }];
    const [row] = buildPlayerStatRows(players, [], [{
      playerId: "5872",
      name: "Deebo Samuel",
      pos: "WR",
      team: "SF",
    }]);

    expect(row?.sleeper?.playerId).toBe("5872");
  });

  it("does not guess when a name and position match multiple Sleeper players", () => {
    const players: Player[] = [{
      id: "duplicate-player",
      name: "Shared Name",
      pos: "WR",
      nflTeam: "FA",
      rank: 999,
      search_rank: 999,
      search_rank_ppr: 999,
    }];
    const [row] = buildPlayerStatRows(players, [], [
      { playerId: "one", name: "Shared Name", pos: "WR", team: "BUF" },
      { playerId: "two", name: "Shared Name", pos: "WR", team: "MIA" },
    ]);

    expect(row?.sleeper).toBeUndefined();
  });
});
