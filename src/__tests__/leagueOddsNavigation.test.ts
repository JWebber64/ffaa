import { describe, expect, it } from "vitest";
import { leagueOddsRedirectTarget, LEAGUE_HQ_VIEWS } from "../features/league-hq/leagueOddsNavigation";
import { buildLeagueLinks } from "../layouts/appShellLinks";

describe("power rankings and odds navigation", () => {
  it("places the clearly labeled odds tab directly after Overview", () => {
    expect(LEAGUE_HQ_VIEWS.slice(0, 2).map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "overview", label: "Overview" },
      { id: "futures", label: "Power Rankings & Odds" },
    ]);
  });

  it("adds a grouped League menu shortcut with active-league context", () => {
    expect(buildLeagueLinks("", undefined)).toContainEqual(expect.objectContaining({
      to: "/league?view=futures",
      label: "Power Rankings & Odds",
    }));
    expect(buildLeagueLinks("1234567890", "G.O.A.T. League")).toContainEqual(expect.objectContaining({
      to: "/league?league=1234567890&view=futures",
      label: "Power Rankings & Odds",
    }));
  });

  it("keeps query context when the clean odds URL redirects to League HQ", () => {
    expect(leagueOddsRedirectTarget("?league=1234567890")).toEqual({
      pathname: "/league",
      search: "?league=1234567890&view=futures",
    });
  });
});
