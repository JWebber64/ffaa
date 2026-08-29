/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import { findSleeperLeagues } from "../features/league-hq/sleeperLeague";
import OfflineDraftV2 from "../screens_v2/OfflineDraftV2";
import {
  createOfflineDraftLeagueProfile,
  shouldApplyOfflineDraftLeagueProfile,
} from "../screens_v2/offlineDraftLeagueProfile";
import type { RosterSlot } from "../types/draftConfig";

vi.mock("../data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("../features/league-hq/sleeperLeague", () => ({
  findSleeperLeagues: vi.fn(),
}));

const leagueId = "1385319428408774656";
const twoReceiverSlots: RosterSlot[] = [
  { slot: "QB", count: 1 },
  { slot: "RB", count: 2 },
  { slot: "WR", count: 2 },
  { slot: "TE", count: 1 },
  { slot: "FLEX", count: 1, flexEligible: ["RB", "WR", "TE"] },
  { slot: "BENCH", count: 4 },
];
const threeReceiverSlots = twoReceiverSlots.map((slot) =>
  slot.slot === "WR" ? { ...slot, count: 3 } : slot
);
const goatConnection: SleeperLeagueConnectionSummary = {
  leagueId,
  leagueName: "G.O.A.T. League",
  season: "2026",
  status: "pre_draft",
  totalRosters: 12,
  sourceUrl: `https://sleeper.com/leagues/${leagueId}`,
  lastUsedAt: "2026-08-29T00:00:00.000Z",
  auctionSettings: {
    scoring: "ppr",
    scoringLabel: "Full PPR",
    teamCount: 12,
    budget: 200,
    budgetSource: "gamehq-default",
    rosterSize: 11,
    rosterSlots: twoReceiverSlots,
  },
};

function emptyTeams() {
  return Array.from({ length: 12 }, (_, index) => ({
    teamId: `offline-t${index + 1}`,
    teamNumber: index + 1,
    name: `Team ${index + 1}`,
    budget: 200,
    spent: 0,
    managerType: "human",
    roster: [],
  }));
}

describe("offline draft active league roster profile", () => {
  beforeEach(() => {
    vi.mocked(findSleeperLeagues).mockResolvedValue({
      lookupType: "league",
      displayName: "G.O.A.T. League",
      leagues: [{
        leagueId,
        name: "G.O.A.T. League",
        season: "2026",
        status: "pre_draft",
        totalRosters: 12,
        avatarUrl: "",
        sourceUrl: `https://sleeper.com/leagues/${leagueId}`,
        auctionSettings: {
          scoring: "ppr",
          scoringLabel: "Full PPR",
          teamCount: 12,
          budget: 200,
          budgetSource: "gamehq-default",
          rosterSize: 12,
          rosterSlots: threeReceiverSlots,
        },
      }],
    });
    window.localStorage.clear();
    window.localStorage.setItem("ffaa.activeSleeperLeague.v1", leagueId);
    window.localStorage.setItem("ffaa.sleeperLeagueConnections.v1", JSON.stringify([goatConnection]));
    window.localStorage.setItem("ffaa.offlineDraft.v1", JSON.stringify({
      teams: emptyTeams(),
      config: {
        teamCount: 12,
        defaultBudget: 200,
        draftType: "auction",
        scoring: "ppr",
        rosterSlots: twoReceiverSlots,
        isOpen: true,
      },
      lastAssignment: null,
    }));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("preserves the verified three-WR G.O.A.T. roster when a cached connection is one WR stale", () => {
    const profile = createOfflineDraftLeagueProfile(goatConnection);
    expect(profile?.rosterSlots.find((slot) => slot.slot === "WR")?.count).toBe(3);
  });

  it("restores the verified G.O.A.T. roster from an older identity-only connection", () => {
    const { auctionSettings: _auctionSettings, ...identityOnlyConnection } = goatConnection;
    const profile = createOfflineDraftLeagueProfile(identityOnlyConnection);
    expect(profile?.teamCount).toBe(12);
    expect(profile?.rosterSlots.find((slot) => slot.slot === "WR")?.count).toBe(3);
    expect(profile?.rosterSlots.find((slot) => slot.slot === "BENCH")?.count).toBe(4);
  });

  it("restores the third WR from the active G.O.A.T. profile before any player is drafted", async () => {
    const { container } = render(<OfflineDraftV2 />);

    await waitFor(() => {
      expect(container.querySelector('.team-board-cell:first-child [data-roster-slot="WR-2"]')).not.toBeNull();
    });

    const firstTeamLabels = Array.from(
      container.querySelectorAll(".team-board-cell:first-child .team-slot-line-label")
    ).map((element) => element.textContent);
    expect(firstTeamLabels.filter((label) => label?.startsWith("WR"))).toEqual(["WR1", "WR2", "WR3"]);
  });

  it("repairs the exact empty G.O.A.T. two-WR custom shape without overwriting other custom or in-progress drafts", () => {
    const profile = createOfflineDraftLeagueProfile(goatConnection);
    expect(profile).not.toBeNull();
    if (!profile) return;
    const legacyConfig = {
      teamCount: 12,
      defaultBudget: 200,
      scoring: "ppr" as const,
      rosterSlots: twoReceiverSlots,
      profileSource: "legacy" as const,
    };

    expect(shouldApplyOfflineDraftLeagueProfile(legacyConfig, profile, false)).toBe(true);
    expect(shouldApplyOfflineDraftLeagueProfile({ ...legacyConfig, profileSource: "custom" }, profile, false)).toBe(true);
    expect(shouldApplyOfflineDraftLeagueProfile({
      ...legacyConfig,
      profileSource: "custom",
      rosterSlots: [...legacyConfig.rosterSlots, { slot: "K", count: 1 }],
    }, profile, false)).toBe(false);
    expect(shouldApplyOfflineDraftLeagueProfile(legacyConfig, profile, true)).toBe(false);
  });
});
