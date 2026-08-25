import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const globalsCss = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
const leagueCss = readFileSync(resolve(projectRoot, "src/screens/league-hq.css"), "utf8");

function hexToOklabLightness(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

describe("app-wide form control surface guard", () => {
  it("keeps form controls visibly separate from the panel surface", () => {
    const control = refinementCss.match(/--ffaa-control-surface:\s*oklch\(([0-9.]+)/);
    const panel = refinementCss.match(/--ffaa-panel-background:\s*linear-gradient\([^,]+,\s*(#[0-9a-f]{6})/i);

    expect(control).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(Number(control?.[1]) - hexToOklabLightness(panel?.[1] ?? "#000000")).toBeGreaterThanOrEqual(0.08);
  });

  it("applies the shared surface to primitive and raw page controls", () => {
    const coveredSelectors = new Set<string>();
    const root = postcss.parse(refinementCss);

    root.walkRules((rule) => {
      const ownsControlSurface = rule.nodes.some(
        (node) => node.type === "decl" && node.prop === "background" && node.value.includes("--ffaa-control-surface"),
      );
      if (ownsControlSurface) rule.selectors.forEach((selector) => coveredSelectors.add(selector));
    });

    expect([...coveredSelectors]).toEqual(expect.arrayContaining([
      ".ui-input-field",
      ".ffaa-custom-select-trigger",
      ".cui-input",
      ".tool-field input",
      ".offline-search-field input",
      ".history-draft-search input",
      ".stats-select-label select",
      ".league-connect-form select",
      ".league-sorter select",
      ".studio-manager-list textarea",
      ".mobile-search-field",
      ".league-connect-input",
      ".auction-budget-input",
      ".auction-selected-ticket label > span",
    ]));
  });

  it("keeps inputs inside compound controls transparent", () => {
    expect(refinementCss).toMatch(/\.tool-field \.auction-budget-input input\s*\{[^}]*background:\s*transparent\s*!important/s);
    expect(leagueCss).toMatch(/\.league-connect-input input\s*\{[^}]*background:\s*transparent/s);
    expect(globalsCss).toMatch(/\.mobile-search-field input\s*\{[^}]*background:\s*transparent/s);
  });
});
