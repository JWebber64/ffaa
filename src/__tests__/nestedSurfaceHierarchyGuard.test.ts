import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tokensCss = readFileSync(resolve(projectRoot, "src/styles/tokens.css"), "utf8");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const toolsCss = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");

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

describe("app-wide nested surface hierarchy guard", () => {
  it("keeps raised tiles separate from both cards and form controls", () => {
    const raised = tokensCss.match(/--bg-2:\s*oklch\(([0-9.]+)/);
    const control = refinementCss.match(/--ffaa-control-surface:\s*oklch\(([0-9.]+)/);
    const panel = refinementCss.match(/--ffaa-panel-background:\s*linear-gradient\([^,]+,\s*(#[0-9a-f]{6})/i);
    const card = refinementCss.match(/--ffaa-card-background:\s*linear-gradient\([^,]+,\s*(#[0-9a-f]{6})/i);

    expect(raised).not.toBeNull();
    expect(control).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(card).not.toBeNull();

    const raisedLightness = Number(raised?.[1]);
    const parentLightness = Math.max(
      hexToOklabLightness(panel?.[1] ?? "#000000"),
      hexToOklabLightness(card?.[1] ?? "#000000"),
    );

    expect(raisedLightness - parentLightness).toBeGreaterThanOrEqual(0.04);
    expect(Number(control?.[1]) - raisedLightness).toBeGreaterThanOrEqual(0.03);
  });

  it("covers nested tile families across every routed product area", () => {
    const coveredSelectors = new Set<string>();
    const root = postcss.parse(refinementCss);

    root.walkRules((rule) => {
      const ownsInnerSurface = rule.nodes.some(
        (node) => node.type === "decl" && node.prop === "background" && node.value.includes("--ffaa-inner-surface"),
      );
      if (ownsInnerSurface) rule.selectors.forEach((selector) => coveredSelectors.add(selector));
    });

    expect([...coveredSelectors]).toEqual(expect.arrayContaining([
      ".setup-stat-card",
      ".host-manager-card",
      ".join-room-meta-item",
      ".results-team-metrics > div",
      ".offline-setup-summary > div",
      ".stats-hub-summary-card",
      ".stats-hub-summary-card:first-child",
      ".analytics-summary-grid > div",
      ".analytics-summary-grid > div:first-child",
      ".team-points-summary-grid > div",
      ".schedule-presets button",
      ".league-manager-stats > div",
      ".team-detail-stats div",
      ".mobile-context-item",
      ".history-leader-strip > div",
      ".history-rivalry-facts > div",
      ".history-draft-summary > div",
      ".history-decision-metrics > div",
      ".history-payout-weeks > article",
    ]));
  });

  it("keeps active and position-tinted child states above the neutral layer", () => {
    expect(refinementCss).toMatch(/\.schedule-presets button\.is-active\s*\{[^}]*var\(--tools-green\)[^}]*var\(--ffaa-inner-surface\)[^}]*!important/s);
    expect(refinementCss).toMatch(/\.team-detail-row\.is-filled\s*\{[^}]*var\(--team-slot-color\)[^}]*var\(--ffaa-inner-surface\)[^}]*!important/s);
  });

  it("keeps position-count wrappers transparent and identifies them by position color", () => {
    expect(toolsCss).toMatch(/\.team-slot-control\s*\{[^}]*padding:\s*0[^}]*border:\s*0[^}]*background:\s*transparent/s);
    expect(toolsCss).toMatch(/\.auction-slot-control\s*\{[^}]*padding:\s*0[^}]*border:\s*0[^}]*background:\s*transparent/s);
    expect(toolsCss).toMatch(/\.team-slot-control\[data-position="qb"\]\s*\{[^}]*var\(--pos-qb\)/s);
    expect(toolsCss).toMatch(/\.auction-slot-control\[data-position="def"\]\s*\{[^}]*var\(--pos-dst\)/s);
    expect(toolsCss).toMatch(/\.team-slot-control\s*>\s*span\s*\{[^}]*var\(--slot-color\)/s);
    expect(toolsCss).toMatch(/\.auction-slot-control\s*>\s*span\s*\{[^}]*var\(--slot-color\)/s);
  });
});
