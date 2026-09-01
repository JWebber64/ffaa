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
  function createDataTransfer() {
    const values = new Map<string, string>();
    return {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn((type: string, value: string) => values.set(type, value)),
      getData: vi.fn((type: string) => values.get(type) ?? ""),
    };
  }

  it("keeps the active draft toolbar focused on recovery and destructive actions", () => {
    const { container } = render(<OfflineDraftV2 />);
    const toolbar = container.querySelector(".offline-console-toolbar");
    const teamState = container.querySelector(".offline-console-head > .offline-team-chip");

    expect(toolbar).toBeTruthy();
    expect(toolbar?.querySelector(".offline-console-metrics")).toBeTruthy();
    expect(toolbar?.querySelector(".offline-console-actions")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Save$/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Undo" }).classList.contains("ui-button-ghost")).toBe(true);
    expect(screen.getByRole("button", { name: "Reset" }).classList.contains("offline-reset-action")).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel Draft" }).classList.contains("offline-cancel-action")).toBe(true);
    expect(teamState).toBeTruthy();
    expect(teamState?.querySelector(".offline-team-chip-dot")).toBeNull();
  });

  it("drags a wrong-team player onto the correct team and transfers the auction spend", async () => {
    render(<OfflineDraftV2 />);

    expect(screen.queryByRole("button", { name: /Remove assignment/ })).toBeNull();
    const playerCard = screen.getByRole("button", { name: "Move Test Quarterback from QB" });
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(playerCard, { dataTransfer });
    const teamTarget = screen.getByRole("button", { name: "Move Test Quarterback to Team 2" });
    fireEvent.dragOver(teamTarget, { dataTransfer });
    fireEvent.drop(teamTarget, { dataTransfer });
    fireEvent.dragEnd(playerCard, { dataTransfer });

    expect(screen.getByRole("heading", { name: "Team 2" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Test Quarterback moved from Team 1 to Team 2.");

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as ReturnType<typeof savedOpenDraft>;
      expect(saved.teams[0]?.roster).toEqual([]);
      expect(saved.teams[0]?.spent).toBe(0);
      expect(saved.teams[1]?.roster).toEqual([
        expect.objectContaining({ playerId: "wrong-team-player", name: "Test Quarterback", price: 27 }),
      ]);
      expect(saved.teams[1]?.spent).toBe(27);
    });
  });

  it("drags a player to the single trash target and returns them to available players", async () => {
    render(<OfflineDraftV2 />);

    const playerCard = screen.getByRole("button", { name: "Move Test Quarterback from QB" });
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(playerCard, { dataTransfer });

    const availableTarget = screen.getByRole("button", {
      name: "Return Test Quarterback to available players",
    });
    fireEvent.dragOver(availableTarget, { dataTransfer });
    fireEvent.drop(availableTarget, { dataTransfer });
    fireEvent.dragEnd(playerCard, { dataTransfer });

    expect(screen.getByText("No rostered players.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Test Quarterback returned to available players; $27 returned to Team 1.",
    );

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as ReturnType<typeof savedOpenDraft>;
      expect(saved.teams[0]?.roster).toEqual([]);
      expect(saved.teams[0]?.spent).toBe(0);
    });
  });
});
