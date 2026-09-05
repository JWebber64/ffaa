import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const projectPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(projectPath);
    return /\.(css|ts|tsx)$/.test(entry.name) ? [projectPath] : [];
  });
}

function hueAndSaturation(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation: max === 0 ? 0 : delta / max };
}

function prohibitedInterfaceColors(path: string) {
  const source = readProjectFile(path).replace(/^\s*--pos-[^:]+:.*$/gm, "");
  return [...source.matchAll(/#([0-9a-f]{6})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/gi)]
    .flatMap((match) => {
      const red = match[1] ? Number.parseInt(match[1].slice(0, 2), 16) : Number(match[2]);
      const green = match[1] ? Number.parseInt(match[1].slice(2, 4), 16) : Number(match[3]);
      const blue = match[1] ? Number.parseInt(match[1].slice(4, 6), 16) : Number(match[4]);
      const { hue, saturation } = hueAndSaturation(red, green, blue);
      return hue >= 165 && hue <= 260 && saturation >= 0.12 ? [match[0]] : [];
    });
}

describe("shared Bosco, Ruggine, Sabbia, and Fumo visual system", () => {
  it("defines every site-wide element role in the shared token owner", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const roles = [
      "--color-surface-page",
      "--color-surface-header",
      "--color-surface-card-primary",
      "--color-surface-card-secondary",
      "--color-surface-card-tertiary",
      "--color-surface-warm",
      "--color-surface-warm-subtle",
      "--color-surface-field",
      "--color-surface-field-hover",
      "--color-surface-selected",
      "--color-surface-menu",
      "--color-surface-toolbar",
      "--color-surface-table-header",
      "--color-surface-table-row",
      "--color-surface-table-warm-row",
      "--color-surface-table-warm-row-alt",
      "--color-surface-table-warm-row-hover",
      "--color-surface-badge-brand",
      "--color-chart-plot",
      "--color-chart-grid",
      "--color-chart-axis",
      "--color-chart-axis-muted",
      "--color-chart-reference",
      "--color-chart-series-neutral",
      "--color-chart-series-neutral-point",
      "--color-chart-series-positive",
      "--color-chart-series-negative",
      "--color-chart-track",
      "--color-border-default",
      "--color-border-brand",
      "--color-border-on-warm",
      "--color-button-primary-border",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-text-on-warm",
      "--color-text-on-warm-secondary",
      "--color-text-on-warm-accent",
      "--color-text-link",
      "--color-button-primary",
      "--color-button-secondary",
      "--color-button-quiet-hover",
      "--color-field-focus",
      "--color-status-success",
      "--color-status-warning",
      "--color-status-danger",
    ];

    for (const role of roles) expect(tokens).toContain(`${role}:`);
    expect(tokens).toContain("--green-50:");
    expect(tokens).toContain("--green-950:");
    expect(tokens).toContain("--gray-50:");
    expect(tokens).toContain("--gray-950:");
  });

  it("keeps the approved palette and hierarchy exact", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const design = readProjectFile("DESIGN.md");

    for (const assignment of [
      "--brand-verde-bosco: #365a43",
      "--brand-ruggine: #9c4f31",
      "--brand-sabbia: #d8c6a8",
      "--brand-fumo: #353a38",
      "--color-surface-page: var(--brand-verde-bosco)",
      "--color-button-primary: var(--brand-ruggine)",
      "--color-surface-header: var(--gray-800)",
      "--color-surface-warm: var(--brand-sabbia)",
    ]) expect(tokens).toContain(assignment);

    expect(design).toContain('verde-bosco: "#365A43"');
    expect(design).toContain('ruggine: "#9C4F31"');
    expect(design).toContain('sabbia: "#D8C6A8"');
    expect(design).toContain('grigio-fumo: "#353A38"');
    expect(design).toContain("Do keep Verde Bosco dominant");
    expect(design).toContain("Do use the shared Ruggine role for every primary button");
    expect(design).toContain("Do give Sabbia ownership of a visible surface region");
    expect(design).toContain("Do not reduce Sabbia to text and border tint");
  });

  it("gives Sabbia substantial, contrast-safe surface ownership", () => {
    const landing = readProjectFile("src/screens_v2/landing-v2.css");
    const tools = readProjectFile("src/screens/tools/tools.css");
    const auction = readProjectFile("src/features/auction-values/auction-values.css");
    const refinement = readProjectFile("src/styles/refinement.css");

    expect(landing).toMatch(/\.platform-hero-copy \{[\s\S]*?background: var\(--color-surface-warm\)/);
    expect(landing).toMatch(/\.platform-hero-copy \{[\s\S]*?color: var\(--color-text-on-warm\)/);
    expect(tools).toMatch(/\.tools-principles \{[\s\S]*?background: var\(--color-surface-warm\)/);
    expect(auction).toMatch(/\.auction-source-model \{[\s\S]*?background: var\(--color-surface-warm\)/);
    expect(refinement).toMatch(/\.stats-hub \.stats-hub-source-strip \{[\s\S]*?background: var\(--color-surface-warm\)/);
    expect(refinement).toMatch(/\.analytics-lab \.analytics-attribution \{[\s\S]*?background: var\(--color-surface-warm\)/);
  });

  it("uses exact Sabbia for chart backgrounds without replacing position semantics", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const charts = readProjectFile("src/styles/globals.css");
    const scatter = readProjectFile("src/components/analytics/AnalyticsScatterPlot.tsx");
    const design = readProjectFile("DESIGN.md");

    expect(tokens).toContain("--color-chart-plot: var(--brand-sabbia)");
    expect(tokens).toContain("--color-chart-axis: var(--gray-950)");
    expect(tokens).toContain("--color-chart-series-neutral: var(--green-700)");
    expect(charts).toMatch(/\.stats-sparkline \{[\s\S]*?background: var\(--color-chart-plot\)/);
    expect(charts).toMatch(/\.stats-sparkline polyline \{[\s\S]*?stroke: var\(--color-chart-series-neutral\)/);
    expect(charts).toMatch(/\.analytics-scatter-frame \{[\s\S]*?background: var\(--color-chart-plot\)/);
    expect(charts).toMatch(/\.analytics-grid-line \{[\s\S]*?stroke: var\(--color-chart-grid\)/);
    expect(charts).toMatch(/\.analytics-axis-label \{[\s\S]*?fill: var\(--color-chart-axis\)/);
    expect(charts).toMatch(/\.analytics-ranked-bars \{[\s\S]*?background: var\(--color-chart-plot\)/);
    expect(charts).toMatch(/\.analytics-ranked-track \.is-neutral \{ background: var\(--color-chart-series-neutral\); \}/);
    expect(scatter).toContain("fill={positionColorVar(point.position)}");
    expect(design).toContain("Charts and graphs use exact Sabbia as the plot-area background");
    expect(design).toContain("Do not recolor position-coded chart points or legends to Sabbia");
    expect(design).toContain("Do not use Sabbia for a plotted line or mark when the chart already uses Sabbia as its background");
  });

  it("uses Sabbia as the Stats Hub research-table background", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const refinement = readProjectFile("src/styles/refinement.css");
    const design = readProjectFile("DESIGN.md");

    expect(tokens).toContain("--color-surface-table-warm-row: var(--brand-sabbia)");
    expect(refinement).toMatch(/\.stats-hub \.stats-hub-table-shell \{[\s\S]*?background: var\(--color-surface-table-warm-row\)/);
    expect(refinement).toMatch(/\.stats-hub \.stats-hub-table th,[\s\S]*?background: var\(--color-surface-table-header\)/);
    expect(refinement).toMatch(/\.stats-hub \.stats-hub-table tbody tr \{[\s\S]*?--stats-hub-row-background: var\(--color-surface-table-warm-row\)/);
    expect(refinement).toMatch(/\.stats-hub \.stats-hub-player-copy strong \{[\s\S]*?color: var\(--color-text-on-warm\)/);
    expect(design).toContain("The Stats Hub research table uses exact Sabbia as its continuous body background");
  });

  it("uses Sabbia across the Schedule Lab matchup matrix", () => {
    const tools = readProjectFile("src/screens/tools/tools.css");
    const design = readProjectFile("DESIGN.md");

    expect(tools).toMatch(/\.schedule-table-shell \{[\s\S]*?background: var\(--color-surface-table-warm-row\)/);
    expect(tools).toMatch(/\.schedule-table thead th \{[\s\S]*?background: var\(--color-surface-table-header\)/);
    expect(tools).toMatch(/\.schedule-table tbody tr \{[\s\S]*?--schedule-row-background: var\(--color-surface-table-warm-row\)/);
    expect(tools).toMatch(/\.schedule-table tbody td:first-child \{[\s\S]*?background: var\(--schedule-row-background\)/);
    expect(tools).toMatch(/\.schedule-cell \{[\s\S]*?background: var\(--schedule-row-background\)/);
    expect(tools).toMatch(/\.schedule-cell\.is-favorable \{ color: var\(--green-800\); \}/);
    expect(tools).toMatch(/\.schedule-cell\.is-tough \{ color: var\(--rust-700\); \}/);
    expect(design).toContain("The Schedule Lab matchup matrix uses Sabbia only for the graph-like data canvas");
  });

  it("keeps the shared product header lighter than the page canvas", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const shell = readProjectFile("src/layouts/app-shell.css");
    const design = readProjectFile("DESIGN.md");

    expect(tokens).toContain("--color-surface-header: var(--gray-800)");
    expect(shell).toContain("var(--color-surface-header) 98%");
    expect(shell).not.toContain("var(--surface-canvas) 94%");
    expect(design).toContain('color-surface-header: "{colors.gray-800}"');
  });

  it("preserves the established semantic color for each football position", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const positionAssignments = [
      "--pos-qb: #dc2626",
      "--pos-rb: #16a34a",
      "--pos-wr: #2563eb",
      "--pos-te: #ea580c",
      "--pos-flex: #0891b2",
      "--pos-k: #9333ea",
      "--pos-dst: #4b5563",
      "--pos-bench: var(--gray-500)",
      "--pos-foreground-light: oklch(1 0 0)",
      "--pos-foreground-dark: var(--gray-950)",
    ];

    for (const assignment of positionAssignments) expect(tokens).toContain(assignment);
  });

  it("does not allow blue, cyan, or teal literals outside semantic position and team identity", () => {
    const exclusions = new Set(["src/data/nflTeamBrand.ts"]);
    const failures = sourceFiles("src")
      .filter((path) => !exclusions.has(path))
      .flatMap((path) => prohibitedInterfaceColors(path).map((color) => `${path}: ${color}`));

    expect(failures).toEqual([]);
  });

  it("keeps the League HQ field and story cards on shared element roles", () => {
    const league = readProjectFile("src/screens/league-hq.css");

    expect(league).toMatch(/\.league-sync-select,[\s\S]*?background: var\(--color-surface-field\)/);
    expect(league).toMatch(/\.league-pulse \{[^}]*background: var\(--color-surface-card-primary\)/);
    expect(league).toMatch(/\.league-pulse-track article \{[^}]*background: var\(--color-surface-card-secondary\)/);
  });

  it("keeps shared and route-level primary actions on one semantic color", () => {
    const consumers: Record<string, string[]> = {
      "src/styles/refinement.css": [".ui-button-primary", "var(--color-button-primary)"],
      "src/layouts/app-shell.css": [".shell-primary-action", "var(--color-button-primary)"],
      "src/screens_v2/landing-v2.css": [".platform-primary-link", "var(--color-button-primary)"],
      "src/screens/tools/tools.css": [".tool-button.is-primary", "var(--color-button-primary)"],
      "src/screens/league-hq.css": [".league-link-button", "var(--color-button-primary)"],
      "src/screens/my-hq.css": [".hq-primary-link", "var(--color-button-primary)"],
      "src/ui/Button.tsx": ["ui-button-${variant}", "var(--color-button-primary)"],
    };

    for (const [path, required] of Object.entries(consumers)) {
      const source = readProjectFile(path);
      for (const token of required) expect(source, `${path} should include ${token}`).toContain(token);
      expect(source, `${path} should use the Ruggine button border role`).toContain("var(--color-button-primary-border)");
    }
  });

  it("keeps the major route families connected to purposeful editorial imagery", () => {
    const shell = readProjectFile("src/layouts/AppShellV2.tsx");
    const refinement = readProjectFile("src/styles/refinement.css");
    const myHq = readProjectFile("src/screens/my-hq.css");

    expect(shell).toContain("--draft-editorial-image");
    expect(shell).toContain("--research-editorial-image");
    expect(shell).toContain("--league-editorial-image");
    expect(refinement).toContain("var(--draft-editorial-image)");
    expect(refinement).toContain("var(--research-editorial-image)");
    expect(refinement).toContain("var(--league-editorial-image)");
    expect(myHq).toContain("var(--league-editorial-image)");
  });

  it("keeps editorial photography in its natural color", () => {
    const directPhotoStyles = [
      "src/screens_v2/landing-v2.css",
      "src/screens/tools/tools.css",
      "src/screens/league-hq.css",
    ];
    const editorialBackgroundStyles = [
      "src/styles/refinement.css",
      "src/screens/tools/tools.css",
      "src/screens/league-hq.css",
      "src/screens/my-hq.css",
      "src/features/league-history/ui/league-history.css",
    ];

    for (const path of directPhotoStyles) {
      expect(readProjectFile(path), `${path} should not color-grade photography`).not.toMatch(
        /filter:\s*[^;]*(?:grayscale|sepia|hue-rotate|saturate|brightness)\b/i,
      );
    }

    for (const path of editorialBackgroundStyles) {
      expect(readProjectFile(path), `${path} should not use luminosity blending on photography`).not.toContain(
        "luminosity",
      );
    }
  });
});
