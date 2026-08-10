import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvRow = Record<string, string>;

type LeagueLogsSnapshot = {
  meta?: { lastRefreshed?: string };
  data?: Array<{
    sleeperPlayerId?: string;
    value?: number;
    rawValue?: number;
    overallRank?: number;
    positionRank?: number;
  }>;
};

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...valueParts] = argument.replace(/^--/, "").split("=");
    return [key, valueParts.join("=")];
  }),
);

const season = Number(args.get("season") || 2026);
const root = process.cwd();

if (!Number.isInteger(season) || season < 2020 || season > 2100) {
  throw new Error(`Invalid season: ${String(args.get("season"))}`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "FFAA public fantasy data refresh" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "FFAA public fantasy data refresh" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === ",") {
      record.push(cell);
      cell = "";
    } else if (character === "\n") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
    } else if (character !== "\r") cell += character;
  }

  if (cell || record.length) {
    record.push(cell);
    records.push(record);
  }

  const headers = records[0] ?? [];
  return records.slice(1).flatMap((values) => {
    if (!values.length || values.every((value) => value === "")) return [];
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return [row];
  });
}

async function writeSchedule() {
  const source =
    "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv";
  const rows = parseCsv(await fetchText(source))
    .filter((row) => Number(row.season) === season && row.game_type === "REG")
    .map((row) => ({
      season,
      week: Number(row.week),
      awayTeam: row.away_team ?? "",
      homeTeam: row.home_team ?? "",
      gameType: row.game_type ?? "REG",
      gameday: row.gameday ?? "",
    }))
    .filter(
      (row) =>
        Number.isInteger(row.week) &&
        row.week >= 1 &&
        row.week <= 18 &&
        Boolean(row.awayTeam) &&
        Boolean(row.homeTeam),
    )
    .sort((left, right) => left.week - right.week || left.awayTeam.localeCompare(right.awayTeam));

  if (rows.length < 250) {
    throw new Error(`Schedule validation failed: expected at least 250 regular-season games, got ${rows.length}`);
  }

  const output = path.join(root, "src", "data", `nfl-schedule-${season}.json`);
  await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${rows.length} schedule rows to ${output}`);
}

async function writeLeagueLogsMarket() {
  const [ppr, halfPpr, twoQb, sleeperPlayersText] = await Promise.all([
    fetchJson<LeagueLogsSnapshot>(
      "https://developer.leaguelogs.com/v1/market/redraft-1qb-12t-ppr1",
    ),
    fetchJson<LeagueLogsSnapshot>(
      "https://developer.leaguelogs.com/v1/market/redraft-1qb-12t-ppr0_5",
    ),
    fetchJson<LeagueLogsSnapshot>(
      "https://developer.leaguelogs.com/v1/market/redraft-2qb-12t-ppr1",
    ),
    readFile(path.join(root, "src", "data", `players-${season}-sleeper.json`), "utf8"),
  ]);

  const sleeperPlayers = JSON.parse(sleeperPlayersText) as Array<{
    playerId?: string;
    name?: string;
    pos?: string;
    team?: string | null;
  }>;
  const players = new Map(
    sleeperPlayers
      .filter((player) => player.playerId)
      .map((player) => [String(player.playerId), player]),
  );
  const profileMaps = [ppr, halfPpr, twoQb].map(
    (snapshot) =>
      new Map((snapshot.data ?? []).map((row) => [String(row.sleeperPlayerId ?? ""), row])),
  );
  const playerIds = new Set(profileMaps.flatMap((profile) => [...profile.keys()].filter(Boolean)));
  const rows = [...playerIds].flatMap((playerId) => {
    const player = players.get(playerId);
    if (!player?.name || !player.pos) return [];
    const pprRow = profileMaps[0]?.get(playerId);
    const halfPprRow = profileMaps[1]?.get(playerId);
    const twoQbRow = profileMaps[2]?.get(playerId);
    return [{
      playerId,
      name: player.name,
      pos: player.pos,
      team: player.team ?? "FA",
      pprMarketIndex: pprRow?.value ?? null,
      pprRank: pprRow?.overallRank ?? null,
      halfPprMarketIndex: halfPprRow?.value ?? null,
      halfPprRank: halfPprRow?.overallRank ?? null,
      twoQbMarketIndex: twoQbRow?.value ?? null,
      twoQbRank: twoQbRow?.overallRank ?? null,
      updatedAt:
        ppr.meta?.lastRefreshed ?? halfPpr.meta?.lastRefreshed ?? twoQb.meta?.lastRefreshed,
    }];
  });

  rows.sort((left, right) => (left.pprRank ?? 9999) - (right.pprRank ?? 9999));
  if (rows.length < 100) {
    throw new Error(`LeagueLogs validation failed: only ${rows.length} joined player rows`);
  }

  const output = path.join(root, "src", "data", `players-${season}-leaguelogs.json`);
  await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${rows.length} LeagueLogs market rows to ${output}`);
}

async function main() {
  await Promise.all([writeSchedule(), writeLeagueLogsMarket()]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
