export type ScoringFormat = "standard" | "half_ppr" | "ppr";

export type AuctionSourceType =
  | "expert_projection"
  | "market_aav"
  | "custom_calculator"
  | "community_sheet"
  | "external_sheet"
  | "archive";

export type AuctionSourceAccess =
  | "public"
  | "registration_required"
  | "partial"
  | "paid"
  | "unavailable";

export type SourceDirectoryCategory =
  | "current_values"
  | "market_tools"
  | "community"
  | "restricted"
  | "archive";

export type SourceVerificationStatus = "verified" | "partial" | "archived" | "unavailable";

export type AuctionValueSource = {
  id: string;
  name: string;
  shortName: string;
  sourceType: AuctionSourceType;
  category: SourceDirectoryCategory;
  sourceUrl: string;
  season?: number;
  formats: ScoringFormat[];
  supportedLeagueSizes: number[];
  defaultLeagueSize?: number;
  sourceBudget?: number;
  qbFormat: "one_qb" | "superflex" | "both" | "unknown";
  access: AuctionSourceAccess;
  comparisonReady: boolean;
  printableInsideFFAA: boolean;
  externalOnly: boolean;
  requiresRegistration?: boolean;
  partialAccess?: boolean;
  sourceUpdatedAt?: string;
  importedAt?: string;
  importedPlayerCount?: number;
  importedRowCount?: number;
  rosterAssumptions?: string;
  notes: string;
  verificationStatus: SourceVerificationStatus;
  verifiedAt: string;
};

export type AuctionPlayerValue = {
  sourceId: string;
  season: number;
  scoringFormat: ScoringFormat;
  leagueSize?: number;
  sourceBudget: number;
  playerId: string;
  playerName: string;
  position: string;
  nflTeam?: string;
  byeWeek?: number;
  rank?: number;
  rawValue: number;
  sourceUpdatedAt?: string;
  matched: boolean;
};

export type AuctionValueMode = "raw" | "normalized";

export type AuctionSortKey =
  | "player"
  | "position"
  | "team"
  | "average"
  | "median"
  | "minimum"
  | "maximum"
  | "spread"
  | "count"
  | "expert"
  | "market"
  | "difference"
  | `source:${string}`;

export type SourceCompatibility = {
  compatible: boolean;
  reasons: string[];
};

export type ComparisonSourceValue = {
  sourceId: string;
  rawValue: number;
  normalizedValue: number;
  displayValue: number;
  includedInConsensus: boolean;
};

export type AuctionComparisonRow = {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam?: string;
  byeWeek?: number;
  sourceValues: Record<string, ComparisonSourceValue | undefined>;
  average: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  spread: number | null;
  contributingSourceCount: number;
  expertFairValue: number | null;
  marketAav: number | null;
  fairMarketDifference: number | null;
};

export type PlayerMatchWarning = {
  sourceId: string;
  playerName: string;
  position: string;
  nflTeam?: string;
  reason: "unmatched" | "ambiguous";
};
