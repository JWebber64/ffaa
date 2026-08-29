import type { SleeperLeagueConnectionSummary } from "../features/league-hq/sleeperConnections";
import {
  FLEX_ELIGIBLE,
  SLOT_TYPES,
  type RosterSlot,
  type ScoringType,
} from "../types/draftConfig";

export type OfflineDraftProfileSource = "custom" | "default" | "league" | "legacy";

export interface OfflineDraftLeagueProfile {
  leagueId: string;
  leagueName: string;
  teamCount: number;
  defaultBudget: number;
  scoring: ScoringType;
  rosterSlots: RosterSlot[];
}

export interface OfflineDraftProfileConfigLike {
  teamCount: number;
  defaultBudget: number;
  scoring: ScoringType;
  rosterSlots: RosterSlot[];
  profileSource?: OfflineDraftProfileSource;
  profileLeagueId?: string;
}

const slotTypeSet = new Set<string>(SLOT_TYPES);
const GOAT_LEAGUE_ID = "1385319428408774656";
const GOAT_ROSTER_SLOTS: RosterSlot[] = [
  { slot: "QB", count: 1 },
  { slot: "RB", count: 2 },
  { slot: "WR", count: 3 },
  { slot: "TE", count: 1 },
  { slot: "FLEX", count: 1, flexEligible: [...FLEX_ELIGIBLE] },
  { slot: "BENCH", count: 4 },
];

function normalizedLeagueSlotName(value: unknown) {
  const slot = String(value ?? "").trim().toUpperCase();
  if (slot === "DEF" || slot === "D/ST") return "DST";
  if (slot === "BN") return "BENCH";
  return slot;
}

function leagueRosterSlots(connection: SleeperLeagueConnectionSummary) {
  const counts = new Map<RosterSlot["slot"], number>();
  for (const entry of connection.auctionSettings?.rosterSlots ?? []) {
    const slot = normalizedLeagueSlotName(entry.slot);
    const count = Math.max(0, Math.round(Number(entry.count) || 0));
    if (!slotTypeSet.has(slot) || count <= 0) continue;
    const typedSlot = slot as RosterSlot["slot"];
    counts.set(typedSlot, (counts.get(typedSlot) ?? 0) + count);
  }

  // The commissioner-confirmed 2026 G.O.A.T. roster has three starting WRs.
  // Keep that contract when a previously cached Sleeper summary is one WR stale.
  if (connection.leagueId === GOAT_LEAGUE_ID) {
    counts.set("WR", Math.max(counts.get("WR") ?? 0, 3));
  }

  return [...counts.entries()].map(([slot, count]): RosterSlot => ({
    slot,
    count,
    ...(slot === "FLEX" ? { flexEligible: [...FLEX_ELIGIBLE] } : {}),
  }));
}

export function createOfflineDraftLeagueProfile(
  connection: SleeperLeagueConnectionSummary | null | undefined,
  fallbackLeagueId = "",
): OfflineDraftLeagueProfile | null {
  const settings = connection?.auctionSettings;
  const leagueId = connection?.leagueId || fallbackLeagueId;
  if (!settings && leagueId !== GOAT_LEAGUE_ID) return null;
  const rosterSlots = settings
    ? leagueRosterSlots(connection as SleeperLeagueConnectionSummary)
    : GOAT_ROSTER_SLOTS.map((slot) => ({
        ...slot,
        ...(slot.flexEligible ? { flexEligible: [...slot.flexEligible] } : {}),
      }));
  if (!rosterSlots.length) return null;

  return {
    leagueId,
    leagueName: connection?.leagueName || "G.O.A.T. League",
    teamCount: (settings?.teamCount ?? connection?.totalRosters) || 12,
    defaultBudget: settings?.budget ?? 200,
    scoring: settings ? (settings.scoring === "halfPpr" ? "half_ppr" : settings.scoring) : "ppr",
    rosterSlots,
  };
}

function rosterSlotCounts(slots: readonly RosterSlot[]) {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    const name = normalizedLeagueSlotName(slot.slot);
    counts.set(name, (counts.get(name) ?? 0) + Math.max(0, Math.round(Number(slot.count) || 0)));
  }
  return counts;
}

function rosterProfilesMatch(left: readonly RosterSlot[], right: readonly RosterSlot[]) {
  const leftCounts = rosterSlotCounts(left);
  const rightCounts = rosterSlotCounts(right);
  const names = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  return [...names].every((name) => (leftCounts.get(name) ?? 0) === (rightCounts.get(name) ?? 0));
}

function isOnlyOneReceiverShort(current: readonly RosterSlot[], expected: readonly RosterSlot[]) {
  const currentCounts = rosterSlotCounts(current);
  const expectedCounts = rosterSlotCounts(expected);
  const names = new Set([...currentCounts.keys(), ...expectedCounts.keys()]);
  return [...names].every((name) => {
    const currentCount = currentCounts.get(name) ?? 0;
    const expectedCount = expectedCounts.get(name) ?? 0;
    return name === "WR" ? currentCount + 1 === expectedCount : currentCount === expectedCount;
  });
}

function profileMatchesConfig(config: OfflineDraftProfileConfigLike, profile: OfflineDraftLeagueProfile) {
  return config.teamCount === profile.teamCount
    && config.defaultBudget === profile.defaultBudget
    && config.scoring === profile.scoring
    && rosterProfilesMatch(config.rosterSlots, profile.rosterSlots);
}

export function shouldApplyOfflineDraftLeagueProfile(
  config: OfflineDraftProfileConfigLike,
  profile: OfflineDraftLeagueProfile,
  hasRosteredPlayers: boolean,
) {
  if (hasRosteredPlayers) return false;
  if (config.profileSource === "custom") {
    return profile.leagueId === GOAT_LEAGUE_ID
      && config.teamCount === profile.teamCount
      && config.defaultBudget === profile.defaultBudget
      && config.scoring === profile.scoring
      && isOnlyOneReceiverShort(config.rosterSlots, profile.rosterSlots);
  }
  if (config.profileSource === "default") return true;
  if (config.profileSource === "league") {
    return config.profileLeagueId !== profile.leagueId || !profileMatchesConfig(config, profile);
  }
  return rosterProfilesMatch(config.rosterSlots, profile.rosterSlots)
    || isOnlyOneReceiverShort(config.rosterSlots, profile.rosterSlots);
}

export function applyOfflineDraftLeagueProfile<T extends OfflineDraftProfileConfigLike>(
  config: T,
  profile: OfflineDraftLeagueProfile,
): T {
  return {
    ...config,
    teamCount: profile.teamCount,
    defaultBudget: profile.defaultBudget,
    scoring: profile.scoring,
    rosterSlots: profile.rosterSlots.map((slot) => ({
      ...slot,
      ...(slot.flexEligible ? { flexEligible: [...slot.flexEligible] } : {}),
    })),
    profileSource: "league",
    profileLeagueId: profile.leagueId,
  };
}

export function markOfflineDraftProfileCustom<T extends OfflineDraftProfileConfigLike>(config: T): T {
  return {
    ...config,
    profileSource: "custom",
    profileLeagueId: undefined,
  };
}
