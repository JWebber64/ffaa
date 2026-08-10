// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createStarterLeagueHQ } from "../features/league-hq/leagueHQData";
import { useLeagueHQ } from "../features/league-hq/useLeagueHQ";

const starter = createStarterLeagueHQ({
  teams: [{ id: 1, name: "Local Team" }],
  teamCount: 1,
  baseBudget: 200,
  roster: { QB: 1 },
  nominationSeconds: 30,
  antiSnipeSeconds: 5,
});

describe("useLeagueHQ scoped persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps each connected league in an isolated local workspace", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useLeagueHQ(starter, scope),
      { initialProps: { scope: "111111111111" } },
    );

    act(() => {
      result.current.setData((current) => ({
        ...current,
        identity: { ...current.identity, name: "Alpha League" },
      }));
    });
    expect(result.current.data.identity.name).toBe("Alpha League");

    rerender({ scope: "222222222222" });
    expect(result.current.data.identity.name).toBe(starter.identity.name);

    act(() => {
      result.current.setData((current) => ({
        ...current,
        identity: { ...current.identity, name: "Beta League" },
      }));
    });
    expect(result.current.data.identity.name).toBe("Beta League");

    rerender({ scope: "111111111111" });
    expect(result.current.data.identity.name).toBe("Alpha League");
  });

  it("stores a late refresh under its original league without replacing the active league", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useLeagueHQ(starter, scope),
      { initialProps: { scope: "111111111111" } },
    );
    const updateFirstLeague = result.current.setData;

    rerender({ scope: "222222222222" });
    act(() => {
      updateFirstLeague((current) => ({
        ...current,
        identity: { ...current.identity, name: "Late Alpha Refresh" },
      }));
    });

    expect(result.current.data.identity.name).toBe(starter.identity.name);
    rerender({ scope: "111111111111" });
    expect(result.current.data.identity.name).toBe("Late Alpha Refresh");
  });
});
