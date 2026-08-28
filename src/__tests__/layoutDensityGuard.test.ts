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
      "src/screens_v2/landing-v2.css": ["var(--type-display-hero)", "var(--space-section-gap)", "aspect-ratio: 16 / 8"],
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

  it("keeps the homepage product-led without replacing real features with a mock dashboard", () => {
    const landing = readProjectFile("src/screens_v2/LandingV2.tsx");
    const styles = readProjectFile("src/screens_v2/landing-v2.css");

    expect(landing).not.toContain("platform-preview-frame");
    expect(landing).not.toContain("Product preview");
    expect(landing).not.toContain("platform-promise");
    expect(landing).not.toContain("Explore Demo League");
    expect(landing).toContain("Stats & Research");
    expect(landing).toContain("Analytics & Values");
    expect(landing).toContain("Draft Rooms & Tools");
    expect(landing).toContain("League HQ & History");
    expect(styles).not.toContain(".platform-preview-frame");
    expect(styles).toContain("aspect-ratio: 16 / 8");
    expect(styles).toContain(".platform-feature-index");
    expect(styles).toContain(".platform-chapters article > figure");
  });

  it("keeps the homepage canvas quiet and the content card-led", () => {
    const landing = readProjectFile("src/screens_v2/LandingV2.tsx");
    const styles = readProjectFile("src/screens_v2/landing-v2.css");

    expect(styles).not.toContain("--platform-home-canvas:");
    expect(styles).not.toContain(".platform-home::before");
    expect(styles).toMatch(/\.platform-hero \{[\s\S]*?background: var\(--color-surface-card-primary\)/);
    expect(styles).toMatch(/\.platform-feature-index \{[\s\S]*?background: var\(--color-surface-card-secondary\)/);
    expect(styles).toMatch(/\.platform-chapters \{[\s\S]*?background: var\(--color-surface-card-primary\)/);
    expect(styles).toContain("white-space: nowrap");
    expect(styles).toContain(".platform-hero-actions .platform-secondary-link");
    expect(styles).toContain("border-radius: var(--r-md)");
    expect(styles).toContain("padding: 0 var(--space-4)");
    expect(landing).not.toContain("platform-feature-card");
    expect(landing).not.toContain("platform-chapter-card");
  });

  it("documents why ordinary cards and heroes stay natural-height", () => {
    const design = readProjectFile("DESIGN.md");
    expect(design).toContain("This is an information-dense product, not a poster.");
    expect(design).toContain("Page heroes and cards use natural height.");
    expect(design).toContain("900px-tall desktop viewport");
  });

  it("packs repeated participant editing into compact desktop columns", () => {
    const component = readProjectFile("src/features/draft-order/ParticipantSetup.tsx");
    const styles = readProjectFile("src/features/draft-order/draft-order.css");
    const design = readProjectFile("DESIGN.md");

    expect(component).toContain('className="participant-editor-table"');
    expect(component).toContain('className="participant-editor-header"');
    expect(component).toContain('className="participant-editor-header-group"');
    expect(styles).toContain(".participant-editor-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }");
    expect(styles).toContain(".participant-editor-list input { width: 100%; min-height: 30px;");
    expect(design).toContain("Repeated editable data belongs in one compact list or table shell.");
    expect(design).toContain("do not turn every record into a padded card");
    expect(design).toContain("pack independent records into two or more columns");
    expect(design).toContain("10-12-record single-line editor should occupy roughly 250-350px vertically");
  });
});
