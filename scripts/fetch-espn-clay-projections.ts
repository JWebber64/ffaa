/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";
import { PDFParse } from "pdf-parse";

const FANTASY_SEASON = 2026;
const SOURCE_URL = "https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf";
const SOURCE_LABEL = "ESPN Mike Clay 2026 projections";
const UPDATED_AT = "2026-06-22";
const REPORT_PATH = path.resolve("reports/NFLDK2026_CS_ClayProjections2026.pdf");
const OUTPUT_JSON = path.resolve(`src/data/players-${FANTASY_SEASON}-espn-clay-projections.json`);

type Position = "QB" | "RB" | "WR" | "TE" | "K";

type ProjectionRow = {
  id: string;
  season: number;
  source: typeof SOURCE_LABEL;
  updatedAt: string;
  rank: number;
  name: string;
  pos: Position;
  nflTeam: string;
  projectedPoints: number;
  games?: number | undefined;
  attempts?: number | undefined;
  completions?: number | undefined;
  passYards?: number | undefined;
  passTds?: number | undefined;
  interceptions?: number | undefined;
  sacks?: number | undefined;
  rushAttempts?: number | undefined;
  rushYards?: number | undefined;
  rushTds?: number | undefined;
  targets?: number | undefined;
  receptions?: number | undefined;
  recYards?: number | undefined;
  recTds?: number | undefined;
  carryShare?: number | undefined;
  targetShare?: number | undefined;
  fieldGoalsMade?: number | undefined;
  fieldGoalAttempts?: number | undefined;
  fieldGoalPercentage?: number | undefined;
  extraPointsMade?: number | undefined;
  extraPointAttempts?: number | undefined;
  extraPointPercentage?: number | undefined;
};

const TEAM_ALIASES: Record<string, string> = {
  ARZ: "ARI",
  BLT: "BAL",
  CLV: "CLE",
  HST: "HOU",
};

const TEAM_TOKENS = new Set([
  "ARZ",
  "ATL",
  "BLT",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLV",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HST",
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
]);

function normalizeTeam(team: string) {
  return TEAM_ALIASES[team] ?? team;
}

function toId(pos: Position, name: string) {
  return `${FANTASY_SEASON}-${pos}-${slugify(name, { lower: true, strict: true })}`;
}

function cleanPageText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parseNumber(token: string) {
  const parsed = Number(token.replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumericToken(token: string | undefined) {
  return token !== undefined && /^-?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(token);
}

function sectionAfterHeader(text: string, headerEnd: string, footerPattern: RegExp) {
  const headerIndex = text.indexOf(headerEnd);
  if (headerIndex < 0) return "";
  return text.slice(headerIndex + headerEnd.length).replace(footerPattern, "").trim();
}

function parseRows<T>(
  section: string,
  numericCount: number,
  build: (name: string, team: string, values: number[]) => T | null
) {
  const rows: T[] = [];
  const tokens = section.split(/\s+/).filter(Boolean);
  let index = 0;

  while (index < tokens.length) {
    const nameTokens: string[] = [];
    while (index < tokens.length && !TEAM_TOKENS.has(tokens[index] ?? "")) {
      const token = tokens[index];
      if (!token || token === "--") break;
      nameTokens.push(token);
      index += 1;
    }

    const team = tokens[index];
    if (!team || !TEAM_TOKENS.has(team)) break;
    index += 1;

    const values: number[] = [];
    while (values.length < numericCount && index < tokens.length) {
      const token = tokens[index];
      if (!token || !isNumericToken(token)) break;
      const value = parseNumber(token);
      if (value === null) break;
      values.push(value);
      index += 1;
    }

    if (nameTokens.length && values.length === numericCount) {
      const row = build(nameTokens.join(" "), normalizeTeam(team), values);
      if (row) rows.push(row);
    } else {
      break;
    }
  }

  return rows;
}

function baseRow(
  name: string,
  pos: Position,
  team: string,
  rank: number,
  projectedPoints: number,
): ProjectionRow {
  return {
    id: toId(pos, name),
    season: FANTASY_SEASON,
    source: SOURCE_LABEL,
    updatedAt: UPDATED_AT,
    rank,
    name,
    pos,
    nflTeam: team,
    projectedPoints,
  };
}

function parseQuarterbacks(text: string) {
  const section = sectionAfterHeader(
    text,
    "Quarterback Team Pos Rk FF Pt G P Att Comp P Yds P TD INT Sk Carry Ru Yds Ru TD",
    / Quarterback Projections.*$/i
  );

  return parseRows(section, 12, (name, team, values): ProjectionRow => ({
    ...baseRow(name, "QB", team, values[0] ?? 999, values[1] ?? 0),
    games: values[2],
    attempts: values[3],
    completions: values[4],
    passYards: values[5],
    passTds: values[6],
    interceptions: values[7],
    sacks: values[8],
    rushAttempts: values[9],
    rushYards: values[10],
    rushTds: values[11],
  }));
}

function parseSkillPosition(text: string, pos: "RB" | "WR" | "TE") {
  const section = sectionAfterHeader(
    text,
    `${pos === "RB" ? "Running Back" : pos === "WR" ? "Wide Receiver" : "Tight End"} Team Pos Rk FF Pt G Carry Ru Yds Ru TD Targ Rec Re Yd Re TD Car% Targ%`,
    / (Running Back|Wide Receiver|Tight End) Projections.*$/i
  );

  return parseRows(section, 12, (name, team, values): ProjectionRow => ({
    ...baseRow(name, pos, team, values[0] ?? 999, values[1] ?? 0),
    games: values[2],
    rushAttempts: values[3],
    rushYards: values[4],
    rushTds: values[5],
    targets: values[6],
    receptions: values[7],
    recYards: values[8],
    recTds: values[9],
    carryShare: values[10],
    targetShare: values[11],
  }));
}

function parseKickers(text: string) {
  const section = sectionAfterHeader(
    text,
    "KICKER Tm FF Pt FGM FGA FG% XPM XPA XP%",
    / Kicker Projections.*$/i
  );

  return parseRows(section, 7, (name, team, values): ProjectionRow => ({
    ...baseRow(name, "K", team, 999, values[0] ?? 0),
    fieldGoalsMade: values[1],
    fieldGoalAttempts: values[2],
    fieldGoalPercentage: values[3],
    extraPointsMade: values[4],
    extraPointAttempts: values[5],
    extraPointPercentage: values[6],
  }));
}

async function ensurePdf() {
  try {
    const existing = await fs.stat(REPORT_PATH);
    if (existing.size > 0) return;
  } catch {
    // Fetch below.
  }

  console.log(`Fetching ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      accept: "application/pdf,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`ESPN projection PDF request failed: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, bytes);
}

async function getPageText(parser: PDFParse, page: number) {
  const result = await parser.getText({ partial: [page] });
  return cleanPageText(result.text);
}

async function main() {
  await ensurePdf();
  const buffer = await fs.readFile(REPORT_PATH);
  const parser = new PDFParse({ data: buffer });

  try {
    const rows: ProjectionRow[] = [];
    rows.push(...parseQuarterbacks(await getPageText(parser, 35)));

    for (const page of [36, 37, 38]) {
      rows.push(...parseSkillPosition(await getPageText(parser, page), "RB"));
    }
    for (const page of [39, 40, 41, 42, 43]) {
      rows.push(...parseSkillPosition(await getPageText(parser, page), "WR"));
    }
    for (const page of [44, 45]) {
      rows.push(...parseSkillPosition(await getPageText(parser, page), "TE"));
    }
    rows.push(...parseKickers(await getPageText(parser, 57)));

    if (rows.length < 400) {
      throw new Error(`Parsed only ${rows.length} ESPN Clay projection rows; expected 400+.`);
    }

    rows.sort((left, right) => {
      const posOrder = ["QB", "RB", "WR", "TE", "K"].indexOf(left.pos) - ["QB", "RB", "WR", "TE", "K"].indexOf(right.pos);
      return posOrder || left.rank - right.rank || right.projectedPoints - left.projectedPoints;
    });

    await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
    await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    console.log(`Wrote ${rows.length} ESPN Clay projection rows to ${OUTPUT_JSON}`);
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
