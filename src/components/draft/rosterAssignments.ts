import { positionColorVar } from "../../ui/positionColors";

export type RosterSlot = { slot: string; count: number; flexEligible?: string[] };

export type RosterPlayer = {
  playerId?: string;
  name?: string;
  price?: number;
  pos?: string;
  assignedSlot?: string;
  team?: string;
  byeWeek?: number;
  auctionValue?: number;
  projectedValue?: number;
};

export type Team = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  teamNumber?: number;
  roster?: RosterPlayer[];
};

export type SlotAssignment = {
  key: string;
  slot: string;
  label: string;
  group: "starters" | "depth";
  color: string;
  flexEligible?: string[];
  assigned: RosterPlayer | null;
};

const POSITION_ALIASES: Record<string, string> = {
  DEF: "DST",
  "D/ST": "DST",
};

const SLOT_LABELS: Record<string, string> = {
  BENCH: "BN",
  IDP_FLEX: "IDP",
};

function normalizePosition(value: string | null | undefined) {
  if (!value) return "";
  const normalized = String(value).toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

function getSlotColor(slot: string) {
  return positionColorVar(slot, "var(--pos-flex)");
}

function getDefaultFlexEligibility(slot: string) {
  if (slot === "FLEX") return ["RB", "WR", "TE"];
  if (slot === "IDP_FLEX") return ["DL", "LB", "DB"];
  return [];
}

function buildSlotLabel(slot: string, count: number, index: number) {
  const label = SLOT_LABELS[slot] ?? slot;
  if (count === 1) return label;
  return `${label}${index + 1}`;
}

function expandRosterSlots(rosterSlots: RosterSlot[]): SlotAssignment[] {
  return rosterSlots.flatMap((slotConfig) => {
    const slot = normalizePosition(slotConfig.slot);
    const count = Math.max(0, Number(slotConfig.count) || 0);
    const flexEligible =
      Array.isArray(slotConfig.flexEligible) && slotConfig.flexEligible.length > 0
        ? slotConfig.flexEligible.map((value) => normalizePosition(value))
        : getDefaultFlexEligibility(slot);

    return Array.from({ length: count }, (_, index) => ({
      key: `${slot}-${index}`,
      slot,
      label: buildSlotLabel(slot, count, index),
      group: slot === "BENCH" || slot === "IR" ? "depth" : "starters",
      color: getSlotColor(slot),
      ...(flexEligible.length > 0 ? { flexEligible } : {}),
      assigned: null,
    }));
  });
}

export function isRosterPlayerEligibleForSlot(
  player: RosterPlayer,
  slot: Pick<SlotAssignment, "slot" | "flexEligible">
) {
  const position = normalizePosition(player.pos);
  const slotType = normalizePosition(slot.slot);
  if (!position || slotType === "IR") return false;
  if (slotType === "BENCH") return true;
  if (slotType === "FLEX" || slotType === "IDP_FLEX") {
    return (slot.flexEligible ?? getDefaultFlexEligibility(slotType)).includes(position);
  }
  return position === slotType;
}

export function getTeamRosterAssignments(rosterSlots: RosterSlot[], roster: RosterPlayer[]) {
  const slots = expandRosterSlots(rosterSlots);
  const remainingPlayers = [...roster];

  const takeMatchingPlayer = (predicate: (player: RosterPlayer) => boolean) => {
    const index = remainingPlayers.findIndex((player) => predicate(player));
    if (index < 0) return null;
    const [player] = remainingPlayers.splice(index, 1);
    return player ?? null;
  };

  for (const player of roster) {
    if (!player.assignedSlot) continue;
    const slot = slots.find((candidate) => candidate.key === player.assignedSlot && !candidate.assigned);
    if (!slot || !isRosterPlayerEligibleForSlot(player, slot)) continue;

    slot.assigned = player;
    const playerIndex = remainingPlayers.indexOf(player);
    if (playerIndex >= 0) remainingPlayers.splice(playerIndex, 1);
  }

  for (const slot of slots) {
    if (slot.assigned) continue;
    if (slot.slot === "FLEX" || slot.slot === "IDP_FLEX" || slot.slot === "BENCH" || slot.slot === "IR") {
      continue;
    }
    slot.assigned = takeMatchingPlayer((player) => normalizePosition(player.pos) === slot.slot);
  }

  for (const slot of slots) {
    if (slot.assigned) continue;
    if (slot.slot !== "FLEX" && slot.slot !== "IDP_FLEX") continue;
    slot.assigned = takeMatchingPlayer((player) => {
      const pos = normalizePosition(player.pos);
      return !!pos && (slot.flexEligible ?? []).includes(pos);
    });
  }

  for (const slot of slots) {
    if (slot.assigned) continue;
    if (slot.slot !== "BENCH") continue;
    slot.assigned = takeMatchingPlayer(() => true);
  }

  for (const slot of slots) {
    if (slot.assigned) continue;
    if (slot.slot !== "IR") continue;
    slot.assigned = takeMatchingPlayer(() => true);
  }

  if (remainingPlayers.length === 0) return slots;

  return [
    ...slots,
    ...remainingPlayers.map((player, index) => ({
      key: `overflow-${player.playerId ?? index}`,
      slot: "BENCH",
      label: `BN${index + 1}`,
      group: "depth" as const,
      color: getSlotColor("BENCH"),
      assigned: player,
    })),
  ];
}

export function moveRosterPlayerToSlot<T extends RosterPlayer>(
  rosterSlots: RosterSlot[],
  roster: T[],
  playerId: string,
  targetSlotKey: string
): T[] {
  const movingPlayer = roster.find((player) => player.playerId === playerId);
  if (!movingPlayer) return roster;

  const configuredSlots = expandRosterSlots(rosterSlots);
  const targetSlot = configuredSlots.find((slot) => slot.key === targetSlotKey);
  if (!targetSlot || !isRosterPlayerEligibleForSlot(movingPlayer, targetSlot)) return roster;

  const assignments = getTeamRosterAssignments(rosterSlots, roster);
  const sourceSlot = assignments.find((slot) => slot.assigned?.playerId === playerId);
  if (sourceSlot?.key === targetSlotKey) return roster;

  const targetPlayer = assignments.find((slot) => slot.key === targetSlotKey)?.assigned ?? null;
  const targetCanTakeSource = Boolean(
    targetPlayer &&
      sourceSlot &&
      !sourceSlot.key.startsWith("overflow-") &&
      isRosterPlayerEligibleForSlot(targetPlayer, sourceSlot)
  );

  return roster.map((player) => {
    if (player.playerId === playerId) {
      return { ...player, assignedSlot: targetSlotKey } as T;
    }
    if (targetPlayer?.playerId === player.playerId) {
      if (targetCanTakeSource && sourceSlot) {
        return { ...player, assignedSlot: sourceSlot.key } as T;
      }
      const { assignedSlot: _assignedSlot, ...rest } = player;
      return rest as T;
    }
    return player;
  });
}

export function getTeamMaxBid(team: Team, totalSlots: number) {
  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const openSlots = Math.max(0, totalSlots - (team.roster?.length ?? 0));
  return Math.max(0, remainingBudget - Math.max(0, openSlots - 1));
}
