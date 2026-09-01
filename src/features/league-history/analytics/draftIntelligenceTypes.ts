import type { HistoryCoverageStatus } from "../domain/types";

export type DraftPriceBandId = "value" | "core" | "premium" | "unknown";

export interface DraftPriceBand {
  id: DraftPriceBandId;
  label: string;
  maximumPrice: number | null;
}

export interface DraftReceipt {
  id: string;
  draftId: string;
  seasonId: string;
  season: number;
  managerId: string | null;
  managerName: string;
  franchiseId: string | null;
  franchiseName: string;
  providerPlayerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  price: number | null;
  isKeeper: boolean;
  priceBand: DraftPriceBand;
  ledgerStatus: HistoryCoverageStatus;
  provisional: boolean;
  observedWeeks: number[];
  observedRosterWeeks: number;
  starterWeeks: number;
  startedPoints: number;
  rosteredPoints: number;
  pointsPerDollar: number | null;
  comparablePercentile: number | null;
  comparableCount: number;
  exclusions: string[];
}

export interface DraftDNADistribution {
  id: string;
  label: string;
  purchases: number;
  spend: number;
  spendShare: number;
}

export interface ManagerDraftDNA {
  id: string;
  managerId: string;
  managerName: string;
  seasons: number[];
  purchases: number;
  keepers: number;
  totalSpend: number;
  averagePrice: number | null;
  medianPrice: number | null;
  topThreeSpendShare: number | null;
  startedPoints: number;
  starterWeeks: number;
  pointsPerDollar: number | null;
  eligibleReceipts: number;
  excludedReceipts: number;
  provisional: boolean;
  positionSpend: DraftDNADistribution[];
  priceBands: DraftDNADistribution[];
  repeatTargets: Array<{ providerPlayerId: string; playerName: string; seasons: number[] }>;
}

export interface DraftIntelligenceResult {
  receipts: DraftReceipt[];
  keepers: DraftReceipt[];
  managers: ManagerDraftDNA[];
  availableSeasons: number[];
  observationStartWeek: number | null;
  observationEndWeek: number | null;
  provisional: boolean;
  exclusions: Record<string, number>;
}

export interface DraftIntelligenceFilters {
  season?: number | null;
  managerId?: string | null;
}
