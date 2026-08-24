import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MIN_SEASON = 1999;
const MAX_SEASON = 2025;
const OUTPUT_PATH = resolve("public/data/nflverse-player-careers.json");
const NFLVERSE_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player";
const FANTASY_POSITIONS = new Set(["QB", "RB", "FB", "WR", "TE", "K", "PK"]);

type BundleSeason = Array<string | number | null>;
type CareerBundle = {
  version: 1;
  source: "nflverse";
  generatedAt: string;
  coverageStart: number;
  coverageEnd: number;
  players: Record<string, { n: string; s: BundleSeason[] }>;
};

function parseCsvRecord(record: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    const nextCharacter = record[index + 1];
    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function numberOrZero(value: string | undefined) {
  const parsed = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function downloadSeason(season: number) {
  const response = await fetch(`${NFLVERSE_URL}/stats_player_reg_${season}.csv.gz`);
  if (!response.ok) throw new Error(`nflverse ${season} returned ${response.status}`);
  return gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
}

async function main() {
  const bundle: CareerBundle = {
    version: 1,
    source: "nflverse",
    generatedAt: new Date().toISOString(),
    coverageStart: MIN_SEASON,
    coverageEnd: MAX_SEASON,
    players: {},
  };

  for (let season = MIN_SEASON; season <= MAX_SEASON; season += 1) {
    const text = await downloadSeason(season);
    const records = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvRecord(records[0] ?? "");
    const indexes = new Map(headers.map((header, index) => [header, index]));
    const field = (values: string[], name: string) => {
      const index = indexes.get(name) ?? -1;
      return index >= 0 ? values[index] : undefined;
    };

    for (const record of records.slice(1)) {
      const values = parseCsvRecord(record);
      const playerId = field(values, "player_id")?.trim() ?? "";
      const position = field(values, "position")?.trim().toUpperCase() ?? "";
      if (!playerId || !FANTASY_POSITIONS.has(position)) continue;
      const playerName =
        field(values, "player_display_name")?.trim() ||
        field(values, "player_name")?.trim() ||
        playerId;
      const player = bundle.players[playerId] ?? { n: playerName, s: [] };
      player.n = playerName;
      player.s.push([
        numberOrZero(field(values, "season")) || season,
        position,
        field(values, "recent_team")?.trim() || "",
        numberOrZero(field(values, "games")),
        numberOrZero(field(values, "fantasy_points")),
        numberOrZero(field(values, "fantasy_points_ppr")),
        numberOrZero(field(values, "completions")),
        numberOrZero(field(values, "attempts")),
        numberOrZero(field(values, "passing_yards")),
        numberOrZero(field(values, "passing_tds")),
        numberOrZero(field(values, "passing_interceptions")),
        numberOrZero(field(values, "carries")),
        numberOrZero(field(values, "rushing_yards")),
        numberOrZero(field(values, "rushing_tds")),
        numberOrZero(field(values, "receptions")),
        numberOrZero(field(values, "targets")),
        numberOrZero(field(values, "receiving_yards")),
        numberOrZero(field(values, "receiving_tds")),
        numberOrZero(field(values, "fumbles_lost_total")),
        numberOrZero(field(values, "fg_made")),
        numberOrZero(field(values, "fg_att")),
        nullableNumber(field(values, "fg_pct")),
        numberOrZero(field(values, "pat_made")),
        numberOrZero(field(values, "pat_att")),
      ]);
      bundle.players[playerId] = player;
    }

    process.stdout.write(`Loaded ${season}\n`);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(bundle));
  process.stdout.write(
    `Wrote ${Object.keys(bundle.players).length.toLocaleString()} player careers to ${OUTPUT_PATH}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

