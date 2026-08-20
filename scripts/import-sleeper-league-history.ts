import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SleeperApiClient } from "../src/features/league-history/provider/sleeperClient";
import {
  mergeSpreadsheetAuctionSources,
  type SpreadsheetAuctionSource,
} from "../src/features/league-history/provider/spreadsheetAuction";
import {
  mapSleeperHistory,
  type LeagueHistoryImportPayload,
  type PlayerReference,
  type SeasonImportPayload,
} from "../src/features/league-history/provider/sleeperMapper";

interface CachedSleeperPlayer {
  playerId: string;
  name: string;
  pos?: string | null;
  team?: string | null;
}

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function loadPlayerReferences() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const cachePath = resolve(scriptDirectory, "../src/data/players-2026-sleeper.json");
  const rows = JSON.parse(await readFile(cachePath, "utf8")) as CachedSleeperPlayer[];
  return new Map<string, PlayerReference>(rows.map((player) => [player.playerId, {
    name: player.name || player.playerId,
    position: player.pos ?? "",
    team: player.team ?? "",
  }]));
}

function payloadChunk(payload: LeagueHistoryImportPayload, season: SeasonImportPayload): LeagueHistoryImportPayload {
  return { ...payload, seasons: [season] };
}

async function writeImportChunks(payload: LeagueHistoryImportPayload, chunksDirectory: string) {
  const absoluteDirectory = resolve(chunksDirectory);
  await mkdir(absoluteDirectory, { recursive: true });
  let chunkNumber = 0;
  const writeChunk = async (label: string, season: SeasonImportPayload) => {
    chunkNumber += 1;
    const filename = `${String(chunkNumber).padStart(3, "0")}-${label}.json`;
    await writeFile(resolve(absoluteDirectory, filename), JSON.stringify(payloadChunk(payload, season)), "utf8");
  };
  for (const season of payload.seasons) {
    const foundation = {
      ...season,
      weeklyResults: [],
      transactions: [],
    };
    await writeChunk(`season-${season.season}-foundation`, foundation);
    for (let index = 0; index < season.weeklyResults.length; index += 48) {
      await writeChunk(`season-${season.season}-weekly-${String(index / 48 + 1).padStart(2, "0")}`, {
        ...foundation,
        matchups: [],
        playoffMatches: [],
        drafts: [],
        weeklyResults: season.weeklyResults.slice(index, index + 48),
      });
    }
    for (let index = 0; index < season.transactions.length; index += 75) {
      await writeChunk(`season-${season.season}-transactions-${String(index / 75 + 1).padStart(2, "0")}`, {
        ...foundation,
        matchups: [],
        playoffMatches: [],
        drafts: [],
        transactions: season.transactions.slice(index, index + 75),
      });
    }
  }
  console.log(`[league-history] wrote ${chunkNumber} resumable import chunks to ${absoluteDirectory}`);
}

async function main() {
  const leagueId = option("league") || process.argv.find((argument) => /^\d{10,}$/.test(argument)) || "";
  if (!leagueId) {
    throw new Error("Usage: npm run league:history:import -- --league=<numeric Sleeper league ID> [--auction-sources=<config.json>] [--only-seasons=2024,2025] [--drafts-only]");
  }
  const players = await loadPlayerReferences();
  const client = new SleeperApiClient();
  console.log(`[league-history] discovering Sleeper season chain for ${leagueId}`);
  const history = await client.loadHistory(leagueId);
  let payload = mapSleeperHistory(history, players);
  console.log(`[league-history] mapped ${payload.seasons.length} seasons, ${payload.seasons.reduce((sum, season) => sum + season.matchups.length, 0)} matchups, ${payload.seasons.reduce((sum, season) => sum + season.transactions.length, 0)} transactions, and ${payload.seasons.reduce((sum, season) => sum + season.drafts.reduce((draftSum, draft) => draftSum + draft.picks.length, 0), 0)} draft picks`);

  const auctionSourcesPath = option("auction-sources");
  if (auctionSourcesPath) {
    const sources = JSON.parse(await readFile(resolve(auctionSourcesPath), "utf8")) as SpreadsheetAuctionSource[];
    if (!Array.isArray(sources) || !sources.length) throw new Error("--auction-sources must point to a non-empty JSON array.");
    const merged = await mergeSpreadsheetAuctionSources(payload, sources, players);
    payload = merged.payload;
    for (const validation of merged.validations) {
      console.log(`[league-history] ${validation.season} auction: ${validation.sales} sales, $${validation.spend}, ${validation.managerMatches.length} validated managers${validation.isComplete ? "" : ", partial ledger"}`);
      for (const warning of validation.warnings) console.warn(`[league-history] warning: ${warning}`);
    }
    const auctionReportPath = option("auction-report");
    if (auctionReportPath) {
      const absoluteReportPath = resolve(auctionReportPath);
      await mkdir(dirname(absoluteReportPath), { recursive: true });
      await writeFile(absoluteReportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: merged.validations }, null, 2)}\n`, "utf8");
      console.log(`[league-history] wrote auction validation report to ${absoluteReportPath}`);
    }
  }

  const selectedSeasons = option("only-seasons").split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
  if (selectedSeasons.length) payload = { ...payload, seasons: payload.seasons.filter((season) => selectedSeasons.includes(season.season)) };
  if (hasFlag("drafts-only")) {
    payload = { ...payload, seasons: payload.seasons.map((season) => ({
      ...season,
      weeklyResults: [],
      matchups: [],
      playoffMatches: [],
      transactions: [],
    })) };
  }
  if (selectedSeasons.length || hasFlag("drafts-only")) {
    console.log(`[league-history] scoped payload to ${payload.seasons.map((season) => season.season).join(", ") || "no"} seasons${hasFlag("drafts-only") ? " and draft/franchise rows only" : ""}`);
  }

  const outputPath = option("output");
  if (outputPath) {
    const absoluteOutputPath = resolve(outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`[league-history] wrote normalized payload to ${absoluteOutputPath}`);
  }
  const chunksDirectory = option("chunks-dir");
  if (chunksDirectory) await writeImportChunks(payload, chunksDirectory);
  if (hasFlag("dry-run")) return;

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !secretKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY for the server-side import. Never use a VITE_ key for imports.");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/import_fantasy_league_history`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Content-Profile": "app",
      "Accept-Profile": "app",
    },
    body: JSON.stringify({ payload }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase import failed (${response.status}): ${body.slice(0, 500)}`);
  const result = JSON.parse(body) as { status?: string; error?: string; leagueId?: string; seasonsImported?: number };
  if (result.status !== "complete") throw new Error(result.error || "Supabase returned an incomplete import.");
  console.log(`[league-history] import complete: league ${result.leagueId}, ${result.seasonsImported} seasons`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
