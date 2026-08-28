import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  });
}

describe("field arrow consistency", () => {
  it("documents the shared select and centered field-arrow rules", () => {
    const design = readFileSync(resolve(projectRoot, "DESIGN.md"), "utf8");

    expect(design).toContain("shared custom select trigger and its single down chevron");
    expect(design).toContain("centered on both axes");
    expect(design).toContain("Do not expose browser-native select arrows");
  });

  it("routes every product select through UniversalSelect", () => {
    const violations = collectTsxFiles(resolve(projectRoot, "src")).flatMap((path) => {
      if (path.endsWith("UniversalSelect.tsx") || path.includes(`${sep}__tests__${sep}`)) return [];
      const source = readFileSync(path, "utf8");
      return /<select(?:\s|>)/.test(source) ? [path.replace(`${projectRoot}${sep}`, "")] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps one shared glyph and explicit two-axis centering in the control CSS", () => {
    const numericInput = readFileSync(resolve(projectRoot, "src/ui/NumericInput.tsx"), "utf8");
    const universalSelect = readFileSync(resolve(projectRoot, "src/ui/UniversalSelect.tsx"), "utf8");
    const globals = readFileSync(resolve(projectRoot, "src/styles/globals.css"), "utf8");

    expect(numericInput).toContain('<ControlChevron kind="stepper" />');
    expect(universalSelect).toContain('<ControlChevron kind="select" />');
    expect(globals).toMatch(/\.ffaa-custom-select-icon\s*\{[\s\S]*?place-items:\s*center;/);
    expect(globals).toMatch(/\.ffaa-number-stepper-visual\s*\{[\s\S]*?place-items:\s*center;/);
  });
});
