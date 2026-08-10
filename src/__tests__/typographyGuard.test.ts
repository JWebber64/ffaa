import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function getCssBlock(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  return match?.[1] ?? "";
}

function getLineHeight(css: string, selector: string) {
  const block = getCssBlock(css, selector);
  const match = block.match(/line-height:\s*([0-9.]+)/);
  return match ? Number(match[1]) : null;
}

describe("compact player-name typography guard", () => {
  it("keeps the old SlotTile pattern from using leading-none in clipped player text", () => {
    const slotTile = readProjectFile("src/components/draft/SlotTile.tsx");

    expect(slotTile).toContain("descender-safe-text");
    expect(slotTile).not.toContain("leading-none");
  });

  it("keeps clipped draft-board player names descender-safe", () => {
    const css = readProjectFile("src/styles/globals.css");

    expect(getLineHeight(css, ".descender-safe-text")).toBeGreaterThanOrEqual(1.18);

    for (const selector of [
      ".team-slot-line-player",
      ".team-board-12 .team-slot-line-player",
      ".team-board-16 .team-slot-line-player",
      ".team-board-density-compact .team-slot-line-player",
    ]) {
      expect(getLineHeight(css, selector)).toBeGreaterThanOrEqual(1.18);
    }
  });

  it("documents the regression case that exposed the clipped descender", () => {
    const regressionName = "Jaxon Smith-Njigba";

    expect(regressionName).toMatch(/[gjpqy]/);
    expect(regressionName.split(/\s+|-/)).toEqual(["Jaxon", "Smith", "Njigba"]);
  });

  it("keeps common long board names in a smaller width-safe tier", () => {
    const teamBoard = readProjectFile("src/components/draft/TeamBoard.tsx");
    const css = readProjectFile("src/styles/globals.css");

    expect(teamBoard).toContain('if (longestPart >= 9 || totalLength >= 18) return "name-sm";');
    expect(css).toContain("--team-slot-side-width: 28px;");
    expect(css).toContain("--team-slot-meta-width: 18px;");
  });
});
