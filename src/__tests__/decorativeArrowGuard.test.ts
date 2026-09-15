import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(projectRoot, "src");
const adjacentSeasonPagination = "src/features/league-history/ui/pages/SeasonsPage.tsx";
const recapComparisons = [
  { path: "src/features/weekly-recap/RecapGraphics.tsx", label: 'aria-label="replace with"' },
  { path: "src/features/weekly-recap/LeagueRecapArticle.tsx", label: 'aria-label="became"' },
];

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

describe("decorative arrow contract", () => {
  it("reserves right-arrow icons for directional controls and explicit before/after comparisons", () => {
    const uses = tsxFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("<ArrowRight") ? [relative(projectRoot, path).replace(/\\/g, "/")] : [];
    });

    expect(uses.sort()).toEqual([adjacentSeasonPagination, ...recapComparisons.map((entry) => entry.path)].sort());
    for (const comparison of recapComparisons) {
      const source = readFileSync(resolve(projectRoot, comparison.path), "utf8");
      expect(source.match(/<ArrowRight\b/g)).toHaveLength(1);
      expect(source).toContain(comparison.label);
    }

    const pagination = readFileSync(resolve(projectRoot, adjacentSeasonPagination), "utf8");
    expect(pagination.match(/<ArrowRight\b/g)).toHaveLength(1);
    expect(pagination).toContain('aria-label="Adjacent seasons"');
  });

  it("documents the no-decorative-arrow rule in the shared design contract", () => {
    const design = readFileSync(resolve(projectRoot, "DESIGN.md"), "utf8");
    expect(design).toContain("Do not append decorative right-arrow icons or glyphs");
    expect(design).toContain("chevrons remain appropriate for disclosure and dropdown state");
  });
});
