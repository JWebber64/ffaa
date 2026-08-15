import { describe, expect, it } from "vitest";

import {
  getNflTeamBrand,
  getNflTeamCssVars,
  normalizeNflTeam,
} from "../data/nflTeamBrand";

describe("NFL team branding", () => {
  it("normalizes common provider aliases", () => {
    expect(normalizeNflTeam("sfo")).toBe("SF");
    expect(normalizeNflTeam("WSH")).toBe("WAS");
    expect(normalizeNflTeam("LA")).toBe("LAR");
  });

  it("returns a complete two-color team identity", () => {
    expect(getNflTeamBrand("BUF")).toEqual({
      primary: "#00338d",
      secondary: "#c60c30",
      accent: "#ffffff",
      foreground: "#ffffff",
    });
    expect(getNflTeamCssVars("GB")).toMatchObject({
      "--team-primary": "#203731",
      "--team-secondary": "#ffb612",
    });
  });

  it("uses a readable neutral identity for free agents and unknown teams", () => {
    expect(getNflTeamBrand("FA")).toEqual(getNflTeamBrand("UNKNOWN"));
    expect(getNflTeamBrand(null).foreground).toBe("#f7fbf8");
  });
});
