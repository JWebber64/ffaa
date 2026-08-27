import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function clampMaximums(source: string) {
  return Array.from(source.matchAll(/font-size:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/g), (match) => Number(match[1]));
}

describe("shared layout density contract", () => {
  it("owns page spacing and typography in named shared roles", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const roles = [
      "--type-display-hero",
      "--type-display-page",
      "--type-display-section",
      "--type-title-section",
      "--type-title-card",
      "--space-page-hero",
      "--space-page-gap",
      "--space-section-gap",
      "--space-panel-padding",
      "--space-card-padding",
    ];

    for (const role of roles) expect(tokens).toContain(`${role}:`);
  });

  it("keeps representative page families on the shared compact roles", () => {
    const consumers: Record<string, string[]> = {
      "src/screens_v2/landing-v2.css": ["var(--type-display-hero)", "var(--space-page-gap)", "aspect-ratio: 16 / 10"],
      "src/screens/tools/tools.css": ["var(--type-display-page)", "var(--space-page-hero)", "min-height: 0"],
      "src/screens/league-hq.css": ["var(--type-display-page)", ".league-content { min-height: 0; }", "var(--space-panel-padding)"],
      "src/screens/my-hq.css": ["var(--type-display-page)", "min-height: 0", "var(--space-panel-padding)"],
      "src/styles/refinement.css": ["Compact layout contract", "var(--type-display-page)", "var(--space-page-hero)"],
    };

    for (const [path, required] of Object.entries(consumers)) {
      const source = readProjectFile(path);
      for (const token of required) expect(source, `${path} should include ${token}`).toContain(token);
    }
  });

  it("rejects the oversized homepage values that caused the density regression", () => {
    const landing = readProjectFile("src/screens_v2/landing-v2.css");
    const tools = readProjectFile("src/screens/tools/tools.css");
    const league = readProjectFile("src/screens/league-hq.css");
    const myHq = readProjectFile("src/screens/my-hq.css");

    expect(landing).not.toContain("8.5rem");
    expect(landing).not.toContain("min-height: 610px");
    expect(landing).not.toContain("min-height: min(720px");
    expect(tools).not.toContain("min-height: 220px");
    expect(league).not.toContain(".league-content { min-height: 620px; }");
    expect(myHq).not.toContain("min-height: 440px");

    const maximums = [...clampMaximums(landing), ...clampMaximums(tools), ...clampMaximums(league), ...clampMaximums(myHq)];
    expect(Math.max(...maximums)).toBeLessThanOrEqual(4.75);
  });

  it("documents why ordinary cards and heroes stay natural-height", () => {
    const design = readProjectFile("DESIGN.md");
    expect(design).toContain("This is an information-dense product, not a poster.");
    expect(design).toContain("Page heroes and cards use natural height.");
    expect(design).toContain("900px-tall desktop viewport");
  });
});
