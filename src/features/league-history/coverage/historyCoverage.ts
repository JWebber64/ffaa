import type {
  HistoricalDraft,
  HistoryCoverageDomain,
  HistoryCoverageStatus,
  HistoryDomainCoverage,
  LeagueHistoryCoverage,
  LeagueHistorySnapshot,
  LeagueSeason,
  LeagueSeasonCoverage,
} from "../domain/types";

export type HistoryMetricId =
  | "draft-dna-descriptive"
  | "draft-receipt-observed-return"
  | "draft-dna-comparison";

export interface HistoryMetricEligibility {
  eligible: boolean;
  provisional: boolean;
  reasons: string[];
}

function settingRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function settingNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coverageStatus(observed: number, expected: number | null): HistoryCoverageStatus {
  if (expected == null) return observed > 0 ? "unknown" : "missing";
  if (expected <= 0) return observed > 0 ? "unknown" : "not_applicable";
  if (observed <= 0) return "missing";
  if (observed < expected) return "partial";
  return "complete";
}

function evidence(
  status: HistoryCoverageStatus,
  observed: number,
  expected: number | null,
  source: string,
  importedAt: string,
  reasons: string[],
  additions: Partial<HistoryDomainCoverage> = {},
): HistoryDomainCoverage {
  return {
    status,
    observed,
    expected,
    source,
    sourceUrl: "",
    importedAt,
    reasons,
    ...additions,
  };
}

function draftCoverage(
  snapshot: LeagueHistorySnapshot,
  season: LeagueSeason,
  importedAt: string,
): HistoryDomainCoverage {
  const drafts = snapshot.drafts.filter((draft) => draft.leagueSeasonId === season.id);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const picks = snapshot.draftPicks.filter((pick) => draftIds.has(pick.draftId));
  const primaryDraft = drafts[0] ?? null;
  if (!primaryDraft) {
    return evidence("missing", 0, null, "Sleeper draft source", importedAt, ["no-draft-record"]);
  }

  const ledger = settingRecord(primaryDraft.settings.auctionLedger);
  const sourceUrl = typeof ledger.url === "string" ? ledger.url : "";
  const sourceLabel = typeof ledger.label === "string" ? ledger.label : "";
  const ledgerExpected = settingNumber(ledger.expectedRosterSpots);
  const roundsExpected = primaryDraft.rounds != null && primaryDraft.rounds > 0 && season.totalRosters > 0
    ? primaryDraft.rounds * season.totalRosters
    : null;
  const expected = ledgerExpected ?? roundsExpected;
  const recordedSpend = settingNumber(ledger.recordedSpend)
    ?? picks.reduce((sum, pick) => sum + (pick.auctionPrice ?? 0), 0);
  const expectedSpend = settingNumber(ledger.expectedBudget);
  const countStatus = coverageStatus(picks.length, expected);
  const spendMatches = expectedSpend == null || recordedSpend === expectedSpend;
  const status: HistoryCoverageStatus = countStatus === "complete" && !spendMatches
    ? "partial"
    : countStatus;
  const reasons = new Set<string>();
  if (!picks.length) reasons.add("no-recorded-picks");
  if (expected == null) reasons.add("no-expected-denominator");
  if (expected != null && picks.length < expected) reasons.add("expected-pick-count-short");
  if (!spendMatches) reasons.add("expected-spend-short");
  if (status === "complete") reasons.add("expected-count-matched");
  if (primaryDraft.status) reasons.add("provider-lifecycle-not-coverage");
  const orderKnown = ledger.orderKnown === false
    ? false
    : picks.some((pick) => pick.pickNumber != null);
  if (!orderKnown) reasons.add("nomination-order-unavailable");

  return evidence(
    status,
    picks.length,
    expected,
    sourceLabel || (sourceUrl ? "Verified auction workbook" : "Sleeper draft source"),
    typeof ledger.fetchedAt === "string" ? ledger.fetchedAt : importedAt,
    [...reasons],
    {
      sourceUrl,
      recordedSpend,
      expectedSpend,
      orderKnown,
    },
  );
}

function seasonCoverage(
  snapshot: LeagueHistorySnapshot,
  season: LeagueSeason,
  generatedAt: string,
): LeagueSeasonCoverage {
  const importedAt = season.importedAt || generatedAt;
  const franchises = snapshot.franchises.filter((row) => row.leagueSeasonId === season.id);
  const completedMatchups = snapshot.matchups.filter((row) => row.leagueSeasonId === season.id && row.isComplete);
  const completedWeeks = new Set(completedMatchups.map((row) => row.week));
  const weeklyResults = snapshot.weeklyResults.filter((row) => row.leagueSeasonId === season.id);
  const weeklyResultIds = new Set(weeklyResults.map((row) => row.id));
  const weeklyPlayerResults = snapshot.weeklyPlayerResults.filter((row) => weeklyResultIds.has(row.weeklyRosterResultId));
  const weeklyResultsWithPlayers = new Set(weeklyPlayerResults.map((row) => row.weeklyRosterResultId)).size;
  const mappedFranchises = franchises.filter((row) => row.managerId).length;
  const transactions = snapshot.transactions.filter((row) => row.leagueSeasonId === season.id);
  const expectedWeeklyResults = completedWeeks.size && season.totalRosters
    ? completedWeeks.size * season.totalRosters
    : null;
  const franchiseStatus = coverageStatus(franchises.length, season.totalRosters || null);
  const managerStatus = coverageStatus(mappedFranchises, franchises.length || season.totalRosters || null);
  const weeklyStatus = coverageStatus(weeklyResults.length, expectedWeeklyResults);
  const playerPayloadStatus = coverageStatus(weeklyResultsWithPlayers, weeklyResults.length || null);

  const domains: Record<HistoryCoverageDomain, HistoryDomainCoverage> = {
    franchises: evidence(franchiseStatus, franchises.length, season.totalRosters || null, "Sleeper rosters", importedAt, [
      franchiseStatus === "complete" ? "expected-count-matched" : franchises.length ? "expected-franchise-count-short" : "no-recorded-franchises",
    ]),
    managerIdentity: evidence(managerStatus, mappedFranchises, franchises.length || season.totalRosters || null, "Sleeper user identity", importedAt, [
      managerStatus === "complete" ? "all-franchises-mapped" : mappedFranchises ? "manager-mapping-partial" : "manager-mapping-missing",
    ], {
      mappedFranchises,
      expectedFranchises: franchises.length || season.totalRosters || null,
    }),
    matchups: evidence(
      completedMatchups.length ? "unknown" : "missing",
      completedMatchups.length,
      null,
      "Sleeper completed matchups",
      importedAt,
      [completedMatchups.length ? "no-expected-denominator" : "no-completed-matchups"],
    ),
    weeklyResults: evidence(weeklyStatus, weeklyResults.length, expectedWeeklyResults, "Sleeper weekly rosters", importedAt, [
      weeklyStatus === "complete" ? "completed-week-rosters-matched" : weeklyResults.length ? "weekly-roster-count-short" : "weekly-results-not-loaded-or-missing",
    ]),
    weeklyPlayerResults: evidence(playerPayloadStatus, weeklyResultsWithPlayers, weeklyResults.length || null, "Sleeper weekly player payloads", importedAt, [
      playerPayloadStatus === "complete" ? "weekly-player-payloads-matched" : weeklyPlayerResults.length ? "weekly-player-payloads-partial" : "weekly-player-results-not-loaded-or-missing",
    ]),
    drafts: draftCoverage(snapshot, season, importedAt),
    transactions: evidence("unknown", transactions.length, null, "Sleeper transactions", importedAt, ["no-authoritative-transaction-denominator"]),
  };

  return { seasonId: season.id, season: season.season, importedAt, domains };
}

export function buildLeagueHistoryCoverage(
  snapshot: LeagueHistorySnapshot,
  generatedAt = snapshot.league.updatedAt || new Date(0).toISOString(),
): LeagueHistoryCoverage {
  return {
    version: 1,
    generatedAt,
    seasons: [...snapshot.seasons]
      .sort((left, right) => right.season - left.season)
      .map((season) => seasonCoverage(snapshot, season, generatedAt)),
  };
}

export function ensureLeagueHistoryCoverage(snapshot: LeagueHistorySnapshot) {
  return snapshot.coverage ?? buildLeagueHistoryCoverage(snapshot);
}

export function coverageForSeason(snapshot: LeagueHistorySnapshot, seasonId: string) {
  return ensureLeagueHistoryCoverage(snapshot).seasons.find((season) => season.seasonId === seasonId) ?? null;
}

export function coverageStatusLabel(status: HistoryCoverageStatus) {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Partial source";
  if (status === "missing") return "Missing";
  if (status === "not_applicable") return "Not applicable";
  return "Available; completeness unknown";
}

export function isHistoryMetricEligible(
  metricId: HistoryMetricId,
  season: LeagueSeasonCoverage | null,
): HistoryMetricEligibility {
  if (!season) return { eligible: false, provisional: false, reasons: ["coverage-unavailable"] };
  const draft = season.domains.drafts;
  const identity = season.domains.managerIdentity;
  const weekly = season.domains.weeklyResults;
  const players = season.domains.weeklyPlayerResults;
  const reasons: string[] = [];
  if (draft.status === "missing" || draft.status === "not_applicable") reasons.push("draft-ledger-unavailable");
  if (identity.status !== "complete") reasons.push("manager-identity-incomplete");

  if (metricId !== "draft-dna-descriptive") {
    if (weekly.status !== "complete") reasons.push("weekly-roster-results-incomplete");
    if (players.status !== "complete") reasons.push("weekly-player-results-incomplete");
  }
  if (metricId === "draft-dna-comparison" && draft.expected == null) {
    reasons.push("draft-denominator-unavailable");
  }

  const provisional = draft.status !== "complete";
  return {
    eligible: reasons.length === 0,
    provisional,
    reasons,
  };
}

export function historyCoverageSummary(coverage: LeagueHistoryCoverage) {
  if (!coverage.seasons.length) return { status: "missing" as const, label: "History source data is missing" };
  const coreDomains: HistoryCoverageDomain[] = ["franchises", "managerIdentity", "weeklyResults", "weeklyPlayerResults", "drafts"];
  const states = coverage.seasons.flatMap((season) => coreDomains.map((domain) => season.domains[domain].status));
  if (states.every((status) => status === "complete" || status === "not_applicable")) {
    return { status: "ready" as const, label: "Ready for supported analytics" };
  }
  return { status: "limited" as const, label: "Some analytics are limited" };
}

export function primaryDraftForSeason(snapshot: LeagueHistorySnapshot, seasonId: string): HistoricalDraft | null {
  return snapshot.drafts.find((draft) => draft.leagueSeasonId === seasonId) ?? null;
}
