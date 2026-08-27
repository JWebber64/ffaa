import { describe, expect, it } from "vitest";
import { metadataForPath } from "../lib/routeMetadata";

describe("route metadata", () => {
  it("gives public product routes unique indexable metadata", () => {
    const paths = ["/", "/stats", "/analytics", "/tools", "/tools/player-compare", "/league", "/league/123456789012"];
    const metadata = paths.map(metadataForPath);

    expect(new Set(metadata.map((entry) => entry.title)).size).toBe(metadata.length);
    expect(metadata.every((entry) => entry.indexable !== false)).toBe(true);
    expect(metadata.map((entry) => entry.path)).toEqual(paths);
  });

  it("keeps personalized and temporary room routes out of search", () => {
    const paths = ["/my-hq", "/offline-draft", "/host/setup", "/join", "/draft/private-room", "/results/private-room"];

    expect(paths.map(metadataForPath).every((entry) => entry.indexable === false)).toBe(true);
  });
});
