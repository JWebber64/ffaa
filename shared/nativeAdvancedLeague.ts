import type { LeagueSettingsV1 } from "./leagueSettings";

export type AdvancedDraftKind = "startup" | "rookie" | "supplemental" | "dispersal";
export type FuturePickStatus = "available" | "traded" | "used" | "compensatory";

export type FutureDraftPick = {
  id: string;
  season: number;
  round: number;
  originalFranchiseId: string;
  ownerFranchiseId: string;
  status: FuturePickStatus;
  compensatoryReason: string;
  revision: number;
};

export type KeeperAssignment = {
  id: string;
  playerId: string;
  franchiseId: string;
  declaredAt: string;
  yearsKept: number;
  cost: number;
  sourceRound: number | null;
  status: "declared" | "released" | "converted_to_contract";
  revision: number;
};

export type SalaryRetention = { franchiseId: string; season: number; amount: number };

export type PlayerContract = {
  id: string;
  playerId: string;
  franchiseId: string;
  startSeason: number;
  endSeason: number;
  salaryBySeason: Record<string, number>;
  optionYears: number[];
  exercisedOptionYears: number[];
  retainedSalary: SalaryRetention[];
  extensionOfContractId: string | null;
  status: "active" | "expired" | "released" | "tagged";
  revision: number;
};

export type DeadCapCharge = {
  id: string;
  franchiseId: string;
  playerId: string;
  season: number;
  amount: number;
  sourceContractId: string;
  reason: string;
};

export type TaxiAssignment = {
  id: string;
  playerId: string;
  franchiseId: string;
  experienceSeasons: number;
  placedAt: string;
  activatedAt: string | null;
  status: "taxi" | "activated" | "released";
  revision: number;
};

export type RestrictedFreeAgentTender = {
  id: string;
  playerId: string;
  franchiseId: string;
  season: number;
  amount: number;
  compensationRound: number;
  matchingDeadline: string;
  status: "open" | "matched" | "declined" | "expired";
  revision: number;
};

export type FranchiseTag = {
  id: string;
  playerId: string;
  franchiseId: string;
  season: number;
  salary: number;
  status: "active" | "rescinded" | "converted";
  revision: number;
};

export type OrphanTeamState = {
  franchiseId: string;
  orphaned: boolean;
  orphanedAt: string | null;
  reason: string;
  eligibleForDispersal: boolean;
  adoptedAt: string | null;
  revision: number;
};

export type CompensatoryPick = {
  id: string;
  season: number;
  round: number;
  afterPick: number;
  ownerFranchiseId: string;
  reason: string;
  status: "awarded" | "used" | "revoked";
  revision: number;
};

export type AdvancedDraftPlan = {
  id: string;
  kind: AdvancedDraftKind;
  season: number;
  rounds: number;
  eligibleFranchiseIds: string[];
  sourceOrphanFranchiseIds: string[];
  status: "planned" | "open" | "complete" | "canceled";
  revision: number;
};

export type SalaryLedger = {
  franchiseId: string;
  season: number;
  activeSalary: number;
  retainedSalary: number;
  deadCap: number;
  totalCapCharge: number;
  capSpace: number;
};

export type AdvancedLeagueState = {
  seasonYear: number;
  futurePicks: FutureDraftPick[];
  keepers: KeeperAssignment[];
  contracts: PlayerContract[];
  deadCap: DeadCapCharge[];
  taxi: TaxiAssignment[];
  rfaTenders: RestrictedFreeAgentTender[];
  franchiseTags: FranchiseTag[];
  orphanTeams: OrphanTeamState[];
  compensatoryPicks: CompensatoryPick[];
  draftPlans: AdvancedDraftPlan[];
};

export type AdvancedLeagueIssue = { field: string; message: string };

function pickId(season: number, round: number, franchiseId: string) {
  return `pick__${season}__${round}__${franchiseId}`;
}

export function calculateKeeperCost(settings: LeagueSettingsV1["keeper"], yearsKept: number) {
  if (!settings.enabled || settings.costMode === "none") return 0;
  return settings.baseCost + Math.max(0, Math.floor(yearsKept)) * settings.annualEscalation;
}

export function initializeAdvancedLeagueState(input: {
  settings: LeagueSettingsV1;
  seasonYear: number;
  franchiseIds: string[];
}) : AdvancedLeagueState {
  const franchises = [...new Set(input.franchiseIds.filter(Boolean))].sort();
  const futurePicks = input.settings.advanced.enabled
    ? Array.from({ length: input.settings.advanced.futurePickYears }, (_, yearIndex) => input.seasonYear + yearIndex + 1)
        .flatMap((season) => Array.from({ length: input.settings.advanced.rookieDraftRounds }, (_, roundIndex) => roundIndex + 1)
          .flatMap((round) => franchises.map((franchiseId): FutureDraftPick => ({
            id: pickId(season, round, franchiseId), season, round, originalFranchiseId: franchiseId,
            ownerFranchiseId: franchiseId, status: "available", compensatoryReason: "", revision: 1,
          }))))
    : [];
  const draftPlans: AdvancedDraftPlan[] = input.settings.advanced.enabled ? [
    { id: `rookie__${input.seasonYear + 1}`, kind: "rookie", season: input.seasonYear + 1, rounds: input.settings.advanced.rookieDraftRounds, eligibleFranchiseIds: franchises, sourceOrphanFranchiseIds: [], status: "planned", revision: 1 },
    ...(input.settings.advanced.supplementalDrafts ? [{ id: `supplemental__${input.seasonYear + 1}`, kind: "supplemental" as const, season: input.seasonYear + 1, rounds: 1, eligibleFranchiseIds: franchises, sourceOrphanFranchiseIds: [], status: "planned" as const, revision: 1 }] : []),
    ...(input.settings.advanced.dispersalDrafts ? [{ id: `dispersal__${input.seasonYear + 1}`, kind: "dispersal" as const, season: input.seasonYear + 1, rounds: 0, eligibleFranchiseIds: [], sourceOrphanFranchiseIds: [], status: "planned" as const, revision: 1 }] : []),
  ] : [];
  return {
    seasonYear: input.seasonYear,
    futurePicks,
    keepers: [], contracts: [], deadCap: [], taxi: [], rfaTenders: [], franchiseTags: [], compensatoryPicks: [], draftPlans,
    orphanTeams: franchises.map((franchiseId) => ({ franchiseId, orphaned: false, orphanedAt: null, reason: "", eligibleForDispersal: false, adoptedAt: null, revision: 1 })),
  };
}

export function buildSalaryLedgers(settings: LeagueSettingsV1["advanced"], state: AdvancedLeagueState, season: number): SalaryLedger[] {
  const franchiseIds = new Set(state.orphanTeams.map((row) => row.franchiseId));
  for (const contract of state.contracts) franchiseIds.add(contract.franchiseId);
  for (const charge of state.deadCap) franchiseIds.add(charge.franchiseId);
  for (const contract of state.contracts) for (const retained of contract.retainedSalary) franchiseIds.add(retained.franchiseId);
  const active = new Map<string, number>(); const retained = new Map<string, number>(); const dead = new Map<string, number>();
  for (const contract of state.contracts) {
    if (!["active", "tagged"].includes(contract.status) || season < contract.startSeason || season > contract.endSeason) continue;
    const salary = Number(contract.salaryBySeason[String(season)] ?? 0);
    const retainedRows = contract.retainedSalary.filter((row) => row.season === season);
    const retainedTotal = retainedRows.reduce((sum, row) => sum + row.amount, 0);
    active.set(contract.franchiseId, (active.get(contract.franchiseId) ?? 0) + Math.max(0, salary - retainedTotal));
    for (const row of retainedRows) retained.set(row.franchiseId, (retained.get(row.franchiseId) ?? 0) + row.amount);
  }
  for (const charge of state.deadCap.filter((row) => row.season === season)) dead.set(charge.franchiseId, (dead.get(charge.franchiseId) ?? 0) + charge.amount);
  return [...franchiseIds].sort().map((franchiseId) => {
    const activeSalary = active.get(franchiseId) ?? 0; const retainedSalary = retained.get(franchiseId) ?? 0; const deadCap = dead.get(franchiseId) ?? 0; const totalCapCharge = activeSalary + retainedSalary + deadCap;
    return { franchiseId, season, activeSalary, retainedSalary, deadCap, totalCapCharge, capSpace: settings.salaryCap - totalCapCharge };
  });
}

function duplicateIds(rows: Array<{ id: string }>) {
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const row of rows) { if (seen.has(row.id)) duplicates.add(row.id); seen.add(row.id); }
  return [...duplicates];
}

export function validateAdvancedLeagueState(settings: LeagueSettingsV1, state: AdvancedLeagueState): AdvancedLeagueIssue[] {
  const issues: AdvancedLeagueIssue[] = [];
  const collections: Array<[string, Array<{ id: string }>]> = [
    ["futurePicks", state.futurePicks], ["keepers", state.keepers], ["contracts", state.contracts], ["deadCap", state.deadCap], ["taxi", state.taxi], ["rfaTenders", state.rfaTenders], ["franchiseTags", state.franchiseTags], ["compensatoryPicks", state.compensatoryPicks], ["draftPlans", state.draftPlans],
  ];
  for (const [field, rows] of collections) for (const id of duplicateIds(rows)) issues.push({ field, message: `Duplicate authoritative asset id ${id}.` });
  if (!settings.advanced.enabled && collections.some(([, rows]) => rows.length)) issues.push({ field: "advanced.enabled", message: "Advanced assets cannot exist while contract controls are disabled." });
  if (settings.keeper.enabled) {
    const byTeam = new Map<string, number>();
    for (const row of state.keepers.filter((keeper) => keeper.status === "declared")) {
      byTeam.set(row.franchiseId, (byTeam.get(row.franchiseId) ?? 0) + 1);
      const expected = calculateKeeperCost(settings.keeper, row.yearsKept);
      if (row.cost !== expected) issues.push({ field: `keepers.${row.id}.cost`, message: `Keeper cost must be ${expected} under the published escalation rule.` });
    }
    for (const [franchiseId, count] of byTeam) if (count > settings.keeper.maxKeepers) issues.push({ field: `keepers.${franchiseId}`, message: `${franchiseId} exceeds the ${settings.keeper.maxKeepers}-keeper limit.` });
  }
  if (!settings.advanced.enabled) return issues;
  const pickIds = new Set<string>();
  for (const pick of state.futurePicks) {
    const canonical = pickId(pick.season, pick.round, pick.originalFranchiseId);
    if (pick.id !== canonical || pickIds.has(canonical)) issues.push({ field: `futurePicks.${pick.id}`, message: "Each original season/round/franchise pick must have one permanent asset id." });
    pickIds.add(canonical);
    if (pick.season <= state.seasonYear || pick.season > state.seasonYear + settings.advanced.futurePickYears || pick.round < 1 || pick.round > settings.advanced.rookieDraftRounds) issues.push({ field: `futurePicks.${pick.id}`, message: "Future pick is outside the published tradable year or rookie-round window." });
  }
  const contractedPlayers = new Set<string>();
  for (const contract of state.contracts.filter((row) => ["active", "tagged"].includes(row.status))) {
    if (contractedPlayers.has(contract.playerId)) issues.push({ field: `contracts.${contract.playerId}`, message: "A player cannot have two active contracts." });
    contractedPlayers.add(contract.playerId);
    const length = contract.endSeason - contract.startSeason + 1;
    if (length < 1 || length > settings.advanced.maxContractYears) issues.push({ field: `contracts.${contract.id}`, message: "Contract length exceeds the published maximum." });
    if (contract.optionYears.length > settings.advanced.optionYears || contract.optionYears.some((year) => year < contract.startSeason || year > contract.endSeason)) issues.push({ field: `contracts.${contract.id}.optionYears`, message: "Contract option years exceed the published allowance or term." });
    if (contract.extensionOfContractId && !settings.advanced.extensions) issues.push({ field: `contracts.${contract.id}.extension`, message: "Extensions are disabled by the published rules." });
    for (let season = contract.startSeason; season <= contract.endSeason; season += 1) {
      const salary = Number(contract.salaryBySeason[String(season)] ?? Number.NaN);
      if (!Number.isFinite(salary) || salary < 0) issues.push({ field: `contracts.${contract.id}.salary.${season}`, message: "Every contract season needs a non-negative salary." });
      const retainedRows = contract.retainedSalary.filter((row) => row.season === season);
      if (retainedRows.some((row) => row.amount < 0)) issues.push({ field: `contracts.${contract.id}.retainedSalary`, message: "Retained salary cannot be negative." });
      const retained = retainedRows.reduce((sum, row) => sum + row.amount, 0);
      if (Number.isFinite(salary) && retained > salary * settings.advanced.maxSalaryRetentionPercent / 100) issues.push({ field: `contracts.${contract.id}.retainedSalary`, message: "Retained salary exceeds the published percentage limit." });
    }
    if (contract.exercisedOptionYears.some((year) => !contract.optionYears.includes(year))) issues.push({ field: `contracts.${contract.id}.exercisedOptionYears`, message: "Only a published option year can be exercised." });
  }
  for (const charge of state.deadCap) if (charge.amount < 0) issues.push({ field: `deadCap.${charge.id}`, message: "Dead-cap charges cannot be negative." });
  const taxiPlayers = new Set<string>(); const taxiCount = new Map<string, number>();
  for (const row of state.taxi.filter((entry) => entry.status === "taxi")) {
    if (taxiPlayers.has(row.playerId)) issues.push({ field: `taxi.${row.playerId}`, message: "A player cannot occupy two taxi squads." });
    taxiPlayers.add(row.playerId); taxiCount.set(row.franchiseId, (taxiCount.get(row.franchiseId) ?? 0) + 1);
    if (row.experienceSeasons > settings.advanced.taxiMaxExperienceSeasons) issues.push({ field: `taxi.${row.id}`, message: "Taxi player exceeds the experience limit." });
  }
  for (const [franchiseId, count] of taxiCount) if (count > settings.advanced.taxiSquadSlots) issues.push({ field: `taxi.${franchiseId}`, message: `${franchiseId} exceeds the taxi squad limit.` });
  if (!settings.advanced.restrictedFreeAgency && state.rfaTenders.some((row) => row.status === "open")) issues.push({ field: "rfaTenders", message: "Open restricted-free-agent tenders require RFA to be enabled." });
  const activeTags = new Map<string, number>(); for (const row of state.franchiseTags.filter((tag) => tag.status === "active")) activeTags.set(row.franchiseId, (activeTags.get(row.franchiseId) ?? 0) + 1);
  for (const [franchiseId, count] of activeTags) if (count > settings.advanced.franchiseTagsPerTeam) issues.push({ field: `franchiseTags.${franchiseId}`, message: `${franchiseId} exceeds the franchise-tag limit.` });
  if (!settings.advanced.orphanTeams && state.orphanTeams.some((row) => row.orphaned)) issues.push({ field: "orphanTeams", message: "Orphan-team workflow is disabled." });
  if (!settings.advanced.compensatoryPicks && state.compensatoryPicks.some((row) => row.status === "awarded")) issues.push({ field: "compensatoryPicks", message: "Compensatory picks are disabled." });
  for (const pick of state.compensatoryPicks.filter((row) => row.status === "awarded")) if (!pick.reason.trim() || pick.round < 1 || pick.round > settings.advanced.rookieDraftRounds) issues.push({ field: `compensatoryPicks.${pick.id}`, message: "Compensatory picks need a reason and a valid rookie-draft round." });
  for (const plan of state.draftPlans) {
    if (plan.kind === "supplemental" && !settings.advanced.supplementalDrafts) issues.push({ field: `draftPlans.${plan.id}`, message: "Supplemental drafts are disabled." });
    if (plan.kind === "dispersal" && !settings.advanced.dispersalDrafts) issues.push({ field: `draftPlans.${plan.id}`, message: "Dispersal drafts are disabled." });
  }
  const capSeasons = new Set<number>([state.seasonYear]);
  for (const contract of state.contracts) for (let season = contract.startSeason; season <= contract.endSeason; season += 1) capSeasons.add(season);
  for (const charge of state.deadCap) capSeasons.add(charge.season);
  for (const season of capSeasons) for (const ledger of buildSalaryLedgers(settings.advanced, state, season)) if (ledger.capSpace < 0) issues.push({ field: `salaryLedgers.${ledger.franchiseId}.${season}`, message: `${ledger.franchiseId} is ${Math.abs(ledger.capSpace)} over the ${season} salary cap.` });
  return issues;
}
