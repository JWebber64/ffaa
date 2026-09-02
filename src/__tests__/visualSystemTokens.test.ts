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

describe("shared green and gray visual system", () => {
  it("defines every site-wide element role in the shared token owner", () => {
    const tokens = readProjectFile("src/styles/tokens.css");
    const roles = [
      "--color-surface-page",
      "--color-surface-header",
      "--color-surface-card-primary",
      "--color-surface-card-secondary",
      "--color-surface-card-tertiary",
      "--color-surface-field",
      "--color-surface-field-hover",
      "--color-surface-selected",
      "--color-surface-menu",
      "--color-surface-toolbar",
      "--color-surface-table-header",
      "--color-surface-table-row",
      "--color-surface-badge-brand",
      "--color-border-default",
      "--color-border-brand",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-muted",
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
