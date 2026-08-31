import { describe, expect, it } from "vitest";
import { loadPlayerPool } from "../data/loadPlayerPool";

describe("2026 player pool coverage", () => {
  it("includes Cyrus Allen as a Kansas City wide receiver", () => {
    const cyrusAllen = loadPlayerPool().find((player) => player.id === "2026-WR-cyrus-allen");

    expect(cyrusAllen).toMatchObject({
      name: "Cyrus Allen",
      pos: "WR",
      nflTeam: "KC",
    });
  });
});
