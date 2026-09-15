import { describe, expect, it } from "vitest";
import {
  emptyImportStatus,
  monitoringModeForSeasonType,
  shouldCheckPreseasonSource,
  sleeperMatchupMetrics,
  sleeperProjectionMetrics,
} from "../../scripts/value-source-pulse-policy";

describe("value source pulse in-season policy", () => {
  it("switches regular and postseason monitoring to in-season mode", () => {
    expect(monitoringModeForSeasonType("regular")).toBe("in-season");
    expect(monitoringModeForSeasonType("post")).toBe("in-season");
    expect(monitoringModeForSeasonType("pre")).toBe("preseason");
  });

  it("retires preseason-only network and empty-import noise in season", () => {
    expect(shouldCheckPreseasonSource("in-season", true)).toBe(false);
    expect(shouldCheckPreseasonSource("in-season", false)).toBe(true);
    expect(emptyImportStatus("in-season", true)).toBe("not_configured");
    expect(emptyImportStatus("preseason", true)).toBe("warning");
  });

  it("counts only weekly rows that contain usable fantasy-point projections", () => {
    const metrics = sleeperProjectionMetrics(JSON.stringify([
      { player_id: "1", updated_at: 1_789_435_211_000, stats: { pts_half_ppr: 14.2 } },
      { player_id: "2", updated_at: 1_789_435_212_000, stats: { rush_yd: 50 } },
      { player_id: "3", updated_at: 1_789_435_213_000, stats: { pts_ppr: 8.1 } },
      { player_id: "4", updated_at: 1_789_435_214_000, stats: { pts_ppr: null } },
    ]));
    expect(metrics.rowCount).toBe(2);
    expect(metrics.dataUpdatedAt).toBe(new Date(1_789_435_213_000).toISOString());
  });

  it("counts matchup rows with team and player scoring payloads", () => {
    const metrics = sleeperMatchupMetrics(JSON.stringify([
      { roster_id: 1, points: 88.46, players_points: { "10": 14.2 } },
      { roster_id: 2, points: 91.12, players_points: { "20": 18.4 } },
      { roster_id: 3, points: null, players_points: {} },
    ]));
    expect(metrics).toEqual({ rowCount: 2, playerPointRows: 2 });
  });
});
