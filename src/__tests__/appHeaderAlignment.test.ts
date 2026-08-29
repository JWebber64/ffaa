import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shellCss = readFileSync(resolve(process.cwd(), "src/layouts/app-shell.css"), "utf8");

describe("app header control alignment", () => {
  it("keeps the league label, select, and draft action on one aligned row", () => {
    expect(shellCss).toMatch(
      /\.league-context-control\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s,
    );
    expect(shellCss).toMatch(
      /\.league-context-control\s*>\s*span\s*\{[^}]*white-space:\s*nowrap;/s,
    );
  });

  it("uses one explicit height for the league field and primary action", () => {
    expect(shellCss).toContain("--app-header-control-height: 44px");
    expect(shellCss).toMatch(
      /\.league-context-select\s*\{[^}]*height:\s*var\(--app-header-control-height\);[^}]*min-height:\s*var\(--app-header-control-height\);/s,
    );
    expect(shellCss).toMatch(
      /\.shell-primary-action\s*\{[^}]*height:\s*var\(--app-header-control-height\);[^}]*min-height:\s*var\(--app-header-control-height\);/s,
    );
  });
});
