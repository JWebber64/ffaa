/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  OfflineLeagueDraftRecord,
  OfflineLeagueDraftSnapshot,
} from "../features/offline-draft/offlineLeagueDraftPersistence";

const leagueSyncMocks = vi.hoisted(() => ({
  save: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("../data/loadPlayerPool", () => ({
  loadPlayerPool: () => [],
}));

vi.mock("../features/league-hq/sleeperConnections", () => ({
  useSleeperLeagueConnections: () => ({
    activeLeagueId: "1385319428408774656",
    connections: [{
      leagueId: "1385319428408774656",
      leagueName: "G.O.A.T. League",
      season: "2026",
    }],
    rememberConnection: vi.fn(),
  }),
}));

vi.mock("../features/league-hq/sleeperLeague", () => ({
  findSleeperLeagues: vi.fn().mockResolvedValue({
    lookupType: "user",
    displayName: "",
    leagues: [],
  }),
}));

vi.mock("../features/offline-draft/offlineLeagueDraftPersistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/offline-draft/offlineLeagueDraftPersistence")>();
  return {
    ...actual,
    saveOfflineLeagueDraft: leagueSyncMocks.save,
    subscribeToOfflineLeagueDraft: leagueSyncMocks.subscribe,
  };
});

import { normalizeOfflineLeagueDraftRecord } from "../features/offline-draft/offlineLeagueDraftPersistence";
import OfflineDraftV2 from "../screens_v2/OfflineDraftV2";

const leagueId = "1385319428408774656";
const storageKey = "ffaa.offlineDraft.v1";

function openDraftState(teamName = "Team 1") {
  return {
    config: {
      teamCount: 8,
      defaultBudget: 200,
      draftType: "auction",
      scoring: "ppr",
      rosterSlots: [{ slot: "QB", count: 1 }],
      isOpen: true,
      profileSource: "league",
      profileLeagueId: leagueId,
    },
    teams: Array.from({ length: 8 }, (_, index) => ({
      teamId: `offline-t${index + 1}`,
      teamNumber: index + 1,
      name: index === 0 ? teamName : `Team ${index + 1}`,
      budget: 200,
      spent: 0,
      managerType: "human",
      roster: [] as Array<{ playerId: string; name: string; price: number; pos: string }>,
    })),
    lastAssignment: null,
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
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("offline draft league live display", () => {
  it("accepts only valid records scoped to the expected league", () => {
    const record = {
      owner_user_id: "editor-user",
      schema_version: 1,
      league_id: leagueId,
      state: openDraftState(),
      created_at: "2026-08-29T00:00:00.000Z",
      updated_at: "2026-08-29T00:01:00.000Z",
      version: 4,
    };

    expect(normalizeOfflineLeagueDraftRecord(record, leagueId)).toMatchObject({
      leagueId,
      ownerUserId: "editor-user",
      version: 4,
    });
    expect(normalizeOfflineLeagueDraftRecord(record, "9999999999999999999")).toBeNull();
  });

  it("publishes from one laptop and mirrors later changes to a read-only laptop", async () => {
    let remoteRecord: OfflineLeagueDraftRecord | null = null;
    const subscribers: Array<{
      userId: string;
      onRecord: (snapshot: OfflineLeagueDraftSnapshot) => void;
    }> = [];

    leagueSyncMocks.subscribe.mockImplementation(async (
      _leagueId: string,
      onRecord: (snapshot: OfflineLeagueDraftSnapshot) => void,
    ) => {
      const userId = subscribers.length === 0 ? "editor-user" : "viewer-user";
      const subscriber = { userId, onRecord };
      subscribers.push(subscriber);
      queueMicrotask(() => onRecord({ currentUserId: userId, record: remoteRecord }));
      return () => {
        const index = subscribers.indexOf(subscriber);
        if (index >= 0) subscribers.splice(index, 1);
      };
    });

    leagueSyncMocks.save.mockImplementation(async (_leagueId: string, state: ReturnType<typeof openDraftState>) => {
      const timestamp = new Date().toISOString();
      remoteRecord = {
        leagueId,
        ownerUserId: "editor-user",
        state,
        createdAt: remoteRecord?.createdAt ?? timestamp,
        updatedAt: timestamp,
        version: (remoteRecord?.version ?? 0) + 1,
      };
      for (const subscriber of subscribers) {
        subscriber.onRecord({ currentUserId: subscriber.userId, record: remoteRecord });
      }
      return { access: "editor" as const, record: remoteRecord };
    });

    window.localStorage.setItem(storageKey, JSON.stringify(openDraftState()));
    const editor = render(<OfflineDraftV2 />);

    await waitFor(() => expect(leagueSyncMocks.save).toHaveBeenCalled(), { timeout: 3_000 });
    expect(within(editor.container).queryByRole("region", { name: "League live display" })).toBeNull();
    expect(within(editor.container).queryByText("League live display")).toBeNull();
    expect(within(editor.container).queryByRole("button", { name: "Copy separate view link" })).toBeNull();

    window.localStorage.clear();
    const viewer = render(<OfflineDraftV2 />);

    await waitFor(() => {
      expect(within(viewer.container).getByRole("heading", { name: "Offline Draft Board" })).toBeTruthy();
      expect(within(viewer.container).queryByRole("button", { name: "Save" })).toBeNull();
    });
    expect(within(viewer.container).queryByRole("region", { name: "League live display" })).toBeNull();

    fireEvent.change(within(editor.container).getByLabelText("Team Name"), {
      target: { value: "Updated Team" },
    });

    await waitFor(() => {
      expect(within(viewer.container).getAllByTitle("Updated Team").length).toBeGreaterThan(0);
    }, { timeout: 3_000 });
  }, 15_000);

  it("does not require IR to be filled before the read-only board is complete", async () => {
    const state = openDraftState();
    state.config.rosterSlots = [
      { slot: "QB", count: 1 },
      { slot: "IR", count: 1 },
    ];
    state.teams = state.teams.map((team, index) => ({
      ...team,
      spent: 1,
      roster: [{
        playerId: `qb-${index + 1}`,
        name: `Quarterback ${index + 1}`,
        price: 1,
        pos: "QB",
      }],
    }));

    leagueSyncMocks.subscribe.mockImplementation(async (
      _leagueId: string,
      onRecord: (snapshot: OfflineLeagueDraftSnapshot) => void,
    ) => {
      queueMicrotask(() => onRecord({
        currentUserId: "viewer-user",
        record: {
          leagueId,
          ownerUserId: "editor-user",
          state,
          createdAt: "2026-08-29T00:00:00.000Z",
          updatedAt: "2026-08-29T00:01:00.000Z",
          version: 1,
        },
      }));
      return () => undefined;
    });

    const viewer = render(<OfflineDraftV2 />);

    await waitFor(() => {
      expect(within(viewer.container).getByText("Complete")).toBeTruthy();
    });
    expect(within(viewer.container).queryByRole("region", { name: "League live display" })).toBeNull();
  });
});
