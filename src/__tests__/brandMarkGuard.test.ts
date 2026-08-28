import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const shellSource = readFileSync(resolve(projectRoot, "src/layouts/AppShellV2.tsx"), "utf8");
const shellCss = readFileSync(resolve(projectRoot, "src/layouts/app-shell.css"), "utf8");
const brandImage = resolve(projectRoot, "public/images/football-header-mark.jpg");

describe("Fantasy Football header mark", () => {
  it("uses the optimized football image instead of the FF placeholder", () => {
    expect(existsSync(brandImage)).toBe(true);
    expect(statSync(brandImage).size).toBeLessThan(50_000);
    expect(shellSource).toContain('src={appUrl("images/football-header-mark.jpg")}');
    expect(shellSource).not.toContain(">FF</span>");
    expect(shellCss).toContain(".product-shell .app-brand-image img");
  });
});
