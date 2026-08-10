/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";

const SOURCE_URL = "https://winwithodds.com/download/season_long_proj_table.csv";
const FANTASY_SEASON = 2026;
const OUTPUT_JSON = path.resolve(`src/data/players-${FANTASY_SEASON}-winwithodds.json`);

type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

interface WinWithOddsRow {
  id: string;
  season: number;
  source: "WinWithOdds Vegas projections";
  rank: number;
  name: string;
  pos: Position;
  projectedPoints: number;
  updatedAt?: string;
  attempts?: number;
  completions?: number;
  passTds?: number;
  passYards?: number;
  interceptions?: number;
  receptions?: number;
  recYards?: number;
  recTds?: number;
  recFirstDowns?: number;
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  rushFirstDowns?: number;
  fumbles?: number;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function cleanNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function cleanPosition(value: unknown): Position | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(normalized)) {
    return normalized as Position;
  }
  return null;
}

function toId(season: number, pos: Position, name: string) {
  return `${season}-${pos}-${slugify(name, { lower: true, strict: true })}`;
}

type OptionalStatKey = Exclude<
  keyof WinWithOddsRow,
  "id" | "season" | "source" | "rank" | "name" | "pos" | "projectedPoints"
  | "updatedAt"
>;

function assignOptional(row: WinWithOddsRow, key: OptionalStatKey, value: number | undefined) {
  if (value !== undefined) {
    row[key] = value;
  }
}

async function main() {
  console.log(`Fetching WinWithOdds projections from ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      accept: "text/csv,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`WinWithOdds request failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  const season = FANTASY_SEASON;
  const updatedAt = new Date().toISOString().slice(0, 10);

  const players = rows.flatMap((raw): WinWithOddsRow[] => {
    const name = String(raw.Name ?? "").trim();
    const pos = cleanPosition(raw.Pos);
    const projectedPoints = cleanNumber(raw.Projections);
    const rank = cleanNumber(raw.Rank);

    if (!name || !pos || projectedPoints === undefined) return [];

    let row: WinWithOddsRow = {
      id: toId(season, pos, name),
      season,
      source: "WinWithOdds Vegas projections",
      rank: typeof rank === "number" ? rank + 1 : 999,
      name,
      pos,
      projectedPoints,
      updatedAt,
    };

    assignOptional(row, "attempts", cleanNumber(raw.Attempts));
    assignOptional(row, "completions", cleanNumber(raw.Comps));
    assignOptional(row, "passTds", cleanNumber(raw["Pass TDs"]));
    assignOptional(row, "passYards", cleanNumber(raw["Pass Yards"]));
    assignOptional(row, "interceptions", cleanNumber(raw.Ints));
    assignOptional(row, "receptions", cleanNumber(raw.Receptions));
    assignOptional(row, "recYards", cleanNumber(raw["Rec Yards"]));
    assignOptional(row, "recTds", cleanNumber(raw["Rec TDs"]));
    assignOptional(row, "recFirstDowns", cleanNumber(raw["Rec FD"]));
    assignOptional(row, "rushAttempts", cleanNumber(raw["Rush Attempts"]));
    assignOptional(row, "rushYards", cleanNumber(raw["Rush Yards"]));
    assignOptional(row, "rushTds", cleanNumber(raw["Rush TDs"]));
    assignOptional(row, "rushFirstDowns", cleanNumber(raw["Rush FD"]));
    assignOptional(row, "fumbles", cleanNumber(raw.Fumbles));

    return [row];
  });

  if (!players.length) {
    throw new Error("No WinWithOdds players parsed.");
  }

  players.sort((left, right) => left.rank - right.rank || right.projectedPoints - left.projectedPoints);
  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(players, null, 2)}\n`, "utf8");

  console.log(`Wrote ${players.length} WinWithOdds projection rows to ${OUTPUT_JSON}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
