import { describe, expect, it } from "vitest";

import { createRedraftLeagueSettings, parseLeagueSettings, validateLeagueSettings } from "../../shared/leagueSettings";
import { buildSalaryLedgers, calculateKeeperCost, initializeAdvancedLeagueState, validateAdvancedLeagueState } from "../../shared/nativeAdvancedLeague";

function dynastySettings() {
  const settings = createRedraftLeagueSettings("America/New_York");
  settings.leagueType = "dynasty";
  settings.keeper = { enabled: true, maxKeepers: 30, declarationDeadline: "2026-08-25T18:00:00-04:00", costMode: "auction_salary", baseCost: 6, annualEscalation: 3 };
  settings.advanced.enabled = true;
  settings.advanced.supplementalDrafts = true;
  return settings;
}

describe("Phase 12 keeper, dynasty, and salary-cap model", () => {
  it("keeps legacy and new redraft settings simple with both advanced layers off", () => {
    const defaults = createRedraftLeagueSettings("UTC");
    expect(defaults).toMatchObject({ leagueType: "redraft", keeper: { enabled: false }, advanced: { enabled: false } });
    expect(validateLeagueSettings(defaults)).toEqual([]);
    const legacy = { ...defaults } as Record<string, unknown>;
    delete legacy.keeper; delete legacy.advanced;
    expect(parseLeagueSettings(legacy).settings).toMatchObject({ keeper: { enabled: false }, advanced: { enabled: false } });
  });

  it("calculates escalating keeper cost from the published simple rule", () => {
    const settings = dynastySettings();
    expect(calculateKeeperCost(settings.keeper, 0)).toBe(6);
    expect(calculateKeeperCost(settings.keeper, 2)).toBe(12);
  });

  it("creates one permanent future-pick asset per original team, year, and rookie round", () => {
    const settings = dynastySettings();
    const state = initializeAdvancedLeagueState({ settings, seasonYear: 2026, franchiseIds: ["team-b", "team-a", "team-a"] });
    expect(state.futurePicks).toHaveLength(24);
    expect(state.futurePicks[0]).toMatchObject({ id: "pick__2027__1__team-a", originalFranchiseId: "team-a", ownerFranchiseId: "team-a" });
    expect(state.draftPlans.map((row) => row.kind)).toEqual(["rookie", "supplemental", "dispersal"]);
    expect(validateAdvancedLeagueState(settings, state)).toEqual([]);
  });

  it("accounts for active, retained, and dead salary while rejecting double contracts and illegal taxi/cap state", () => {
    const settings = dynastySettings(); settings.advanced.salaryCap = 100; settings.advanced.taxiSquadSlots = 1; settings.advanced.taxiMaxExperienceSeasons = 1;
    const state = initializeAdvancedLeagueState({ settings, seasonYear: 2026, franchiseIds: ["team-a", "team-b"] });
    state.contracts.push({ id: "contract-one", playerId: "player-one", franchiseId: "team-b", startSeason: 2026, endSeason: 2028, salaryBySeason: { "2026": 80, "2027": 82, "2028": 84 }, optionYears: [2028], exercisedOptionYears: [], retainedSalary: [{ franchiseId: "team-a", season: 2026, amount: 30 }], extensionOfContractId: null, status: "active", revision: 1 });
    state.deadCap.push({ id: "dead-one", franchiseId: "team-a", playerId: "former", season: 2026, amount: 12, sourceContractId: "old-contract", reason: "Release" });
    expect(buildSalaryLedgers(settings.advanced, state, 2026)).toEqual([
      { franchiseId: "team-a", season: 2026, activeSalary: 0, retainedSalary: 30, deadCap: 12, totalCapCharge: 42, capSpace: 58 },
      { franchiseId: "team-b", season: 2026, activeSalary: 50, retainedSalary: 0, deadCap: 0, totalCapCharge: 50, capSpace: 50 },
    ]);
    state.contracts.push({ ...state.contracts[0]!, id: "contract-two", franchiseId: "team-a" });
    state.taxi.push({ id: "taxi-one", playerId: "rookie-one", franchiseId: "team-a", experienceSeasons: 2, placedAt: "2026-08-01T00:00:00.000Z", activatedAt: null, status: "taxi", revision: 1 });
    const messages = validateAdvancedLeagueState(settings, state).map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining(["A player cannot have two active contracts.", "Taxi player exceeds the experience limit."]));
  });
});
