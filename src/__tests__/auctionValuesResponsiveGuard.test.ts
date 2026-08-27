import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/features/auction-values/auction-values.css"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/features/auction-values/AuctionValuesPage.tsx"), "utf8");
const directory = readFileSync(resolve(process.cwd(), "src/features/auction-values/SourceDirectory.tsx"), "utf8");
const globalDefinitions = [
  "src/styles/tokens.css",
  "src/styles/globals.css",
  "src/styles/refinement.css",
  "src/features/auction-values/auction-values.css",
  "src/layouts/AppShellV2.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n");

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

  it("keeps the comparison ahead of a collapsed, bounded source library", () => {
    expect(page.indexOf('className="auction-comparison-workspace"')).toBeLessThan(page.indexOf('className="auction-source-library"'));
    expect(page).toContain('<details className="auction-source-library">');
    expect(directory).toContain("props.sources.slice(0, 8)");
    expect(css).not.toContain("font-size: .47rem");
  });

  it("defines every custom property consumed by the Auction Values stylesheet", () => {
    const used = [...css.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((match) => match[1]);
    const defined = new Set([...globalDefinitions.matchAll(/["']?(--[a-zA-Z0-9-]+)["']?\s*:/g)].map((match) => match[1]));
    expect([...new Set(used)].filter((name) => !defined.has(name))).toEqual([]);
  });
});
