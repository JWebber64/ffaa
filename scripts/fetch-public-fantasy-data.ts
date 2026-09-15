import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

type CsvRow = Record<string, string>;

type LeagueLogsProfileId = "ppr" | "halfPpr" | "superflex";

type LeagueLogsRankingRow = {
  name: string;
  position: string;
  team: string;
  value: number;
  overallRank: number;
  updatedAt: string;
};

const LEAGUELOGS_PROFILES: ReadonlyArray<{
  id: LeagueLogsProfileId;
  url: string;
}> = [
  { id: "ppr", url: "https://leaguelogs.com/rankings/redraft/ppr" },
  { id: "halfPpr", url: "https://leaguelogs.com/rankings/redraft/half-ppr" },
  { id: "superflex", url: "https://leaguelogs.com/rankings/redraft/superflex" },
];

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

function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePlayerName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function playerIdentity(name: string, position: string) {
  return `${normalizePlayerName(name)}|${position.toUpperCase()}`;
}

function parseLeagueLogsRankings(html: string, url: string): LeagueLogsRankingRow[] {
  const $ = cheerio.load(html);
  const updatedAt = html.match(/"marketLastRefreshed":"([^"]+)"/)?.[1] ?? new Date().toISOString();
  const rows: LeagueLogsRankingRow[] = [];

  $("table tbody tr").each((_, element) => {
    const cells = $(element).children("td");
    if (cells.length < 6) return;
    const name = cleanText(cells.eq(1).find("a").first().text());
    const position = cleanText(cells.eq(2).text()).toUpperCase();
    const team = cleanText(cells.eq(3).text()).toUpperCase();
    const overallRank = Number(cleanText(cells.eq(0).text()).replace(/,/g, ""));
    const value = Number(cleanText(cells.eq(5).text()).replace(/,/g, ""));
    if (!name || !position || !Number.isFinite(overallRank) || !Number.isFinite(value)) return;
    rows.push({ name, position, team, overallRank, value, updatedAt });
  });

  if (rows.length < 175) {
    throw new Error(`${url} validation failed: parsed only ${rows.length} public ranking rows`);
  }
  return rows;
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
  const [profileResults, sleeperPlayersText] = await Promise.all([
    Promise.all(LEAGUELOGS_PROFILES.map(async (profile) => ({
      profile,
      rows: parseLeagueLogsRankings(await fetchText(profile.url), profile.url),
    }))),
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
  const playersByIdentity = new Map(
    [...players.values()].map((player) => [playerIdentity(player.name ?? "", player.pos ?? ""), player]),
  );
  const profileMaps = new Map<LeagueLogsProfileId, Map<string, LeagueLogsRankingRow>>();

  for (const result of profileResults) {
    const joined = result.rows.flatMap((ranking) => {
      const player = playersByIdentity.get(playerIdentity(ranking.name, ranking.position));
      return player?.playerId ? [[player.playerId, ranking] as const] : [];
    });
    if (joined.length < 170) {
      throw new Error(
        `LeagueLogs ${result.profile.id} validation failed: matched only ${joined.length}/${result.rows.length} rows to Sleeper players`,
      );
    }
    profileMaps.set(result.profile.id, new Map(joined));
  }

  const ppr = profileMaps.get("ppr") ?? new Map<string, LeagueLogsRankingRow>();
  const halfPpr = profileMaps.get("halfPpr") ?? new Map<string, LeagueLogsRankingRow>();
  const superflex = profileMaps.get("superflex") ?? new Map<string, LeagueLogsRankingRow>();
  const playerIds = new Set([...ppr.keys(), ...halfPpr.keys(), ...superflex.keys()]);
  const rows = [...playerIds].flatMap((playerId) => {
    const player = players.get(playerId);
    if (!player?.name || !player.pos) return [];
    const pprRow = ppr.get(playerId);
    const halfPprRow = halfPpr.get(playerId);
    const twoQbRow = superflex.get(playerId);
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
        pprRow?.updatedAt ?? halfPprRow?.updatedAt ?? twoQbRow?.updatedAt,
    }];
  });

  rows.sort((left, right) => (left.pprRank ?? 9999) - (right.pprRank ?? 9999));
  if (rows.length < 100) {
    throw new Error(`LeagueLogs validation failed: only ${rows.length} joined player rows`);
  }

  const output = path.join(root, "src", "data", `players-${season}-leaguelogs.json`);
  await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${rows.length} LeagueLogs public ranking rows to ${output} ` +
    `(PPR=${ppr.size}, half-PPR=${halfPpr.size}, superflex=${superflex.size})`,
  );
}

async function main() {
  await Promise.all([writeSchedule(), writeLeagueLogsMarket()]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
