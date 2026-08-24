import { describe, expect, it } from "vitest";

import {
  parsePlayerCareerCsv,
  selectPlayerCareerRows,
} from "@/data/playerCareerStats";

const HEADER = [
  "player_id",
  "player_display_name",
  "player_name",
  "position",
  "recent_team",
  "season",
  "games",
  "fantasy_points",
  "fantasy_points_ppr",
  "completions",
  "attempts",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "carries",
  "rushing_yards",
  "rushing_tds",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_tds",
  "fumbles_lost_total",
  "fg_made",
  "fg_att",
  "fg_pct",
  "pat_made",
  "pat_att",
].join(",");

function row(values: Array<string | number>) {
  return values.join(",");
}

describe("player career stats", () => {
  it("parses nflverse regular-season totals into a compact career row", () => {
    const parsed = parsePlayerCareerCsv([
      HEADER,
      row([
        "00-0033280", "Christian McCaffrey", "C.McCaffrey", "RB", "SF", 2025, 17,
        314.6, 416.6, 0, 1, 0, 0, 0, 311, 1202, 10, 102, 129, 924, 7, 0,
        0, 0, "", 0, 0,
      ]),
    ].join("\n"), 2025);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      playerId: "00-0033280",
      playerName: "Christian McCaffrey",
      season: 2025,
      games: 17,
      carries: 311,
      rushingYards: 1202,
      receptions: 102,
      receivingYards: 924,
      standardFantasyPoints: 314.6,
      pprFantasyPoints: 416.6,
    });
  });

  it("uses the stable nflverse player ID across position changes", () => {
    const tightEndSeason = parsePlayerCareerCsv([
      HEADER,
      row(["player-a", "Position Changer", "P.Changer", "TE", "NO", 2025, 10, 60, 90]),
    ].join("\n"), 2025)[0]!;
    const quarterbackSeason = parsePlayerCareerCsv([
      HEADER,
      row(["player-a", "Position Changer", "P.Changer", "QB", "NO", 2024, 8, 72, 84]),
      row(["player-b", "Position Changer", "P.Changer", "TE", "NYJ", 2024, 2, 4, 5]),
    ].join("\n"), 2024);

    const selected = selectPlayerCareerRows(
      [tightEndSeason, ...quarterbackSeason],
      { playerId: "player-a", playerName: "Position Changer", position: "TE" },
    );

    expect(selected.map((season) => season.season).sort()).toEqual([2024, 2025]);
    expect(selected.every((season) => season.playerId === "player-a")).toBe(true);
  });

  it("falls back to normalized name and current position when no cross-source ID exists", () => {
    const candidates = parsePlayerCareerCsv([
      HEADER,
      row(["veteran", "José Runner Jr.", "J.Runner", "FB", "MIA", 2023, 12, 80, 95]),
      row(["namesake", "Jose Runner", "J.Runner", "WR", "DAL", 2025, 1, 2, 3]),
    ].join("\n"), 2025);

    const selected = selectPlayerCareerRows(candidates, {
      playerName: "Jose Runner",
      position: "RB",
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.playerId).toBe("veteran");
  });
});

