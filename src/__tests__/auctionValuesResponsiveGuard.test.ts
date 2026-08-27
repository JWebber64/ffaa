import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/features/auction-values/auction-values.css"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

describe("auction value route responsive and print guards", () => {
  it("keeps the comparison intentionally scrollable with a sticky player column", () => {
    expect(css).toContain(".auction-table-region");
    expect(css).toMatch(/\.auction-table-region\s*\{[^}]*overflow:\s*auto/s);
    expect(css).toMatch(/\.auction-comparison-table \.auction-player-column[\s\S]*?position:\s*sticky/);
    expect(css).toContain(".auction-mobile-stack.is-active");
  });

  it("defines ink-friendly print output and repeated table headers", () => {
    expect(css).toContain("@media print");
    expect(css).toContain("background: #fff !important");
    expect(css).toContain("display: table-header-group");
    expect(css).toContain("break-inside: avoid");
  });

  it("registers direct, sheet, and print routes", () => {
    expect(app).toContain('<Route path="/auction-values"');
    expect(app).toContain('<Route path="/auction-values/source/:sourceId"');
    expect(app).toContain('<Route path="/auction-values/print"');
  });
});
