/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      spent: index === 0 ? 197 : 0,
      roster: index === 0
        ? [{ playerId: "editable-player", name: "Editable Quarterback", price: 197, pos: "QB" }]
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

describe("offline draft price editing", () => {
  it("persists a rostered player's edited price and exposes an over-budget team", async () => {
    const { container } = render(<OfflineDraftV2 />);
    const priceInput = screen.getByRole("spinbutton", { name: "Price for Editable Quarterback" });
    const summary = container.querySelector(".offline-selected-summary");

    expect(priceInput.getAttribute("value")).toBe("197");
    expect(summary).toBeTruthy();

    fireEvent.change(priceInput, { target: { value: "205" } });

    expect(within(summary as HTMLElement).getByText("Over budget").parentElement?.textContent).toContain("$5");
    expect(screen.getByTitle("Over budget by $5").textContent).toContain("-$5");
    expect(screen.getByRole("status").textContent).toContain(
      "Editable Quarterback price updated from $197 to $205. Team 1 is $5 over budget."
    );

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as ReturnType<typeof savedOpenDraft>;
      expect(saved.teams[0]?.roster[0]?.price).toBe(205);
      expect(saved.teams[0]?.spent).toBe(205);
    });

    fireEvent.change(priceInput, { target: { value: "195" } });

    expect(within(summary as HTMLElement).getByText("Remaining").parentElement?.textContent).toContain("$5");
    expect(screen.getByTitle("Remaining budget: $5").textContent).toContain("$5");
  }, 15_000);
});
