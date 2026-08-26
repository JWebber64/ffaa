import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const globalsCss = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
const leagueCss = readFileSync(resolve(projectRoot, "src/screens/league-hq.css"), "utf8");

describe("app-wide form control surface guard", () => {
  it("uses one dark-teal surface for fields and their arrow controls", () => {
    expect(globalsCss).toMatch(/--ffaa-field-surface:\s*\n\s*linear-gradient/);
    expect(refinementCss).toMatch(/--ffaa-control-surface:\s*var\(--ffaa-field-surface\)/);
    expect(globalsCss).toMatch(/--ffaa-number-field-surface:\s*var\(--ffaa-field-surface\)/);
    expect(globalsCss).toMatch(/\.ffaa-custom-select-icon\s*\{[^}]*background:\s*var\(--ffaa-field-surface\)/s);
    expect(globalsCss).toMatch(/\.draft-bid-stepper\s*\{[^}]*background:\s*var\(--ffaa-field-surface\)/s);
    expect(globalsCss).toMatch(/\.ffaa-number-stepper\s*\{[^}]*background:\s*var\(--ffaa-field-surface\)/s);
    expect(refinementCss).not.toMatch(/(?:\.ffaa-custom-select-icon|\.draft-bid-stepper)[^{]*\{[^}]*background-image:\s*none/s);
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
      ".setup-input",
      ".setup-select",
      ".host-input",
      ".join-input",
      ".offline-input",
      ".offline-select-trigger",
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
