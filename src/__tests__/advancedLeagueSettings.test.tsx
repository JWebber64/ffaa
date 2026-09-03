// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRedraftLeagueSettings } from "../../shared/leagueSettings";
import { AdvancedLeagueSettingsSection } from "../features/league-settings/AdvancedLeagueSettingsSection";

afterEach(cleanup);

describe("Phase 12 advanced settings separation", () => {
  it("keeps ordinary redraft setup free of keeper and contract fields", () => {
    render(<AdvancedLeagueSettingsSection settings={createRedraftLeagueSettings()} onChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Simple keeper rules" })).toBeTruthy();
    expect(screen.getByText("Not active for redraft.")).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Salary cap" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Maximum keepers" })).toBeNull();
  });

  it("shows simple keeper controls without exposing the contract-league matrix", () => {
    const settings = createRedraftLeagueSettings(); settings.leagueType = "keeper"; settings.keeper.enabled = true; settings.keeper.maxKeepers = 3; settings.keeper.declarationDeadline = "2026-08-25T18:00";
    render(<AdvancedLeagueSettingsSection settings={settings} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: "Maximum keepers" })).toBeTruthy();
    expect(screen.getByText("Advanced controls are off.")).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Salary cap" })).toBeNull();
  });

  it("exposes future picks, rookie drafts, taxi, contracts, cap, tags, orphan, and dispersal controls only for dynasty", () => {
    const settings = createRedraftLeagueSettings(); settings.leagueType = "dynasty"; settings.keeper.enabled = true; settings.keeper.maxKeepers = 30; settings.keeper.declarationDeadline = "2026-08-25T18:00"; settings.advanced.enabled = true;
    render(<AdvancedLeagueSettingsSection settings={settings} onChange={vi.fn()} />);
    for (const name of ["Tradable future pick years", "Rookie draft rounds", "Taxi squad slots", "Salary cap", "Default contract years", "Allowed option years", "Dead cap percent", "Maximum salary retention percent", "Franchise tags per team"]) expect(screen.getByRole("spinbutton", { name })).toBeTruthy();
    for (const name of ["Supplemental drafts", "Contract extensions", "Restricted free agency", "Orphan-team workflow", "Dispersal drafts", "Compensatory picks"]) expect(screen.getByRole("checkbox", { name: new RegExp(name, "iu") })).toBeTruthy();
  });
});
