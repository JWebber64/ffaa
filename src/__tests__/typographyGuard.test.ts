import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

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

function listCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listCssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

function numericLineHeight(value: string | undefined) {
  if (!value) return null;
  const match = value.trim().match(/^([0-9.]+)$/);
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

  it("keeps every ellipsized text rule descender-safe", () => {
    const violations: string[] = [];

    for (const path of listCssFiles(resolve(projectRoot, "src"))) {
      const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
      root.walkRules((rule) => {
        const declarations = new Map(rule.nodes
          .filter((node) => node.type === "decl")
          .map((node) => [node.prop, node.value]));
        if (declarations.get("text-overflow") !== "ellipsis") return;

        const lineHeight = numericLineHeight(declarations.get("line-height"));
        if (lineHeight === null || lineHeight < 1.18) {
          const relativePath = path.slice(projectRoot.length + 1).split("\\").join("/");
          violations.push(`${relativePath}: ${rule.selector}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("keeps every display-font rule on a safe heading line box", () => {
    const violations: string[] = [];

    for (const path of listCssFiles(resolve(projectRoot, "src"))) {
      const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
      root.walkRules((rule) => {
        const declarations = new Map(rule.nodes
          .filter((node) => node.type === "decl")
          .map((node) => [node.prop, node.value]));
        const family = declarations.get("font-family") ?? "";
        const shorthand = declarations.get("font") ?? "";
        if (!family.includes("--font-display") && !shorthand.includes("--font-display")) return;

        const explicit = numericLineHeight(declarations.get("line-height"));
        const shorthandMatch = shorthand.match(/\/\s*([0-9.]+)/);
        const lineHeight = explicit ?? (shorthandMatch ? Number(shorthandMatch[1]) : null);
        if (lineHeight === null || lineHeight < 1.08) {
          const relativePath = path.slice(projectRoot.length + 1).split("\\").join("/");
          violations.push(`${relativePath}: ${rule.selector}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("keeps the reusable display class authoritative over tighter page rules", () => {
    const css = readProjectFile("src/styles/globals.css");
    const block = getCssBlock(css, ".ff-display");

    expect(block).toMatch(/line-height:\s*1\.1\s*!important/);
  });
});
