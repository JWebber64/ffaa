import { coverageForSeason } from "../coverage/historyCoverage";
import type { LeagueHistorySnapshot } from "../domain/types";
import type {
  DraftDNADistribution,
  DraftIntelligenceFilters,
  DraftIntelligenceResult,
  DraftPriceBand,
  DraftReceipt,
  ManagerDraftDNA,
} from "./draftIntelligenceTypes";

function priceBand(price: number | null, budget: number | null): DraftPriceBand {
  if (price == null || price <= 0 || budget == null || budget <= 0) {
    return { id: "unknown", label: "Band unavailable", maximumPrice: null };
  }
  const valueMaximum = Math.max(1, Math.floor(budget * 0.025));
  const coreMaximum = Math.max(valueMaximum + 1, Math.floor(budget * 0.1));
  if (price <= valueMaximum) return { id: "value", label: `Value (≤$${valueMaximum})`, maximumPrice: valueMaximum };
  if (price <= coreMaximum) return { id: "core", label: `Core ($${valueMaximum + 1}–$${coreMaximum})`, maximumPrice: coreMaximum };
  return { id: "premium", label: `Premium ($${coreMaximum + 1}+)`, maximumPrice: null };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle] ?? null
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function distribution(
  receipts: DraftReceipt[],
  keyFor: (receipt: DraftReceipt) => { id: string; label: string },
  totalSpend: number,
): DraftDNADistribution[] {
  const values = new Map<string, DraftDNADistribution>();
  for (const receipt of receipts) {
    const key = keyFor(receipt);
    const existing = values.get(key.id) ?? { id: key.id, label: key.label, purchases: 0, spend: 0, spendShare: 0 };
    existing.purchases += 1;
    existing.spend += receipt.price ?? 0;
    values.set(key.id, existing);
  }
  return [...values.values()]
    .map((row) => ({ ...row, spendShare: totalSpend > 0 ? row.spend / totalSpend : 0 }))
    .sort((left, right) => right.spend - left.spend || left.label.localeCompare(right.label));
}

function managerDNA(receipts: DraftReceipt[], managerId: string, managerName: string): ManagerDraftDNA {
  const managerReceipts = receipts.filter((receipt) => receipt.managerId === managerId);
  const purchased = managerReceipts.filter((receipt) => !receipt.isKeeper);
  const keepers = managerReceipts.filter((receipt) => receipt.isKeeper);
  const prices = purchased.map((receipt) => receipt.price).filter((price): price is number => price != null && price > 0);
  const totalSpend = prices.reduce((sum, price) => sum + price, 0);
  const topThreeSpend = [...prices].sort((left, right) => right - left).slice(0, 3).reduce((sum, price) => sum + price, 0);
  const eligible = purchased.filter((receipt) => receipt.pointsPerDollar != null);
  const startedPoints = eligible.reduce((sum, receipt) => sum + receipt.startedPoints, 0);
  const eligibleSpend = eligible.reduce((sum, receipt) => sum + (receipt.price ?? 0), 0);
  const targets = new Map<string, { providerPlayerId: string; playerName: string; seasons: Set<number> }>();
  for (const receipt of managerReceipts) {
    const target = targets.get(receipt.providerPlayerId) ?? {
      providerPlayerId: receipt.providerPlayerId,
      playerName: receipt.playerName,
      seasons: new Set<number>(),
    };
    target.seasons.add(receipt.season);
    targets.set(receipt.providerPlayerId, target);
  }

  return {
    id: managerId,
    managerId,
    managerName,
    seasons: [...new Set(managerReceipts.map((receipt) => receipt.season))].sort((left, right) => right - left),
    purchases: purchased.length,
    keepers: keepers.length,
    totalSpend,
    averagePrice: prices.length ? totalSpend / prices.length : null,
    medianPrice: median(prices),
    topThreeSpendShare: totalSpend > 0 ? topThreeSpend / totalSpend : null,
    startedPoints,
    starterWeeks: eligible.reduce((sum, receipt) => sum + receipt.starterWeeks, 0),
    pointsPerDollar: eligibleSpend > 0 ? startedPoints / eligibleSpend : null,
    eligibleReceipts: eligible.length,
    excludedReceipts: purchased.length - eligible.length,
    provisional: managerReceipts.some((receipt) => receipt.provisional),
    positionSpend: distribution(purchased, (receipt) => ({ id: receipt.position || "Other", label: receipt.position || "Other" }), totalSpend),
    priceBands: distribution(purchased, (receipt) => ({ id: receipt.priceBand.id, label: receipt.priceBand.label }), totalSpend),
    repeatTargets: [...targets.values()]
      .filter((target) => target.seasons.size > 1)
      .map((target) => ({ ...target, seasons: [...target.seasons].sort((left, right) => right - left) }))
      .sort((left, right) => right.seasons.length - left.seasons.length || left.playerName.localeCompare(right.playerName)),
  };
}

function addPercentiles(receipts: DraftReceipt[]) {
  const groups = new Map<string, DraftReceipt[]>();
  for (const receipt of receipts) {
    if (receipt.pointsPerDollar == null || receipt.priceBand.id === "unknown") continue;
    const key = `${receipt.season}:${receipt.position}:${receipt.priceBand.id}`;
    groups.set(key, [...(groups.get(key) ?? []), receipt]);
  }
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    for (const receipt of group) {
      const atOrBelow = group.filter((candidate) => (candidate.pointsPerDollar ?? -1) <= (receipt.pointsPerDollar ?? -1)).length;
      receipt.comparableCount = group.length;
      receipt.comparablePercentile = Math.round((atOrBelow / group.length) * 100);
    }
  }
}

export function buildDraftIntelligence(
  snapshot: LeagueHistorySnapshot,
  filters: DraftIntelligenceFilters = {},
): DraftIntelligenceResult {
  const seasonById = new Map(snapshot.seasons.map((season) => [season.id, season]));
  const draftById = new Map(snapshot.drafts.map((draft) => [draft.id, draft]));
  const franchiseById = new Map(snapshot.franchises.map((franchise) => [franchise.id, franchise]));
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager]));
  const weeklyById = new Map(snapshot.weeklyResults.map((result) => [result.id, result]));
  const outcomes = new Map<string, Array<{ week: number; isStarter: boolean; points: number | null }>>();

  for (const player of snapshot.weeklyPlayerResults) {
    const weekly = weeklyById.get(player.weeklyRosterResultId);
    if (!weekly) continue;
    const key = `${weekly.franchiseId}:${player.providerPlayerId}`;
    const rows = outcomes.get(key) ?? [];
    rows.push({ week: weekly.week, isStarter: player.isStarter, points: player.fantasyPoints });
    outcomes.set(key, rows);
  }

  const receipts: DraftReceipt[] = [];
  const exclusions: Record<string, number> = {};
  const addExclusion = (reason: string) => { exclusions[reason] = (exclusions[reason] ?? 0) + 1; };

  for (const pick of snapshot.draftPicks) {
    const draft = draftById.get(pick.draftId);
    const season = draft ? seasonById.get(draft.leagueSeasonId) : null;
    if (!draft || !season || (draft.draftType !== "auction" && pick.auctionPrice == null)) continue;
    if (filters.season != null && season.season !== filters.season) continue;
    const franchise = pick.franchiseId ? franchiseById.get(pick.franchiseId) ?? null : null;
    const manager = franchise?.managerId ? managerById.get(franchise.managerId) ?? null : null;
    if (filters.managerId && manager?.id !== filters.managerId) continue;
    const coverage = coverageForSeason(snapshot, season.id)?.domains.drafts ?? null;
    const resultRows = franchise ? outcomes.get(`${franchise.id}:${pick.providerPlayerId}`) ?? [] : [];
    const observedWeeks = [...new Set(resultRows.map((row) => row.week))].sort((left, right) => left - right);
    const startedRows = resultRows.filter((row) => row.isStarter && row.points != null);
    const exclusionsForReceipt: string[] = [];
    if (!franchise) exclusionsForReceipt.push("franchise-unlinked");
    if (!manager) exclusionsForReceipt.push("manager-unlinked");
    if (pick.auctionPrice == null || pick.auctionPrice <= 0) exclusionsForReceipt.push("price-unavailable");
    if (!resultRows.length) exclusionsForReceipt.push("no-observed-weekly-results");
    for (const reason of exclusionsForReceipt) addExclusion(reason);
    const startedPoints = startedRows.reduce((sum, row) => sum + (row.points ?? 0), 0);
    const rosteredPoints = resultRows.reduce((sum, row) => sum + (row.points ?? 0), 0);
    const paidPrice = pick.auctionPrice;
    const comparable = !pick.isKeeper
      && exclusionsForReceipt.length === 0
      && paidPrice != null
      && paidPrice > 0;
    receipts.push({
      id: pick.id,
      draftId: draft.id,
      seasonId: season.id,
      season: season.season,
      managerId: manager?.id ?? null,
      managerName: manager?.displayName ?? franchise?.historicalUsername ?? "Unknown manager",
      franchiseId: franchise?.id ?? null,
      franchiseName: franchise?.teamName ?? "Unknown franchise",
      providerPlayerId: pick.providerPlayerId,
      playerName: pick.playerName || pick.providerPlayerId,
      position: pick.position || "Other",
      nflTeam: pick.nflTeam,
      price: paidPrice,
      isKeeper: pick.isKeeper,
      priceBand: priceBand(paidPrice, draft.budget),
      ledgerStatus: coverage?.status ?? "unknown",
      provisional: coverage?.status !== "complete",
      observedWeeks,
      observedRosterWeeks: observedWeeks.length,
      starterWeeks: new Set(startedRows.map((row) => row.week)).size,
      startedPoints,
      rosteredPoints,
      pointsPerDollar: comparable && paidPrice != null ? startedPoints / paidPrice : null,
      comparablePercentile: null,
      comparableCount: 0,
      exclusions: exclusionsForReceipt,
    });
  }

  addPercentiles(receipts.filter((receipt) => !receipt.isKeeper));
  const managerIds = [...new Set(receipts.map((receipt) => receipt.managerId).filter((id): id is string => Boolean(id)))];
  const managers = managerIds
    .map((managerId) => managerDNA(receipts, managerId, managerById.get(managerId)?.displayName ?? "Unknown manager"))
    .sort((left, right) => right.totalSpend - left.totalSpend || left.managerName.localeCompare(right.managerName));
  const allWeeks = receipts.flatMap((receipt) => receipt.observedWeeks);

  return {
    receipts: receipts.filter((receipt) => !receipt.isKeeper),
    keepers: receipts.filter((receipt) => receipt.isKeeper),
    managers,
    availableSeasons: [...new Set(receipts.map((receipt) => receipt.season))].sort((left, right) => right - left),
    observationStartWeek: allWeeks.length ? Math.min(...allWeeks) : null,
    observationEndWeek: allWeeks.length ? Math.max(...allWeeks) : null,
    provisional: receipts.some((receipt) => receipt.provisional),
    exclusions,
  };
}
