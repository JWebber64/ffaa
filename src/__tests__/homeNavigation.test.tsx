/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShellV2 from "../layouts/AppShellV2";

const leagueId = "1385319428408774656";
const switchLeague = vi.fn();
vi.mock("../features/league-hq/sleeperConnections", () => ({
  useSleeperLeagueConnections: () => ({
    connections: [{ leagueId: "1385319428408774656", leagueName: "Connected league", managerProviderUserId: "manager", managerTeamName: "My team" }],
    activeLeagueId: "1385319428408774656",
    setActiveLeagueId: switchLeague,
  }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function shell(path: string) {
  render(<MemoryRouter initialEntries={[path]}><AppShellV2 /></MemoryRouter>);
  return screen.getByRole("navigation", { name: "Mobile navigation" });
}

describe("global and league navigation", () => {
  it("keeps global navigation outside a league even with a remembered team", () => {
    const mobile = shell("/stats");
    expect(within(mobile).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(mobile).getByRole("link", { name: "Research" })).toHaveClass("active");
    expect(within(mobile).queryByRole("link", { name: "League home" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Fantasy Football presented by GameHQ home" }));
    expect(within(mobile).getByRole("link", { name: "Home" })).toHaveClass("active");
    expect(switchLeague).not.toHaveBeenCalled();
  });

  it.each(["matchup", "team/matchup"])("selects only Matchup on the %s route", (suffix) => {
    const mobile = shell(`/league/${leagueId}/${suffix}`);
    expect(within(mobile).getByRole("link", { name: "League home" })).toHaveAttribute("href", `/league/${leagueId}`);
    expect(within(mobile).getByRole("link", { name: "Matchup" })).toHaveClass("active");
    expect(within(mobile).getByRole("link", { name: "Team" })).not.toHaveClass("active");
  });

  it("uses the current native league instead of the remembered Sleeper league", () => {
    const nativeId = "11111111-1111-4111-8111-111111111111";
    const mobile = shell(`/league/${nativeId}/team`);
    expect(within(mobile).getByRole("link", { name: "League home" })).toHaveAttribute("href", `/league/${nativeId}`);
    expect(within(mobile).getByRole("link", { name: "Team" })).toHaveClass("active");
  });

  it("offers a global exit from a league and dismisses More when it is selected", () => {
    const mobile = shell(`/league/${leagueId}/team`);
    const menu = within(mobile).getByText("More").closest("details")!;
    fireEvent.click(within(menu).getByText("More"));
    fireEvent.click(within(menu).getByRole("link", { name: "Home" }));
    expect(menu).not.toHaveAttribute("open");
    expect(within(mobile).getByRole("link", { name: "Home" })).toHaveClass("active");
  });

  it("marks the draft section current during room setup", () => {
    const mobile = shell("/host/setup");
    expect(within(mobile).getByRole("link", { name: "Draft" })).toHaveAttribute("aria-current", "page");
    expect(within(mobile).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
