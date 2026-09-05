import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tokensCss = readFileSync(resolve(projectRoot, "src/styles/tokens.css"), "utf8");
const refinementCss = readFileSync(resolve(projectRoot, "src/styles/refinement.css"), "utf8");
const globalsCss = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");
const toolsCss = readFileSync(resolve(projectRoot, "src/screens/tools/tools.css"), "utf8");
const teamRaterSource = readFileSync(resolve(projectRoot, "src/screens/tools/TeamRater.tsx"), "utf8");
const auctionTeamBuilderSource = readFileSync(resolve(projectRoot, "src/screens/tools/AuctionTeamBuilder.tsx"), "utf8");
const historyCss = readFileSync(resolve(projectRoot, "src/features/league-history/ui/league-history.css"), "utf8");

describe("app-wide nested surface hierarchy guard", () => {
  it("keeps primary, secondary, and field surfaces as separate named roles", () => {
    expect(tokensCss).toMatch(/--color-surface-card-primary:\s*var\(--green-900\)/);
    expect(tokensCss).toMatch(/--color-surface-card-secondary:\s*var\(--green-800\)/);
    expect(tokensCss).toMatch(/--color-surface-field:\s*color-mix\([^;]*var\(--gray-/);
    expect(tokensCss).toMatch(/--ffaa-control-surface:\s*var\(--color-surface-field\)/);
    expect(tokensCss).toMatch(/--ffaa-panel-background:[^;]*var\(--color-surface-card-secondary\)[^;]*var\(--color-surface-card-primary\)/);
  });

  it("covers nested tile families across every routed product area", () => {
    const routedSurfaceCss = `${refinementCss}\n${globalsCss}\n${toolsCss}\n${historyCss}`;
    const nestedTileFamilies = [
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
    ];

    for (const selector of nestedTileFamilies) expect(routedSurfaceCss).toContain(selector);
  });

  it("keeps active and position-tinted child states above the neutral layer", () => {
    expect(toolsCss).toMatch(/\.schedule-presets button\.is-active\s*\{[^}]*var\(--color-border-brand\)[^}]*var\(--color-surface-selected\)/s);
    expect(refinementCss).toMatch(/\.offline-board-wrap \.team-slot-line\.is-filled\s*\{[^}]*var\(--team-slot-color\)[^}]*var\(--ffaa-surface-raised\)/s);
  });

  it("keeps position-colored outer cards without a nested green Team Rater control", () => {
    expect(toolsCss).toMatch(/\.team-slot-control\s*\{[^}]*padding:\s*10px[^}]*border:\s*1px solid[^}]*var\(--slot-color\)[^}]*background:\s*color-mix[^}]*var\(--slot-color\)/s);
    expect(toolsCss).toMatch(/\.auction-slot-control\s*\{[^}]*padding:\s*10px[^}]*border:\s*1px solid[^}]*var\(--slot-color\)[^}]*background:\s*color-mix[^}]*var\(--slot-color\)/s);
    expect(teamRaterSource).toContain('"--slot-color": positionColorVar(position)');
    expect(auctionTeamBuilderSource).toContain('"--slot-color": positionColorVar(slot)');
    expect(toolsCss).not.toMatch(/\.(?:team|auction)-slot-control\[data-position=/);
    expect(toolsCss).toMatch(/\.team-slot-control\s*>\s*span\s*\{[^}]*var\(--slot-color\)/s);
    expect(toolsCss).toMatch(/\.auction-slot-control\s*>\s*span\s*\{[^}]*var\(--slot-color\)/s);
    expect(toolsCss).toMatch(/\.team-slot-stepper input\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s);
    expect(refinementCss).toMatch(/\.team-slot-stepper \.ffaa-number-stepper\s*\{[^}]*border:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);

    const nestedControlSurfaceRules: string[] = [];
    postcss.parse(refinementCss).walkRules((rule) => {
      if (!rule.selectors.includes(".team-slot-stepper input")) return;
      const hasControlSurface = rule.nodes.some(
        (node) => node.type === "decl" && node.prop === "background" && node.value.includes("--ffaa-control-surface"),
      );
      if (hasControlSurface) nestedControlSurfaceRules.push(rule.selector);
    });
    expect(nestedControlSurfaceRules).toEqual([]);
  });
});
