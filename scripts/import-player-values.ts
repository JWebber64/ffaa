/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";

type SourceKey =
  | "fantasypros"
  | "draftsharks"
  | "rotowire"
  | "yahoo"
  | "sharp"
  | "4for4"
  | "fantasyfootballcalculator"
  | "rotoballer"
  | "footballers"
  | "fantasynerds"
  | "fftoolbox"
  | "beatadp";
type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

type RawRow = Record<string, unknown>;

type ImportedValueRow = {
  name: string;
  pos: Position;
  team?: string;
  auctionValue?: number;
  projectedPoints?: number;
  adp?: number;
  rank?: number;
  updatedAt?: string;
  scoring?: "standard" | "halfPpr" | "ppr";
  budget?: number;
  teamCount?: number;
  rosterSize?: number;
  source?: string;
};

const SOURCE_CONFIG: Record<
  SourceKey,
  {
    label: string;
    output: string;
  }
> = {
  fantasypros: {
    label: "FantasyPros auction values",
    output: "src/data/players-2026-fantasypros-values.json",
  },
  draftsharks: {
    label: "Draft Sharks projections",
    output: "src/data/players-2026-draftsharks.json",
  },
  rotowire: {
    label: "RotoWire values",
    output: "src/data/players-2026-rotowire.json",
  },
  yahoo: {
    label: "Yahoo salary-cap values",
    output: "src/data/players-2026-yahoo-values.json",
  },
  sharp: {
    label: "Sharp Football Analysis projections",
    output: "src/data/players-2026-sharp.json",
  },
  "4for4": {
    label: "4for4 ADP",
    output: "src/data/players-2026-4for4.json",
  },
  fantasyfootballcalculator: {
    label: "Fantasy Football Calculator ADP",
    output: "src/data/players-2026-fantasyfootballcalculator.json",
  },
  rotoballer: {
    label: "RotoBaller cheat sheet",
    output: "src/data/players-2026-rotoballer.json",
  },
  footballers: {
    label: "Fantasy Footballers rankings",
    output: "src/data/players-2026-footballers.json",
  },
  fantasynerds: {
    label: "FantasyNerds public auction values",
    output: "src/data/players-2026-fantasynerds.json",
  },
  fftoolbox: {
    label: "FullTime Fantasy / FFToolbox auction values",
    output: "src/data/players-2026-fftoolbox.json",
  },
  beatadp: {
    label: "BeatADP market ADP",
    output: "src/data/players-2026-beatadp.json",
  },
};

const FIELD_ALIASES = {
  name: ["name", "player", "player name", "full name"],
  pos: ["pos", "position", "player position"],
  team: ["team", "nflteam", "nfl team", "tm"],
  auctionValue: [
    "auctionvalue",
    "auction value",
    "salarycapvalue",
    "salary cap value",
    "salary",
    "avg salary",
    "average salary",
    "avg price",
    "average price",
    "price",
    "cost",
    "value",
    "$",
  ],
  projectedPoints: [
    "projectedpoints",
    "projected points",
    "projection",
    "projections",
    "points",
    "fantasypoints",
    "fantasy points",
    "projected fantasy points",
    "fantasy pts",
    "fpts",
    "fp",
    "pts",
  ],
  adp: ["adp", "averagepick", "average pick", "avg pick", "consensus"],
  rank: ["rank", "overall rank", "ovr", "#"],
  updatedAt: ["updatedat", "updated at", "date", "asof", "as of"],
  scoring: ["scoring", "format", "scoring type", "scoringtype"],
  budget: ["budget", "auction budget", "salary cap", "salarycap"],
  teamCount: ["team count", "teamcount", "teams", "league size"],
  rosterSize: ["roster size", "rostersize", "drafted roster size"],
};

const TEAM_ALIASES: Record<string, string> = {
  ARZ: "ARI",
  JAC: "JAX",
  WSH: "WAS",
  LA: "LAR",
  SFO: "SF",
  KAN: "KC",
};

const VALID_TEAMS = new Set([
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LV",
  "LAC",
  "LAR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
  "FA",
]);

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const trimmed = arg.slice(2);
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) {
      args.set(trimmed, true);
      continue;
    }
    args.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
  }

  return args;
}

function readOption(args: Map<string, string | boolean>, key: string) {
  const argValue = args.get(key);
  if (typeof argValue === "string") return argValue;
  const envKey = `npm_config_${key.replace(/-/g, "_")}`;
  const envValue = process.env[envKey];
  return envValue || undefined;
}

function readFlag(args: Map<string, string | boolean>, key: string) {
  if (args.has(key)) return true;
  const envKey = `npm_config_${key.replace(/-/g, "_")}`;
  const envValue = process.env[envKey];
  return envValue === "true" || envValue === "1";
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[$_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCsvLine(line: string) {
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

function parseCsv(content: string): RawRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "").map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseJson(content: string): RawRow[] {
  const parsed = JSON.parse(content) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { players?: unknown }).players)
      ? (parsed as { players: unknown[] }).players
      : null;

  if (!rows) {
    throw new Error("JSON input must be an array or an object with a players array.");
  }

  return rows.filter((row): row is RawRow => typeof row === "object" && row !== null);
}

function cleanNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue =
    typeof value === "string" ? Number(value.replace(/[$,%\s,]/g, "")) : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function cleanString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const stringValue = String(value).trim();
  return stringValue || undefined;
}

function readAliased(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct !== undefined && direct !== null && direct !== "") return direct;

    const normalizedAlias = normalizeHeader(alias);
    const matchedKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizedAlias);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && row[matchedKey] !== "") {
      return row[matchedKey];
    }
  }

  return undefined;
}

function normalizePosition(value: unknown): Position | undefined {
  const normalized = cleanString(value)?.toUpperCase();
  if (!normalized) return undefined;
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(normalized)) return normalized as Position;
  return undefined;
}

function normalizeTeam(value: unknown) {
  const normalized = cleanString(value)?.replace(/\s+/g, "").toUpperCase();
  if (!normalized) return undefined;
  const team = TEAM_ALIASES[normalized] ?? normalized;
  return VALID_TEAMS.has(team) ? team : undefined;
}

function normalizeScoring(value: unknown): ImportedValueRow["scoring"] {
  const normalized = cleanString(value)?.toLowerCase().replace(/[_\s-]+/g, "");
  if (normalized === "ppr" || normalized === "fullppr") return "ppr";
  if (normalized === "halfppr" || normalized === "05ppr") return "halfPpr";
  if (normalized === "standard" || normalized === "nonppr" || normalized === "0ppr") {
    return "standard";
  }
  return undefined;
}

function normalizeRow(row: RawRow, source: SourceKey): ImportedValueRow | null {
  const name = cleanString(readAliased(row, FIELD_ALIASES.name));
  const pos = normalizePosition(readAliased(row, FIELD_ALIASES.pos));
  if (!name || !pos) return null;

  const auctionValue = cleanNumber(readAliased(row, FIELD_ALIASES.auctionValue));
  const projectedPoints = cleanNumber(readAliased(row, FIELD_ALIASES.projectedPoints));
  const adp = cleanNumber(readAliased(row, FIELD_ALIASES.adp));
  const rank = cleanNumber(readAliased(row, FIELD_ALIASES.rank));
  if (
    auctionValue === undefined &&
    projectedPoints === undefined &&
    adp === undefined &&
    rank === undefined
  ) {
    return null;
  }

  const team = normalizeTeam(readAliased(row, FIELD_ALIASES.team));
  const updatedAt = cleanString(readAliased(row, FIELD_ALIASES.updatedAt));
  const scoring = normalizeScoring(readAliased(row, FIELD_ALIASES.scoring));
  const budget = cleanNumber(readAliased(row, FIELD_ALIASES.budget));
  const teamCount = cleanNumber(readAliased(row, FIELD_ALIASES.teamCount));
  const rosterSize = cleanNumber(readAliased(row, FIELD_ALIASES.rosterSize));
  const normalized: ImportedValueRow = {
    name,
    pos,
    source: SOURCE_CONFIG[source].label,
  };

  if (team) normalized.team = team;
  if (auctionValue !== undefined) normalized.auctionValue = Math.round(auctionValue * 100) / 100;
  if (projectedPoints !== undefined) normalized.projectedPoints = Math.round(projectedPoints * 100) / 100;
  if (adp !== undefined) normalized.adp = Math.round(adp * 100) / 100;
  if (rank !== undefined) normalized.rank = Math.round(rank * 100) / 100;
  if (updatedAt) normalized.updatedAt = updatedAt;
  if (scoring) normalized.scoring = scoring;
  if (budget !== undefined) normalized.budget = Math.round(budget);
  if (teamCount !== undefined) normalized.teamCount = Math.round(teamCount);
  if (rosterSize !== undefined) normalized.rosterSize = Math.round(rosterSize);

  return normalized;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = readOption(args, "source");
  const input = readOption(args, "input");
  const outputOverride = readOption(args, "output");
  const dryRun = readFlag(args, "dry-run");

  if (typeof source !== "string" || !(source in SOURCE_CONFIG)) {
    throw new Error(
      `Pass --source=${Object.keys(SOURCE_CONFIG).join("|")} so the importer knows where to write.`
    );
  }
  if (typeof input !== "string") {
    throw new Error("Pass --input=/path/to/source.csv or --input=/path/to/source.json.");
  }

  const sourceKey = source as SourceKey;
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(
    typeof outputOverride === "string" ? outputOverride : SOURCE_CONFIG[sourceKey].output
  );
  const content = await fs.readFile(inputPath, "utf8");
  const rows = inputPath.toLowerCase().endsWith(".json") ? parseJson(content) : parseCsv(content);
  const normalizedRows = rows.flatMap((row) => {
    const normalized = normalizeRow(row, sourceKey);
    return normalized ? [normalized] : [];
  });

  normalizedRows.sort((left, right) => {
    const leftRank = left.rank ?? left.adp ?? Number.POSITIVE_INFINITY;
    const rightRank = right.rank ?? right.adp ?? Number.POSITIVE_INFINITY;
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });

  const skipped = rows.length - normalizedRows.length;
  console.log(
    `Parsed ${normalizedRows.length} ${SOURCE_CONFIG[sourceKey].label} rows from ${inputPath}` +
      (skipped > 0 ? ` (${skipped} skipped)` : "")
  );

  if (dryRun) {
    console.log(JSON.stringify(normalizedRows.slice(0, 5), null, 2));
    return;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(normalizedRows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${normalizedRows.length} rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
