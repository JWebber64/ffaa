// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

import TeamBoard from "../components/draft/TeamBoard";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function declarationsFor(relativePath: string, selector: string) {
  const path = resolve(projectRoot, relativePath);
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
  it("renders the raised status rail outside the clipped team panel", () => {
    const { container } = render(
      <TeamBoard
        teams={[{ teamId: "offline-t1", name: "Team 1", budget: 200, spent: 0, roster: [] }]}
        rosterSlots={[{ slot: "QB", count: 1 }]}
        currentNominatorTeamId="offline-t1"
        highBidderTeamId="offline-t1"
      />
    );

    const cell = container.querySelector(".team-board-cell");
    const panel = container.querySelector(".team-panel");
    const badges = container.querySelector(".team-panel-status-badges");

    expect(badges?.parentElement).toBe(cell);
    expect(panel?.contains(badges)).toBe(false);
    expect(badges?.textContent).toContain("Nominating");
    expect(badges?.textContent).toContain("High bid");
  });

  it("reserves the status rail in both the shared and offline desktop layouts", () => {
    const board = declarationsFor("src/styles/globals.css", ".team-board-has-status-badges");
    const cell = declarationsFor("src/styles/globals.css", ".team-board-has-status-badges .team-board-cell");
    const badges = declarationsFor("src/styles/globals.css", ".team-panel-status-badges");
    const offlineBoard = declarationsFor(
      "src/styles/refinement.css",
      ".offline-board-wrap .team-board.team-board-has-status-badges"
    );

    expect(board.get("padding-top")).toBe("5px");
    expect(cell.get("position")).toBe("relative");
    expect(cell.get("padding-top")).toBe("22px");
    expect(badges.get("top")).toBe("2px");
    expect(badges.get("transform")).toBe("translateX(-50%)");
    expect(offlineBoard.get("padding-top")).toBe("5px");
  });
});
