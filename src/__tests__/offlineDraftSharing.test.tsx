/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloudMocks = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("../data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("../features/league-hq/sleeperLeague", () => ({
  findSleeperLeagues: vi.fn(),
}));

vi.mock("../features/offline-draft/offlineDraftPersistence", () => ({
  createOfflineDraftOnline: cloudMocks.create,
  loadOfflineDraftOnlineForSession: cloudMocks.load,
  saveOfflineDraftOnline: cloudMocks.save,
  subscribeToOfflineDraftOnline: cloudMocks.subscribe,
}));

import OfflineDraftV2 from "../screens_v2/OfflineDraftV2";

const draftId = "AbCdEfGhIjKlMnOpQrSt";

function sharedState(teamName = "Webber") {
  return {
    teams: [
      {
        teamId: "offline-t1",
        teamNumber: 1,
        name: teamName,
        budget: 200,
        spent: 0,
        managerType: "human",
        roster: [],
      },
      {
        teamId: "offline-t2",
        teamNumber: 2,
        name: "Claybags",
        budget: 200,
        spent: 0,
        managerType: "human",
        roster: [],
      },
    ],
    config: {
      teamCount: 2,
      defaultBudget: 200,
      draftType: "auction",
      scoring: "ppr",
      rosterSlots: [
        { slot: "QB", count: 1 },
        { slot: "WR", count: 3 },
        { slot: "BENCH", count: 4 },
      ],
      isOpen: false,
      profileSource: "league",
      profileLeagueId: "1385319428408774656",
    },
    lastAssignment: null,
  };
}

function cloudRecord(state = sharedState()) {
  return {
    id: draftId,
    ownerUserId: "owner-user",
    state,
    leagueId: "1385319428408774656",
    leagueName: "G.O.A.T. League",
    season: "2026",
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    version: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/ff/offline-draft");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  cloudMocks.subscribe.mockReturnValue(() => undefined);
  cloudMocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("offline draft online sharing", () => {
  it("creates an Offline Draft ID, copies its view link, and autosaves later team edits", async () => {
    let createdRecord = cloudRecord();
    cloudMocks.create.mockImplementation(async (state) => {
      createdRecord = cloudRecord(state);
      return createdRecord;
    });
    cloudMocks.load.mockImplementation(async () => ({ record: createdRecord, isOwner: true }));

    render(<OfflineDraftV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Share Draft Online" }));

    await screen.findByText(`Offline Draft ID: ${draftId}`);
    expect(cloudMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teams: expect.arrayContaining([expect.objectContaining({ name: "Team 1" })]),
      }),
      expect.any(Object),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/offline-draft/${draftId}`,
    );
    expect(window.location.pathname).toBe(`/offline-draft/${draftId}`);

    fireEvent.change(screen.getByLabelText("Team 1 name"), { target: { value: "Webber Warriors" } });
    await waitFor(
      () => expect(cloudMocks.save).toHaveBeenCalledWith(
        draftId,
        expect.objectContaining({
          teams: expect.arrayContaining([expect.objectContaining({ name: "Webber Warriors" })]),
        }),
      ),
      { timeout: 3_000 },
    );
  });

  it("opens another device as a live read-only G.O.A.T. board", async () => {
    window.history.replaceState({}, "", `/ff/offline-draft/${draftId}`);
    cloudMocks.load.mockResolvedValue({ record: cloudRecord(), isOwner: false });

    render(<OfflineDraftV2 />);

    expect(await screen.findByRole("heading", { name: "Offline Draft Board" })).toBeInTheDocument();
    expect(screen.getByText("G.O.A.T. League")).toBeInTheDocument();
    expect(screen.getByText("Read-only live view. Changes from the draft owner appear automatically.")).toBeInTheDocument();
    expect(screen.getByText(`Offline Draft ID: ${draftId}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Draft Online" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Setup" })).not.toBeInTheDocument();
    expect(cloudMocks.subscribe).toHaveBeenCalledWith(draftId, expect.any(Function), expect.any(Function));
  });
});
