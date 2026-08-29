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

describe("team board status badges", () => {
  it("keeps the top badges inside a reserved rail instead of straddling the clipped panel edge", () => {
    const board = declarationsFor(".team-board-has-status-badges");
    const cell = declarationsFor(".team-board-has-status-badges .team-board-cell");
    const badges = declarationsFor(".team-panel-status-badges");

    expect(board.get("padding-top")).toBe("5px");
    expect(cell.get("position")).toBe("relative");
    expect(cell.get("padding-top")).toBe("22px");
    expect(badges.get("top")).toBe("-22px");
    expect(badges.get("transform")).toBe("translateX(-50%)");
  });
});
