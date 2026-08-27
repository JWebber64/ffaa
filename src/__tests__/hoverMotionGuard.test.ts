import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(projectRoot, "src");

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) return listSourceFiles(path);
    if (!entry.isFile()) return [];

    return [".css", ".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("stationary hover feedback", () => {
  it("does not move cards or controls upward on hover", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((path) => {
      if (path.endsWith("hoverMotionGuard.test.ts")) return [];

      const source = readFileSync(path, "utf8");
      const cssHoverLift = /[^{}]*:hover[^{}]*\{[^{}]*transform\s*:\s*translateY\(\s*-/gis;
      const componentHoverLift = /_hover\s*=\s*\{\{(?:(?!\}\}).)*translateY\(\s*-/gis;
      const utilityHoverLift = /(?:group-)?hover:-translate-y-[^\s"'`]+/gi;

      return [
        ...source.matchAll(cssHoverLift),
        ...source.matchAll(componentHoverLift),
        ...source.matchAll(utilityHoverLift),
      ].map((match) => `${path.slice(projectRoot.length + 1)}: ${match[0].trim()}`);
    });

    expect(violations).toEqual([]);
  }, 15_000);
});
