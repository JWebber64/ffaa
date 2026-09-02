// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionBadge } from "../ui/PositionBadge";
import {
  POSITION_COLOR_KEYS,
  positionClassName,
  positionColorKey,
  positionColorVar,
} from "../ui/positionColors";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const projectPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(projectPath);
    return /\.(css|ts|tsx)$/.test(entry.name) ? [projectPath] : [];
  });
}

afterEach(cleanup);

describe("canonical position color system", () => {
  it("normalizes numbered lineup slots and common provider aliases", () => {
    expect([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR3",
      "TE",
      "FLEX",
      "RB/WR/TE",
      "REC_FLEX",
      "WRRB_FLEX",
      "SUPER_FLEX",
      "BN6",
      "TAXI",
      "DEF",
      "D/ST",
      "IDP_FLEX",
    ].map(positionColorKey)).toEqual([
      "qb",
      "rb",
      "rb",
      "wr",
      "wr",
      "te",
      "flex",
      "flex",
      "flex",
      "flex",
      "flex",
      "bench",
      "bench",
      "dst",
      "dst",
      "idpflex",
    ]);
    expect(positionClassName("WR2")).toBe("pos-wr");
    expect(positionColorVar("WR2")).toBe("var(--pos-wr)");
  });

  it("renders every badge through the normalized semantic token", () => {
    render(<PositionBadge position="RB2">RB2</PositionBadge>);

    const badge = screen.getByText("RB2");
    expect(badge.classList.contains("pos-rb")).toBe(true);
    expect(badge.getAttribute("data-position-color")).toBe("rb");
    expect(badge.style.getPropertyValue("--position-color")).toBe("var(--pos-rb)");
  });

  it("keeps raw values in one token owner and blocks synthesized position classes", () => {
    const runtimeFiles = sourceFiles("src");
    const dynamicClassViolations = runtimeFiles.flatMap((path) => {
      if (path === "src/ui/positionColors.ts") return [];
      const source = readFileSync(resolve(projectRoot, path), "utf8");
      return /(?:pos-|--pos-)\$\{/.test(source) ? [path] : [];
    });
    const tokenDefinition = new RegExp(`--pos-(?:${POSITION_COLOR_KEYS.join("|")})\\s*:`);
    const tokenOwnerViolations = runtimeFiles.flatMap((path) => {
      if (path === "src/styles/tokens.css") return [];
      const source = readFileSync(resolve(projectRoot, path), "utf8");
      return tokenDefinition.test(source) ? [path] : [];
    });

    expect(dynamicClassViolations).toEqual([]);
    expect(tokenOwnerViolations).toEqual([]);
  });

  it("keeps the Player Pool position-rank marker on the shared badge", () => {
    const playerPool = readFileSync(resolve(projectRoot, "src/components/PlayerPool.tsx"), "utf8");

    expect(playerPool).toMatch(/<PositionBadge[^>]*position=\{player\.pos\}[^>]*title="Position Rank">/s);
    expect(playerPool).not.toMatch(/<Badge[^>]*title="Position Rank">/s);
  });
});
