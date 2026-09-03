import { describe, expect, it } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { replayNativeScoring, scoringFreshness, type NormalizedScoringEvent } from "../../shared/nativeScoring";

const settings = createRedraftLeagueSettings("America/New_York");

function event(id: string, occurredAt: string, playerId: string, statistics: NormalizedScoringEvent["statistics"]): NormalizedScoringEvent {
  return { eventKey: id, providerKey: "fixture", providerEventId: id, providerTimestamp: occurredAt, occurredAt, playerId, nflGameId: "game-1", statistics, description: id, correctionOfEventKey: "", revision: 1, ingestionVersion: "v1", corrected: false };
}

describe("native scoring engine", () => {
  it("replays a complete fixture deterministically even when provider events arrive out of order", () => {
    const fixture = [
      event("reception", "2026-09-13T17:03:00.000Z", "wr-1", [{ statistic: "receiving_yards", value: 18 }, { statistic: "receptions", value: 1 }]),
      event("touchdown", "2026-09-13T17:05:00.000Z", "wr-1", [{ statistic: "receiving_touchdowns", value: 1 }]),
      event("interception", "2026-09-13T17:01:00.000Z", "qb-1", [{ statistic: "interceptions", value: 1 }]),
    ];
    const ordered = replayNativeScoring(fixture, settings);
    const reversed = replayNativeScoring([...fixture].reverse(), settings);
    expect(reversed).toEqual(ordered);
    expect(ordered.playerTotals).toEqual({ "qb-1": -2, "wr-1": 8.3 });
    expect(ordered.events.find((row) => row.eventKey === "reception")).toMatchObject({ fantasyPointDelta: 2.3, components: [{ scoringRuleId: "receiving-yards", fantasyPointDelta: 1.8 }, { scoringRuleId: "receptions", fantasyPointDelta: 0.5 }] });
  });

  it("identifies delayed, stale, and last-known-score provider states", () => {
    expect(scoringFreshness("2026-09-13T17:00:00.000Z", Date.parse("2026-09-13T17:02:00.000Z"), "live").state).toBe("delayed");
    expect(scoringFreshness("2026-09-13T17:00:00.000Z", Date.parse("2026-09-13T17:10:00.000Z"), "live")).toMatchObject({ state: "stale", ageSeconds: 600 });
    expect(scoringFreshness("", Date.now(), "unavailable").message).toContain("cached last-known");
  });
});
