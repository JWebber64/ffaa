import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("document scroll owner guard", () => {
  it("does not turn body or the React root into nested vertical scroll containers", () => {
    const path = resolve(projectRoot, "src/styles/globals.css");
    const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
    const violations: string[] = [];

    root.walkRules((rule) => {
      const selectors = rule.selectors ?? [];
      if (!selectors.some((selector) => ["html", "body", "#root"].includes(selector.trim()))) return;

      rule.walkDecls((declaration) => {
        const value = declaration.value.trim().toLowerCase();
        const createsVerticalScroller =
          (declaration.prop === "overflow-x" && value === "hidden") ||
          (declaration.prop === "overflow-y" && ["auto", "scroll", "hidden"].includes(value)) ||
          (declaration.prop === "overflow" && ["auto", "scroll", "hidden"].includes(value));

        if (createsVerticalScroller) {
          violations.push(`${rule.selector}: ${declaration.prop}: ${declaration.value}`);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
