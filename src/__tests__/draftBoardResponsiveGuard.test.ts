import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function declarationsFor(selector: string) {
  const path = resolve(projectRoot, "src/styles/globals.css");
  const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
  const declarations = new Map<string, string>();

  root.walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });

  return declarations;
}

describe("draft board responsive guard", () => {
  it("keeps 12-team desktop columns shrinkable instead of clipping the last team", () => {
    expect(declarationsFor(".team-panel").get("grid-template-columns")).toBe("minmax(0, 1fr)");
    expect(declarationsFor(".team-panel-meta-row").get("grid-template-columns")).toBe(
      "repeat(3, minmax(0, 1fr))"
    );
  });
});
