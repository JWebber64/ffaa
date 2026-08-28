import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const guardedExtensions = new Set([".css", ".jsx", ".tsx"]);

function collectGuardedFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectGuardedFiles(path);
    return guardedExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("app-wide one-sided accent guard", () => {
  it("documents the full-container state rule", () => {
    const design = readFileSync(resolve(projectRoot, "DESIGN.md"), "utf8");

    expect(design).toContain("Do not use decorative left-edge stripes");
    expect(design).toContain("nested inputs stay transparent");
    expect(design).toContain("## No AI slop");
    expect(design).toContain("must never be shown with a highlighted side of a card");
  });

  it("keeps the approved draft-order photography instead of placeholder SVG art", () => {
    const artwork = readFileSync(
      resolve(projectRoot, "src/features/draft-order/ModeArtwork.tsx"),
      "utf8",
    );

    expect(artwork).toContain("images/draft-order/draft-dash.jpg");
    expect(artwork).toContain("images/draft-order/football-plinko.jpg");
    expect(artwork).toContain("images/draft-order/punt-bounce.jpg");
    expect(artwork).not.toContain("<svg");
  });

  it("rejects decorative left-edge accent signatures", () => {
    const prohibited = [
      /inset\s+[1-9]\d*(?:\.\d+)?px\s+0\s+0/i,
      /border-left\s*:\s*[2-9]\d*(?:\.\d+)?px/i,
      /border-left-width\s*:\s*[1-9]/i,
      /border-l-\[/i,
    ];
    const violations = collectGuardedFiles(resolve(projectRoot, "src")).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return prohibited
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${path.replace(`${projectRoot}\\`, "")}: ${pattern.source}`);
    });

    expect(violations).toEqual([]);
  });
});
