export type BidAuctionPlayer = {
  playerId: string;
  name: string;
  pos?: string;
  team?: string;
  byeWeek?: number;
  auctionValue?: number;
  projectedValue?: number;
  projectedPoints?: number;
  valueConfidence?: number;
  valueSources?: unknown[];
};

export type BidRosterPlayer = {
  playerId?: string;
  name?: string;
  price?: number;
  pos?: string;
  team?: string;
  byeWeek?: number;
  auctionValue?: number;
  projectedValue?: number;
  projectedPoints?: number;
  valueConfidence?: number;
};

export type BidDraftTeam = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  teamNumber?: number;
  userId?: string | null;
  roster?: BidRosterPlayer[];
};

export type BidRuntimeRosterSlot = {
  slot: string;
  count: number;
  flexEligible?: string[];
};

export type BidDraftSnapshot = {
  phase?: string;
  auction?: {
    player?: BidAuctionPlayer | null;
    currentBid?: number;
    highBidderTeamId?: string | null;
    secondsLeft?: number;
    call?: "none" | "once" | "twice" | "sold";
  };
  settings?: {
    draftType?: "auction" | "snake";
    bidSeconds?: number;
    bidIncrements?: number[];
    rosterSlots?: BidRuntimeRosterSlot[];
  };
  teams?: BidDraftTeam[];
};

type AssignablePlayer = {
  pos?: string;
  isCandidate?: boolean;
};

type AssignableSlot = {
  slot: string;
  flexEligible: string[];
  assigned: AssignablePlayer | null;
};

export type BidValidation = {
  canBid: boolean;
  reason: string | null;
  amount: number | null;
  currentBid: number;
  minIncrement: number;
  nextMinimumBid: number;
  maxBid: number;
  remainingBudget: number;
  openRosterSlots: number;
  team: BidDraftTeam | null;
  player: BidAuctionPlayer | null;
};

const POSITION_ALIASES: Record<string, string> = {
  DEF: "DST",
  "D/ST": "DST",
};

function normalizePosition(value: string | null | undefined) {
  if (!value) return "";
  const normalized = String(value).toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

function getDefaultFlexEligibility(slot: string) {
  if (slot === "FLEX") return ["RB", "WR", "TE"];
  if (slot === "IDP_FLEX") return ["DL", "LB", "DB"];
  return [];
}

function expandRosterSlots(rosterSlots: BidRuntimeRosterSlot[] | undefined): AssignableSlot[] {
  if (!Array.isArray(rosterSlots)) return [];

  return rosterSlots.flatMap((slotConfig) => {
    const slot = normalizePosition(slotConfig.slot);
    const count = Math.max(0, Number(slotConfig.count) || 0);
    const flexEligible =
      Array.isArray(slotConfig.flexEligible) && slotConfig.flexEligible.length > 0
        ? slotConfig.flexEligible.map(normalizePosition)
        : getDefaultFlexEligibility(slot);

    return Array.from({ length: count }, () => ({
      slot,
      flexEligible,
      assigned: null,
    }));
  });
}

function takeMatchingPlayer(
  players: AssignablePlayer[],
  predicate: (player: AssignablePlayer) => boolean
) {
  const index = players.findIndex(predicate);
  if (index < 0) return null;
  const [player] = players.splice(index, 1);
  return player ?? null;
}

function assignPlayersToSlots(slots: AssignableSlot[], players: AssignablePlayer[]) {
  const remainingPlayers = [...players];

  for (const slot of slots) {
    if (slot.slot === "FLEX" || slot.slot === "IDP_FLEX" || slot.slot === "BENCH" || slot.slot === "IR") {
      continue;
    }

    slot.assigned = takeMatchingPlayer(
      remainingPlayers,
      (player) => normalizePosition(player.pos) === slot.slot
    );
  }

  for (const slot of slots) {
    if (slot.slot !== "FLEX" && slot.slot !== "IDP_FLEX") continue;

    slot.assigned = takeMatchingPlayer(remainingPlayers, (player) => {
      const pos = normalizePosition(player.pos);
      return !!pos && slot.flexEligible.includes(pos);
    });
  }

  for (const slot of slots) {
    if (slot.slot !== "BENCH") continue;
    slot.assigned = takeMatchingPlayer(remainingPlayers, () => true);
  }

  for (const slot of slots) {
    if (slot.slot !== "IR") continue;
    slot.assigned = takeMatchingPlayer(remainingPlayers, () => true);
  }

  return slots;
}

export function getBidIncrements(snapshot: BidDraftSnapshot) {
  const increments = (snapshot.settings?.bidIncrements ?? [])
    .map((value) => Math.max(1, Math.round(Number(value) || 0)))
    .filter((value, index, all) => value > 0 && all.indexOf(value) === index)
    .sort((left, right) => left - right);

  return increments.length > 0 ? increments : [1, 2, 5, 10];
}

export function getTotalRosterSlots(snapshot: BidDraftSnapshot) {
  return (snapshot.settings?.rosterSlots ?? []).reduce(
    (sum, slot) => sum + Math.max(0, Number(slot.count) || 0),
    0
  );
}

export function getTeamRemainingBudget(team: BidDraftTeam | null | undefined) {
  if (!team) return 0;
  return Math.max(0, (team.budget ?? 0) - (team.spent ?? 0));
}

export function canRosterAuctionPlayer(
  snapshot: BidDraftSnapshot,
  team: BidDraftTeam,
  player: BidAuctionPlayer | null | undefined
) {
  if (!player) return false;

  const slots = expandRosterSlots(snapshot.settings?.rosterSlots);
  if (slots.length === 0) return true;
  if ((team.roster?.length ?? 0) >= slots.length) return false;

  const candidate: AssignablePlayer = {
    ...(player.pos ? { pos: player.pos } : {}),
    isCandidate: true,
  };
  const rosterPlayers: AssignablePlayer[] = (team.roster ?? []).map((entry) => ({
    ...(entry.pos ? { pos: entry.pos } : {}),
  }));

  return assignPlayersToSlots(slots, [...rosterPlayers, candidate]).some(
    (slot) => slot.assigned?.isCandidate === true
  );
}

export function getTeamMaxBidForSnapshot(
  snapshot: BidDraftSnapshot,
  team: BidDraftTeam | null | undefined,
  player: BidAuctionPlayer | null | undefined = snapshot.auction?.player
) {
  if (!team) return 0;

  const remainingBudget = getTeamRemainingBudget(team);
  const totalSlots = getTotalRosterSlots(snapshot);
  if (totalSlots <= 0) return remainingBudget;

  const openRosterSlots = Math.max(0, totalSlots - (team.roster?.length ?? 0));
  if (openRosterSlots <= 0) return 0;
  if (player && !canRosterAuctionPlayer(snapshot, team, player)) return 0;

  const reserve = Math.max(0, openRosterSlots - 1);
  return Math.max(0, remainingBudget - reserve);
}

export function getBidValidation(
  snapshot: BidDraftSnapshot,
  teamId: string | null | undefined,
  amount?: number | null
): BidValidation {
  const player = snapshot.auction?.player ?? null;
  const team = teamId
    ? (snapshot.teams ?? []).find((entry) => entry.teamId === teamId) ?? null
    : null;
  const currentBid = Math.max(0, Math.round(Number(snapshot.auction?.currentBid ?? 0) || 0));
  const minIncrement = getBidIncrements(snapshot)[0] ?? 1;
  const nextMinimumBid = currentBid + minIncrement;
  const remainingBudget = getTeamRemainingBudget(team);
  const totalSlots = getTotalRosterSlots(snapshot);
  const openRosterSlots = team
    ? totalSlots > 0
      ? Math.max(0, totalSlots - (team.roster?.length ?? 0))
      : Number.MAX_SAFE_INTEGER
    : 0;
  const maxBid = getTeamMaxBidForSnapshot(snapshot, team, player);
  const hasAmount = amount !== undefined && amount !== null;
  const cleanAmount =
    typeof amount === "number" && Number.isFinite(amount) && Number.isInteger(amount)
      ? amount
      : null;

  const baseValidation: Omit<BidValidation, "canBid" | "reason"> = {
    amount: cleanAmount,
    currentBid,
    minIncrement,
    nextMinimumBid,
    maxBid,
    remainingBudget,
    openRosterSlots,
    team,
    player,
  };

  if (snapshot.settings?.draftType !== "auction" || snapshot.phase !== "bidding") {
    return { ...baseValidation, canBid: false, reason: "No live auction." };
  }

  if (!player) {
    return { ...baseValidation, canBid: false, reason: "Waiting for a player to be nominated." };
  }

  if (snapshot.auction?.call === "sold") {
    return { ...baseValidation, canBid: false, reason: "Auction is already sold." };
  }

  if (!teamId || !team) {
    return { ...baseValidation, canBid: false, reason: "Join as a manager to bid." };
  }

  if (snapshot.auction?.highBidderTeamId === teamId) {
    return { ...baseValidation, canBid: false, reason: "You are already the high bidder." };
  }

  if (totalSlots > 0 && openRosterSlots <= 0) {
    return { ...baseValidation, canBid: false, reason: "Your roster is full." };
  }

  if (!canRosterAuctionPlayer(snapshot, team, player)) {
    return { ...baseValidation, canBid: false, reason: "No roster slot fits this player." };
  }

  if (maxBid < nextMinimumBid) {
    return { ...baseValidation, canBid: false, reason: "Your max bid is below the next minimum." };
  }

  if (hasAmount && cleanAmount === null) {
    return { ...baseValidation, canBid: false, reason: "Bid must be a whole dollar amount." };
  }

  if (cleanAmount !== null && cleanAmount < nextMinimumBid) {
    return {
      ...baseValidation,
      canBid: false,
      reason: `Bid must be at least $${nextMinimumBid}.`,
    };
  }

  if (cleanAmount !== null && cleanAmount > maxBid) {
    return {
      ...baseValidation,
      canBid: false,
      reason: `Max bid for ${team.name} is $${maxBid}.`,
    };
  }

  return { ...baseValidation, canBid: true, reason: null };
}
