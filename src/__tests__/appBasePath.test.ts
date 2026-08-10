import { describe, expect, it } from "vitest";

import { appUrl, normalizeAppBaseUrl } from "@/lib/appBasePath";

describe("app base path", () => {
  it("keeps root development URLs unchanged", () => {
    expect(normalizeAppBaseUrl("/")).toBe("/");
    expect(appUrl("sounds/sold.mp3", "/")).toBe("/sounds/sold.mp3");
  });

  it("prefixes dynamic public assets for the GameHQ /ff deployment", () => {
    expect(normalizeAppBaseUrl("/ff/")).toBe("/ff/");
    expect(appUrl("/teams/SEA.svg", "/ff/")).toBe("/ff/teams/SEA.svg");
    expect(appUrl("data/analytics/file.csv", "ff")).toBe("/ff/data/analytics/file.csv");
    expect(appUrl("https://api.example.com/data", "/ff/")).toBe("https://api.example.com/data");
  });
});
