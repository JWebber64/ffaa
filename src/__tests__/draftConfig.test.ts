import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_AUCTION_12, normalizeDraftConfigV2 } from "../types/draftConfig";

describe("draft config", () => {
  it("defaults every configured CPU manager profile selector to random", () => {
    const config = normalizeDraftConfigV2({
      ...DEFAULT_CONFIG_AUCTION_12,
      computerManagers: 3,
    });

    expect(config.computerManagerProfiles).toEqual(["random", "random", "random"]);
  });

  it("trims CPU profile selectors when the CPU count is reduced", () => {
    const config = normalizeDraftConfigV2({
      ...DEFAULT_CONFIG_AUCTION_12,
      computerManagers: 2,
      computerManagerProfiles: ["aggressive", "frugal", "balanced"],
    });

    expect(config.computerManagerProfiles).toEqual(["aggressive", "frugal"]);
  });
});
