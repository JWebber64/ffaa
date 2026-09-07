// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import type { MyHQData } from "../features/my-hq/myHQ";

const fixture = vi.hoisted(() => ({
  avatarUrl: "https://sleepercdn.com/avatars/thumbs/manager-avatar",
}));

const connection: SleeperLeagueConnectionSummary = {
  leagueId: "111111111111",
  leagueName: "G.O.A.T. League",
  season: "2026",
  status: "in_season",
  totalRosters: 12,
  sourceUrl: "https://sleeper.com/leagues/111111111111",
  lastUsedAt: "2026-09-07T00:00:00.000Z",
  managerProviderUserId: "manager-1",
  managerDisplayName: "JWebber64",
  managerTeamName: "Better call Hall",
  managerAvatarUrl: fixture.avatarUrl,
};

const data: MyHQData = {
  leagueId: connection.leagueId,
  leagueName: connection.leagueName,
  season: connection.season,
  seasonPhase: "regular",
  week: 1,
  teamName: "Better call Hall",
  record: "0-0",
  standing: 3,
  totalTeams: 12,
  opponentName: "Opponent",
  opponentRecord: "0-0",
  managerProviderUserId: "manager-1",
  managerAvatarUrl: fixture.avatarUrl,
  leagueOwnerProviderUserId: "owner-1",
  opponentProviderUserId: "opponent-1",
  teamScore: null,
  opponentScore: null,
  teamProjectedPoints: null,
  opponentProjectedPoints: null,
  starterLineup: [],
  opponentStarterLineup: [],
  starters: [],
  bench: [],
  opponentBench: [],
  starterSlots: [],
  rosteredPlayerIds: [],
  alerts: [],
  decisions: [],
  availableRecommendations: [],
  closestMatchup: "No matchup",
  recentActivity: [],
  projectionNote: "",
  loadedAt: "2026-09-07T00:00:00.000Z",
};

vi.mock("../lib/authSession", () => ({
  isPermanentFirebaseSession: () => false,
  upgradeFirebaseSessionWithGoogle: vi.fn(),
}));
vi.mock("../lib/useFirebaseSession", () => ({ useFirebaseSession: () => null }));
vi.mock("../features/league-hq/sleeperConnections", async (importOriginal) => ({
  ...await importOriginal<typeof import("../features/league-hq/sleeperConnections")>(),
  useSleeperLeagueConnections: () => ({
    connections: [connection],
    activeLeagueId: connection.leagueId,
  }),
}));
vi.mock("../features/my-hq/useMyTeamsPortfolio", () => ({
  useMyTeamsPortfolio: () => [{
    connection,
    state: { status: "ready", data, error: "" },
    decision: null,
  }],
}));
vi.mock("../features/league-workspace/ManagerIdentityForm", () => ({ ManagerIdentityForm: () => null }));
vi.mock("../features/league-workspace/leagueWorkspaceState", () => ({
  useLeagueWorkspace: () => ({
    connection,
    teamState: { status: "ready", data, error: "" },
  }),
}));
vi.mock("../features/league-history/useLeagueHistory", () => ({
  useLeagueHistory: () => ({ status: "error", data: null }),
}));

import MyTeams from "../screens/MyTeams";
import MyHQ from "../screens/MyHQ";

describe("Sleeper manager avatar surfaces", () => {
  it("shows the manager avatar in each My Teams row", () => {
    const { container } = render(<MemoryRouter><MyTeams /></MemoryRouter>);

    const image = container.querySelector(".my-team-identity img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(fixture.avatarUrl);
  });

  it("shows the manager avatar in the My Team summary", () => {
    const { container } = render(<MemoryRouter><MyHQ /></MemoryRouter>);

    const image = container.querySelector(".hq-team-mark img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(fixture.avatarUrl);
  });
});
