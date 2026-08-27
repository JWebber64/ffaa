/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
type Scoring = "standard" | "halfPpr" | "ppr";

type ProjectionRow = {
  sourceId: string;
  source: string;
  sourceUrl: string;
  season: 2026;
  name: string;
  pos: Position;
  team?: string;
  scoring: Scoring;
  projectedPoints: number;
  receptions?: number;
  updatedAt: string;
};

type SourceResult = {
  sourceId: string;
  status: "populated" | "warning" | "cataloged";
  rowCount: number;
  message: string;
};

const OUTPUT_PATH = path.resolve("src/data/players-2026-public-projections.json");
const REPORT_PATH = path.resolve("reports/public-projection-sources.json");
const USER_AGENT = "FFAA public projection consensus (+https://gamehqhub.com/ff/)";
const FETCHED_AT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const cleanText = (value: string) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const numberValue = (value: string | undefined) => {
  if (!value || value === "—" || value === "-") return undefined;
  const parsed = Number(value.replace(/[,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

async function fetchHtml(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

function dedupeRows(rows: ProjectionRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.sourceId}|${row.name.toLowerCase()}|${row.pos}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const FFTODAY_POSITIONS: Array<{ pos: Position; id: number; receptionsIndex?: number }> = [
  { pos: "QB", id: 10 },
  { pos: "RB", id: 20, receptionsIndex: 7 },
  { pos: "WR", id: 30, receptionsIndex: 4 },
  { pos: "TE", id: 40, receptionsIndex: 4 },
  { pos: "K", id: 80 },
  { pos: "DEF", id: 99 },
];

function ffTodayProjectionTable(html: string) {
  const $ = cheerio.load(html);
  return { $, table: $("table").filter((_, element) => $(element).find("tr").length > 10).last() };
}

async function scrapeFfToday() {
  const rows: ProjectionRow[] = [];
  let updatedAt = FETCHED_AT;

  for (const config of FFTODAY_POSITIONS) {
    const baseUrl = `https://www.fftoday.com/rankings/playerproj.php?Season=2026&PosID=${config.id}`;
    const firstHtml = await fetchHtml(baseUrl);
    const updatedMatch = firstHtml.match(/Updated:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    updatedAt = updatedMatch
      ? `${updatedMatch[3]}-${updatedMatch[1]!.padStart(2, "0")}-${updatedMatch[2]!.padStart(2, "0")}`
      : FETCHED_AT;
    const pages = [...firstHtml.matchAll(/cur_page=(\d+)/g)].map((match) => Number(match[1]));
    const maxPage = Math.max(0, ...pages);

    for (let page = 0; page <= maxPage; page += 1) {
      const html = page === 0
        ? firstHtml
        : await fetchHtml(`${baseUrl}&order_by=FFPts&sort_order=DESC&cur_page=${page}`);
      const { $, table } = ffTodayProjectionTable(html);

      table.find("tr").slice(2).each((_, element) => {
        const cells = $(element).children("th,td").map((__, cell) => cleanText($(cell).text())).get();
        const name = cleanText($(element).find("a").first().text() || cells[1] || "");
        const projectedPoints = numberValue(cells.at(-1));
        if (!name || projectedPoints === undefined) return;
        const team = config.pos === "DEF" ? undefined : cleanText(cells[2] || "");
        const receptions = config.receptionsIndex === undefined
          ? undefined
          : numberValue(cells[config.receptionsIndex]);
        rows.push({
          sourceId: "fftoday-projections",
          source: "FFToday projections",
          sourceUrl: baseUrl,
          season: 2026,
          name,
          pos: config.pos,
          ...(team ? { team } : {}),
          scoring: "halfPpr",
          projectedPoints,
          ...(receptions !== undefined ? { receptions } : {}),
          updatedAt,
        });
      });
    }
  }

  return dedupeRows(rows);
}

const CBS_POSITIONS: Array<{ path: string; pos: Position; receptionsIndex?: number }> = [
  { path: "QB", pos: "QB" },
  { path: "RB", pos: "RB", receptionsIndex: 7 },
  { path: "WR", pos: "WR", receptionsIndex: 3 },
  { path: "TE", pos: "TE", receptionsIndex: 3 },
  { path: "K", pos: "K" },
  { path: "DST", pos: "DEF" },
];

async function scrapeCbs() {
  const rows: ProjectionRow[] = [];

  for (const config of CBS_POSITIONS) {
    const pathname = `/fantasy/football/stats/${config.path}/2026/season/projections/nonppr/`;
    let sourceUrl = `https://www.cbssports.com${pathname}`;
    let html: string;
    try {
      html = await fetchHtml(sourceUrl);
    } catch {
      sourceUrl = `https://poseidon-fastly.cbssports.com${pathname}`;
      html = await fetchHtml(sourceUrl);
    }
    const $ = cheerio.load(html);
    const table = $("table").filter((_, element) => $(element).find("tbody tr").length > 0).first();

    table.find("tbody tr").each((_, element) => {
      const cells = $(element).children("td").map((__, cell) => cleanText($(cell).text())).get();
      const longName = $(element).find(".CellPlayerName--long a").first().text();
      const name = cleanText(longName || $(element).find("a").last().text());
      const team = cleanText($(element).find(".CellPlayerName--long .CellPlayerName-team").text());
      const projectedPoints = numberValue(cells.at(-2));
      if (!name || projectedPoints === undefined) return;
      const receptions = config.receptionsIndex === undefined
        ? undefined
        : numberValue(cells[config.receptionsIndex]);
      rows.push({
        sourceId: "cbs-projections",
        source: "CBS Sports projections",
        sourceUrl,
        season: 2026,
        name,
        pos: config.pos,
        ...(team ? { team } : {}),
        scoring: "standard",
        projectedPoints,
        ...(receptions !== undefined ? { receptions } : {}),
        updatedAt: FETCHED_AT,
      });
    });
  }

  return dedupeRows(rows);
}

async function readExistingRows() {
  try {
    return JSON.parse(await fs.readFile(OUTPUT_PATH, "utf8")) as ProjectionRow[];
  } catch {
    return [];
  }
}

async function main() {
  const previousRows = await readExistingRows();
  const outputRows: ProjectionRow[] = [];
  const results: SourceResult[] = [];
  const scrapers = [
    { id: "fftoday-projections", label: "FFToday", minimum: 350, run: scrapeFfToday },
    { id: "cbs-projections", label: "CBS Sports", minimum: 350, run: scrapeCbs },
  ];

  for (const scraper of scrapers) {
    try {
      const rows = await scraper.run();
      if (rows.length < scraper.minimum) throw new Error(`parsed only ${rows.length} rows`);
      outputRows.push(...rows);
      results.push({ sourceId: scraper.id, status: "populated", rowCount: rows.length, message: "Public projection table refreshed." });
    } catch (error) {
      const preserved = previousRows.filter((row) => row.sourceId === scraper.id);
      outputRows.push(...preserved);
      results.push({
        sourceId: scraper.id,
        status: "warning",
        rowCount: preserved.length,
        message: `Refresh failed; ${preserved.length ? "preserved the prior cache" : "no prior cache is available"}. ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  results.push(
    { sourceId: "razzball-projections", status: "cataloged", rowCount: 0, message: "Public table is visible in a browser, but Cloudflare blocks unattended refreshes." },
    { sourceId: "fantasypros-consensus", status: "cataloged", rowCount: 0, message: "Excluded from voting because it aggregates ESPN, CBS, and FFToday." },
    { sourceId: "rotowire-projections", status: "cataloged", rowCount: 0, message: "Complete projections require a subscription." },
  );

  const orderedRows = dedupeRows(outputRows).sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) ||
    right.projectedPoints - left.projectedPoints ||
    left.name.localeCompare(right.name)
  );
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(orderedRows, null, 2)}\n`, "utf8");
  await fs.writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: results }, null, 2)}\n`, "utf8");

  for (const result of results) console.log(`${result.status.toUpperCase()} ${result.sourceId}: ${result.rowCount} rows — ${result.message}`);
  if (!orderedRows.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
