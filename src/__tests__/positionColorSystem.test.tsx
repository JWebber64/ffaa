// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AnalyticsScatterPlot } from "../components/analytics/AnalyticsScatterPlot";
import { SlotTile } from "../components/draft/SlotTile";
import { PositionBadge } from "../ui/PositionBadge";
import {
  POSITION_COLOR_KEYS,
  positionClassName,
  positionColorKey,
  positionColorVar,
  type PositionColorKey,
} from "../ui/positionColors";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const projectPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(projectPath);
    return /\.(css|ts|tsx)$/.test(entry.name) ? [projectPath] : [];
  });
}

function tokenValue(source: string, token: string) {
  const match = source.match(new RegExp(`--${token}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Missing CSS token --${token}`);
  return match[1].trim();
}

function resolveColorToken(source: string, token: string, visited = new Set<string>()): string {
  if (visited.has(token)) throw new Error(`Circular CSS token reference at --${token}`);
  visited.add(token);
  const value = tokenValue(source, token);
  const reference = value.match(/^var\(--([^)]+)\)$/)?.[1];
  return reference ? resolveColorToken(source, reference, visited) : value;
}

function colorToLinearRgb(color: string): [number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return [0, 2, 4].map((offset) => {
      const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  }

  const oklch = color.match(/^oklch\(([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\)$/i);
  if (!oklch) throw new Error(`Unsupported CSS color in contrast guard: ${color}`);
  const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
  const chroma = Number(oklch[3]);
  const hue = Number(oklch[4]) * Math.PI / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const [red, green, blue] = colorToLinearRgb(color);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
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
    expect(badge.style.color).toBe("var(--position-foreground, var(--pos-foreground-light))");
  });

  it("keeps every standalone position marker on the shared badge primitive", () => {
    const consumers = [
      ["src/components/auction/AuctionControls.tsx", 1],
      ["src/components/auction/NominationQueue.tsx", 1],
      ["src/components/draft/TeamBoard.tsx", 1],
      ["src/components/manager/MobileManagerDraftView.tsx", 2],
      ["src/components/PlayerPool.tsx", 2],
      ["src/components/roster/RosterRow.tsx", 1],
      ["src/components/unified/PlayerSearch.tsx", 1],
      ["src/features/auction-values/ComparisonTable.tsx", 1],
      ["src/features/auction-values/SourceSheet.tsx", 1],
      ["src/screens/DraftBoard.tsx", 2],
      ["src/screens/LeagueLineup.tsx", 2],
      ["src/screens/LeagueMatchups.tsx", 1],
      ["src/screens/LeaguePlayers.tsx", 1],
      ["src/screens/LeagueTeams.tsx", 1],
      ["src/screens/MyHQ.tsx", 2],
      ["src/screens/tools/AuctionTeamBuilder.tsx", 2],
      ["src/screens/tools/TeamRater.tsx", 1],
      ["src/screens_v2/DraftRoomV2.tsx", 1],
      ["src/screens_v2/OfflineDraftV2.tsx", 1],
    ] as const;

    for (const [path, count] of consumers) {
      const source = readFileSync(resolve(projectRoot, path), "utf8");
      expect(source.match(/<PositionBadge\b/g)?.length ?? 0, `${path} PositionBadge count`).toBe(count);
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
      "team-detail-slot",
      "team-slot-line-label",
      "tool-position-tag",
      "ffaa-position-badge",
    ];
    const markerRuleViolations = sourceFiles("src")
      .filter((path) => path.endsWith(".css"))
      .flatMap((path) => {
        const source = readFileSync(resolve(projectRoot, path), "utf8");
        return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) => {
          const rule = match[0];
          const selector = match[1] ?? "";
          const declarations = match[2] ?? "";
          const isMarkerRule = markerClasses.some((className) => selector.includes(`.${className}`));
          const remixesBackground = /background(?:-color)?\s*:\s*color-mix\(/.test(declarations);
          const declaresForeground = /(?:^|;)\s*color\s*:/i.test(declarations);
          const usesSharedForeground = /(?:^|;)\s*color\s*:\s*var\(--position-foreground/i.test(declarations);
          const forcesForeground = declaresForeground && !usesSharedForeground;
          return isMarkerRule && (remixesBackground || forcesForeground) ? [`${path}: ${rule.trim()}`] : [];
        });
      });

    expect(markerRuleViolations).toEqual([]);
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
    const localPositionMapViolations = runtimeFiles
      .filter((path) => /\.tsx?$/.test(path) && path !== "src/ui/positionColors.ts")
      .flatMap((path) => {
        const source = readFileSync(resolve(projectRoot, path), "utf8");
        const objectLiterals = Array.from(source.matchAll(/\{[^{}]{0,1200}\}/gs), (match) => match[0]);
        const hasLocalColorMap = objectLiterals.some((objectLiteral) => {
          const hasCorePositionKeys = ["qb", "rb", "wr", "te"].every((position) =>
            new RegExp(`["']?${position}["']?\\s*:`, "i").test(objectLiteral));
          const hasColorValue = /(?:#[0-9a-f]{3,8}|rgba?\(|oklch\(|color-mix\(|var\(--(?:pos|green|gray))/i.test(objectLiteral);
          return hasCorePositionKeys && hasColorValue;
        });
        return hasLocalColorMap ? [path] : [];
      });
    const positionSelectorViolations = runtimeFiles
      .filter((path) => path.endsWith(".css") && path !== "src/styles/tokens.css")
      .flatMap((path) => {
        const source = readFileSync(resolve(projectRoot, path), "utf8");
        return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) => {
          const selector = match[1] ?? "";
          const declarations = match[2] ?? "";
          const role = selector.match(/(?:is-|pos-|data-position\s*=\s*["']?)(qb|rb|wr|te|flex|k|dst|def|bench|ir|dl|lb|db|idpflex)/i)?.[1]?.toLowerCase();
          if (!role || !/(?:background|fill|stroke|--[\w-]*color)\s*:/.test(declarations)) return [];
          const expectedRole = role === "def" ? "dst" : role;
          const usesSharedColor = declarations.includes(`var(--pos-${expectedRole})`)
            || declarations.includes("var(--position-color");
          return usesSharedColor ? [] : [`${path}: ${match[0].trim()}`];
        });
      });

    expect(dynamicClassViolations).toEqual([]);
    expect(tokenOwnerViolations).toEqual([]);
    expect(localPositionMapViolations).toEqual([]);
    expect(positionSelectorViolations).toEqual([]);
  });

  it("uses the shared resolver for chart points, legends, and dormant slot tiles", () => {
    const positions = ["QB", "RB1", "WR3", "TE", "SUPER_FLEX", "K", "D/ST", "BN2", "IR", "DL", "LB", "DB", "IDP_FLEX"];
    const points = positions.map((position, index) => ({
      id: `${position}-${index}`,
      label: position,
      team: "FA",
      position,
      x: index,
      y: index * 2,
    }));
    const { container } = render(
      <>
        <AnalyticsScatterPlot
          title="Position colors"
          eyebrow="Test"
          description="Canonical chart colors"
          xLabel="X"
          yLabel="Y"
          points={points}
          emptyMessage="No points"
          formatX={String}
          formatY={String}
        />
        {positions.map((position) => <SlotTile key={position} slot={position} />)}
      </>,
    );

    const chartPoints = Array.from(container.querySelectorAll<SVGCircleElement>("circle[data-position-color]"));
    expect(chartPoints.map((point) => point.getAttribute("fill"))).toEqual(
      positions.map((position) => positionColorVar(position)),
    );
    expect(chartPoints.map((point) => point.dataset.positionColor)).toEqual(positions.map(positionColorKey));

    const legends = Array.from(container.querySelectorAll<HTMLElement>(".analytics-chart-legend"));
    expect(legends.map((legend) => legend.style.getPropertyValue("--position-color"))).toEqual(
      ["QB", "RB", "WR", "TE"].map((position) => positionColorVar(position)),
    );

    const slotTiles = Array.from(container.querySelectorAll<HTMLElement>("[style*='--slot-color']"));
    expect(slotTiles.map((tile) => tile.style.getPropertyValue("--slot-color"))).toEqual(
      positions.map((position) => positionColorVar(position)),
    );
  });

  it("keeps every small badge foreground at WCAG AA contrast", () => {
    const tokens = readFileSync(resolve(projectRoot, "src/styles/tokens.css"), "utf8");
    const foregroundByPosition: Record<PositionColorKey, "pos-foreground-light" | "pos-foreground-dark"> = {
      qb: "pos-foreground-light",
      rb: "pos-foreground-dark",
      wr: "pos-foreground-light",
      te: "pos-foreground-dark",
      flex: "pos-foreground-dark",
      k: "pos-foreground-light",
      dst: "pos-foreground-light",
      bench: "pos-foreground-light",
      ir: "pos-foreground-light",
      dl: "pos-foreground-light",
      lb: "pos-foreground-light",
      db: "pos-foreground-dark",
      idpflex: "pos-foreground-dark",
    };

    for (const position of POSITION_COLOR_KEYS) {
      const foregroundToken = foregroundByPosition[position];
      const fill = resolveColorToken(tokens, `pos-${position}`);
      const foreground = resolveColorToken(tokens, foregroundToken);
      const ratio = contrastRatio(foreground, fill);
      const classRule = tokens.match(new RegExp(`\\.pos-${position}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(classRule, `.pos-${position} foreground assignment`).toContain(`var(--${foregroundToken})`);
      expect(ratio, `${position} contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the Player Pool position-rank marker on the shared badge", () => {
    const playerPool = readFileSync(resolve(projectRoot, "src/components/PlayerPool.tsx"), "utf8");

    expect(playerPool).toMatch(/<PositionBadge[^>]*position=\{player\.pos\}[^>]*title="Position Rank">/s);
    expect(playerPool).not.toMatch(/<Badge[^>]*title="Position Rank">/s);
  });
});
