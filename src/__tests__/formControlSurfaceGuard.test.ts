import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const globalsCss = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
const tokensCss = readFileSync(resolve(projectRoot, "src/styles/tokens.css"), "utf8");
const leagueCss = readFileSync(resolve(projectRoot, "src/screens/league-hq.css"), "utf8");

describe("app-wide form control surface guard", () => {
  it("uses one neutral gray surface for fields and their arrow controls", () => {
    expect(tokensCss).toMatch(/--color-surface-field:\s*color-mix\([^;]*var\(--gray-/);
    expect(tokensCss).toMatch(/--ffaa-control-surface:\s*var\(--color-surface-field\)/);
    expect(refinementCss).toMatch(/\.ffaa-number-field > input\[type="number"\],[^}]*\.ffaa-number-stepper[^}]*\{[^}]*background:\s*var\(--color-surface-field\)/s);
    expect(refinementCss).toMatch(/\.ffaa-custom-select-icon,[^}]*\.ffaa-number-stepper\s*\{[^}]*background-image:\s*none/s);
  });

  it("applies the shared surface to primitive and raw page controls", () => {
    const coveredSelectors = new Set<string>();
    const root = postcss.parse(refinementCss);

    root.walkRules((rule) => {
      const ownsControlSurface = rule.nodes.some(
        (node) => node.type === "decl" && node.prop === "background" && node.value.includes("--color-surface-field"),
      );
      if (ownsControlSurface) rule.selectors.forEach((selector) => coveredSelectors.add(selector));
    });

    expect([...coveredSelectors]).toEqual(expect.arrayContaining([
      ".ui-input-field",
      ".setup-input",
      ".setup-select",
      ".host-input",
      ".join-input",
      ".offline-input",
      ".offline-select-trigger",
      ".ffaa-custom-select-trigger",
      ".cui-input",
      ".tool-field input",
      ".league-json",
      ".studio-manager-list textarea",
    ]));
  });

  it("keeps inputs inside compound controls transparent", () => {
    expect(refinementCss).toMatch(/\.tool-field \.auction-budget-input input\s*\{[^}]*background:\s*transparent/s);
    expect(leagueCss).toMatch(/\.league-connect-input input\s*\{[^}]*background:\s*transparent/s);
    expect(globalsCss).toMatch(/\.mobile-search-field input\s*\{[^}]*background:\s*transparent/s);
  });
});
