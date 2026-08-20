import type { JsonValue } from "../domain/types";
import type {
  DraftImportPayload,
  LeagueHistoryImportPayload,
  PlayerReference,
  SeasonImportPayload,
} from "./sleeperMapper";

export interface SpreadsheetAuctionSource {
  season: number;
  label: string;
  spreadsheetId: string;
  auctionGid: string;
  teamsGid: string;
  budgetPerTeam: number;
  teamCount: number;
  expectedRosterSpots: number;
  expectedSales: number;
  expectedSpend: number;
  playerAliases?: Record<string, string>;
  reviewNotes?: Record<string, string>;
}

export interface SpreadsheetAuctionSale {
  sourceRow: number;
  playerName: string;
  position: string;
  nflTeam: string;
  managerLabel: string;
  price: number;
  isKeeper: boolean;
  projectedValue: number | null;
  siteValue: number | null;
}

interface SpreadsheetTeamSummary {
  managerLabel: string;
  remainingBudget: number;
  totalDrafted: number;
  positionSpend: Record<string, number>;
}

export interface AuctionManagerMatch {
  sourceManager: string;
  providerRosterId: number;
  teamName: string;
  overlap: number;
  comparedPlayers: number;
  confidence: number;
}

export interface SpreadsheetAuctionValidation {
  season: number;
  label: string;
  sourceUrl: string;
  sales: number;
  spend: number;
  expectedRosterSpots: number;
  expectedBudget: number;
  isComplete: boolean;
  positionSpend: Record<string, number>;
  managerMatches: AuctionManagerMatch[];
  warnings: string[];
}

export interface SpreadsheetAuctionMergeResult {
  payload: LeagueHistoryImportPayload;
  validations: SpreadsheetAuctionValidation[];
}

type CsvLoader = (source: SpreadsheetAuctionSource, gid: string) => Promise<string>;

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/\?$/, "");
}

function moneyValue(value: string) {
  const normalized = value.trim().replace(/[,$\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePlayerName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeManagerLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function headerIndex(row: string[], name: string) {
  return row.findIndex((cell) => normalizedHeader(cell) === name);
}

export function parseAuctionSheet(csv: string): SpreadsheetAuctionSale[] {
  const rows = parseCsv(csv);
  const headerRowIndex = rows.findIndex((row) =>
    headerIndex(row, "player") >= 0 && headerIndex(row, "paid") >= 0 && headerIndex(row, "drafted by") >= 0);
  if (headerRowIndex < 0) throw new Error("Auction sheet is missing Player, Paid, or Drafted By columns.");
  const headers = rows[headerRowIndex]!;
  const playerIndex = headerIndex(headers, "player");
  const positionIndex = headerIndex(headers, "pos");
  const teamIndex = headerIndex(headers, "team");
  const paidIndex = headerIndex(headers, "paid");
  const managerIndex = headerIndex(headers, "drafted by");
  const keeperIndex = headerIndex(headers, "keeper");
  const projectedIndex = headerIndex(headers, "projected $");
  const siteValueIndex = headers.findIndex((cell) => ["espn $", "yahoo $"].includes(normalizedHeader(cell)));
  return rows.slice(headerRowIndex + 1).flatMap((row, offset) => {
    const playerName = row[playerIndex]?.trim() ?? "";
    const managerLabel = normalizeManagerLabel(row[managerIndex] ?? "");
    const price = moneyValue(row[paidIndex] ?? "");
    if (!playerName || !managerLabel || price == null || price <= 0) return [];
    return [{
      sourceRow: headerRowIndex + offset + 2,
      playerName,
      position: row[positionIndex]?.trim().toUpperCase() ?? "",
      nflTeam: row[teamIndex]?.trim().toUpperCase() ?? "",
      managerLabel,
      price,
      isKeeper: /^yes$/i.test(row[keeperIndex]?.trim() ?? ""),
      projectedValue: moneyValue(row[projectedIndex] ?? ""),
      siteValue: moneyValue(row[siteValueIndex] ?? ""),
    }];
  });
}

function parseTeamsSummary(csv: string, teamCount: number): SpreadsheetTeamSummary[] {
  const rows = parseCsv(csv);
  const headerRowIndex = rows.findIndex((row) =>
    headerIndex(row, "number") >= 0 && headerIndex(row, "name") >= 0 && headerIndex(row, "total drafted") >= 0);
  if (headerRowIndex < 0) throw new Error("Teams sheet is missing Number, Name, or Total Drafted columns.");
  const headers = rows[headerRowIndex]!;
  const numberIndex = headerIndex(headers, "number");
  const nameIndex = headerIndex(headers, "name");
  const remainingIndex = headerIndex(headers, "remaining budget");
  const draftedIndex = headerIndex(headers, "total drafted");
  const spendIndexes = Object.fromEntries(["QB", "RB", "WR", "TE", "K", "DEF"].map((position) => [
    position,
    headers.findIndex((cell) => normalizedHeader(cell) === `${position.toLowerCase()} spend`),
  ]));
  return rows.slice(headerRowIndex + 1).flatMap((row) => {
    const teamNumber = Number(row[numberIndex]?.trim());
    const managerLabel = normalizeManagerLabel(row[nameIndex] ?? "");
    const totalDrafted = moneyValue(row[draftedIndex] ?? "");
    if (!Number.isInteger(teamNumber) || teamNumber < 1 || teamNumber > teamCount || !managerLabel || totalDrafted == null || totalDrafted <= 0) return [];
    return [{
      managerLabel,
      remainingBudget: moneyValue(row[remainingIndex] ?? "") ?? 0,
      totalDrafted,
      positionSpend: Object.fromEntries(Object.entries(spendIndexes).map(([position, index]) => [
        position,
        index >= 0 ? moneyValue(row[index] ?? "") ?? 0 : 0,
      ])),
    }];
  });
}

function sourceUrl(source: SpreadsheetAuctionSource) {
  return `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/edit?gid=${source.auctionGid}#gid=${source.auctionGid}`;
}

function firstRosterPlayerNames(season: SeasonImportPayload) {
  const weeks = season.weeklyResults.filter((result) => result.players.length).map((result) => result.week);
  const firstWeek = weeks.length ? Math.min(...weeks) : null;
  const rosterPlayers = new Map<number, Set<string>>();
  if (firstWeek == null) return rosterPlayers;
  for (const result of season.weeklyResults.filter((row) => row.week === firstWeek)) {
    rosterPlayers.set(result.providerRosterId, new Set(result.players.map((player) => normalizePlayerName(player.playerName))));
  }
  return rosterPlayers;
}

function matchManagers(
  season: SeasonImportPayload,
  sales: SpreadsheetAuctionSale[],
  playerAliases: Record<string, string> = {},
): AuctionManagerMatch[] {
  const rosterPlayers = firstRosterPlayerNames(season);
  if (!rosterPlayers.size) throw new Error(`${season.season}: no weekly roster player data is available to validate manager identity.`);
  const purchaseNames = new Map<string, Set<string>>();
  for (const sale of sales) {
    const names = purchaseNames.get(sale.managerLabel) ?? new Set<string>();
    names.add(normalizePlayerName(playerAliases[sale.playerName] ?? sale.playerName));
    purchaseNames.set(sale.managerLabel, names);
  }
  return [...purchaseNames.entries()].map(([sourceManager, names]) => {
    const candidates = [...rosterPlayers.entries()].map(([providerRosterId, rosterNames]) => {
      const overlap = [...names].filter((name) => rosterNames.has(name)).length;
      const comparedPlayers = Math.min(names.size, rosterNames.size);
      return { providerRosterId, overlap, comparedPlayers, confidence: comparedPlayers ? overlap / comparedPlayers : 0 };
    }).sort((left, right) => right.overlap - left.overlap || right.confidence - left.confidence);
    const best = candidates[0];
    const runnerUp = candidates[1];
    if (!best || best.overlap < 3 || best.confidence < 0.5 || best.overlap === runnerUp?.overlap) {
      throw new Error(`${season.season}: manager ${sourceManager} did not have a unique, high-confidence Week 1 roster match.`);
    }
    const franchise = season.franchises.find((row) => row.providerRosterId === best.providerRosterId);
    if (!franchise) throw new Error(`${season.season}: matched roster ${best.providerRosterId} has no franchise record.`);
    return { sourceManager, teamName: franchise.teamName, ...best };
  }).sort((left, right) => left.providerRosterId - right.providerRosterId);
}

function playerLookup(season: SeasonImportPayload, players: ReadonlyMap<string, PlayerReference>) {
  const candidates = new Map<string, Array<{ playerId: string; reference: PlayerReference }>>();
  const add = (playerId: string, reference: PlayerReference) => {
    const key = normalizePlayerName(reference.name);
    if (!key) return;
    const rows = candidates.get(key) ?? [];
    if (!rows.some((row) => row.playerId === playerId)) rows.push({ playerId, reference });
    candidates.set(key, rows);
  };
  for (const [playerId, reference] of players) add(playerId, reference);
  for (const result of season.weeklyResults) {
    for (const player of result.players) add(player.providerPlayerId, {
      name: player.playerName,
      position: player.position,
      team: "",
    });
  }
  return candidates;
}

function validateSheetTotals(
  source: SpreadsheetAuctionSource,
  sales: SpreadsheetAuctionSale[],
  teams: SpreadsheetTeamSummary[],
) {
  const errors: string[] = [];
  const spend = sales.reduce((sum, sale) => sum + sale.price, 0);
  if (sales.length !== source.expectedSales) errors.push(`expected ${source.expectedSales} sales, found ${sales.length}`);
  if (spend !== source.expectedSpend) errors.push(`expected $${source.expectedSpend} spend, found $${spend}`);
  if (teams.length !== source.teamCount) errors.push(`expected ${source.teamCount} team summaries, found ${teams.length}`);
  const salesByManager = new Map<string, SpreadsheetAuctionSale[]>();
  for (const sale of sales) salesByManager.set(sale.managerLabel, [...(salesByManager.get(sale.managerLabel) ?? []), sale]);
  for (const team of teams) {
    const managerSales = salesByManager.get(team.managerLabel) ?? [];
    const managerSpend = managerSales.reduce((sum, sale) => sum + sale.price, 0);
    const summarySpend = source.budgetPerTeam - team.remainingBudget;
    if (managerSales.length !== team.totalDrafted) errors.push(`${team.managerLabel}: auction rows ${managerSales.length} do not match team total ${team.totalDrafted}`);
    if (managerSpend !== summarySpend) errors.push(`${team.managerLabel}: auction spend $${managerSpend} does not match team summary $${summarySpend}`);
  }
  const missingManagers = [...salesByManager.keys()].filter((manager) => !teams.some((team) => team.managerLabel === manager));
  if (missingManagers.length) errors.push(`missing team summaries for ${missingManagers.join(", ")}`);
  if (errors.length) throw new Error(`${source.season} ${source.label}: ${errors.join("; ")}`);
  return spend;
}

function positionSpend(sales: SpreadsheetAuctionSale[]) {
  return sales.reduce<Record<string, number>>((totals, sale) => {
    totals[sale.position || "Other"] = (totals[sale.position || "Other"] ?? 0) + sale.price;
    return totals;
  }, {});
}

function supplementalPickMetadata(
  source: SpreadsheetAuctionSource,
  sale: SpreadsheetAuctionSale,
  managerMatch: AuctionManagerMatch,
  canonicalPlayerName: string,
) {
  const reviewNote = source.reviewNotes?.[sale.playerName] ?? "";
  const metadata: Record<string, JsonValue> = {
    source: {
      type: "google_sheets_auction_ledger",
      label: source.label,
      url: sourceUrl(source),
      spreadsheetId: source.spreadsheetId,
      gid: source.auctionGid,
      row: sale.sourceRow,
    },
    sourceManager: sale.managerLabel,
    sourcePlayerName: sale.playerName,
    canonicalPlayerName,
    orderKnown: false,
    projectedValue: sale.projectedValue,
    siteValue: sale.siteValue,
    managerMatch: {
      providerRosterId: managerMatch.providerRosterId,
      overlap: managerMatch.overlap,
      comparedPlayers: managerMatch.comparedPlayers,
      confidence: managerMatch.confidence,
    },
  };
  if (reviewNote) metadata.reviewNote = reviewNote;
  return metadata;
}

function mergeDraft(
  season: SeasonImportPayload,
  source: SpreadsheetAuctionSource,
  sales: SpreadsheetAuctionSale[],
  managerMatches: AuctionManagerMatch[],
  players: ReadonlyMap<string, PlayerReference>,
  fetchedAt: string,
) {
  const draft = season.drafts.find((row) => row.providerDraftId === season.providerDraftId) ?? season.drafts[0];
  if (!draft) throw new Error(`${source.season}: no normalized draft record exists for the season.`);
  const lookup = playerLookup(season, players);
  const managerByLabel = new Map(managerMatches.map((match) => [match.sourceManager, match]));
  const unresolved: string[] = [];
  const supplementalPicks: DraftImportPayload["picks"] = sales.flatMap((sale) => {
    const alias = source.playerAliases?.[sale.playerName] ?? sale.playerName;
    const matches = lookup.get(normalizePlayerName(alias)) ?? [];
    const preferred = matches.filter((match) => !sale.position || match.reference.position === sale.position);
    const candidates = preferred.length ? preferred : matches;
    if (candidates.length !== 1) {
      unresolved.push(`${sale.playerName}${candidates.length > 1 ? " (ambiguous)" : ""}`);
      return [];
    }
    const match = candidates[0]!;
    const managerMatch = managerByLabel.get(sale.managerLabel);
    if (!managerMatch) throw new Error(`${source.season}: no validated manager match exists for ${sale.managerLabel}.`);
    return [{
      providerPickId: `sheet:${source.spreadsheetId}:${source.auctionGid}:${sale.sourceRow}`,
      providerRosterId: managerMatch.providerRosterId,
      providerPlayerId: match.playerId,
      playerName: match.reference.name || alias,
      position: sale.position || match.reference.position,
      nflTeam: sale.nflTeam || match.reference.team,
      pickNumber: null,
      round: null,
      draftSlot: null,
      auctionPrice: sale.price,
      isKeeper: sale.isKeeper,
      metadata: supplementalPickMetadata(source, sale, managerMatch, match.reference.name || alias),
    }];
  });
  if (unresolved.length) throw new Error(`${source.season}: unresolved auction players: ${unresolved.join(", ")}`);

  const supplementalByPlayer = new Map(supplementalPicks.map((pick) => [pick.providerPlayerId, pick]));
  const mergedExisting = draft.picks.map((pick) => {
    const supplemental = supplementalByPlayer.get(pick.providerPlayerId);
    if (!supplemental) return pick;
    supplementalByPlayer.delete(pick.providerPlayerId);
    return {
      ...pick,
      providerRosterId: pick.providerRosterId ?? supplemental.providerRosterId,
      playerName: pick.playerName || supplemental.playerName,
      position: pick.position || supplemental.position,
      nflTeam: pick.nflTeam || supplemental.nflTeam,
      auctionPrice: supplemental.auctionPrice,
      isKeeper: pick.isKeeper || supplemental.isKeeper,
      metadata: { ...pick.metadata, auctionSupplement: supplemental.metadata },
    };
  });
  const expectedBudget = source.budgetPerTeam * source.teamCount;
  const recordedSpend = sales.reduce((sum, sale) => sum + sale.price, 0);
  const ledgerSettings: Record<string, JsonValue> = {
    type: "google_sheets_auction_ledger",
    label: source.label,
    url: sourceUrl(source),
    spreadsheetId: source.spreadsheetId,
    auctionGid: source.auctionGid,
    teamsGid: source.teamsGid,
    fetchedAt,
    orderKnown: false,
    recordedSales: sales.length,
    expectedRosterSpots: source.expectedRosterSpots,
    recordedSpend,
    expectedBudget,
    isComplete: sales.length === source.expectedRosterSpots && recordedSpend === expectedBudget,
  };
  draft.draftType = "auction";
  draft.budget = source.budgetPerTeam;
  draft.settings = { ...draft.settings, auctionLedger: ledgerSettings };
  draft.raw = { ...draft.raw, supplementalAuctionLedger: ledgerSettings };
  draft.picks = [...mergedExisting, ...supplementalByPlayer.values()];
}

async function defaultCsvLoader(source: SpreadsheetAuctionSource, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/export?format=csv&gid=${gid}`;
  const response = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`${source.season}: Google Sheets CSV request failed (${response.status}) for gid ${gid}.`);
  return response.text();
}

export async function mergeSpreadsheetAuctionSources(
  payload: LeagueHistoryImportPayload,
  sources: SpreadsheetAuctionSource[],
  players: ReadonlyMap<string, PlayerReference>,
  loadCsv: CsvLoader = defaultCsvLoader,
): Promise<SpreadsheetAuctionMergeResult> {
  const validations: SpreadsheetAuctionValidation[] = [];
  for (const source of sources) {
    const season = payload.seasons.find((row) => row.season === source.season);
    if (!season) throw new Error(`${source.season}: source has no matching normalized league season.`);
    const [auctionCsv, teamsCsv] = await Promise.all([
      loadCsv(source, source.auctionGid),
      loadCsv(source, source.teamsGid),
    ]);
    const sales = parseAuctionSheet(auctionCsv);
    const teams = parseTeamsSummary(teamsCsv, source.teamCount);
    const spend = validateSheetTotals(source, sales, teams);
    const managerMatches = matchManagers(season, sales, source.playerAliases);
    if (managerMatches.length !== source.teamCount) {
      throw new Error(`${source.season}: expected ${source.teamCount} manager matches, found ${managerMatches.length}.`);
    }
    const fetchedAt = new Date().toISOString();
    mergeDraft(season, source, sales, managerMatches, players, fetchedAt);
    const expectedBudget = source.budgetPerTeam * source.teamCount;
    const isComplete = sales.length === source.expectedRosterSpots && spend === expectedBudget;
    validations.push({
      season: source.season,
      label: source.label,
      sourceUrl: sourceUrl(source),
      sales: sales.length,
      spend,
      expectedRosterSpots: source.expectedRosterSpots,
      expectedBudget,
      isComplete,
      positionSpend: positionSpend(sales),
      managerMatches,
      warnings: isComplete ? [] : [
        `Partial ledger: ${sales.length} of ${source.expectedRosterSpots} roster spots and $${spend} of $${expectedBudget} are recorded.`,
        "Nomination and sale order were not preserved by the source sheet.",
      ],
    });
  }
  return { payload, validations };
}

