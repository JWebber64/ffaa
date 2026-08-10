import {
  DEFAULT_ROSTER_SLOTS,
  type DraftTypeV2,
  type NominationOrderModeV2,
  type RosterSlot,
} from "../types/draftConfig";
import {
  normalizeCpuManagerProfileSelections,
  type CpuManagerProfileId,
  type CpuManagerProfileSelection,
} from "../types/cpuManager";
import type { PlayerValueSource } from "../types/draft";

export type AuctionCall = "none" | "once" | "twice" | "sold";

export type DraftLogEntry = {
  id: string;
  ts: string;
  type: string;
  text: string;
};

export type DraftAuctionPlayer = {
  playerId: string;
  name: string;
  pos?: string;
  team?: string;
  byeWeek?: number;
  auctionValue?: number;
  marketValue?: number;
  projectedValue?: number;
  projectedPoints?: number;
  valueConfidence?: number;
  valueSources?: PlayerValueSource[];
};

export type DraftTeam = {
  teamId: string;
  name: string;
  budget: number;
  spent: number;
  managerType?: "human" | "computer";
  managerProfileId?: CpuManagerProfileId;
  teamNumber?: number;
  userId?: string | null;
  roster: Array<{
    playerId: string;
    name: string;
    price: number;
    pos?: string;
    team?: string;
    byeWeek?: number;
      auctionValue?: number;
      marketValue?: number;
    projectedValue?: number;
    projectedPoints?: number;
    valueConfidence?: number;
  }>;
};

export type RuntimeRosterSlot = {
  slot: string;
  count: number;
  flexEligible?: string[];
};

export type RuntimeDraftSettings = {
  draftType: DraftTypeV2;
  scoring: "standard" | "half_ppr" | "ppr";
  teamCount: number;
  computerManagers: number;
  computerManagerProfiles?: CpuManagerProfileSelection[];
  nominationSeconds: number;
  bidSeconds: number;
  bidIncrements: number[];
  startingBudget: number;
  teamBudgets: number[];
  nominationOrderMode: NominationOrderModeV2;
  rosterSlots: RuntimeRosterSlot[];
  snakeAutopick: boolean;
  snakePauseBetweenRounds: boolean;
};

export type DraftSnapshotState = {
  phase?: string;
  order?: {
    nominatingIndex?: number;
    currentNominatorTeamId?: string | null;
    snakeRound?: number;
    snakeDirection?: 1 | -1;
    overallPick?: number;
  };
  auction?: {
    player?: DraftAuctionPlayer | null;
    currentBid?: number;
    highBidderTeamId?: string | null;
    secondsLeft?: number;
    call?: AuctionCall;
  };
  settings?: RuntimeDraftSettings;
  teams?: DraftTeam[];
  log?: DraftLogEntry[];
  auctioneer?: {
    style_pack?: string;
  };
  engine?: {
    host_user_id?: string;
    heartbeat_at?: string;
    last_action_created_at?: string | null;
    last_action_id?: string | null;
    undo_stack?: DraftSnapshotState[];
    paused_from?: string | null;
    timer_expires_at?: string | null;
    bid_window_expires_at?: string | null;
    bot_action_due_at?: string | null;
    bot_action_key?: string | null;
  };
  draft_type?: DraftTypeV2;
  team_count?: number;
};

const DEFAULT_RUNTIME_SETTINGS: RuntimeDraftSettings = {
  draftType: "auction",
  scoring: "ppr",
  teamCount: 12,
  computerManagers: 0,
  computerManagerProfiles: [],
  nominationSeconds: 30,
  bidSeconds: 10,
  bidIncrements: [1, 2, 5, 10],
  startingBudget: 200,
  teamBudgets: Array(12).fill(200),
  nominationOrderMode: "random_first_rotate",
  rosterSlots: DEFAULT_ROSTER_SLOTS.map((slot) => ({
    slot: slot.slot,
    count: slot.count,
    ...(slot.flexEligible ? { flexEligible: [...slot.flexEligible] } : {}),
  })),
  snakeAutopick: true,
  snakePauseBetweenRounds: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return null;
}

function toNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  return null;
}

function normalizeDraftType(value: unknown, fallback: DraftTypeV2): DraftTypeV2 {
  return value === "snake" ? "snake" : fallback;
}

function normalizeScoring(
  value: unknown,
  fallback: RuntimeDraftSettings["scoring"],
): RuntimeDraftSettings["scoring"] {
  if (value === "standard" || value === "half_ppr" || value === "ppr") return value;
  if (value === "halfPpr" || value === "half-ppr") return "half_ppr";
  return fallback;
}

function normalizeNominationOrderMode(
  value: unknown,
  fallback: NominationOrderModeV2
): NominationOrderModeV2 {
  if (value === "fixed" || value === "random_each") {
    return value;
  }

  return fallback;
}

function normalizeTeamBudgets(
  value: unknown,
  teamCount: number,
  defaultBudget: number
): number[] {
  const budgets = Array.isArray(value)
    ? value.map((entry) => toPositiveInt(entry) ?? defaultBudget)
    : [];

  return Array.from({ length: teamCount }, (_, index) => budgets[index] ?? defaultBudget);
}

function cloneRosterSlot(slot: RosterSlot | RuntimeRosterSlot): RuntimeRosterSlot {
  return {
    slot: slot.slot,
    count: toNonNegativeInt(slot.count) ?? 0,
    ...(Array.isArray(slot.flexEligible) && slot.flexEligible.length > 0
      ? { flexEligible: slot.flexEligible.map(String) }
      : {}),
  };
}

function normalizeRosterSlots(value: unknown): RuntimeRosterSlot[] {
  if (!Array.isArray(value)) {
    return DEFAULT_RUNTIME_SETTINGS.rosterSlots.map(cloneRosterSlot);
  }

  const rosterSlots = value
    .filter(isRecord)
    .map((slot) => cloneRosterSlot(slot as RuntimeRosterSlot))
    .filter((slot) => slot.slot && slot.count >= 0);

  return rosterSlots.length > 0
    ? rosterSlots
    : DEFAULT_RUNTIME_SETTINGS.rosterSlots.map(cloneRosterSlot);
}

export function deriveBidIncrements(minIncrement: number): number[] {
  const base = Math.max(1, toPositiveInt(minIncrement) ?? 1);
  const values = [base, base * 2, base * 5, base * 10];

  return Array.from(new Set(values)).sort((left, right) => left - right);
}

export function normalizeRuntimeSettings(
  rawSettings: unknown,
  fallback: Partial<RuntimeDraftSettings> = {}
): RuntimeDraftSettings {
  const base: RuntimeDraftSettings = {
    ...DEFAULT_RUNTIME_SETTINGS,
    ...fallback,
  };

  base.teamCount = toPositiveInt(base.teamCount) ?? DEFAULT_RUNTIME_SETTINGS.teamCount;
  base.startingBudget =
    toPositiveInt(base.startingBudget) ?? DEFAULT_RUNTIME_SETTINGS.startingBudget;
  base.bidIncrements =
    Array.isArray(base.bidIncrements) && base.bidIncrements.length > 0
      ? base.bidIncrements
      : DEFAULT_RUNTIME_SETTINGS.bidIncrements;
  base.teamBudgets = normalizeTeamBudgets(
    base.teamBudgets,
    base.teamCount,
    base.startingBudget
  );
  base.nominationSeconds =
    toPositiveInt(base.nominationSeconds) ?? DEFAULT_RUNTIME_SETTINGS.nominationSeconds;
  base.bidSeconds = toPositiveInt(base.bidSeconds) ?? DEFAULT_RUNTIME_SETTINGS.bidSeconds;
  base.draftType = normalizeDraftType(base.draftType, DEFAULT_RUNTIME_SETTINGS.draftType);
  base.scoring = normalizeScoring(base.scoring, DEFAULT_RUNTIME_SETTINGS.scoring);
  base.nominationOrderMode = normalizeNominationOrderMode(
    base.nominationOrderMode,
    DEFAULT_RUNTIME_SETTINGS.nominationOrderMode
  );
  base.computerManagers = Math.max(
    0,
    Math.min(
      base.teamCount - 1,
      toNonNegativeInt(base.computerManagers) ?? DEFAULT_RUNTIME_SETTINGS.computerManagers
    )
  );
  base.computerManagerProfiles = normalizeCpuManagerProfileSelections(
    base.computerManagerProfiles,
    base.computerManagers
  );
  base.rosterSlots = normalizeRosterSlots(base.rosterSlots);
  base.snakeAutopick = typeof base.snakeAutopick === "boolean"
    ? base.snakeAutopick
    : DEFAULT_RUNTIME_SETTINGS.snakeAutopick;
  base.snakePauseBetweenRounds = typeof base.snakePauseBetweenRounds === "boolean"
    ? base.snakePauseBetweenRounds
    : DEFAULT_RUNTIME_SETTINGS.snakePauseBetweenRounds;

  if (!isRecord(rawSettings)) {
    return base;
  }

  const directDraftType = normalizeDraftType(rawSettings.draftType, base.draftType);
  const directScoring = normalizeScoring(rawSettings.scoring, base.scoring);
  const directTeamCount = toPositiveInt(rawSettings.teamCount) ?? base.teamCount;
  const computerManagers = Math.max(
    0,
    Math.min(
      directTeamCount - 1,
      toNonNegativeInt(rawSettings.computerManagers) ?? base.computerManagers
    )
  );
  const computerManagerProfiles = normalizeCpuManagerProfileSelections(
    rawSettings.computerManagerProfiles,
    computerManagers
  );
  const rosterSlots = normalizeRosterSlots(rawSettings.rosterSlots);

  if (isRecord(rawSettings.auctionSettings) || isRecord(rawSettings.snakeSettings)) {
    const auctionSettings = isRecord(rawSettings.auctionSettings)
      ? rawSettings.auctionSettings
      : null;
    const snakeSettings = isRecord(rawSettings.snakeSettings)
      ? rawSettings.snakeSettings
      : null;
    const draftType = normalizeDraftType(rawSettings.draftType, base.draftType);

    if (draftType === "snake" && snakeSettings) {
      const pickSeconds = toPositiveInt(snakeSettings.pickSeconds) ?? base.bidSeconds;
      return {
        ...base,
        draftType,
        scoring: directScoring,
        teamCount: directTeamCount,
        computerManagers,
        computerManagerProfiles,
        nominationSeconds: pickSeconds,
        bidSeconds: pickSeconds,
        bidIncrements: base.bidIncrements,
        teamBudgets: normalizeTeamBudgets(
          rawSettings.teamBudgets,
          directTeamCount,
          base.startingBudget
        ),
        rosterSlots,
        snakeAutopick:
          typeof snakeSettings.autopick === "boolean"
            ? snakeSettings.autopick
            : base.snakeAutopick,
        snakePauseBetweenRounds:
          typeof snakeSettings.pauseBetweenRounds === "boolean"
            ? snakeSettings.pauseBetweenRounds
            : base.snakePauseBetweenRounds,
      };
    }

    const defaultBudget =
      toPositiveInt(auctionSettings?.defaultBudget) ?? base.startingBudget;
    const minIncrement =
      toPositiveInt(auctionSettings?.minIncrement) ?? base.bidIncrements[0] ?? 1;

    return {
      ...base,
      draftType,
      scoring: directScoring,
      teamCount: directTeamCount,
      computerManagers,
      computerManagerProfiles,
      nominationSeconds:
        toPositiveInt(auctionSettings?.nominationSeconds) ?? base.nominationSeconds,
      bidSeconds: toPositiveInt(auctionSettings?.bidResetSeconds) ?? base.bidSeconds,
      bidIncrements: deriveBidIncrements(minIncrement),
      startingBudget: defaultBudget,
      teamBudgets: normalizeTeamBudgets(
        auctionSettings?.teamBudgets,
        directTeamCount,
        defaultBudget
      ),
      nominationOrderMode: normalizeNominationOrderMode(
        auctionSettings?.nominationOrderMode,
        base.nominationOrderMode
      ),
      rosterSlots,
    };
  }

  const startingBudget = toPositiveInt(rawSettings.startingBudget) ?? base.startingBudget;
  const bidIncrements = Array.isArray(rawSettings.bidIncrements)
    ? rawSettings.bidIncrements
        .map((entry) => toPositiveInt(entry))
        .filter((entry): entry is number => entry !== null)
    : [];

  return {
    ...base,
    draftType: directDraftType,
    scoring: directScoring,
    teamCount: directTeamCount,
    computerManagers,
    computerManagerProfiles,
    nominationSeconds:
      toPositiveInt(rawSettings.nominationSeconds) ?? base.nominationSeconds,
    bidSeconds: toPositiveInt(rawSettings.bidSeconds) ?? base.bidSeconds,
    bidIncrements: bidIncrements.length > 0 ? bidIncrements : base.bidIncrements,
    startingBudget,
    teamBudgets: normalizeTeamBudgets(
      rawSettings.teamBudgets,
      directTeamCount,
      startingBudget
    ),
    nominationOrderMode: normalizeNominationOrderMode(
      rawSettings.nominationOrderMode,
      base.nominationOrderMode
    ),
    rosterSlots,
    snakeAutopick:
      typeof rawSettings.snakeAutopick === "boolean"
        ? rawSettings.snakeAutopick
        : base.snakeAutopick,
    snakePauseBetweenRounds:
      typeof rawSettings.snakePauseBetweenRounds === "boolean"
        ? rawSettings.snakePauseBetweenRounds
        : base.snakePauseBetweenRounds,
  };
}

export function hydrateDraftSnapshot(
  snapshot: unknown,
  sourceSettings?: unknown,
  draftType?: unknown,
  teamCount?: unknown
): DraftSnapshotState {
  const baseSnapshot = isRecord(snapshot) ? (snapshot as DraftSnapshotState) : {};
  const settings = normalizeRuntimeSettings(baseSnapshot.settings ?? sourceSettings, {
    draftType: normalizeDraftType(draftType, DEFAULT_RUNTIME_SETTINGS.draftType),
    teamCount: toPositiveInt(teamCount) ?? DEFAULT_RUNTIME_SETTINGS.teamCount,
  });

  return {
    ...baseSnapshot,
    phase: typeof baseSnapshot.phase === "string" ? baseSnapshot.phase : "lobby",
    settings,
    draft_type: settings.draftType,
    team_count: settings.teamCount,
    auctioneer: {
      style_pack: baseSnapshot.auctioneer?.style_pack ?? "classic",
      ...baseSnapshot.auctioneer,
    },
  };
}

export function buildInitialDraftSnapshot(
  sourceSettings: unknown,
  draftType?: unknown,
  teamCount?: unknown
): DraftSnapshotState {
  const settings = normalizeRuntimeSettings(sourceSettings, {
    draftType: normalizeDraftType(draftType, DEFAULT_RUNTIME_SETTINGS.draftType),
    teamCount: toPositiveInt(teamCount) ?? DEFAULT_RUNTIME_SETTINGS.teamCount,
  });

  return hydrateDraftSnapshot(
    {
      phase: "lobby",
      auction: {
        player: null,
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: settings.nominationSeconds,
        call: "none",
      },
      log: [],
    },
    settings,
    settings.draftType,
    settings.teamCount
  );
}

export function mapSnapshotPhaseToDraftStatus(phase?: string): string {
  if (phase === "paused") return "paused";
  if (phase === "complete" || phase === "results") return "complete";
  if (phase === "cancelled") return "cancelled";
  if (phase === "lobby") return "lobby";
  return "live";
}
