import type { ToolPlayer, ToolPosition } from "../../data/toolPlayerData";

export const OFFLINE_DRAFT_STORAGE_KEY = "ffaa.offlineDraft.v1";
export const DEFAULT_REGULAR_SEASON_WEEKS = 14;

export type LeagueSeasonSource = "shared" | "local" | "published";
export type LeagueSeasonScoring = "standard" | "half_ppr" | "ppr";

export type LeagueSeasonRosterSlot = {
  slot: string;
  count: number;
  flexEligible?: string[];
};

export type LeagueSeasonRosterPlayer = {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  byeWeek: number | null;
  price: number;
  assignedSlot: string;
};

export type LeagueFranchise = {
  id: string;
  displayName: string;
  teamNumber: number;
  budget: number;
  spent: number;
  remaining: number;
  roster: LeagueSeasonRosterPlayer[];
};

export type LeagueSeasonDraft = {
  leagueId: string;
  source: LeagueSeasonSource;
  revision: number;
  updatedAt: string;
  scoring: LeagueSeasonScoring;
  rosterSlots: LeagueSeasonRosterSlot[];
  defaultBudget: number;
  isOpen: boolean;
  franchises: LeagueFranchise[];
};

export type ProjectedRosterPlayer = LeagueSeasonRosterPlayer & {
  projection: ToolPlayer | null;
  baselinePoints: number | null;
  isOnBye: boolean;
};

export type ProjectedLineupSlot = {
  key: string;
  slot: string;
  label: string;
  player: ProjectedRosterPlayer | null;
};

export type ProjectedLineup = {
  slots: ProjectedLineupSlot[];
  bench: ProjectedRosterPlayer[];
  projectedTotal: number;
  projectedStarterCount: number;
  starterCount: number;
  missingStarterCount: number;
};

export type LeagueScheduleMatchup = {
  id: string;
  week: number;
  homeFranchiseId: string;
  awayFranchiseId: string;
};

export type LeagueLineupAssignments = Record<string, string>;

export type LeagueLineupSlotDefinition = {
  key: string;
  slot: string;
  label: string;
  flexEligible?: string[];
};

type ParseLeagueSeasonDraftOptions = {
  leagueId: string;
  source: LeagueSeasonSource;
  revision?: number;
  updatedAt?: string;
};

type ProjectionLookup = {
  byId: Map<string, ToolPlayer>;
  byNameAndPosition: Map<string, ToolPlayer>;
};

const SLOT_ALIASES: Record<string, string> = {
  DEF: "DST",
  "D/ST": "DST",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function wholeNumber(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(finiteNumber(value, fallback)));
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlot(value: unknown) {
  const normalized = text(String(value ?? "")).toUpperCase();
  return SLOT_ALIASES[normalized] ?? normalized;
}

function normalizeScoring(value: unknown): LeagueSeasonScoring {
  return value === "standard" || value === "half_ppr" || value === "ppr" ? value : "ppr";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'`]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function playerLookupKey(name: string, position: string) {
  return `${normalizeName(name)}|${normalizeSlot(position)}`;
}

function parseRosterPlayer(value: unknown, franchiseId: string, index: number): LeagueSeasonRosterPlayer | null {
  if (!isRecord(value)) return null;
  const name = text(value.name);
  if (!name) return null;
  const rawByeWeek = finiteNumber(value.byeWeek, Number.NaN);
  return {
    id: text(value.playerId) || `${franchiseId}-player-${index + 1}`,
    name,
    position: normalizeSlot(value.pos) || "FLEX",
    nflTeam: text(value.team).toUpperCase(),
    byeWeek: Number.isFinite(rawByeWeek) && rawByeWeek > 0 ? Math.round(rawByeWeek) : null,
    price: wholeNumber(value.price),
    assignedSlot: text(value.assignedSlot),
  };
}

function parseRosterSlots(value: unknown): LeagueSeasonRosterSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LeagueSeasonRosterSlot[] => {
    if (!isRecord(entry)) return [];
    const slot = normalizeSlot(entry.slot);
    const count = Math.min(20, wholeNumber(entry.count));
    if (!slot || count === 0) return [];
    const flexEligible = Array.isArray(entry.flexEligible)
      ? entry.flexEligible.map(normalizeSlot).filter(Boolean)
      : [];
    return [{ slot, count, ...(flexEligible.length ? { flexEligible } : {}) }];
  });
}

export function parseLeagueSeasonDraft(
  value: unknown,
  options: ParseLeagueSeasonDraftOptions,
): LeagueSeasonDraft | null {
  if (!isRecord(value) || !isRecord(value.config) || !Array.isArray(value.teams)) return null;
  const config = value.config;
  const defaultBudget = wholeNumber(config.defaultBudget, 200);
  const rosterSlots = parseRosterSlots(config.rosterSlots);
  if (!rosterSlots.length) return null;

  const franchises = value.teams.slice(0, 16).flatMap((entry, index): LeagueFranchise[] => {
    if (!isRecord(entry)) return [];
    const id = text(entry.teamId) || `offline-t${index + 1}`;
    const roster = Array.isArray(entry.roster)
      ? entry.roster.flatMap((player, playerIndex) => {
          const parsed = parseRosterPlayer(player, id, playerIndex);
          return parsed ? [parsed] : [];
        })
      : [];
    const budget = wholeNumber(entry.budget, defaultBudget);
    const spent = roster.reduce((sum, player) => sum + player.price, 0);
    return [{
      id,
      displayName: text(entry.name) || `Team ${index + 1}`,
      teamNumber: wholeNumber(entry.teamNumber, index + 1) || index + 1,
      budget,
      spent,
      remaining: Math.max(0, budget - spent),
      roster,
    }];
  });
  if (!franchises.length) return null;

  return {
    leagueId: options.leagueId,
    source: options.source,
    revision: Math.max(0, wholeNumber(options.revision)),
    updatedAt: options.updatedAt ?? "",
    scoring: normalizeScoring(config.scoring),
    rosterSlots,
    defaultBudget,
    isOpen: typeof config.isOpen === "boolean"
      ? config.isOpen
      : franchises.some((franchise) => franchise.roster.length > 0),
    franchises,
  };
}

function createProjectionLookup(players: ToolPlayer[]): ProjectionLookup {
  const byId = new Map<string, ToolPlayer>();
  const byNameAndPosition = new Map<string, ToolPlayer>();
  for (const player of players) {
    byId.set(player.id, player);
    byNameAndPosition.set(playerLookupKey(player.name, player.position), player);
  }
  return { byId, byNameAndPosition };
}

function findProjection(player: LeagueSeasonRosterPlayer, lookup: ProjectionLookup) {
  return lookup.byId.get(player.id)
    ?? lookup.byNameAndPosition.get(playerLookupKey(player.name, player.position))
    ?? null;
}

function defaultFlexEligibility(slot: string) {
  if (slot === "FLEX") return ["RB", "WR", "TE"];
  if (slot === "IDP_FLEX") return ["DL", "LB", "DB"];
  if (slot === "SUPER_FLEX") return ["QB", "RB", "WR", "TE"];
  return [];
}

function isEligible(player: LeagueSeasonRosterPlayer, slot: LeagueSeasonRosterSlot) {
  const position = normalizeSlot(player.position);
  const slotName = normalizeSlot(slot.slot);
  const flexEligible = slot.flexEligible?.map(normalizeSlot) ?? defaultFlexEligibility(slotName);
  return flexEligible.length ? flexEligible.includes(position) : position === slotName;
}

function slotLabel(slot: string, count: number, index: number) {
  const base = slot === "BENCH" ? "BN" : slot === "IDP_FLEX" ? "IDP" : slot;
  return count === 1 ? base : `${base}${index + 1}`;
}

export function buildLineupSlotDefinitions(rosterSlots: LeagueSeasonRosterSlot[]): LeagueLineupSlotDefinition[] {
  return rosterSlots.flatMap((slot) => {
    if (slot.slot === "BENCH" || slot.slot === "IR") return [];
    return Array.from({ length: slot.count }, (_, index) => ({
      key: `${slot.slot}-${index}`,
      slot: slot.slot,
      label: slotLabel(slot.slot, slot.count, index),
      ...(slot.flexEligible?.length ? { flexEligible: slot.flexEligible } : {}),
    }));
  });
}

export function isPlayerEligibleForLineupSlot(
  player: LeagueSeasonRosterPlayer,
  slot: LeagueLineupSlotDefinition,
) {
  return isEligible(player, {
    slot: slot.slot,
    count: 1,
    ...(slot.flexEligible?.length ? { flexEligible: slot.flexEligible } : {}),
  });
}

export function lineupAssignmentsFromProjection(lineup: ProjectedLineup): LeagueLineupAssignments {
  return Object.fromEntries(
    lineup.slots.flatMap((slot) => slot.player ? [[slot.key, slot.player.id]] : []),
  );
}

export function normalizeLineupAssignments(
  franchise: LeagueFranchise,
  rosterSlots: LeagueSeasonRosterSlot[],
  value: unknown,
): LeagueLineupAssignments {
  if (!isRecord(value)) return {};
  const playerById = new Map(franchise.roster.map((player) => [player.id, player]));
  const slots = buildLineupSlotDefinitions(rosterSlots);
  const claimedPlayers = new Set<string>();
  const assignments: LeagueLineupAssignments = {};

  for (const slot of slots) {
    const playerId = text(value[slot.key]);
    const player = playerById.get(playerId);
    if (!player || claimedPlayers.has(player.id) || !isPlayerEligibleForLineupSlot(player, slot)) continue;
    assignments[slot.key] = player.id;
    claimedPlayers.add(player.id);
  }

  return assignments;
}

export function projectFranchiseLineup(
  franchise: LeagueFranchise,
  rosterSlots: LeagueSeasonRosterSlot[],
  players: ToolPlayer[],
  week: number,
): ProjectedLineup {
  const lookup = createProjectionLookup(players);
  const projectedRoster = franchise.roster.map((player): ProjectedRosterPlayer => {
    const projection = findProjection(player, lookup);
    const isOnBye = week > 0 && (projection?.byeWeek ?? player.byeWeek) === week;
    return {
      ...player,
      projection,
      baselinePoints: isOnBye ? 0 : projection?.projectedPointsPerGame ?? null,
      isOnBye,
    };
  });
  const available = new Map(projectedRoster.map((player) => [player.id, player]));
  const expanded = buildLineupSlotDefinitions(rosterSlots);
  const assignments = new Map<string, ProjectedRosterPlayer>();
  const orderedSlots = [
    ...expanded.filter((slot) => !(slot.flexEligible?.length || defaultFlexEligibility(slot.slot).length)),
    ...expanded.filter((slot) => slot.flexEligible?.length || defaultFlexEligibility(slot.slot).length),
  ];

  for (const slot of orderedSlots) {
    const eligible = [...available.values()]
      .filter((player) => isEligible(player, {
        slot: slot.slot,
        count: 1,
        ...(slot.flexEligible?.length ? { flexEligible: slot.flexEligible } : {}),
      }))
      .sort((left, right) =>
        (right.baselinePoints ?? -1) - (left.baselinePoints ?? -1)
        || (left.projection?.rank ?? Number.MAX_SAFE_INTEGER) - (right.projection?.rank ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name)
      );
    const selected = eligible[0];
    if (!selected) continue;
    assignments.set(slot.key, selected);
    available.delete(selected.id);
  }

  const slots = expanded.map((slot): ProjectedLineupSlot => ({
    key: slot.key,
    slot: slot.slot,
    label: slot.label,
    player: assignments.get(slot.key) ?? null,
  }));
  const starterPlayers = slots.flatMap((slot) => slot.player ? [slot.player] : []);
  const projectedStarterCount = starterPlayers.filter((player) => player.baselinePoints !== null).length;
  const bench = [...available.values()].sort((left, right) =>
    (right.baselinePoints ?? -1) - (left.baselinePoints ?? -1) || left.name.localeCompare(right.name)
  );

  return {
    slots,
    bench,
    projectedTotal: starterPlayers.reduce((sum, player) => sum + (player.baselinePoints ?? 0), 0),
    projectedStarterCount,
    starterCount: starterPlayers.length,
    missingStarterCount: Math.max(0, slots.length - starterPlayers.length),
  };
}

export function projectAssignedLineup(
  franchise: LeagueFranchise,
  rosterSlots: LeagueSeasonRosterSlot[],
  players: ToolPlayer[],
  week: number,
  assignmentsValue: unknown,
): ProjectedLineup {
  const optimized = projectFranchiseLineup(franchise, rosterSlots, players, week);
  const projectedById = new Map(
    [...optimized.slots.flatMap((slot) => slot.player ? [slot.player] : []), ...optimized.bench]
      .map((player) => [player.id, player]),
  );
  const assignments = normalizeLineupAssignments(franchise, rosterSlots, assignmentsValue);
  const slots = buildLineupSlotDefinitions(rosterSlots).map((slot): ProjectedLineupSlot => ({
    key: slot.key,
    slot: slot.slot,
    label: slot.label,
    player: projectedById.get(assignments[slot.key] ?? "") ?? null,
  }));
  const starters = slots.flatMap((slot) => slot.player ? [slot.player] : []);
  const starterIds = new Set(starters.map((player) => player.id));
  const bench = [...projectedById.values()]
    .filter((player) => !starterIds.has(player.id))
    .sort((left, right) =>
      (right.baselinePoints ?? -1) - (left.baselinePoints ?? -1) || left.name.localeCompare(right.name)
    );

  return {
    slots,
    bench,
    projectedTotal: starters.reduce((sum, player) => sum + (player.baselinePoints ?? 0), 0),
    projectedStarterCount: starters.filter((player) => player.baselinePoints !== null).length,
    starterCount: starters.length,
    missingStarterCount: Math.max(0, slots.length - starters.length),
  };
}

export function buildRoundRobinSchedule(
  franchises: LeagueFranchise[],
  weekCount = DEFAULT_REGULAR_SEASON_WEEKS,
): LeagueScheduleMatchup[] {
  if (franchises.length < 2 || weekCount < 1) return [];
  const byeId = "__bye__";
  let rotation = franchises.map((franchise) => franchise.id);
  if (rotation.length % 2 !== 0) rotation = [...rotation, byeId];
  const roundCount = rotation.length - 1;
  const half = rotation.length / 2;
  const schedule: LeagueScheduleMatchup[] = [];

  for (let round = 0; round < weekCount; round += 1) {
    const cycleRound = round % roundCount;
    const reverseCycle = Math.floor(round / roundCount) % 2 === 1;
    for (let pairIndex = 0; pairIndex < half; pairIndex += 1) {
      const left = rotation[pairIndex]!;
      const right = rotation[rotation.length - 1 - pairIndex]!;
      if (left === byeId || right === byeId) continue;
      const swap = (cycleRound + pairIndex) % 2 === 1 !== reverseCycle;
      const homeFranchiseId = swap ? right : left;
      const awayFranchiseId = swap ? left : right;
      schedule.push({
        id: `week-${round + 1}-${homeFranchiseId}-${awayFranchiseId}`,
        week: round + 1,
        homeFranchiseId,
        awayFranchiseId,
      });
    }
    rotation = [rotation[0]!, rotation[rotation.length - 1]!, ...rotation.slice(1, -1)];
  }
  return schedule;
}

export function scoringLabel(scoring: LeagueSeasonScoring) {
  if (scoring === "half_ppr") return "Half PPR";
  if (scoring === "ppr") return "Full PPR";
  return "Standard";
}

export function toolScoring(scoring: LeagueSeasonScoring): "standard" | "halfPpr" | "ppr" {
  return scoring === "half_ppr" ? "halfPpr" : scoring;
}

export function positionLabel(position: string) {
  return normalizeSlot(position) === "DST" ? "DEF" : normalizeSlot(position);
}

export function isSupportedToolPosition(position: string): position is ToolPosition {
  return ["QB", "RB", "WR", "TE", "K", "DEF"].includes(positionLabel(position));
}
