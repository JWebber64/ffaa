import type { Player } from "../types/draft";
import type {
  DraftAuctionPlayer,
  DraftSnapshotState,
  DraftTeam,
  RuntimeDraftSettings,
  RuntimeRosterSlot,
} from "../multiplayer/draftSnapshot";
import { isCpuManagerProfileId, type CpuManagerProfileId } from "../types/cpuManager";
import { getBidValidation, getDraftableRosterSlotCount } from "../multiplayer/bidRules";

const POSITION_ALIASES: Record<string, string> = {
  DEF: "DST",
  "D/ST": "DST",
};

const STARTER_NEED_WEIGHTS: Record<string, number> = {
  QB: 2.6,
  RB: 4.4,
  WR: 4.2,
  TE: 3.0,
  K: 2.2,
  DST: 2.3,
  DL: 2.6,
  LB: 2.8,
  DB: 2.4,
};

const FLEX_NEED_WEIGHTS: Record<string, number> = {
  RB: 2.2,
  WR: 2.3,
  TE: 1.8,
  DL: 1.8,
  LB: 2.0,
  DB: 1.7,
};

const BENCH_NEED_WEIGHTS: Record<string, number> = {
  QB: 0.55,
  RB: 1.45,
  WR: 1.35,
  TE: 0.8,
  K: 0.05,
  DST: 0.08,
  DL: 0.95,
  LB: 1.0,
  DB: 0.9,
};

const DEPTH_CAPS: Record<string, number> = {
  QB: 2,
  TE: 2,
  K: 1,
  DST: 1,
};

export type CpuManagerProfile = {
  id: CpuManagerProfileId;
  label: string;
  shortLabel: string;
  valueMultiplier: number;
  needWeight: number;
  depthNeedWeight: number;
  needSpendMultiplier: number;
  depthSpendMultiplier: number;
  starSpendMultiplier: number;
  starPriority: number;
  budgetCapMultiplier: number;
  bidJumpMultiplier: number;
  fallbackMinNeedTier: PlayerNeed["needTier"] | 4;
  bidConfidenceMultiplier: number;
  thinkDelayMultiplier: number;
};

export const CPU_MANAGER_PROFILES: CpuManagerProfile[] = [
  {
    id: "balanced",
    label: "Balanced",
    shortLabel: "BAL",
    valueMultiplier: 1,
    needWeight: 1,
    depthNeedWeight: 1,
    needSpendMultiplier: 1,
    depthSpendMultiplier: 1,
    starSpendMultiplier: 1,
    starPriority: 1,
    budgetCapMultiplier: 1,
    bidJumpMultiplier: 1,
    fallbackMinNeedTier: 1,
    bidConfidenceMultiplier: 1,
    thinkDelayMultiplier: 1,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    shortLabel: "AGG",
    valueMultiplier: 1.14,
    needWeight: 1.12,
    depthNeedWeight: 1.05,
    needSpendMultiplier: 1.12,
    depthSpendMultiplier: 1.04,
    starSpendMultiplier: 1.12,
    starPriority: 1.12,
    budgetCapMultiplier: 1.16,
    bidJumpMultiplier: 1.45,
    fallbackMinNeedTier: 1,
    bidConfidenceMultiplier: 1.18,
    thinkDelayMultiplier: 0.72,
  },
  {
    id: "frugal",
    label: "Frugal",
    shortLabel: "FRG",
    valueMultiplier: 0.82,
    needWeight: 0.94,
    depthNeedWeight: 0.72,
    needSpendMultiplier: 0.9,
    depthSpendMultiplier: 0.68,
    starSpendMultiplier: 0.92,
    starPriority: 0.92,
    budgetCapMultiplier: 0.78,
    bidJumpMultiplier: 0.48,
    fallbackMinNeedTier: 4,
    bidConfidenceMultiplier: 0.78,
    thinkDelayMultiplier: 1.28,
  },
  {
    id: "stars_and_scrubs",
    label: "Stars & Scrubs",
    shortLabel: "STAR",
    valueMultiplier: 0.96,
    needWeight: 0.96,
    depthNeedWeight: 0.5,
    needSpendMultiplier: 0.95,
    depthSpendMultiplier: 0.52,
    starSpendMultiplier: 1.32,
    starPriority: 1.48,
    budgetCapMultiplier: 1.08,
    bidJumpMultiplier: 1.22,
    fallbackMinNeedTier: 2,
    bidConfidenceMultiplier: 1.04,
    thinkDelayMultiplier: 0.88,
  },
  {
    id: "need_focused",
    label: "Need Focused",
    shortLabel: "NEED",
    valueMultiplier: 1,
    needWeight: 1.32,
    depthNeedWeight: 0.68,
    needSpendMultiplier: 1.18,
    depthSpendMultiplier: 0.72,
    starSpendMultiplier: 0.95,
    starPriority: 0.9,
    budgetCapMultiplier: 1.04,
    bidJumpMultiplier: 0.85,
    fallbackMinNeedTier: 2,
    bidConfidenceMultiplier: 1.1,
    thinkDelayMultiplier: 1.02,
  },
];

const DEFAULT_CPU_PROFILE = CPU_MANAGER_PROFILES[0]!;

type SlotBucket = {
  exact: Map<string, number>;
  flex: Array<Set<string>>;
  bench: number;
  ir: number;
};

type TeamNeedProfile = {
  bucket: SlotBucket;
  positionCounts: Map<string, number>;
  starterSlotsRemaining: number;
  openSlotsRemaining: number;
};

type PlayerNeed = {
  needTier: 0 | 1 | 2 | 3;
  needScore: number;
  exactNeed: number;
  flexNeed: number;
};

type MarketState = {
  availablePlayers: Player[];
  availableCountByPos: Map<string, number>;
  positionalRanks: Map<string, number>;
};

type PlayerEvaluation = PlayerNeed & {
  pos: string;
  posRank: number;
  scarcityBoost: number;
  maxBid: number;
  ceiling: number;
  score: number;
};

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getComputerProfileIndex(team: Pick<DraftTeam, "teamId" | "name" | "teamNumber">) {
  const nameMatch = String(team.name ?? "").match(/cpu\s*(\d+)/i);
  if (nameMatch?.[1]) {
    return Math.max(0, Number(nameMatch[1]) - 1);
  }

  return stableHash(`${team.teamId ?? ""}:${team.teamNumber ?? ""}:${team.name ?? ""}`);
}

export function getComputerManagerProfile(
  team: Pick<DraftTeam, "teamId" | "name" | "teamNumber" | "managerType" | "managerProfileId"> | null | undefined
) {
  if (!team || team.managerType !== "computer") return DEFAULT_CPU_PROFILE;
  if (isCpuManagerProfileId(team.managerProfileId)) {
    return CPU_MANAGER_PROFILES.find((profile) => profile.id === team.managerProfileId) ?? DEFAULT_CPU_PROFILE;
  }

  const index = getComputerProfileIndex(team);
  return CPU_MANAGER_PROFILES[index % CPU_MANAGER_PROFILES.length] ?? DEFAULT_CPU_PROFILE;
}

export function getComputerManagerThinkDelayMultiplier(
  team: Pick<DraftTeam, "teamId" | "name" | "teamNumber" | "managerType" | "managerProfileId"> | null | undefined
) {
  return getComputerManagerProfile(team).thinkDelayMultiplier;
}

export function getComputerManagerNominationDelayMultiplier(
  team: Pick<DraftTeam, "teamId" | "name" | "teamNumber" | "managerType" | "managerProfileId"> | null | undefined
) {
  return Math.max(0.22, Math.min(0.45, getComputerManagerProfile(team).thinkDelayMultiplier * 0.35));
}

function normalizePosition(pos: string | null | undefined) {
  if (!pos) return "";
  return POSITION_ALIASES[pos] ?? pos;
}

function getTotalRosterSlots(settings: RuntimeDraftSettings) {
  return getDraftableRosterSlotCount(settings.rosterSlots);
}

function buildSlotBucket(rosterSlots: RuntimeRosterSlot[]): SlotBucket {
  const exact = new Map<string, number>();
  const flex: Array<Set<string>> = [];
  let bench = 0;
  let ir = 0;

  for (const slot of rosterSlots) {
    const count = Math.max(0, Number(slot.count) || 0);
    if (count === 0) continue;

    if (slot.slot === "BENCH") {
      bench += count;
      continue;
    }

    if (slot.slot === "IR") {
      ir += count;
      continue;
    }

    if ((slot.slot === "FLEX" || slot.slot === "IDP_FLEX") && Array.isArray(slot.flexEligible)) {
      for (let index = 0; index < count; index += 1) {
        flex.push(new Set(slot.flexEligible.map(normalizePosition)));
      }
      continue;
    }

    exact.set(slot.slot, (exact.get(slot.slot) ?? 0) + count);
  }

  return { exact, flex, bench, ir };
}

function consumeExact(bucket: SlotBucket, pos: string) {
  const current = bucket.exact.get(pos) ?? 0;
  if (current <= 0) return false;
  if (current === 1) {
    bucket.exact.delete(pos);
  } else {
    bucket.exact.set(pos, current - 1);
  }
  return true;
}

function consumeFlex(bucket: SlotBucket, pos: string) {
  const slotIndex = bucket.flex.findIndex((slot) => slot.has(pos));
  if (slotIndex < 0) return false;
  bucket.flex.splice(slotIndex, 1);
  return true;
}

function consumeBench(bucket: SlotBucket) {
  if (bucket.bench <= 0) return false;
  bucket.bench -= 1;
  return true;
}

function applyRosterToSlotBucket(bucket: SlotBucket, team: DraftTeam) {
  for (const rosterEntry of team.roster ?? []) {
    const pos = normalizePosition(rosterEntry.pos);
    if (!pos) {
      consumeBench(bucket);
      continue;
    }

    if (consumeExact(bucket, pos)) continue;
    if (consumeFlex(bucket, pos)) continue;
    if (consumeBench(bucket)) continue;
    if (bucket.ir > 0) {
      bucket.ir -= 1;
    }
  }
}

function getTeamPositionCounts(team: DraftTeam) {
  const counts = new Map<string, number>();

  for (const rosterEntry of team.roster ?? []) {
    const pos = normalizePosition(rosterEntry.pos);
    if (!pos) continue;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }

  return counts;
}

function sumExactNeeds(bucket: SlotBucket) {
  let total = 0;
  for (const count of bucket.exact.values()) {
    total += count;
  }
  return total;
}

function buildTeamNeedProfile(team: DraftTeam, settings: RuntimeDraftSettings): TeamNeedProfile {
  const bucket = buildSlotBucket(settings.rosterSlots);
  applyRosterToSlotBucket(bucket, team);
  const positionCounts = getTeamPositionCounts(team);

  return {
    bucket,
    positionCounts,
    starterSlotsRemaining: sumExactNeeds(bucket) + bucket.flex.length,
    openSlotsRemaining: Math.max(0, getTotalRosterSlots(settings) - (team.roster?.length ?? 0)),
  };
}

function countFlexMatches(bucket: SlotBucket, pos: string) {
  return bucket.flex.reduce((sum, slot) => sum + (slot.has(pos) ? 1 : 0), 0);
}

function getBenchNeedWeight(pos: string, profile: TeamNeedProfile) {
  if (profile.bucket.bench <= 0) return 0;

  const rosteredAtPos = profile.positionCounts.get(pos) ?? 0;
  const depthCap = DEPTH_CAPS[pos] ?? Number.MAX_SAFE_INTEGER;
  if (rosteredAtPos >= depthCap) return 0;

  let weight = BENCH_NEED_WEIGHTS[pos] ?? 0.7;
  if (weight <= 0) return 0;

  if (profile.starterSlotsRemaining > 0) {
    if (pos === "RB" || pos === "WR") {
      weight *= 0.88;
    } else if (pos === "TE") {
      weight *= 0.68;
    } else if (pos === "QB") {
      weight *= 0.45;
    } else {
      weight *= 0.2;
    }
  }

  if (rosteredAtPos > 0) {
    if (pos === "QB") {
      weight *= 0.65 ** rosteredAtPos;
    } else if (pos === "TE") {
      weight *= 0.78 ** rosteredAtPos;
    } else {
      weight *= 0.92 ** Math.max(0, rosteredAtPos - 1);
    }
  }

  return weight;
}

function evaluateNeed(profile: TeamNeedProfile, pos: string): PlayerNeed {
  if (!pos) {
    return {
      needTier: profile.bucket.bench > 0 ? 1 : 0,
      needScore: profile.bucket.bench > 0 ? 0.25 : 0,
      exactNeed: 0,
      flexNeed: 0,
    };
  }

  const exactNeed = profile.bucket.exact.get(pos) ?? 0;
  const flexNeed = countFlexMatches(profile.bucket, pos);
  const benchWeight = getBenchNeedWeight(pos, profile);
  const benchMultiplier =
    profile.bucket.bench > 0 ? 1 + Math.min(Math.max(profile.bucket.bench - 1, 0), 3) * 0.18 : 0;

  let needTier: 0 | 1 | 2 | 3 = 0;
  let needScore = 0;

  if (exactNeed > 0) {
    needTier = 3;
    needScore += exactNeed * (STARTER_NEED_WEIGHTS[pos] ?? 2.4);
  }

  if (flexNeed > 0) {
    needTier = needTier < 2 ? 2 : needTier;
    needScore += flexNeed * (FLEX_NEED_WEIGHTS[pos] ?? 1.5);
  }

  if (benchWeight > 0) {
    needTier = needTier < 1 ? 1 : needTier;
    needScore += benchWeight * benchMultiplier;
  }

  return {
    needTier,
    needScore,
    exactNeed,
    flexNeed,
  };
}

function toAuctionPlayer(player: Player): DraftAuctionPlayer {
  const auctionPlayer: DraftAuctionPlayer = {
    playerId: player.id,
    name: player.name,
    pos: normalizePosition(player.pos),
  };

  if (player.nflTeam) auctionPlayer.team = player.nflTeam;
  if (typeof player.byeWeek === "number") auctionPlayer.byeWeek = player.byeWeek;
  if (typeof player.auctionValue === "number") auctionPlayer.auctionValue = player.auctionValue;
  if (typeof player.marketValue === "number") auctionPlayer.marketValue = player.marketValue;
  if (typeof player.projectedValue === "number") auctionPlayer.projectedValue = player.projectedValue;
  if (typeof player.projectedPoints === "number") auctionPlayer.projectedPoints = player.projectedPoints;
  if (typeof player.valueConfidence === "number") auctionPlayer.valueConfidence = player.valueConfidence;
  if (player.valueSources?.length) auctionPlayer.valueSources = player.valueSources;

  return auctionPlayer;
}

function getPlayerRank(player: Player) {
  const rank = player.rank ?? player.adp ?? player.search_rank ?? player.search_rank_ppr ?? 9999;
  return Math.max(1, Math.round(rank));
}

function getAvailablePlayers(playerPool: Player[], snapshot: DraftSnapshotState) {
  const drafted = new Set<string>();
  for (const team of snapshot.teams ?? []) {
    for (const rosterEntry of team.roster ?? []) {
      if (rosterEntry.playerId) drafted.add(rosterEntry.playerId);
    }
  }

  return playerPool.filter((player) => !drafted.has(player.id));
}

function buildMarketState(playerPool: Player[], snapshot: DraftSnapshotState): MarketState {
  const availablePlayers = getAvailablePlayers(playerPool, snapshot);
  const availableCountByPos = new Map<string, number>();
  const byPosition = new Map<string, Player[]>();

  for (const player of availablePlayers) {
    const pos = normalizePosition(player.pos);
    availableCountByPos.set(pos, (availableCountByPos.get(pos) ?? 0) + 1);

    const group = byPosition.get(pos) ?? [];
    group.push(player);
    byPosition.set(pos, group);
  }

  const positionalRanks = new Map<string, number>();
  for (const players of byPosition.values()) {
    players
      .slice()
      .sort((left, right) => getPlayerRank(left) - getPlayerRank(right))
      .forEach((player, index) => {
        positionalRanks.set(player.id, index + 1);
      });
  }

  return {
    availablePlayers,
    availableCountByPos,
    positionalRanks,
  };
}

function getPositionScarcityBoost(pos: string, market: MarketState) {
  const count = market.availableCountByPos.get(pos) ?? 0;
  if (count <= 0) return 1.2;

  if (pos === "K" || pos === "DST") {
    return count <= 6 ? 0.95 : 0.9;
  }

  if (count <= 6) return 1.18;
  if (count <= 12) return 1.12;
  if (count <= 20) return 1.06;
  return 1;
}

function getTeamMaxBid(team: DraftTeam, settings: RuntimeDraftSettings) {
  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const rosterSpotsRemaining = Math.max(0, getTotalRosterSlots(settings) - (team.roster?.length ?? 0));
  const reserve = Math.max(0, rosterSpotsRemaining - 1);
  return Math.max(0, remainingBudget - reserve);
}

function getProjectedAuctionValue(player: Player, settings: RuntimeDraftSettings) {
  const value = player.auctionValue ?? player.projectedValue;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;

  const sourceBudget = 200;
  const targetBudget = settings.startingBudget > 0 ? settings.startingBudget : sourceBudget;
  return Math.max(1, Math.round((value * targetBudget) / sourceBudget));
}

function applyManagerNeedProfile(
  need: PlayerNeed,
  managerProfile: CpuManagerProfile
): PlayerNeed {
  const multiplier =
    need.needTier === 1 ? managerProfile.depthNeedWeight : managerProfile.needWeight;

  return {
    ...need,
    needScore: need.needScore * multiplier,
  };
}

function getStarProfileMultiplier(rank: number, managerProfile: CpuManagerProfile) {
  if (rank <= 24) return managerProfile.starSpendMultiplier;
  if (rank <= 60) {
    return 1 + (managerProfile.starSpendMultiplier - 1) * 0.4;
  }
  return 1;
}

function getNeedSpendProfileMultiplier(
  needTier: PlayerNeed["needTier"],
  managerProfile: CpuManagerProfile
) {
  if (needTier === 3) return managerProfile.needSpendMultiplier;
  if (needTier === 2) return 1 + (managerProfile.needSpendMultiplier - 1) * 0.55;
  if (needTier === 1) return managerProfile.depthSpendMultiplier;
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getKnownValueCeilingMultiplier(
  player: Player,
  need: PlayerNeed,
  rank: number,
  scarcityBoost: number,
  managerProfile: CpuManagerProfile
) {
  let multiplier = need.needTier === 3 ? 1.06 : need.needTier === 2 ? 1 : 0.88;

  if (rank <= 12) {
    multiplier += 0.08;
  } else if (rank <= 24) {
    multiplier += 0.05;
  } else if (rank <= 60) {
    multiplier += 0.02;
  } else if (rank > 120) {
    multiplier -= 0.04;
  }

  if (managerProfile.id === "aggressive") {
    multiplier += 0.06;
  } else if (managerProfile.id === "frugal") {
    multiplier -= 0.12;
  } else if (managerProfile.id === "need_focused" && need.needTier >= 2) {
    multiplier += 0.03;
  } else if (managerProfile.id === "stars_and_scrubs") {
    multiplier += rank <= 24 ? 0.08 : -0.06;
  }

  if (need.needTier >= 2 && scarcityBoost > 1) {
    multiplier += Math.min(0.04, (scarcityBoost - 1) * 0.2);
  }

  if (need.needTier === 3 && need.exactNeed + need.flexNeed >= 2) {
    multiplier += 0.02;
  }

  if (typeof player.valueConfidence === "number") {
    multiplier += Math.min(0.02, Math.max(0, player.valueConfidence) * 0.02);
  }

  let hardCap = rank <= 12 ? 1.24 : rank <= 24 ? 1.18 : rank <= 60 ? 1.13 : 1.08;
  if (need.needTier <= 1) {
    hardCap = Math.min(hardCap, 0.96);
  }
  if (managerProfile.id === "frugal") {
    hardCap = Math.min(hardCap, rank <= 24 && need.needTier >= 3 ? 1.06 : 0.96);
  }

  return clamp(multiplier, need.needTier <= 1 ? 0.55 : 0.75, hardCap);
}

function estimatePlayerCeiling(
  team: DraftTeam,
  settings: RuntimeDraftSettings,
  profile: TeamNeedProfile,
  player: Player,
  need: PlayerNeed,
  market: MarketState,
  managerProfile: CpuManagerProfile
) {
  const maxBid = getTeamMaxBid(team, settings);
  if (maxBid <= 0) return 0;

  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const openSlots = Math.max(1, profile.openSlotsRemaining);
  const averageSpendPerOpenSlot = remainingBudget / openSlots;
  const rank = getPlayerRank(player);
  const posRank = market.positionalRanks.get(player.id) ?? 99;
  const scarcityBoost = getPositionScarcityBoost(normalizePosition(player.pos), market);
  const projectedValue = getProjectedAuctionValue(player, settings);
  const marketBase = projectedValue ?? (settings.startingBudget * 0.64) / Math.sqrt(rank + 2);
  const needMultiplier = projectedValue
    ? 0.86 + Math.min(0.42, need.needScore * 0.06)
    : 0.74 + Math.min(0.78, need.needScore * 0.12);
  const posRankMultiplier =
    posRank <= 3 ? 1.18 : posRank <= 8 ? 1.1 : posRank <= 16 ? 1.04 : 0.98;
  const lateRoundMultiplier =
    need.needTier === 3 && profile.openSlotsRemaining <= Math.max(3, need.exactNeed + need.flexNeed + 1)
      ? 1.1
      : 1;
  const budgetCapMultiplier =
    need.needTier === 3 ? 3.4 : need.needTier === 2 ? 2.8 : 1.9;
  const prudentCap = averageSpendPerOpenSlot * budgetCapMultiplier * managerProfile.budgetCapMultiplier;
  const confidenceMultiplier =
    projectedValue && typeof player.valueConfidence === "number"
      ? 0.9 + Math.min(0.16, Math.max(0, player.valueConfidence) * 0.16)
      : 1;
  const knownValueCeiling = projectedValue
    ? projectedValue * getKnownValueCeilingMultiplier(player, need, rank, scarcityBoost, managerProfile)
    : Number.POSITIVE_INFINITY;
  const starProfileMultiplier = getStarProfileMultiplier(rank, managerProfile);
  const needSpendProfileMultiplier = getNeedSpendProfileMultiplier(need.needTier, managerProfile);
  const rawCeiling =
    marketBase *
    needMultiplier *
    scarcityBoost *
    posRankMultiplier *
    lateRoundMultiplier *
    confidenceMultiplier *
    managerProfile.valueMultiplier *
    starProfileMultiplier *
    needSpendProfileMultiplier;

  return Math.max(1, Math.round(Math.min(maxBid, prudentCap, knownValueCeiling, rawCeiling)));
}

function evaluatePlayerForTeam(
  team: DraftTeam,
  profile: TeamNeedProfile,
  player: Player,
  settings: RuntimeDraftSettings,
  market: MarketState,
  managerProfile: CpuManagerProfile
): PlayerEvaluation {
  const pos = normalizePosition(player.pos);
  const need = applyManagerNeedProfile(evaluateNeed(profile, pos), managerProfile);
  const posRank = market.positionalRanks.get(player.id) ?? 99;
  const scarcityBoost = getPositionScarcityBoost(pos, market);
  const maxBid = getTeamMaxBid(team, settings);
  const ceiling = estimatePlayerCeiling(team, settings, profile, player, need, market, managerProfile);
  const rankScore = Math.max(0, 7000 - getPlayerRank(player) * 24);
  const positionalScore = Math.max(0, 420 - posRank * 10);
  const scarcityScore = Math.round(scarcityBoost * 450);
  const ceilingScore = Math.min(ceiling, 500);
  const starAdjustedRankScore = rankScore * managerProfile.starPriority;
  const score = Math.round(
    need.needScore * 10000 +
      starAdjustedRankScore +
      positionalScore +
      scarcityScore +
      ceilingScore
  );

  return {
    ...need,
    pos,
    posRank,
    scarcityBoost,
    maxBid,
    ceiling,
    score,
  };
}

function getNominationValueScore(
  player: Player,
  settings: RuntimeDraftSettings,
  market: MarketState,
  managerProfile: CpuManagerProfile
) {
  const projectedValue = getProjectedAuctionValue(player, settings);
  const rank = getPlayerRank(player);
  const posRank = market.positionalRanks.get(player.id) ?? 99;
  const valueScore = projectedValue !== null ? projectedValue * 120 : Math.max(0, 5000 - rank * 35);
  const rankScore = Math.max(0, 1200 - rank * 8) * managerProfile.starPriority;
  const posRankScore = Math.max(0, 300 - posRank * 8);

  return Math.round(valueScore + rankScore + posRankScore);
}

function chooseBidAmount(
  currentBid: number,
  desiredBid: number,
  bidIncrements: number[],
  needTier: PlayerNeed["needTier"],
  managerProfile: CpuManagerProfile
) {
  const headroom = desiredBid - currentBid;
  if (headroom <= 0) return null;

  const increments = bidIncrements
    .map((value) => Math.max(1, Math.round(value)))
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort((left, right) => left - right);

  const affordableIncrements = increments.filter((value) => value <= headroom);
  if (affordableIncrements.length === 0) return null;
  const minAffordableIncrement = affordableIncrements[0]!;

  const targetJump =
    needTier === 3
      ? Math.min(headroom * 0.24, minAffordableIncrement * 5)
      : needTier === 2
        ? Math.min(headroom * 0.16, minAffordableIncrement * 3)
        : minAffordableIncrement;
  const jumpBudget = Math.max(
    minAffordableIncrement,
    Math.ceil(targetJump * managerProfile.bidJumpMultiplier)
  );

  let increment = minAffordableIncrement;
  for (const candidate of affordableIncrements) {
    if (candidate <= jumpBudget) {
      increment = candidate;
    }
  }

  return currentBid + increment;
}

export function chooseComputerNomination(
  snapshot: DraftSnapshotState,
  team: DraftTeam,
  playerPool: Player[]
) {
  const settings = snapshot.settings;
  if (!settings) return null;

  const market = buildMarketState(playerPool, snapshot);
  const profile = buildTeamNeedProfile(team, settings);
  const managerProfile = getComputerManagerProfile(team);
  if (getTeamMaxBid(team, settings) <= 0) return null;

  let bestNeedPlayer: Player | null = null;
  let bestNeedScore = -1;
  let bestValuePlayer: Player | null = null;
  let bestValueScore = -1;

  for (const player of market.availablePlayers) {
    const evaluation = evaluatePlayerForTeam(team, profile, player, settings, market, managerProfile);
    const valueScore = getNominationValueScore(player, settings, market, managerProfile);
    const canSpendOnPlayer = evaluation.ceiling >= 1;

    if (canSpendOnPlayer && evaluation.needTier >= 2 && evaluation.score > bestNeedScore) {
      bestNeedPlayer = player;
      bestNeedScore = evaluation.score;
    }

    if (valueScore > bestValueScore) {
      bestValuePlayer = player;
      bestValueScore = valueScore;
    }
  }

  const bestPlayer = bestNeedPlayer ?? bestValuePlayer;

  return bestPlayer ? toAuctionPlayer(bestPlayer) : null;
}

export function chooseComputerSnakePick(
  snapshot: DraftSnapshotState,
  team: DraftTeam,
  playerPool: Player[]
) {
  const settings = snapshot.settings;
  if (!settings) return null;

  const market = buildMarketState(playerPool, snapshot);
  const profile = buildTeamNeedProfile(team, settings);
  const managerProfile = getComputerManagerProfile(team);
  let bestPlayer: Player | null = null;
  let bestScore = -1;

  for (const player of market.availablePlayers) {
    const evaluation = evaluatePlayerForTeam(team, profile, player, settings, market, managerProfile);
    if (evaluation.needTier === 0) continue;

    if (evaluation.score > bestScore) {
      bestPlayer = player;
      bestScore = evaluation.score;
    }
  }

  if (!bestPlayer) {
    bestPlayer =
      market.availablePlayers
        .slice()
        .sort((left, right) => getPlayerRank(left) - getPlayerRank(right))[0] ?? null;
  }

  return bestPlayer ? toAuctionPlayer(bestPlayer) : null;
}

export function chooseComputerBid(
  snapshot: DraftSnapshotState,
  playerPool: Player[]
) {
  const settings = snapshot.settings;
  const currentPlayerId = snapshot.auction?.player?.playerId;
  if (!settings || !currentPlayerId) return null;

  const market = buildMarketState(playerPool, snapshot);
  const currentPlayer =
    market.availablePlayers.find((player) => player.id === currentPlayerId) ??
    playerPool.find((player) => player.id === currentPlayerId);
  if (!currentPlayer) return null;

  const increments = settings.bidIncrements
    .map((value) => Math.max(1, Math.round(value)))
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort((left, right) => left - right);
  const minIncrement = Math.max(1, increments[0] ?? 1);
  const currentBid = Math.max(0, snapshot.auction?.currentBid ?? 0);
  const nextBid = currentBid + minIncrement;
  const highBidderTeamId = snapshot.auction?.highBidderTeamId ?? null;

  let bestDecision: { teamId: string; amount: number; confidence: number } | null = null;
  let fallbackDecision: { teamId: string; amount: number; confidence: number } | null = null;

  for (const team of snapshot.teams ?? []) {
    if (team.managerType !== "computer") continue;
    if (team.teamId === highBidderTeamId) continue;
    if (!getBidValidation(snapshot, team.teamId, nextBid).canBid) continue;

    const profile = buildTeamNeedProfile(team, settings);
    const managerProfile = getComputerManagerProfile(team);
    const evaluation = evaluatePlayerForTeam(team, profile, currentPlayer, settings, market, managerProfile);
    if (evaluation.needTier === 0) continue;
    if (evaluation.maxBid < nextBid) continue;

    if (evaluation.ceiling < nextBid) {
      if (getProjectedAuctionValue(currentPlayer, settings) !== null) continue;
      if (evaluation.needTier < managerProfile.fallbackMinNeedTier) continue;
      const confidence = evaluation.score;
      if (!fallbackDecision || confidence > fallbackDecision.confidence) {
        fallbackDecision = {
          teamId: team.teamId,
          amount: nextBid,
          confidence,
        };
      }
      continue;
    }

    const amount = chooseBidAmount(
      currentBid,
      evaluation.ceiling,
      increments,
      evaluation.needTier,
      managerProfile
    );
    if (amount === null || amount < nextBid) continue;
    if (!getBidValidation(snapshot, team.teamId, amount).canBid) continue;

    const confidence =
      (evaluation.score + Math.max(0, evaluation.ceiling - amount) * 25) *
      managerProfile.bidConfidenceMultiplier;
    if (!bestDecision || confidence > bestDecision.confidence) {
      bestDecision = {
        teamId: team.teamId,
        amount,
        confidence,
      };
    }
  }

  if (!bestDecision && !fallbackDecision) return null;

  const decision = bestDecision ?? fallbackDecision!;

  return {
    teamId: decision.teamId,
    amount: decision.amount,
  };
}
