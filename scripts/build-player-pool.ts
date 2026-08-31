/* eslint-disable no-console */
// File: scripts/build-player-pool.ts
import fs from "node:fs/promises";
import path from "node:path";
import { load as loadHTML } from "cheerio";
import slugify from "slugify";

// If on Node <18, uncomment the next line and replace global fetch with it.

/** Sources */
const FP_ADP_PPR = "https://www.fantasypros.com/nfl/adp/ppr-overall.php";             // primary (table)
const FP_OVERALL_PPR = "https://www.fantasypros.com/nfl/cheatsheets/top-ppr-players.php"; // backup (ordered list)
const SLEEPER_PLAYERS = "https://api.sleeper.app/v1/players/nfl";
const FANTASY_SEASON = 2026;
const ESPN_FALLBACK_JSON = path.resolve(`src/data/players-${FANTASY_SEASON}-espn.json`);

type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
type Row = {
  id: string;
  season: number;
  source: "FantasyPros ADP" | "FantasyPros ECR" | "ESPN salary-cap values" | "Sleeper player directory";
  rank: number;                 // overall/ADP rank when available
  name: string;                 // always a non-empty string
  pos: Pos;
  nflTeam: string;              // use "FA" for free agents
  byeWeek?: number;
};

// Keep confirmed active players in the pool when a ranking source omits them.
// A matching ranked row still wins during de-duplication when one is available.
const REQUIRED_POOL_ROWS: Row[] = [
  {
    id: "2026-WR-cyrus-allen",
    season: FANTASY_SEASON,
    source: "Sleeper player directory",
    rank: 230,
    name: "Cyrus Allen",
    pos: "WR",
    nflTeam: "KC",
    byeWeek: 5,
  },
];

const OUT_JSON = path.resolve(`src/data/player-pool-${FANTASY_SEASON}.json`);
const toSlug = (s: string) => slugify(s, { lower: true, strict: true });
const TEAM_ALIASES: Record<string, string> = {
  ARZ: "ARI",
  JAC: "JAX",
  LA: "LAR",
  LVR: "LV",
  NOR: "NO",
  NWE: "NE",
  SFO: "SF",
  TAM: "TB",
  WSH: "WAS",
};
const normTeam = (t?: string) => {
  const raw = (t ?? "").replace(/\s+/g, "").toUpperCase();
  return TEAM_ALIASES[raw] ?? raw;
};
const normPos = (p: string): Pos => (p === "DST" || p === "D/ST" || p === "DEF") ? "DEF" : (p as Pos);
const cleanFantasyPos = (p?: string): Pos | null => {
  const normalized = (p ?? "").toUpperCase();
  if (normalized === "DST" || normalized === "D/ST" || normalized === "DEF") return "DEF";
  return (["QB", "RB", "WR", "TE", "K"] as const).includes(normalized as Exclude<Pos, "DEF">)
    ? (normalized as Pos)
    : null;
};
const SUFFIX_TOKENS = new Set(["JR","SR","II","III","IV","V"]);
const normalizeName = (name: string) =>
  name
    .replace(/[.'’]/g, "")    // remove punctuation
    .replace(/\s+/g, " ")
    .trim();

const stripSuffixes = (name: string) => {
  const parts = normalizeName(name).split(" ");
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart && SUFFIX_TOKENS.has(lastPart.toUpperCase())) {
      parts.pop();
    }
  }
  return parts.join(" ");
};

async function get(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/** Parse FantasyPros ADP PPR (table, robust header detection + clean name/team) */
function parseFpAdpPpr(html: string): Row[] {
  const $ = loadHTML(html);

  // 1) Header map (don't assume fixed column order)
  const heads: string[] = [];
  $("table thead tr th").each((_, element) => {
    heads.push($(element).text().trim().toLowerCase());
  });

  const findIdx = (...needles: (string | RegExp)[]) => {
    for (const n of needles) {
      const i = heads.findIndex(h =>
        typeof n === "string" ? h.includes(n.toLowerCase()) : n.test(h)
      );
      if (i !== -1) return i;
    }
    return -1;
  };

  const idxRank   = findIdx("rank", /\bovr\b/, "overall");
  const idxPlayer = findIdx("player");
  const idxTeam   = findIdx("team (bye)", "team");
  const idxPos    = findIdx("pos", "position");

  if (idxRank < 0 || idxPlayer < 0 || idxTeam < 0 || idxPos < 0) {
    console.warn("ADP header mapping failed:", heads);
    return [];
  }

  // 2) Helpers
  const NFL_TEAMS = new Set([
    "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC",
    "LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"
  ]);

  const cleanTeam = (txt: string, fallbackFromPlayer: string = '') => {
    // "CIN (10)" → "CIN"
    const txtUpper = (txt || '').toUpperCase();
    const m = txtUpper.match(/\b([A-Z]{2,3})\b/);
    if (m?.[1]) {
      const team = normTeam(m[1]);
      if (NFL_TEAMS.has(team)) return team;
    }

    // Sometimes the PLAYER cell contains "... CIN (10)"; try to pull from there.
    if (fallbackFromPlayer) {
      const m2 = fallbackFromPlayer.toUpperCase().match(/\b([A-Z]{2,3})\s*\(\d+\)\s*$/);
      if (m2?.[1]) {
        const team = normTeam(m2[1]);
        if (NFL_TEAMS.has(team)) return team;
      }
    }
    return "FA";
  };

  const cleanByeWeek = (txt: string, fallbackFromPlayer: string = '') => {
    const source = `${txt || ""} ${fallbackFromPlayer || ""}`;
    const match = source.match(/\((\d{1,2})\)/);
    if (!match?.[1]) return undefined;
    const byeWeek = Number(match[1]);
    return Number.isFinite(byeWeek) && byeWeek > 0 ? byeWeek : undefined;
  };

  const cleanPos = (txt: string): Pos | null => {
    // "WR1" -> "WR", "D/ST" -> "DEF"
    let p = txt.toUpperCase().replace(/[^A-Z/]/g, ""); // strip digits/spaces
    if (p === "DST" || p === "D/ST" || p === "DEF") p = "DEF";
    return (["QB","RB","WR","TE","K","DEF"] as const).includes(p as Pos) ? (p as Pos) : null;
  };

  const cleanPlayerName = (playerCell: string) => {
    // Remove trailing " TEAM (BYE)" if present
    // e.g., "Ja'Marr Chase CIN (10)" → "Ja'Marr Chase"
    return playerCell.replace(/\s+[A-Z]{2,3}\s*\(\d+\)\s*$/, "").trim();
  };

  const rows: Row[] = [];

  // 3) Parse rows
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;

    const rankTxt   = $(tds[idxRank]).text().trim();
    const playerTxt = $(tds[idxPlayer]).text().replace(/\u00A0/g, " ").trim();
    const teamTxt   = $(tds[idxTeam]).text().trim();
    const posTxt    = $(tds[idxPos]).text().trim();

    if (!playerTxt) return;

    const rank = Number(rankTxt) || undefined;
    const pos  = cleanPos(posTxt);
    if (!pos) return;

    const name = cleanPlayerName(playerTxt);
    const team = cleanTeam(teamTxt, playerTxt);
    const byeWeek = cleanByeWeek(teamTxt, playerTxt);

    // Use suffix-stripped name ONLY for id; display name remains full
    const baseForId = stripSuffixes(name);
    const id = `${FANTASY_SEASON}-${pos}-${toSlug(baseForId)}`;

    rows.push({
      id,
      season: FANTASY_SEASON,
      source: "FantasyPros ADP",
      rank: rank ?? 9999,
      name,
      pos,
      nflTeam: team,
      ...(byeWeek ? { byeWeek } : {})
    });
  });

  console.log('First 5 parsed rows:', rows.slice(0, 5));
  return rows;
}

// ---------- FantasyPros Overall PPR (ordered list, backup) ----------
function parseFpOverallPpr(html: string): Row[] {
  const $ = loadHTML(html);
  const rows: Row[] = [];
  // Safer regex: require a whitelisted POS token, so "IV" / "III" won't match
  const re = /^\s*(\d+)\.\s+(.+?)\s+(QB|RB|WR|TE|K|DST|D\/ST|DEF)-([A-Z]{2,3})\s*$/;

  $("ol li, .players ol li").each((_, li) => {
    const text = $(li).text().replace(/\u00A0/g, " ").trim();
    const m = text.match(re);
    if (!m) return;

    const rank = Number(m[1]);
    const name = m[2]?.trim() || '';
    const pos = m[3] ? normPos(m[3].toUpperCase()) : 'RB';
    const team = m[4] ? normTeam(m[4]) : 'FA';

    const baseForId = stripSuffixes(name);
    const id = `${FANTASY_SEASON}-${pos}-${toSlug(baseForId)}`;

    rows.push({
      id,
      season: FANTASY_SEASON,
      source: "FantasyPros ECR",
      rank,
      name,
      pos,
      nflTeam: team
    });
  });

  return rows;
}


/** Sleeper fallback (full player universe; no ranks) */
async function fetchSleeperMap() {
  const res = await fetch(SLEEPER_PLAYERS);
  if (!res.ok) throw new Error(`Sleeper ${res.status}`);
  const json = await res.json() as Record<string, any>;
  const rows: Record<string, { pos?: Pos; team?: string; name: string; searchRank: number }> = {};

  for (const p of Object.values(json) as any[]) {
    if (p?.sport !== "nfl" || !p?.full_name) continue;
    const nameKey = stripSuffixes(p.full_name).toLowerCase();
    const fantasyPos = Array.isArray(p?.fantasy_positions)
      ? p.fantasy_positions.map((pos: unknown) => cleanFantasyPos(String(pos))).find(Boolean)
      : null;
    const pos = fantasyPos ?? cleanFantasyPos(String(p?.position ?? ""));
    if (!pos) continue;

    const team = normTeam(p?.team) || 'FA';
    const searchRank = typeof p?.search_rank === "number" ? p.search_rank : Number.POSITIVE_INFINITY;
    const existing = rows[nameKey];
    if (existing && existing.searchRank <= searchRank) continue;

    rows[nameKey] = {
      name: p.full_name as string,
      pos,
      team,
      searchRank
    };
  }
  return rows;
}

async function loadEspnFallbackPool(): Promise<Row[]> {
  try {
    const content = await fs.readFile(ESPN_FALLBACK_JSON, "utf8");
    const espnRows = JSON.parse(content) as Array<{
      rank?: number;
      name?: string;
      position?: string;
      team?: string;
      bye?: number;
      byeWeek?: number;
    }>;

    return espnRows.flatMap((row): Row[] => {
      const name = String(row.name ?? "").trim();
      const pos = cleanFantasyPos(row.position);
      const team = normTeam(row.team) || "FA";
      const rank = typeof row.rank === "number" ? row.rank : 9999;
      const byeWeek = typeof row.byeWeek === "number" ? row.byeWeek : row.bye;
      if (!name || !pos || !rank) return [];

      const baseForId = stripSuffixes(name);
      return [
        {
          id: `${FANTASY_SEASON}-${pos}-${toSlug(baseForId)}`,
          season: FANTASY_SEASON,
          source: "ESPN salary-cap values",
          rank,
          name,
          pos,
          nflTeam: team,
          ...(typeof byeWeek === "number" && byeWeek > 0 ? { byeWeek } : {}),
        },
      ];
    });
  } catch (error) {
    console.warn("ESPN fallback pool unavailable:", (error as Error).message);
    return [];
  }
}

async function main() {
  let rows: Row[] = [];

  // 1) Try FP ADP PPR (stable table columns)
  try {
    const html = await get(FP_ADP_PPR);
    rows = parseFpAdpPpr(html);
    if (rows.length) {
      console.log(`Parsed FantasyPros ADP PPR: ${rows.length} rows`);
    }
  } catch (e) {
    console.warn("FP ADP PPR failed:", (e as Error).message);
  }

  // 2) If nothing, try FP Overall PPR (ordered list)
  if (!rows.length) {
    try {
      const html = await get(FP_OVERALL_PPR);
      rows = parseFpOverallPpr(html);
      if (rows.length) {
        console.log(`Parsed FantasyPros Overall PPR: ${rows.length} rows`);
      }
    } catch (e) {
      console.warn("FP Overall PPR failed:", (e as Error).message);
    }
  }

  if (!rows.length) {
    rows = await loadEspnFallbackPool();
    if (rows.length) {
      console.warn(`Using ESPN 2026 salary-cap sheet as player-pool fallback: ${rows.length} rows`);
    }
  }

  // 3) Augment with Sleeper for missing team/pos
  try {
    const sleeper = await fetchSleeperMap();
    rows = rows.map(r => {
      const key = stripSuffixes(r.name).toLowerCase();
      const hit = sleeper[key];
      if (!hit) return r;
      return {
        ...r,
        pos: hit.pos || r.pos,
        nflTeam: hit.team && hit.team !== 'FA' ? hit.team : r.nflTeam
      };
    });
  } catch (e) {
    console.warn("Sleeper augmentation skipped:", (e as Error).message);
  }

  rows = [...rows, ...REQUIRED_POOL_ROWS];

  // 4) De-dup by id; sort by rank (if present), then name
  const map = new Map<string, Row>();
  for (const r of rows) if (!map.has(r.id)) map.set(r.id, r);
  let unique = [...map.values()].sort((a, b) =>
    (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name)
  );

  // Apply Top-N filter based on rank
  const DEFAULT_TOP = 300;
  const topArg = Number((process.argv.find(a => a.startsWith("--top=")) ?? "").split("=")[1]);
  const TOP_N = Number.isFinite(topArg) ? topArg : DEFAULT_TOP;

  // Keep only rows with a numeric rank, then cap to TOP_N
  const ranked = unique.filter(r => typeof r.rank === "number" && (r.rank as number) > 0);
  ranked.sort((a, b) => (a.rank as number) - (b.rank as number));
  unique = ranked.filter(r => (r.rank as number) <= TOP_N);

  // Safety: warn if we didn't get enough rows
  if (unique.length < TOP_N) {
    console.warn(`⚠️ Only ${unique.length} ranked players found (wanted ${TOP_N}).`);
  }
  
  if (unique.length < Math.min(50, TOP_N)) {
    throw new Error(`Only ${unique.length} ranked players found; refusing to overwrite ${OUT_JSON}.`);
  }

  console.log(`Parsed ${unique.length} total players`);
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(unique, null, 2), "utf8");

  console.log(`Wrote ${unique.length} players → ${OUT_JSON}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
