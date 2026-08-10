export type RosterSlot = { slot: string; count: number; flexEligible?: string[] };

export type RosterPlayer = {
  playerId?: string;
  name?: string;
  price?: number;
  pos?: string;
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

const POSITION_COLORS: Record<string, string> = {
  QB: "var(--pos-qb)",
  RB: "var(--pos-rb)",
  WR: "var(--pos-wr)",
  TE: "var(--pos-te)",
  FLEX: "var(--pos-flex)",
  K: "var(--pos-k)",
  DST: "var(--pos-dst)",
  BENCH: "var(--pos-bench)",
  IR: "var(--pos-ir)",
  DL: "var(--pos-dl)",
  LB: "var(--pos-lb)",
  DB: "var(--pos-db)",
  IDP_FLEX: "var(--pos-idpflex)",
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
  return POSITION_COLORS[slot] ?? "var(--pos-flex)";
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

export function getTeamRosterAssignments(rosterSlots: RosterSlot[], roster: RosterPlayer[]) {
  const slots = expandRosterSlots(rosterSlots);
  const remainingPlayers = [...roster];

  const takeMatchingPlayer = (predicate: (player: RosterPlayer) => boolean) => {
    const index = remainingPlayers.findIndex((player) => predicate(player));
    if (index < 0) return null;
    const [player] = remainingPlayers.splice(index, 1);
    return player ?? null;
  };

  for (const slot of slots) {
    if (slot.slot === "FLEX" || slot.slot === "IDP_FLEX" || slot.slot === "BENCH" || slot.slot === "IR") {
      continue;
    }
    slot.assigned = takeMatchingPlayer((player) => normalizePosition(player.pos) === slot.slot);
  }

  for (const slot of slots) {
    if (slot.slot !== "FLEX" && slot.slot !== "IDP_FLEX") continue;
    slot.assigned = takeMatchingPlayer((player) => {
      const pos = normalizePosition(player.pos);
      return !!pos && (slot.flexEligible ?? []).includes(pos);
    });
  }

  for (const slot of slots) {
    if (slot.slot !== "BENCH") continue;
    slot.assigned = takeMatchingPlayer(() => true);
  }

  for (const slot of slots) {
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

export function getTeamMaxBid(team: Team, totalSlots: number) {
  const remainingBudget = Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
  const openSlots = Math.max(0, totalSlots - (team.roster?.length ?? 0));
  return Math.max(0, remainingBudget - Math.max(0, openSlots - 1));
}
