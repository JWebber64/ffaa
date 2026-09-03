/* eslint-disable no-console */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type PulseStatus = "ok" | "changed" | "warning" | "error" | "skipped" | "not_configured";

type PulseSource = {
  id: string;
  label: string;
  kind: "public-endpoint" | "public-page" | "local-import";
  url?: string;
  status: PulseStatus;
  changed: boolean;
  checkedAt: string;
  durationMs?: number;
  httpStatus?: number;
  rowCount?: number;
  contentLength?: number;
  hash?: string;
  message: string;
};

type PulseReport = {
  generatedAt: string;
  summary: {
    ok: number;
    changed: number;
    warning: number;
    error: number;
    skipped: number;
    notConfigured: number;
  };
  sources: PulseSource[];
  recommendations: string[];
};

type SleeperPlayer = {
  playerId: string;
  name: string;
  pos?: string;
  team?: string;
  status?: string;
  injuryStatus?: string | null;
  searchRank?: number;
  fantasyPositions?: string[];
  fantasyDataId?: number | string | null;
  espnId?: number | string | null;
  yahooId?: number | string | null;
  rotowireId?: number | string | null;
};

const REPORT_PATH = path.resolve("reports/value-source-pulse.json");
const FANTASY_SEASON = 2026;
const SLEEPER_CACHE_PATH = path.resolve(`src/data/players-${FANTASY_SEASON}-sleeper.json`);
const SLEEPER_PUBLIC_CACHE_PATH = path.resolve(`public/data/players-${FANTASY_SEASON}-sleeper.json`);
const USER_AGENT = "FFAA value pulse (+local draft value monitor)";

const HTTP_SOURCES = [
  {
    id: "winwithodds_csv",
    label: "WinWithOdds Vegas projections CSV",
    kind: "public-endpoint" as const,
    url: "https://winwithodds.com/download/season_long_proj_table.csv",
    expect: "Projections",
    rowMode: "csv",
  },
  {
    id: "leaguelogs_market",
    label: "LeagueLogs redraft PPR Market Index",
    kind: "public-endpoint" as const,
    url: "https://developer.leaguelogs.com/v1/market/redraft-1qb-12t-ppr1",
    expect: "sleeperPlayerId",
  },
  {
    id: "fftoday_auction",
    label: "FFToday 2026 PPR auction values",
    kind: "public-page" as const,
    url: "https://www.fftoday.com/rankings/26-av-ppr.html",
    expect: "Max Bid",
  },
  {
    id: "fftoday_projections",
    label: "FFToday 2026 season projections",
    kind: "public-page" as const,
    url: "https://www.fftoday.com/rankings/playerproj.php?Season=2026&PosID=30",
    expect: "Puka Nacua",
  },
  {
    id: "cbs_projections",
    label: "CBS Sports 2026 season projections",
    kind: "public-page" as const,
    url: "https://www.cbssports.com/fantasy/football/stats/WR/2026/season/projections/nonppr/",
    expect: "Puka Nacua",
  },
  {
    id: "sports_illustrated_auction",
    label: "Sports Illustrated 2026 auction values",
    kind: "public-page" as const,
    url: "https://www.si.com/fantasy/2026-football-running-back-rankings-seasonal-leagues",
    expect: "Auction",
  },
  {
    id: "usa_today_auction",
    label: "USA TODAY 2026 rankings and auction values",
    kind: "public-page" as const,
    url: "https://sports.yahoo.com/articles/2026-fantasy-football-rankings-updated-224612057.html",
    expect: "Jahmyr Gibbs",
  },
  {
    id: "yafsb_auction_aav",
    label: "YAFSB actual Sleeper auction values",
    kind: "public-page" as const,
    url: "https://yafsb.com/fantasy-football/auction-draft-values/?scoring_type=half_ppr&league_size=12&is_superflex=False&is_dynasty=False&is_rookies=False",
    expect: "Sleeper auction drafts",
  },
  {
    id: "footballguys_auction",
    label: "Footballguys public auction preview",
    kind: "public-page" as const,
    url: "https://www.footballguys.com/salary-cap-auction-values?pos=all",
    expect: "Jahmyr Gibbs",
  },
  {
    id: "sportsbrackets_auction",
    label: "SportsBrackets public auction board",
    kind: "public-page" as const,
    url: "https://sportsbrackets.net/2026/07/24/2026-fantasy-football-auction-values-printable/",
    expect: "$200",
  },
  {
    id: "fantasypros_auction",
    label: "FantasyPros auction values page",
    kind: "public-page" as const,
    url: "https://www.fantasypros.com/nfl/auction-values/calculator.php",
    expect: "Auction",
  },
  {
    id: "rotowire_auction",
    label: "RotoWire auction values page",
    kind: "public-page" as const,
    url: "https://www.rotowire.com/football/auction-values.php",
    expect: "Auction Values",
  },
  {
    id: "draftsharks_auction",
    label: "Draft Sharks auction values page",
    kind: "public-page" as const,
    url: "https://www.draftsharks.com/auction-values",
    expect: "Auction",
  },
  {
    id: "yahoo_salary_cap",
    label: "Yahoo salary-cap draft analysis page",
    kind: "public-page" as const,
    url: "https://football.fantasysports.yahoo.com/f1/draftanalysis?type=salcap",
    expect: "salary",
  },
  {
    id: "sharp_projections",
    label: "Sharp Football Analysis projections page",
    kind: "public-page" as const,
    url: "https://www.sharpfootballanalysis.com/fantasy/fantasy-football-projections/",
    expect: "export CSV",
  },
  {
    id: "fourforfour_adp",
    label: "4for4 ADP page",
    kind: "public-page" as const,
    url: "https://www.4for4.com/adp",
    expect: "ADP",
  },
  {
    id: "fantasyfootballcalculator_adp",
    label: "Fantasy Football Calculator ADP page",
    kind: "public-page" as const,
    url: "https://fantasyfootballcalculator.com/adp",
    expect: "CSV",
  },
  {
    id: "rotoballer_cheatsheet",
    label: "RotoBaller cheat sheet page",
    kind: "public-page" as const,
    url: "https://www.rotoballer.com/free-fantasy-football-draft-cheat-sheet",
    expect: ".csv",
  },
  {
    id: "footballers_rankings",
    label: "Fantasy Footballers rankings page",
    kind: "public-page" as const,
    url: "https://www.thefantasyfootballers.com/2026-running-back-rankings-draft/",
    expect: "Rankings",
  },
  {
    id: "fantasynerds_auction_public",
    label: "FantasyNerds public auction values page",
    kind: "public-page" as const,
    url: "https://www.fantasynerds.com/nfl/auction",
    expect: "Auction",
  },
  {
    id: "beatadp_market",
    label: "BeatADP platform ADP page",
    kind: "public-page" as const,
    url: "https://www.beatadp.com/platform-adp",
    expect: "Consensus",
  },
  {
    id: "sleeper_state",
    label: "Sleeper NFL state",
    kind: "public-endpoint" as const,
    url: "https://api.sleeper.app/v1/state/nfl",
    expect: "season",
  },
  {
    id: "sleeper_trending_add",
    label: "Sleeper trending adds",
    kind: "public-endpoint" as const,
    url: "https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=50",
    rowMode: "json-array",
  },
  {
    id: "sleeper_trending_drop",
    label: "Sleeper trending drops",
    kind: "public-endpoint" as const,
    url: "https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=50",
    rowMode: "json-array",
  },
];

const LOCAL_IMPORTS = [
  {
    id: "player_pool_local",
    label: "2026 player pool",
    file: "src/data/player-pool-2026.json",
  },
  {
    id: "espn_salary_cap_local",
    label: "ESPN 2026 salary-cap values",
    file: "src/data/players-2026-espn.json",
  },
  {
    id: "public_auction_values_local",
    label: "Public 2026 auction-value caches",
    file: "src/data/players-2026-public-auction-values.json",
  },
  {
    id: "sleeper_suggested_values_import",
    label: "Sleeper imported suggested auction values",
    file: "src/data/players-2026-sleeper-values.json",
  },
  {
    id: "winwithodds_local",
    label: "WinWithOdds 2026 projection cache",
    file: "src/data/players-2026-winwithodds.json",
  },
  {
    id: "espn_clay_projection_local",
    label: "ESPN Mike Clay 2026 projection cache",
    file: "src/data/players-2026-espn-clay-projections.json",
  },
  {
    id: "public_projection_local",
    label: "FFToday and CBS 2026 projection caches",
    file: "src/data/players-2026-public-projections.json",
  },
  {
    id: "sleeper_projection_local",
    label: "Sleeper rendered 2026 season projection cache",
    file: "src/data/players-2026-sleeper-projections.json",
  },
  {
    id: "fantasypros_import",
    label: "FantasyPros imported values",
    file: "src/data/players-2026-fantasypros-values.json",
  },
  {
    id: "rotowire_import",
    label: "RotoWire imported values",
    file: "src/data/players-2026-rotowire.json",
  },
  {
    id: "yahoo_import",
    label: "Yahoo imported values",
    file: "src/data/players-2026-yahoo-values.json",
  },
  {
    id: "sharp_import",
    label: "Sharp Football Analysis imported projections",
    file: "src/data/players-2026-sharp.json",
  },
  {
    id: "fourforfour_import",
    label: "4for4 imported ADP",
    file: "src/data/players-2026-4for4.json",
  },
  {
    id: "fantasyfootballcalculator_import",
    label: "Fantasy Football Calculator imported ADP",
    file: "src/data/players-2026-fantasyfootballcalculator.json",
  },
  {
    id: "rotoballer_import",
    label: "RotoBaller imported cheat sheet",
    file: "src/data/players-2026-rotoballer.json",
  },
  {
    id: "footballers_import",
    label: "Fantasy Footballers imported rankings",
    file: "src/data/players-2026-footballers.json",
  },
  {
    id: "fftoolbox_import",
    label: "FullTime Fantasy / FFToolbox imported auction values",
    file: "src/data/players-2026-fftoolbox.json",
  },
  {
    id: "beatadp_import",
    label: "BeatADP imported market ADP",
    file: "src/data/players-2026-beatadp.json",
  },
  {
    id: "sleeper_player_map_local",
    label: "Sleeper player-map cache",
    file: "src/data/players-2026-sleeper.json",
  },
  {
    id: "leaguelogs_market_local",
    label: "LeagueLogs 2026 market cache",
    file: "src/data/players-2026-leaguelogs.json",
  },
  {
    id: "nflverse_schedule_local",
    label: "nflverse 2026 schedule cache",
    file: "src/data/nfl-schedule-2026.json",
  },
];

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const trimmed = arg.slice(2);
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) {
      args.set(trimmed, true);
    } else {
      args.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
    }
  }
  return args;
}

function readFlag(args: Map<string, string | boolean>, key: string) {
  if (args.has(key)) return true;
  const envKey = `npm_config_${key.replace(/-/g, "_")}`;
  const envValue = process.env[envKey];
  return envValue === "true" || envValue === "1";
}

function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function changedFromPrevious(source: Omit<PulseSource, "changed">, previous?: PulseSource) {
  if (!previous) return false;
  if (source.hash && previous.hash && source.hash !== previous.hash) return true;
  if (
    typeof source.rowCount === "number" &&
    typeof previous.rowCount === "number" &&
    source.rowCount !== previous.rowCount
  ) {
    return true;
  }
  if (source.status !== previous.status) return true;
  return false;
}

async function readPreviousReport() {
  try {
    const content = await fs.readFile(REPORT_PATH, "utf8");
    const parsed = JSON.parse(content) as PulseReport;
    return new Map(parsed.sources.map((source) => [source.id, source]));
  } catch {
    return new Map<string, PulseSource>();
  }
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        accept: "text/csv,application/json,text/html,*/*",
      },
    });
    const text = await response.text();
    return {
      durationMs: Date.now() - start,
      httpStatus: response.status,
      ok: response.ok,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function csvRowCount(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

function jsonArrayCount(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
}

function normalizeSleeperPlayers(raw: Record<string, unknown>) {
  return Object.values(raw)
    .flatMap((value): SleeperPlayer[] => {
      if (typeof value !== "object" || value === null) return [];
      const player = value as Record<string, unknown>;
      const playerId = typeof player.player_id === "string" ? player.player_id : "";
      const firstName = typeof player.first_name === "string" ? player.first_name : "";
      const lastName = typeof player.last_name === "string" ? player.last_name : "";
      const fullName =
        typeof player.full_name === "string" && player.full_name.trim()
          ? player.full_name.trim()
          : `${firstName} ${lastName}`.trim();
      const position = typeof player.position === "string" ? player.position : "";

      if (!playerId || !fullName || !position) return [];

      const normalized: SleeperPlayer = {
        playerId,
        name: fullName,
        pos: position === "D/ST" || position === "DST" ? "DEF" : position,
      };

      if (typeof player.team === "string" && player.team) normalized.team = player.team;
      if (typeof player.status === "string" && player.status) normalized.status = player.status;
      if (typeof player.injury_status === "string" || player.injury_status === null) {
        normalized.injuryStatus = player.injury_status as string | null;
      }
      if (typeof player.search_rank === "number" && Number.isFinite(player.search_rank)) {
        normalized.searchRank = player.search_rank;
      }
      if (Array.isArray(player.fantasy_positions)) {
        normalized.fantasyPositions = player.fantasy_positions
          .filter((pos): pos is string => typeof pos === "string")
          .map((pos) => (pos === "D/ST" || pos === "DST" ? "DEF" : pos));
      }
      if (typeof player.fantasy_data_id === "number" || typeof player.fantasy_data_id === "string" || player.fantasy_data_id === null) {
        normalized.fantasyDataId = player.fantasy_data_id as number | string | null;
      }
      if (typeof player.espn_id === "number" || typeof player.espn_id === "string" || player.espn_id === null) {
        normalized.espnId = player.espn_id as number | string | null;
      }
      if (typeof player.yahoo_id === "number" || typeof player.yahoo_id === "string" || player.yahoo_id === null) {
        normalized.yahooId = player.yahoo_id as number | string | null;
      }
      if (typeof player.rotowire_id === "number" || typeof player.rotowire_id === "string" || player.rotowire_id === null) {
        normalized.rotowireId = player.rotowire_id as number | string | null;
      }

      return [normalized];
    })
    .sort((left, right) => {
      const rankLeft = left.searchRank ?? Number.POSITIVE_INFINITY;
      const rankRight = right.searchRank ?? Number.POSITIVE_INFINITY;
      return rankLeft - rankRight || left.name.localeCompare(right.name);
    });
}

async function checkHttpSource(
  definition: (typeof HTTP_SOURCES)[number],
  previous: Map<string, PulseSource>
): Promise<PulseSource> {
  const checkedAt = new Date().toISOString();

  try {
    const result = await fetchText(definition.url);
    const contentLength = result.text.length;
    const rowCount =
      definition.rowMode === "csv"
        ? csvRowCount(result.text)
        : definition.rowMode === "json-array"
          ? jsonArrayCount(result.text)
          : undefined;
    const hash = hashText(result.text);
    const expectedFound = definition.expect
      ? result.text.toLowerCase().includes(definition.expect.toLowerCase())
      : true;
    const status: PulseStatus = !result.ok ? "error" : expectedFound ? "ok" : "warning";
    const message = !result.ok
      ? `HTTP ${result.httpStatus}`
      : expectedFound
        ? rowCount !== undefined
          ? `${rowCount} rows reachable`
          : "Reachable"
        : `Reachable but expected marker '${definition.expect}' was not found`;
    const base: Omit<PulseSource, "changed"> = {
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      url: definition.url,
      status,
      checkedAt,
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      contentLength,
      hash,
      message,
      ...(rowCount !== undefined ? { rowCount } : {}),
    };
    const changed = changedFromPrevious(base, previous.get(definition.id));

    return {
      ...base,
      status: changed && status === "ok" ? "changed" : status,
      changed,
    };
  } catch (error) {
    const base: Omit<PulseSource, "changed"> = {
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      url: definition.url,
      status: "error",
      checkedAt,
      message: error instanceof Error ? error.message : "Unknown request failure",
    };
    return {
      ...base,
      changed: changedFromPrevious(base, previous.get(definition.id)),
    };
  }
}

async function checkLocalImport(
  definition: (typeof LOCAL_IMPORTS)[number],
  previous: Map<string, PulseSource>
): Promise<PulseSource> {
  const checkedAt = new Date().toISOString();
  const filePath = path.resolve(definition.file);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    const rowCount = Array.isArray(parsed)
      ? parsed.length
      : typeof parsed === "object" && parsed !== null
        ? Object.keys(parsed).length
        : 0;
    const hash = hashText(content);
    const status: PulseStatus = rowCount > 0 ? "ok" : "warning";
    const base: Omit<PulseSource, "changed"> = {
      id: definition.id,
      label: definition.label,
      kind: "local-import",
      status,
      checkedAt,
      rowCount,
      contentLength: content.length,
      hash,
      message: rowCount > 0 ? `${rowCount} local rows available` : "No imported rows yet",
    };
    const changed = changedFromPrevious(base, previous.get(definition.id));

    return {
      ...base,
      status: changed && status === "ok" ? "changed" : status,
      changed,
    };
  } catch (error) {
    const base: Omit<PulseSource, "changed"> = {
      id: definition.id,
      label: definition.label,
      kind: "local-import",
      status: "warning",
      checkedAt,
      message: error instanceof Error ? error.message : "Local file unavailable",
    };
    return {
      ...base,
      changed: changedFromPrevious(base, previous.get(definition.id)),
    };
  }
}

function hoursSince(dateString: string | undefined) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const time = Date.parse(dateString);
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / (1000 * 60 * 60);
}

async function checkSleeperPlayers(
  previous: Map<string, PulseSource>,
  force: boolean
): Promise<PulseSource> {
  const previousSource = previous.get("sleeper_players");
  const shouldFetch = force || hoursSince(previousSource?.checkedAt) >= 23;
  const checkedAt = new Date().toISOString();

  if (!shouldFetch) {
    return {
      id: "sleeper_players",
      label: "Sleeper full player map",
      kind: "public-endpoint",
      url: "https://api.sleeper.app/v1/players/nfl",
      status: "skipped",
      changed: false,
      checkedAt,
      message: "Skipped; Sleeper asks this 5MB endpoint be called no more than once per day",
    };
  }

  const definition = {
    id: "sleeper_players",
    label: "Sleeper full player map",
    kind: "public-endpoint" as const,
    url: "https://api.sleeper.app/v1/players/nfl",
    expect: "player_id",
  };

  const source = await checkHttpSource(definition, previous);
  if (source.status === "ok" || source.status === "changed") {
    try {
      const textResult = await fetchText(definition.url);
      const parsed = JSON.parse(textResult.text) as Record<string, unknown>;
      const normalized = normalizeSleeperPlayers(parsed);
      const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
      await Promise.all([
        fs.writeFile(SLEEPER_CACHE_PATH, serialized, "utf8"),
        fs.writeFile(SLEEPER_PUBLIC_CACHE_PATH, serialized, "utf8"),
      ]);
      source.rowCount = normalized.length;
      source.message = `${source.rowCount} Sleeper player IDs reachable and cached for source and public runtime use`;
    } catch {
      source.message = "Reachable, but player map could not be counted";
      source.status = "warning";
    }
  }
  return source;
}

function summarize(sources: PulseSource[]): PulseReport["summary"] {
  return {
    ok: sources.filter((source) => source.status === "ok").length,
    changed: sources.filter((source) => source.status === "changed").length,
    warning: sources.filter((source) => source.status === "warning").length,
    error: sources.filter((source) => source.status === "error").length,
    skipped: sources.filter((source) => source.status === "skipped").length,
    notConfigured: sources.filter((source) => source.status === "not_configured").length,
  };
}

function recommendations(sources: PulseSource[]) {
  const notes: string[] = [];
  const emptyImports = sources.filter(
    (source) => source.kind === "local-import" && source.status === "warning"
  );
  if (emptyImports.length) {
    notes.push(
      `Import files still empty: ${emptyImports.map((source) => source.label).join(", ")}.`
    );
  }
  notes.push(
    "Sleeper's documented draft API can provide actual winning auction bids for a user-supplied draft. Do not ingest its undocumented suggested-price feed without written permission."
  );
  return notes;
}

function printSummary(report: PulseReport) {
  console.log(`Value source pulse: ${report.generatedAt}`);
  for (const source of report.sources) {
    const rowCount = typeof source.rowCount === "number" ? ` rows=${source.rowCount}` : "";
    const httpStatus = typeof source.httpStatus === "number" ? ` http=${source.httpStatus}` : "";
    console.log(`[${source.status}] ${source.label}${httpStatus}${rowCount} - ${source.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const forceSleeperPlayers = readFlag(args, "force-sleeper-players");
  const failOnError = readFlag(args, "fail-on-error");
  const previous = await readPreviousReport();

  const httpSources = await Promise.all(
    HTTP_SOURCES.map((definition) => checkHttpSource(definition, previous))
  );
  const sleeperPlayers = await checkSleeperPlayers(previous, forceSleeperPlayers);
  const localSources = await Promise.all(
    LOCAL_IMPORTS.map((definition) => checkLocalImport(definition, previous))
  );
  const sources = [...httpSources, sleeperPlayers, ...localSources].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const report: PulseReport = {
    generatedAt: new Date().toISOString(),
    summary: summarize(sources),
    sources,
    recommendations: recommendations(sources),
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
  console.log(`Wrote ${REPORT_PATH}`);

  if (failOnError && report.summary.error > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
