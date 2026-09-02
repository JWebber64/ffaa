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
    expect(badge.style.backgroundColor).toBe("var(--pos-rb)");
  });

  it("keeps every standalone position marker on the shared badge primitive", () => {
    const consumers = [
      ["src/components/manager/MobileManagerDraftView.tsx", "mobile-player-pos"],
      ["src/components/manager/MobileManagerDraftView.tsx", "mobile-roster-slot"],
      ["src/components/roster/RosterRow.tsx", "roster-pill"],
      ["src/components/draft/TeamBoard.tsx", "team-slot-line-label"],
      ["src/screens_v2/DraftRoomV2.tsx", "team-detail-slot"],
      ["src/screens_v2/OfflineDraftV2.tsx", "offline-roster-slot-static"],
      ["src/screens/tools/TeamRater.tsx", "tool-position-tag"],
      ["src/screens/tools/AuctionTeamBuilder.tsx", "tool-position-tag"],
      ["src/features/auction-values/SourceSheet.tsx", "auction-position-chip"],
      ["src/features/auction-values/ComparisonTable.tsx", "auction-position-chip"],
    ] as const;

    for (const [path, className] of consumers) {
      const source = readFileSync(resolve(projectRoot, path), "utf8");
      expect(source, `${path} must render ${className} through PositionBadge`).toMatch(
        new RegExp(`<PositionBadge[^>]*className=["']${className}["']`, "s"),
      );
    }
  });

  it("does not remix the background of standalone position markers", () => {
    const markerClasses = [
      "auction-position-chip",
      "hq-position",
      "league-position",
      "mobile-player-pos",
      "mobile-roster-slot",
      "offline-roster-slot-static",
      "roster-pill",
      "stats-pos-pill",
      "team-detail-slot",
      "team-slot-line-label",
      "tool-position-tag",
    ];
    const remixedRules = sourceFiles("src")
      .filter((path) => path.endsWith(".css"))
      .flatMap((path) => {
        const source = readFileSync(resolve(projectRoot, path), "utf8");
        return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) => {
          const rule = match[0];
          const selector = match[1] ?? "";
          const declarations = match[2] ?? "";
          const isMarkerRule = markerClasses.some((className) => selector.includes(`.${className}`));
          const remixesBackground = /background(?:-color)?\s*:\s*color-mix\(/.test(declarations);
          return isMarkerRule && remixesBackground ? [`${path}: ${rule.trim()}`] : [];
        });
      });

    expect(remixedRules).toEqual([]);
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
