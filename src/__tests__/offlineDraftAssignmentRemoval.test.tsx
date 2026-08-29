/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findSleeperLeagues } from "../features/league-hq/sleeperLeague";
import OfflineDraftV2 from "../screens_v2/OfflineDraftV2";

vi.mock("../data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("../features/league-hq/sleeperLeague", () => ({
  findSleeperLeagues: vi.fn(),
}));

vi.mock("../features/offline-draft/offlineDraftPersistence", () => ({
  createOfflineDraftOnline: vi.fn(),
  loadOfflineDraftOnlineForSession: vi.fn(),
  saveOfflineDraftOnline: vi.fn(),
  subscribeToOfflineDraftOnline: vi.fn(() => () => undefined),
}));

const storageKey = "ffaa.offlineDraft.v1";

function savedOpenDraft() {
  return {
    config: {
      teamCount: 8,
      defaultBudget: 200,
      draftType: "auction",
      scoring: "ppr",
      rosterSlots: [{ slot: "QB", count: 1 }],
      isOpen: true,
      profileSource: "custom",
    },
    teams: Array.from({ length: 8 }, (_, index) => ({
      teamId: `offline-t${index + 1}`,
      teamNumber: index + 1,
      name: `Team ${index + 1}`,
      budget: 200,
      spent: index === 0 ? 27 : 0,
      roster: index === 0
        ? [{ playerId: "wrong-team-player", name: "Test Quarterback", price: 27, pos: "QB" }]
        : [],
    })),
    lastAssignment: null,
  };
}

beforeEach(() => {
  vi.mocked(findSleeperLeagues).mockResolvedValue({
    lookupType: "user",
    displayName: "",
    leagues: [],
  });
  window.localStorage.clear();
  window.localStorage.setItem(storageKey, JSON.stringify(savedOpenDraft()));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("offline draft assignment correction", () => {
  it("removes one wrong-team assignment, refunds the team, and persists the correction", async () => {
    render(<OfflineDraftV2 />);

    const removeButton = screen.getByRole("button", {
      name: "Remove assignment for Test Quarterback from Team 1",
    });
    expect(removeButton.textContent).toContain("Remove");

    fireEvent.click(removeButton);

    expect(screen.getByText("No rostered players.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Test Quarterback removed from Team 1; $27 returned to the team budget."
    );

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as ReturnType<typeof savedOpenDraft>;
      expect(saved.teams[0]?.roster).toEqual([]);
      expect(saved.teams[0]?.spent).toBe(0);
    });
  });
});
