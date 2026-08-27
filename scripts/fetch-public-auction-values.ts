/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";
import { PUBLIC_AUCTION_VALUE_SOURCES } from "../src/data/publicAuctionValueSources";

type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
type Scoring = "standard" | "halfPpr" | "ppr";

type AuctionRow = {
  sourceId: string;
  name: string;
  pos: Position;
  team?: string;
  auctionValue: number;
  rank?: number;
  scoring?: Scoring;
  budget: number;
  updatedAt: string;
};

type ScrapeResult = {
  sourceId: string;
  status: "populated" | "cataloged" | "warning" | "error";
  rowCount: number;
  message: string;
};

type PlayerIdentity = {
  name?: string;
  pos?: string;
  nflTeam?: string;
};

const OUTPUT_PATH = path.resolve("src/data/players-2026-public-auction-values.json");
const REPORT_PATH = path.resolve("reports/public-auction-value-sources.json");
const USER_AGENT = "FFAA public auction value importer (+https://gamehqhub.com/ff/)";
const USA_TODAY_SYNDICATED_URL =
  "https://sports.yahoo.com/articles/2026-fantasy-football-rankings-updated-224612057.html";
const USA_TODAY_UPDATED_AT = "2026-08-19";
const FETCHED_AT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const VALID_TEAMS = new Set([
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET",
  "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", "MIN", "NE", "NO",
  "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS", "FA",
]);

const TEAM_ALIASES: Record<string, string> = {
  ARZ: "ARI",
  JAC: "JAX",
  WSH: "WAS",
  LA: "LAR",
  SFO: "SF",
};

function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cleanName(value: string) {
  return cleanText(cheerio.load(`<span>${value}</span>`)("span").text())
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+(?:QB|RB|WR|TE|K|DST|DEF)\d*$/i, "")
    .trim();
}

function identityKey(value: string) {
  return cleanName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

async function loadPlayerIdentities() {
  const content = await fs.readFile(path.resolve("src/data/player-pool-2026.json"), "utf8");
  const players = JSON.parse(content) as PlayerIdentity[];
  return new Map(players.flatMap((player) => {
    if (!player.name) return [];
    return [[identityKey(player.name), player] as const];
  }));
}

function normalizePosition(value: string): Position | null {
  const normalized = cleanText(value).toUpperCase().replace(/\d+$/, "");
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return ["QB", "RB", "WR", "TE", "K", "DEF"].includes(normalized)
    ? (normalized as Position)
    : null;
}

function normalizeTeam(value: string) {
  const normalized = cleanText(value).toUpperCase().replace(/[^A-Z]/g, "");
  const team = TEAM_ALIASES[normalized] ?? normalized;
  return VALID_TEAMS.has(team) ? team : undefined;
}

function parseDollar(value: string) {
  const match = value.match(/\$\s*([\d,.]+)/);
  if (!match) return null;
  const parsed = Number(match[1]?.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRank(value: string) {
  const parsed = Number(cleanText(value).match(/^\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function dedupeRows(rows: AuctionRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.sourceId}|${row.scoring ?? "any"}|${row.name.toLowerCase()}|${row.pos}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchResponse(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url: string) {
  return (await fetchResponse(url)).text();
}

async function fetchPdfText(url: string) {
  const buffer = Buffer.from(await (await fetchResponse(url)).arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

async function scrapeFfToday() {
  const boards: Array<{ url: string; scoring: Scoring }> = [
    { url: "https://www.fftoday.com/rankings/26-av-ppr.html", scoring: "ppr" },
    { url: "https://www.fftoday.com/rankings/26-av-half-ppr.html", scoring: "halfPpr" },
    { url: "https://www.fftoday.com/rankings/26-av-non-ppr.html", scoring: "standard" },
  ];
  const rows: AuctionRow[] = [];

  for (const board of boards) {
    const $ = cheerio.load(await fetchHtml(board.url));
    $("tr.smallbody").each((_, element) => {
      const cells = $(element).find("td").map((__, cell) => cleanText($(cell).text())).get();
      const rank = parseRank(cells[0] ?? "");
      const name = cleanName($(element).find("a").first().text() || cells[2] || "");
      const team = normalizeTeam(cells[3] ?? "");
      const pos = cells.map(normalizePosition).find(Boolean);
      const dollarValue = cells.map(parseDollar).find((value) => value !== null);
      const numericTail = Number(cells.at(-1));
      const auctionValue = dollarValue ??
        (Number.isFinite(numericTail) && numericTail > 0 ? numericTail : null);
      if (!name || !pos || auctionValue === null) return;
      rows.push({
        sourceId: "fftoday",
        name,
        pos,
        ...(team ? { team } : {}),
        auctionValue,
        ...(rank ? { rank } : {}),
        scoring: board.scoring,
        budget: 200,
        updatedAt: FETCHED_AT,
      });
    });
  }

  return rows;
}

async function scrapeSportsIllustrated() {
  const boards: Array<{ url: string; pos: Position }> = [
    { url: "https://www.si.com/fantasy/2026-football-quarterback-rankings-seasonal-leagues", pos: "QB" },
    { url: "https://www.si.com/fantasy/2026-football-running-back-rankings-seasonal-leagues", pos: "RB" },
    { url: "https://www.si.com/fantasy/2026-football-wide-receiver-rankings-seasonal-leagues", pos: "WR" },
    { url: "https://www.si.com/fantasy/2026-football-tight-end-rankings-seasonal-leagues", pos: "TE" },
  ];
  const rows: AuctionRow[] = [];

  for (const board of boards) {
    const $ = cheerio.load(await fetchHtml(board.url));
    $("tr").each((_, element) => {
      const cells = $(element).find("th,td").map((__, cell) => cleanText($(cell).text())).get();
      const dollarIndex = cells.findIndex((cell) => /^\$\s*\d+(?:\.\d+)?$/.test(cell));
      if (dollarIndex < 0) return;
      const auctionValue = parseDollar(cells[dollarIndex] ?? "");
      const rank = parseRank(cells[0] ?? "");
      const team = cells.map(normalizeTeam).find(Boolean);
      const linkNames = $(element)
        .find("a")
        .map((__, link) => cleanName($(link).text()))
        .get()
        .filter((value) => value.length > 3 && !/^(analysis|profile|news)$/i.test(value));
      const fallbackName = cells.find((cell, index) =>
        index !== dollarIndex &&
        !/^\d+(?:\.\d+)?$/.test(cell) &&
        !normalizeTeam(cell) &&
        !normalizePosition(cell) &&
        !/^(rank|player|team|bye|value|auction)$/i.test(cell),
      );
      const name = cleanName(linkNames[0] ?? fallbackName ?? "");
      if (!name || auctionValue === null) return;
      rows.push({
        sourceId: "sports-illustrated",
        name,
        pos: board.pos,
        ...(team ? { team } : {}),
        auctionValue,
        ...(rank ? { rank } : {}),
        scoring: "ppr",
        budget: 200,
        updatedAt: FETCHED_AT,
      });
    });
  }

  return rows;
}

async function scrapeUsaToday() {
  const $ = cheerio.load(await fetchHtml(USA_TODAY_SYNDICATED_URL));
  const identities = await loadPlayerIdentities();
  const rows: AuctionRow[] = [];
  const boards: Array<{
    heading: string;
    tableIndex: number;
    pos: Position;
    columns: Array<{ scoring: Scoring; headers: string[] }>;
  }> = [
    {
      heading: "quarterback rankings",
      tableIndex: 0,
      pos: "QB",
      // The article's 1-QB column applies across reception-scoring formats.
      columns: [
        { scoring: "standard", headers: ["1qb"] },
        { scoring: "halfPpr", headers: ["1qb"] },
        { scoring: "ppr", headers: ["1qb"] },
      ],
    },
    {
      heading: "running back rankings",
      tableIndex: 1,
      pos: "RB",
      columns: [
        { scoring: "standard", headers: ["std"] },
        { scoring: "halfPpr", headers: ["half"] },
        { scoring: "ppr", headers: ["ppr"] },
      ],
    },
    {
      heading: "wide receiver rankings",
      tableIndex: 2,
      pos: "WR",
      columns: [
        { scoring: "standard", headers: ["std"] },
        { scoring: "halfPpr", headers: ["half"] },
        { scoring: "ppr", headers: ["full", "ppr"] },
      ],
    },
    {
      heading: "tight end rankings",
      tableIndex: 3,
      pos: "TE",
      columns: [
        { scoring: "standard", headers: ["std"] },
        { scoring: "halfPpr", headers: ["half"] },
        { scoring: "ppr", headers: ["full", "ppr"] },
      ],
    },
  ];

  for (const board of boards) {
    const heading = $("h2").filter((_, element) =>
      cleanText($(element).text()).toLowerCase().includes(board.heading),
    ).first();
    // Yahoo wraps each syndicated table in layout containers, so the table is
    // not a direct sibling of its heading. The four position boards are the
    // first four tables; the fifth is the duplicate half-PPR overall list.
    const table = $("table").eq(board.tableIndex);
    if (!heading.length || !table.length) {
      throw new Error(`USA TODAY ${board.pos} table was not found`);
    }

    const tableRows = table.find("tr");
    const headers = tableRows.first().find("th,td")
      .map((_, cell) => cleanText($(cell).text()).toLowerCase())
      .get();
    const rankIndex = headers.findIndex((header) => ["rk", "rank"].includes(header));
    const playerIndex = headers.findIndex((header) => header === "player");
    if (rankIndex < 0 || playerIndex < 0) {
      throw new Error(`USA TODAY ${board.pos} table headers were not recognized`);
    }

    tableRows.slice(1).each((_, element) => {
      const cells = $(element).find("th,td").map((__, cell) => cleanText($(cell).text())).get();
      const name = cleanName(cells[playerIndex] ?? "");
      const rank = parseRank(cells[rankIndex] ?? "");
      const identity = identities.get(identityKey(name));
      const team = normalizeTeam(identity?.nflTeam ?? "");
      if (!name || !rank) return;

      for (const column of board.columns) {
        const valueIndex = headers.findIndex((header) => column.headers.includes(header));
        const auctionValue = Number((cells[valueIndex] ?? "").replace(/[$,]/g, ""));
        if (valueIndex < 0 || !Number.isFinite(auctionValue) || auctionValue <= 0) continue;
        rows.push({
          sourceId: "usa-today",
          name,
          pos: board.pos,
          ...(team ? { team } : {}),
          auctionValue,
          rank,
          scoring: column.scoring,
          budget: 200,
          updatedAt: USA_TODAY_UPDATED_AT,
        });
      }
    });
  }

  return rows;
}

async function scrapeDraftSharks() {
  const $ = cheerio.load(await fetchHtml("https://www.draftsharks.com/auction-values"));
  const rows: AuctionRow[] = [];
  $("tbody[data-player-row]").slice(0, 25).each((_, element) => {
    const name = cleanName($(element).attr("data-player-name") ?? "");
    const pos = normalizePosition($(element).attr("data-fantasy-position") ?? "");
    const team = normalizeTeam($(element).find(".player-details-group__team-name").first().text());
    const auctionValue = parseDollar(
      $(element).find('td[data-attribute="dsAuctionValue"]').attr("data-value") ?? "",
    );
    const rank = parseRank($(element).find(".rank-index").first().text());
    if (!name || !pos || auctionValue === null) return;
    rows.push({
      sourceId: "draftsharks",
      name,
      pos,
      ...(team ? { team } : {}),
      auctionValue,
      ...(rank ? { rank } : {}),
      scoring: "ppr",
      budget: 200,
      updatedAt: FETCHED_AT,
    });
  });
  return rows;
}

async function scrapeFootballguys() {
  const $ = cheerio.load(await fetchHtml("https://www.footballguys.com/salary-cap-auction-values?pos=all"));
  const rows: AuctionRow[] = [];
  $("tr.player-row").each((_, element) => {
    const cells = $(element).find("td").map((__, cell) => cleanText($(cell).text())).get();
    const name = cleanName($(element).attr("data-playername") ?? $(element).find("td.name b").text());
    const pos = cells.map((cell) => normalizePosition(cell)).find(Boolean);
    const teamClass = $(element).find('[class*="team-abbr-"]').attr("class") ?? "";
    const team = normalizeTeam(teamClass.match(/team-abbr-([A-Z]{2,3})/)?.[1] ?? "");
    const auctionValue = cells.map(parseDollar).find((value) => value !== null);
    const rank = parseRank($(element).attr("data-rank") ?? cells[0] ?? "");
    if (!name || !pos || auctionValue === null || auctionValue === undefined) return;
    rows.push({
      sourceId: "footballguys",
      name,
      pos,
      ...(team ? { team } : {}),
      auctionValue,
      ...(rank ? { rank } : {}),
      scoring: "ppr",
      budget: 200,
      updatedAt: FETCHED_AT,
    });
  });
  return rows;
}

async function scrapeFantasyNerds() {
  const url = "https://www.fantasynerds.com/nfl/auction?teams=12&budget=200&format=ppr";
  const $ = cheerio.load(await fetchHtml(url));
  const rows: AuctionRow[] = [];
  $("#projections tr, #results tr").each((index, element) => {
    const cells = $(element).find("td").map((__, cell) => cleanText($(cell).text())).get();
    const auctionValue = parseDollar(cells[0] ?? "");
    const name = cleanName($(element).find("a.link").first().text() || cells[1] || "");
    const pos = normalizePosition(cells[2] ?? "");
    const team = normalizeTeam(cells[3] ?? "");
    if (!name || !pos || auctionValue === null) return;
    rows.push({
      sourceId: "fantasynerds",
      name,
      pos,
      ...(team ? { team } : {}),
      auctionValue,
      rank: index + 1,
      scoring: "ppr",
      budget: 200,
      updatedAt: FETCHED_AT,
    });
  });
  return rows;
}

function parsePositionSection(text: string, start: string, end: string | null, pos: Position) {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return [];
  const endIndex = end ? text.indexOf(end, startIndex + start.length) : text.length;
  const section = text.slice(startIndex + start.length, endIndex < 0 ? text.length : endIndex);
  const rows: AuctionRow[] = [];
  const pattern = /([A-Za-z][A-Za-z.'’\-\s]+?)\s+\$(\d+(?:\.\d+)?)/g;
  for (const match of section.matchAll(pattern)) {
    const name = cleanName(match[1] ?? "");
    const auctionValue = Number(match[2]);
    if (!name || !Number.isFinite(auctionValue)) continue;
    rows.push({
      sourceId: "sportsbrackets",
      name,
      pos,
      auctionValue,
      rank: rows.length + 1,
      scoring: "ppr",
      budget: 200,
      updatedAt: FETCHED_AT,
    });
  }
  return rows;
}

async function scrapeSportsBrackets() {
  const text = await fetchPdfText(
    "https://sportsbrackets.net/wp-content/uploads/2026/07/2026-fantasy-football-auction-values-worksheet.pdf",
  );
  return [
    ...parsePositionSection(text, "RUNNING BACK $", "WIDE RECEIVER $", "RB"),
    ...parsePositionSection(text, "WIDE RECEIVER $", "QUARTERBACK $", "WR"),
    ...parsePositionSection(text, "QUARTERBACK $", "TIGHT END $", "QB"),
    ...parsePositionSection(text, "TIGHT END $", "Budget strategy", "TE"),
  ];
}

async function scrapeRtSports() {
  const text = await fetchPdfText(
    "https://www.freedraftguide.com/football/draft-guide-average-pdf.php?AAV=YES",
  );
  const rows: AuctionRow[] = [];
  const pattern = /\$([\d,.]+)\s+(.+?),\s+(QB|RB|WR|TE|K|DEF|DST|D\/ST)\s+([A-Z]{2,3})\s+\d+/g;
  for (const match of text.matchAll(pattern)) {
    const auctionValue = Number(match[1]?.replace(/,/g, ""));
    const name = cleanName(match[2] ?? "");
    const pos = normalizePosition(match[3] ?? "");
    const team = normalizeTeam(match[4] ?? "");
    if (!name || !pos || !Number.isFinite(auctionValue) || auctionValue <= 0) continue;
    rows.push({
      sourceId: "rtsports-aav",
      name,
      pos,
      ...(team ? { team } : {}),
      auctionValue,
      rank: rows.length + 1,
      budget: 200,
      updatedAt: FETCHED_AT,
    });
  }
  return rows;
}

type UnknownRecord = Record<string, unknown>;

function walkObject(value: unknown, visit: (value: UnknownRecord) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObject(item, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as UnknownRecord;
  visit(record);
  Object.values(record).forEach((item) => walkObject(item, visit));
}

function bokehMaps(document: unknown) {
  const maps: UnknownRecord[] = [];
  walkObject(document, (record) => {
    if (record.type !== "map" || !Array.isArray(record.entries)) return;
    const mapped = Object.fromEntries(
      (record.entries as unknown[])
        .filter((entry): entry is [string | number, unknown] =>
          Array.isArray(entry) && (typeof entry[0] === "string" || typeof entry[0] === "number"),
        )
        .map(([key, value]) => [String(key), value]),
    );
    maps.push(mapped);
  });
  return maps;
}

function readArray(map: UnknownRecord, names: string[]) {
  for (const name of names) {
    const key = Object.keys(map).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    if (key && Array.isArray(map[key])) return map[key] as unknown[];
  }
  return [];
}

async function scrapeYafsb() {
  const url = "https://yafsb.com/fantasy-football/auction-draft-values/?scoring_type=half_ppr&league_size=12&is_superflex=False&is_dynasty=False&is_rookies=False";
  const html = await fetchHtml(url);
  const raw = html.match(/const docs_json = '((?:\\.|[^'])*)';/)?.[1];
  if (!raw) throw new Error("Bokeh docs_json was not found");
  const document = JSON.parse(raw.replace(/\\'/g, "'")) as unknown;
  const candidates = bokehMaps(document);
  const identities = await loadPlayerIdentities();
  const rows: AuctionRow[] = [];

  for (const map of candidates) {
    const yValues = readArray(map, ["y"]);
    const averages = readArray(map, ["avg"]);
    if (!yValues.length || !averages.length) continue;
    const labelMap = Object.assign(
      {},
      ...candidates.filter((candidate) =>
        Object.keys(candidate).length > 20 &&
        Object.keys(candidate).every((key) => /^\d+$/.test(key)),
      ),
    ) as UnknownRecord;
    const seenPlayers = new Set<string>();
    for (let index = 0; index < Math.min(yValues.length, averages.length); index += 1) {
      const name = cleanName(String(labelMap[String(yValues[index])] ?? ""));
      if (!name || seenPlayers.has(name)) continue;
      const identity = identities.get(identityKey(name));
      const pos = normalizePosition(identity?.pos ?? "");
      const team = normalizeTeam(identity?.nflTeam ?? "");
      // YAFSB's plotted average is percent of league budget. Convert it to
      // an equivalent value on the app's $200 scale.
      const auctionValue = Number(averages[index]) * 2;
      if (!name || !pos || !Number.isFinite(auctionValue) || auctionValue <= 0) continue;
      seenPlayers.add(name);
      rows.push({
        sourceId: "yafsb-aav",
        name,
        pos,
        ...(team ? { team } : {}),
        auctionValue: Math.round(auctionValue * 100) / 100,
        rank: rows.length + 1,
        scoring: "halfPpr",
        budget: 200,
        updatedAt: FETCHED_AT,
      });
    }
  }

  if (!rows.length) {
    const keys = candidates.map((candidate) => Object.keys(candidate).join(",")).filter(Boolean);
    throw new Error(`No YAFSB rows found. Bokeh columns: ${keys.slice(0, 12).join(" | ")}`);
  }
  return rows;
}

const SCRAPERS: Array<{ sourceId: string; minimumRows: number; scrape: () => Promise<AuctionRow[]> }> = [
  { sourceId: "fftoday", minimumRows: 600, scrape: scrapeFfToday },
  { sourceId: "sports-illustrated", minimumRows: 230, scrape: scrapeSportsIllustrated },
  { sourceId: "usa-today", minimumRows: 750, scrape: scrapeUsaToday },
  { sourceId: "rtsports-aav", minimumRows: 150, scrape: scrapeRtSports },
  { sourceId: "yafsb-aav", minimumRows: 20, scrape: scrapeYafsb },
  { sourceId: "draftsharks", minimumRows: 20, scrape: scrapeDraftSharks },
  { sourceId: "footballguys", minimumRows: 10, scrape: scrapeFootballguys },
  { sourceId: "fantasynerds", minimumRows: 10, scrape: scrapeFantasyNerds },
  { sourceId: "sportsbrackets", minimumRows: 55, scrape: scrapeSportsBrackets },
];

async function main() {
  const rows: AuctionRow[] = [];
  const results: ScrapeResult[] = [];

  for (const scraper of SCRAPERS) {
    try {
      const scraped = dedupeRows(await scraper.scrape());
      rows.push(...scraped);
      const healthy = scraped.length >= scraper.minimumRows;
      results.push({
        sourceId: scraper.sourceId,
        status: healthy ? "populated" : "warning",
        rowCount: scraped.length,
        message: healthy
          ? `Imported ${scraped.length} public rows.`
          : `Imported ${scraped.length} rows; expected at least ${scraper.minimumRows}.`,
      });
    } catch (error) {
      results.push({
        sourceId: scraper.sourceId,
        status: "error",
        rowCount: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const source of PUBLIC_AUCTION_VALUE_SOURCES) {
    if (results.some((result) => result.sourceId === source.id)) continue;
    results.push({
      sourceId: source.id,
      status: "cataloged",
      rowCount: 0,
      message: source.note,
    });
  }

  const orderedRows = dedupeRows(rows).sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) ||
    (left.scoring ?? "").localeCompare(right.scoring ?? "") ||
    (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
    right.auctionValue - left.auctionValue,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    catalogedSourceCount: PUBLIC_AUCTION_VALUE_SOURCES.length,
    populatedSourceCount: results.filter((result) => result.rowCount > 0).length,
    totalImportedRows: orderedRows.length,
    sources: PUBLIC_AUCTION_VALUE_SOURCES.map((source) => ({
      ...source,
      ...(results.find((result) => result.sourceId === source.id) ?? {
        status: "cataloged",
        rowCount: 0,
        message: source.note,
      }),
    })),
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(orderedRows, null, 2)}\n`, "utf8");
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.table(results.map(({ sourceId, status, rowCount, message }) => ({ sourceId, status, rowCount, message })));
  console.log(`Cataloged ${PUBLIC_AUCTION_VALUE_SOURCES.length} public sources.`);
  console.log(`Wrote ${orderedRows.length} rows from ${report.populatedSourceCount} populated sources.`);

  const hardFailures = results.filter((result) =>
    SCRAPERS.some((scraper) => scraper.sourceId === result.sourceId) && result.status === "error",
  );
  if (hardFailures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
