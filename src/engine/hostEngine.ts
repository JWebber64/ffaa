import { loadPlayerPool } from "../data/loadPlayerPool";
import {
  auctionValueOptionsFromSettings,
  auctionValueOptionsKey,
} from "../data/auctionValueSettings";
import {
  hydrateDraftSnapshot,
  mapSnapshotPhaseToDraftStatus,
  type AuctionCall,
  type DraftAuctionPlayer,
  type DraftLogEntry,
  type DraftSnapshotState,
  type DraftTeam,
} from "../multiplayer/draftSnapshot";
import {
  getFirebaseAuctionState,
  getFirebaseDraftById,
  listFirebaseParticipants,
  replayFirebaseActions,
  syncFirebaseAuctionState,
  updateFirebaseDraftSnapshot,
} from "../multiplayer/firebaseBackend";
import {
  getBidValidation,
  getTeamMaxBidForSnapshot,
  getTotalRosterSlots,
} from "../multiplayer/bidRules";
import { getBidSubmittedAtMs, wasBidSubmittedBeforeDeadline } from "../multiplayer/auctionClock";
import { applyAuctionStateToSnapshot, auctionStateSyncKey } from "../multiplayer/auctionState";
import { subscribeHostToActions } from "../multiplayer/realtime";
import {
  chooseComputerBid,
  chooseComputerNomination,
  chooseComputerSnakePick,
  getComputerManagerNominationDelayMultiplier,
  getComputerManagerThinkDelayMultiplier,
} from "./autoManager";
import { resolveCpuManagerProfileSelection } from "../types/cpuManager";
import { orderByOfficialDraftOrder } from "../types/draftConfig";

type DraftActionRow = {
  action_id: string;
  draft_id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type HostEngineHandle = {
  stop: () => void;
  ready: Promise<void>;
  getQueueDepth: () => number;
};

type OpeningBid = {
  amount: number;
  teamId: string | null;
};

const HEARTBEAT_INTERVAL_MS = 10000;
const TICK_INTERVAL_MS = 1000;
const BOT_THINK_MIN_MS = 800;
const BOT_THINK_MAX_MS = 1800;
const ONCE_THRESHOLD_SECONDS = 5;
const TWICE_THRESHOLD_SECONDS = 2;
const SOLD_BANNER_SECONDS = 1;
const MAX_UNDO_STACK = 10;

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function makeSyntheticId(prefix: string) {
  return `engine-${prefix}-${crypto.randomUUID()}`;
}

function randomBotDelayMs(multiplier = 1) {
  const delay = BOT_THINK_MIN_MS + Math.floor(Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS + 1));
  return Math.max(250, Math.round(delay * multiplier));
}

function reportEngineError(scope: string, error: unknown) {
  console.error(`[hostEngine] ${scope} failed`, error);
}

function getAuctionCall(secondsLeft: number): AuctionCall {
  if (secondsLeft <= 0) return "sold";
  if (secondsLeft <= TWICE_THRESHOLD_SECONDS) return "twice";
  if (secondsLeft <= ONCE_THRESHOLD_SECONDS) return "once";
  return "none";
}

function getDraftClockSeconds(snapshot: DraftSnapshotState) {
  if (snapshot.settings?.draftType === "snake") {
    return snapshot.settings?.bidSeconds ?? 60;
  }

  return snapshot.phase === "bidding"
    ? snapshot.settings?.bidSeconds ?? 10
    : snapshot.settings?.nominationSeconds ?? 30;
}

function getTimerRemainingSeconds(snapshot: DraftSnapshotState) {
  const expiresAt = Date.parse(snapshot.engine?.timer_expires_at ?? "");
  if (!Number.isFinite(expiresAt)) {
    return snapshot.auction?.secondsLeft ?? getDraftClockSeconds(snapshot);
  }

  return Math.max(0, Math.ceil((expiresAt - nowMs()) / 1000));
}

function setTimer(snapshot: DraftSnapshotState, seconds: number): DraftSnapshotState {
  const timerExpiresAt = new Date(nowMs() + seconds * 1000).toISOString();

  return {
    ...snapshot,
    auction: {
      ...snapshot.auction,
      secondsLeft: seconds,
    },
    engine: {
      ...snapshot.engine,
      timer_expires_at: timerExpiresAt,
      bid_window_expires_at: snapshot.phase === "bidding" ? timerExpiresAt : null,
    },
  };
}

function clearTimer(snapshot: DraftSnapshotState): DraftSnapshotState {
  if (!snapshot.engine?.timer_expires_at && !snapshot.engine?.bid_window_expires_at) {
    return snapshot;
  }

  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      timer_expires_at: null,
      bid_window_expires_at: null,
    },
  };
}

function restoreTimer(snapshot: DraftSnapshotState): DraftSnapshotState {
  if (
    snapshot.phase !== "bidding" &&
    snapshot.phase !== "nominating" &&
    snapshot.phase !== "picking"
  ) {
    return clearTimer(snapshot);
  }

  const seconds = Math.max(1, snapshot.auction?.secondsLeft ?? getDraftClockSeconds(snapshot));
  return setTimer(snapshot, seconds);
}

function clearBotAction(snapshot: DraftSnapshotState): DraftSnapshotState {
  if (!snapshot.engine?.bot_action_due_at && !snapshot.engine?.bot_action_key) {
    return snapshot;
  }

  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      bot_action_due_at: null,
      bot_action_key: null,
    },
  };
}

function ensureLog(snapshot: DraftSnapshotState) {
  return Array.isArray(snapshot.log) ? snapshot.log : [];
}

function withLog(snapshot: DraftSnapshotState, entry: DraftLogEntry): DraftSnapshotState {
  return {
    ...snapshot,
    log: [...ensureLog(snapshot), entry],
  };
}

function getTeam(snapshot: DraftSnapshotState, teamId: string | null | undefined) {
  if (!teamId) return null;
  return (snapshot.teams ?? []).find((team) => team.teamId === teamId) ?? null;
}

function toRequestedWholeDollar(value: unknown) {
  const hasRequestedValue = value !== undefined && value !== null && value !== "";
  if (!hasRequestedValue) return undefined;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) return null;

  const amount = Math.round(parsed);
  return amount >= 1 ? amount : null;
}

function getOpeningBid(
  snapshot: DraftSnapshotState,
  player: DraftAuctionPlayer,
  requestedTeamId: string | null,
  requestedAmount: unknown
): OpeningBid | null {
  const amount = toRequestedWholeDollar(requestedAmount);
  if (amount === undefined) return { amount: 0, teamId: null };
  if (amount === null) return null;

  const teamId = requestedTeamId ?? snapshot.order?.currentNominatorTeamId ?? null;
  const team = getTeam(snapshot, teamId);
  if (!team) return null;

  const maxBid = getTeamMaxBidForSnapshot(snapshot, team, player);
  if (amount > maxBid) return null;

  return { amount, teamId };
}

function openingBidLogSuffix(openingBid: OpeningBid) {
  return openingBid.amount > 0 ? ` for $${openingBid.amount}` : "";
}

function copyValueFields(
  player: DraftAuctionPlayer,
  target: DraftTeam["roster"][number]
) {
  if (typeof player.byeWeek === "number") target.byeWeek = player.byeWeek;
  if (typeof player.auctionValue === "number") target.auctionValue = player.auctionValue;
  if (typeof player.marketValue === "number") target.marketValue = player.marketValue;
  if (typeof player.projectedValue === "number") target.projectedValue = player.projectedValue;
  if (typeof player.projectedPoints === "number") target.projectedPoints = player.projectedPoints;
  if (typeof player.valueConfidence === "number") target.valueConfidence = player.valueConfidence;
  return target;
}

function isDraftComplete(snapshot: DraftSnapshotState) {
  const totalSlots = getTotalRosterSlots(snapshot);
  if (totalSlots <= 0) return false;

  const teams = snapshot.teams ?? [];
  if (teams.length === 0) return false;

  return teams.every((team) => (team.roster?.length ?? 0) >= totalSlots);
}

function completeDraft(
  snapshot: DraftSnapshotState,
  logText: string,
  logId = makeSyntheticId("complete")
): DraftSnapshotState {
  return clearBotAction(
    clearTimer(
      withLog(
        {
          ...snapshot,
          phase: "complete",
          order: {
            ...snapshot.order,
            currentNominatorTeamId: null,
          },
          auction: {
            player: null,
            currentBid: 0,
            highBidderTeamId: null,
            secondsLeft: 0,
            call: "none",
          },
        },
        {
          id: logId,
          ts: nowIso(),
          type: "system",
          text: logText,
        }
      )
    )
  );
}

function initialNominatorIndex(snapshot: DraftSnapshotState, teams: DraftTeam[]) {
  const mode = snapshot.settings?.nominationOrderMode ?? "random_first_rotate";
  if (mode === "fixed") return 0;
  return Math.floor(Math.random() * teams.length);
}

function nextNominatorIndex(
  snapshot: DraftSnapshotState,
  teams: DraftTeam[],
  currentIndex: number
) {
  const mode = snapshot.settings?.nominationOrderMode ?? "random_first_rotate";
  if (mode === "random_each") {
    return Math.floor(Math.random() * teams.length);
  }

  return (currentIndex + 1) % teams.length;
}

function beginNominationWindow(
  snapshot: DraftSnapshotState,
  nextIndex: number,
  logEntry?: DraftLogEntry
): DraftSnapshotState {
  const nextTeamId = snapshot.teams?.[nextIndex]?.teamId ?? null;
  const seconds = snapshot.settings?.nominationSeconds ?? 30;
  const nextSnapshot = clearBotAction({
    ...snapshot,
    phase: "nominating",
    order: {
      ...snapshot.order,
      nominatingIndex: nextIndex,
      currentNominatorTeamId: nextTeamId,
    },
    auction: {
      player: null,
      currentBid: 0,
      highBidderTeamId: null,
      secondsLeft: seconds,
      call: "none" as const,
    },
  });

  return setTimer(logEntry ? withLog(nextSnapshot, logEntry) : nextSnapshot, seconds);
}

function beginSnakePickWindow(
  snapshot: DraftSnapshotState,
  nextIndex: number,
  round: number,
  direction: 1 | -1,
  overallPick: number,
  logEntry?: DraftLogEntry
): DraftSnapshotState {
  const nextTeamId = snapshot.teams?.[nextIndex]?.teamId ?? null;
  const seconds = snapshot.settings?.bidSeconds ?? snapshot.settings?.nominationSeconds ?? 60;
  const nextSnapshot = clearBotAction({
    ...snapshot,
    phase: "picking",
    order: {
      ...snapshot.order,
      nominatingIndex: nextIndex,
      currentNominatorTeamId: nextTeamId,
      snakeRound: round,
      snakeDirection: direction,
      overallPick,
    },
    auction: {
      player: null,
      currentBid: 0,
      highBidderTeamId: null,
      secondsLeft: seconds,
      call: "none" as const,
    },
  });

  return setTimer(logEntry ? withLog(nextSnapshot, logEntry) : nextSnapshot, seconds);
}

function advanceToNextNominator(
  snapshot: DraftSnapshotState,
  logText: string
): DraftSnapshotState {
  const teams = snapshot.teams ?? [];
  if (teams.length === 0) return snapshot;

  const currentIndex = snapshot.order?.nominatingIndex ?? -1;
  const nextIndex =
    currentIndex >= 0
      ? nextNominatorIndex(snapshot, teams, currentIndex)
      : initialNominatorIndex(snapshot, teams);

  return beginNominationWindow(snapshot, nextIndex, {
    id: makeSyntheticId("nomination-timeout"),
    ts: nowIso(),
    type: "system",
    text: logText,
  });
}

function advanceSnakeTurn(snapshot: DraftSnapshotState): DraftSnapshotState {
  const teams = snapshot.teams ?? [];
  if (teams.length === 0) return snapshot;

  const currentIndex = snapshot.order?.nominatingIndex ?? 0;
  const currentDirection = snapshot.order?.snakeDirection ?? 1;
  const currentRound = snapshot.order?.snakeRound ?? 1;
  let nextIndex = currentIndex + currentDirection;
  let nextDirection = currentDirection;
  let nextRound = currentRound;

  if (teams.length === 1) {
    nextIndex = 0;
    nextRound += 1;
  } else if (nextIndex >= teams.length) {
    nextDirection = -1;
    nextIndex = teams.length - 1;
    nextRound += 1;
  } else if (nextIndex < 0) {
    nextDirection = 1;
    nextIndex = 0;
    nextRound += 1;
  }

  return beginSnakePickWindow(
    snapshot,
    nextIndex,
    nextRound,
    nextDirection,
    (snapshot.order?.overallPick ?? 1) + 1
  );
}

function pushUndo(previousSnapshot: DraftSnapshotState, nextSnapshot: DraftSnapshotState) {
  const stack = Array.isArray(previousSnapshot.engine?.undo_stack)
    ? previousSnapshot.engine.undo_stack.map(compactUndoSnapshot)
    : [];

  return {
    ...nextSnapshot,
    engine: {
      ...nextSnapshot.engine,
      undo_stack: [compactUndoSnapshot(previousSnapshot), ...stack].slice(0, MAX_UNDO_STACK),
    },
  };
}

function compactUndoSnapshot(snapshot: DraftSnapshotState): DraftSnapshotState {
  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      undo_stack: [],
    },
  };
}

function startBidding(
  snapshot: DraftSnapshotState,
  player: DraftAuctionPlayer,
  actionId: string,
  logText: string,
  openingBid: OpeningBid = { amount: 0, teamId: null }
): DraftSnapshotState {
  const nextSnapshot = {
    ...snapshot,
    phase: "bidding",
    auction: {
      player,
      currentBid: openingBid.amount,
      highBidderTeamId: openingBid.teamId,
      secondsLeft: snapshot.settings?.bidSeconds ?? 10,
      call: "none" as const,
    },
  };

  return pushUndo(
    snapshot,
    setTimer(
      withLog(nextSnapshot, {
        id: actionId,
        ts: nowIso(),
        type: "nominate",
        text: logText,
      }),
      nextSnapshot.auction.secondsLeft ?? 10
    )
  );
}

function popUndo(snapshot: DraftSnapshotState): DraftSnapshotState {
  const stack = Array.isArray(snapshot.engine?.undo_stack)
    ? snapshot.engine.undo_stack
    : [];

  if (stack.length === 0) return snapshot;

  const [previous, ...rest] = stack;
  const restored = hydrateDraftSnapshot(previous, snapshot.settings);
  const restoredHostUserId = snapshot.engine?.host_user_id ?? restored.engine?.host_user_id ?? null;

  return restoreTimer({
    ...restored,
    engine: {
      ...restored.engine,
      heartbeat_at: snapshot.engine?.heartbeat_at ?? nowIso(),
      last_action_created_at: snapshot.engine?.last_action_created_at ?? null,
      last_action_id: snapshot.engine?.last_action_id ?? null,
      paused_from: restored.engine?.paused_from ?? null,
      timer_expires_at: restored.engine?.timer_expires_at ?? null,
      bot_action_due_at: null,
      bot_action_key: null,
      undo_stack: rest.map(compactUndoSnapshot).slice(0, MAX_UNDO_STACK),
      ...(restoredHostUserId ? { host_user_id: restoredHostUserId } : {}),
    },
  });
}

function applyBid(
  snapshot: DraftSnapshotState,
  teamId: string,
  amount: number
): DraftSnapshotState {
  const validation = getBidValidation(snapshot, teamId, amount);
  if (!validation.canBid || validation.amount === null) return snapshot;

  return setTimer(
    clearBotAction({
      ...snapshot,
      auction: {
        ...snapshot.auction,
        currentBid: validation.amount,
        highBidderTeamId: teamId,
        secondsLeft: snapshot.settings?.bidSeconds ?? 10,
        call: "none" as AuctionCall,
      },
    }),
    snapshot.settings?.bidSeconds ?? 10
  );
}

function applySnakePick(
  snapshot: DraftSnapshotState,
  teamId: string,
  player: DraftAuctionPlayer,
  actionId: string,
  logText: string
): DraftSnapshotState {
  const pickingTeamId = snapshot.order?.currentNominatorTeamId ?? null;
  if (!teamId || teamId !== pickingTeamId) return snapshot;

  const picker = getTeam(snapshot, teamId);
  if (!picker) return snapshot;

  const rosterEntry = copyValueFields(player, {
    playerId: player.playerId,
    name: player.name,
    price: 0,
    ...(player.pos ? { pos: player.pos } : {}),
    ...(player.team ? { team: player.team } : {}),
    ...(typeof player.byeWeek === "number" ? { byeWeek: player.byeWeek } : {}),
  });

  const updatedTeams = (snapshot.teams ?? []).map((team) =>
    team.teamId === picker.teamId
      ? {
          ...team,
          roster: [...(team.roster ?? []), rosterEntry],
        }
      : team
  );

  const pickedSnapshot = withLog(
    {
      ...snapshot,
      teams: updatedTeams,
      auction: {
        ...snapshot.auction,
        player,
        currentBid: 0,
        highBidderTeamId: teamId,
      },
    },
    {
      id: actionId,
      ts: nowIso(),
      type: "pick",
      text: logText,
    }
  );

  if (isDraftComplete(pickedSnapshot)) {
    return pushUndo(pickedSnapshot, completeDraft(pickedSnapshot, "Draft complete."));
  }

  return pushUndo(
    snapshot,
    advanceSnakeTurn({
      ...pickedSnapshot,
      auction: {
        player: null,
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: snapshot.settings?.bidSeconds ?? 60,
        call: "none",
      },
    })
  );
}

function resolveSale(
  snapshot: DraftSnapshotState,
  logId = makeSyntheticId("sale")
): DraftSnapshotState {
  const player = snapshot.auction?.player;
  const winnerTeamId = snapshot.auction?.highBidderTeamId ?? null;

  if (!player || !winnerTeamId) {
    return advanceToNextNominator(
      snapshot,
      player?.name
        ? `Nomination expired for ${player.name}. Moving to the next team.`
        : "Nomination expired. Moving to the next team."
    );
  }

  const winner = getTeam(snapshot, winnerTeamId);
  if (!winner) {
    return advanceToNextNominator(
      snapshot,
      player.name
        ? `Nomination expired for ${player.name}. Moving to the next team.`
        : "Nomination expired. Moving to the next team."
    );
  }

  const price = Math.max(1, snapshot.auction?.currentBid ?? 1);
  const rosterEntry = copyValueFields(player, {
    playerId: player.playerId,
    name: player.name,
    price,
    ...(player.pos ? { pos: player.pos } : {}),
    ...(player.team ? { team: player.team } : {}),
    ...(typeof player.byeWeek === "number" ? { byeWeek: player.byeWeek } : {}),
  });

  const updatedTeams = (snapshot.teams ?? []).map((team) =>
    team.teamId === winner.teamId
      ? {
          ...team,
          spent: (team.spent ?? 0) + price,
          roster: [...(team.roster ?? []), rosterEntry],
        }
      : team
  );

  const soldSnapshot = withLog(
    {
      ...snapshot,
      teams: updatedTeams,
    },
    {
      id: logId,
      ts: nowIso(),
      type: "sold",
      text: `SOLD: ${player.name} to ${winner.name} for $${price}`,
    }
  );

  if (isDraftComplete(soldSnapshot)) {
    return pushUndo(snapshot, completeDraft(soldSnapshot, "Draft complete."));
  }

  const currentIndex = snapshot.order?.nominatingIndex ?? -1;
  const nextIndex =
    currentIndex >= 0
      ? nextNominatorIndex(snapshot, updatedTeams, currentIndex)
      : initialNominatorIndex(snapshot, updatedTeams);

  return pushUndo(
    snapshot,
    beginNominationWindow(soldSnapshot, nextIndex)
  );
}

function ensureEngineFields(
  snapshotIn: DraftSnapshotState | null,
  hostUserId: string
): DraftSnapshotState {
  const snapshot = hydrateDraftSnapshot(snapshotIn);

  return {
    ...snapshot,
    engine: {
      host_user_id: hostUserId,
      heartbeat_at: snapshot.engine?.heartbeat_at ?? nowIso(),
      last_action_created_at: snapshot.engine?.last_action_created_at ?? null,
      last_action_id: snapshot.engine?.last_action_id ?? null,
      undo_stack: Array.isArray(snapshot.engine?.undo_stack)
        ? snapshot.engine.undo_stack.map(compactUndoSnapshot).slice(0, MAX_UNDO_STACK)
        : [],
      paused_from: snapshot.engine?.paused_from ?? null,
      timer_expires_at: snapshot.engine?.timer_expires_at ?? null,
      bid_window_expires_at: snapshot.engine?.bid_window_expires_at ?? null,
      bot_action_due_at: snapshot.engine?.bot_action_due_at ?? null,
      bot_action_key: snapshot.engine?.bot_action_key ?? null,
    },
  };
}

function forceTimerNomination(
  snapshot: DraftSnapshotState,
  playerPool: ReturnType<typeof loadPlayerPool>
): DraftSnapshotState {
  const currentTeam = getTeam(snapshot, snapshot.order?.currentNominatorTeamId);
  const currentTeamName =
    currentTeam?.name ??
    snapshot.order?.currentNominatorTeamId ??
    "Current nominator";

  if (currentTeam) {
    const player = chooseComputerNomination(snapshot, currentTeam, playerPool);
    if (player) {
      return clearBotAction(
        startBidding(
          snapshot,
          player,
          makeSyntheticId("timer-nominate"),
          `${currentTeamName} ran out of nomination time. Timer nominated ${player.name}.`
        )
      );
    }
  }

  return advanceToNextNominator(
    snapshot,
    `${currentTeamName} ran out of nomination time. No legal nomination was available, so the clock rotated to the next team.`
  );
}

function syncClock(
  snapshot: DraftSnapshotState,
  playerPool: ReturnType<typeof loadPlayerPool>
): DraftSnapshotState {
  if (
    snapshot.phase !== "bidding" &&
    snapshot.phase !== "nominating" &&
    snapshot.phase !== "picking"
  ) {
    return clearTimer(snapshot);
  }

  if (!Number.isFinite(Date.parse(snapshot.engine?.timer_expires_at ?? ""))) {
    return restoreTimer(snapshot);
  }

  const remaining = getTimerRemainingSeconds(snapshot);

  if (snapshot.phase === "nominating") {
    if (remaining === 0) {
      return forceTimerNomination(snapshot, playerPool);
    }

    return snapshot;
  }

  if (snapshot.phase === "picking") {
    return snapshot;
  }

  if (remaining === 0) {
    if (snapshot.auction?.call === "sold") {
      return resolveSale(snapshot);
    }

    return {
      ...snapshot,
      auction: {
        ...snapshot.auction,
        secondsLeft: 0,
        call: "sold",
      },
      engine: {
        ...snapshot.engine,
        timer_expires_at: new Date(nowMs() + SOLD_BANNER_SECONDS * 1000).toISOString(),
        bid_window_expires_at:
          snapshot.engine?.bid_window_expires_at ?? snapshot.engine?.timer_expires_at ?? null,
      },
    };
  }

  if (snapshot.auction?.call === "sold") {
    return snapshot;
  }

  const nextCall = getAuctionCall(remaining);
  if (nextCall === (snapshot.auction?.call ?? "none")) {
    return snapshot;
  }

  return {
    ...snapshot,
    auction: {
      ...snapshot.auction,
      secondsLeft: remaining,
      call: nextCall,
    },
  };
}

function maybeScheduleBotAction(snapshot: DraftSnapshotState, key: string, delayMultiplier = 1) {
  const existingKey = snapshot.engine?.bot_action_key ?? null;
  const existingDueAt = snapshot.engine?.bot_action_due_at ?? null;

  if (existingKey === key && existingDueAt) {
    return snapshot;
  }

  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      bot_action_key: key,
      bot_action_due_at: new Date(nowMs() + randomBotDelayMs(delayMultiplier)).toISOString(),
    },
  };
}

function isBotActionDue(snapshot: DraftSnapshotState, key: string) {
  if ((snapshot.engine?.bot_action_key ?? null) !== key) return false;

  const dueAt = Date.parse(snapshot.engine?.bot_action_due_at ?? "");
  return Number.isFinite(dueAt) && dueAt <= nowMs();
}

function applyAutomation(snapshot: DraftSnapshotState, playerPool: ReturnType<typeof loadPlayerPool>) {
  if (snapshot.phase === "paused" || snapshot.phase === "complete" || snapshot.phase === "lobby") {
    return clearBotAction(snapshot);
  }

  const currentTeamId = snapshot.order?.currentNominatorTeamId ?? null;
  const currentTeam = getTeam(snapshot, currentTeamId);

  if (snapshot.phase === "nominating") {
    if (currentTeam?.managerType !== "computer") {
      return clearBotAction(snapshot);
    }

    const actionKey = `nominate:${currentTeam.teamId}:${snapshot.order?.nominatingIndex ?? -1}`;
    const scheduledSnapshot = maybeScheduleBotAction(
      snapshot,
      actionKey,
      getComputerManagerNominationDelayMultiplier(currentTeam)
    );
    if (!isBotActionDue(scheduledSnapshot, actionKey)) {
      return scheduledSnapshot;
    }

    const player = chooseComputerNomination(scheduledSnapshot, currentTeam, playerPool);
    if (!player) {
      return clearBotAction(
        advanceToNextNominator(
          scheduledSnapshot,
          `${currentTeam.name} let the nomination clock expire.`
        )
      );
    }

    return clearBotAction(
      startBidding(
        scheduledSnapshot,
        player,
        makeSyntheticId("cpu-nominate"),
        `${currentTeam.name} nominated ${player.name}.`
      )
    );
  }

  if (snapshot.phase === "bidding") {
    if (snapshot.auction?.call === "sold") {
      return clearBotAction(snapshot);
    }

    const actionKey = `bid:${snapshot.auction?.player?.playerId ?? "none"}:${snapshot.auction?.currentBid ?? 0}:${snapshot.auction?.highBidderTeamId ?? "none"}`;
    const bidDecision = chooseComputerBid(snapshot, playerPool);

    if (!bidDecision) {
      return clearBotAction(snapshot);
    }

    const biddingTeam = getTeam(snapshot, bidDecision.teamId);
    if (!biddingTeam) {
      return clearBotAction(snapshot);
    }

    const scheduledSnapshot = maybeScheduleBotAction(
      snapshot,
      actionKey,
      getComputerManagerThinkDelayMultiplier(biddingTeam)
    );
    if (!isBotActionDue(scheduledSnapshot, actionKey)) {
      return scheduledSnapshot;
    }

    return clearBotAction(
      applyBid(
        scheduledSnapshot,
        bidDecision.teamId,
        bidDecision.amount
      )
    );
  }

  if (snapshot.phase === "picking") {
    if (!currentTeamId || !currentTeam) {
      return clearBotAction(snapshot);
    }

    const timedOut = getTimerRemainingSeconds(snapshot) <= 0;
    const shouldAct =
      currentTeam.managerType === "computer" ||
      (timedOut && (snapshot.settings?.snakeAutopick ?? true));
    if (!shouldAct) {
      return clearBotAction(snapshot);
    }

    const actionKey = `pick:${currentTeamId}:${snapshot.order?.overallPick ?? 1}`;
    const scheduledSnapshot =
      currentTeam.managerType === "computer" && !timedOut
        ? maybeScheduleBotAction(
            snapshot,
            actionKey,
            getComputerManagerThinkDelayMultiplier(currentTeam)
          )
        : snapshot;

    if (currentTeam.managerType === "computer" && !timedOut && !isBotActionDue(scheduledSnapshot, actionKey)) {
      return scheduledSnapshot;
    }

    const player = chooseComputerSnakePick(scheduledSnapshot, currentTeam, playerPool);
    if (!player) {
      return clearBotAction(completeDraft(scheduledSnapshot, "No players available. Draft complete."));
    }

    const logText =
      currentTeam.managerType === "computer"
        ? `${currentTeam.name} drafted ${player.name}.`
        : `${currentTeam.name} auto-picked ${player.name}.`;

    return clearBotAction(
      applySnakePick(
        scheduledSnapshot,
        currentTeamId,
        player,
        makeSyntheticId(currentTeam.managerType === "computer" ? "cpu-pick" : "auto-pick"),
        logText
      )
    );
  }

  return clearBotAction(snapshot);
}

async function buildLobbyTeams(
  snapshot: DraftSnapshotState,
  draftId: string
): Promise<DraftSnapshotState> {
  if (snapshot.phase !== "lobby" && Array.isArray(snapshot.teams) && snapshot.teams.length > 0) {
    return snapshot;
  }

  const participantsBySeat = (await listFirebaseParticipants(draftId)).sort(
    (left, right) => left.team_number - right.team_number
  );

  const settings = snapshot.settings;
  const participants = orderByOfficialDraftOrder(
    participantsBySeat,
    settings?.draftOrder,
    (participant) => participant.user_id,
  );
  const teamCount = settings?.teamCount ?? snapshot.team_count ?? 12;
  const computerManagers = Math.max(
    0,
    Math.min(teamCount - 1, settings?.computerManagers ?? 0)
  );
  const humanSeatCount = Math.max(1, teamCount - computerManagers);

  const humanTeams: DraftTeam[] = participants.map((participant) => {
    const teamNumber = Number(participant.team_number ?? 0) || 0;
    return {
      teamId: `t${teamNumber}`,
      teamNumber,
      userId: participant.user_id,
      managerType: "human" as const,
      name: participant.display_name,
      budget: settings?.teamBudgets?.[teamNumber - 1] ?? settings?.startingBudget ?? 200,
      spent: 0,
      roster: [],
    };
  });

  const botTeams: DraftTeam[] = Array.from({ length: computerManagers }, (_, index) => {
    const teamNumber = humanSeatCount + index + 1;
    const managerProfileId = resolveCpuManagerProfileSelection(
      settings?.computerManagerProfiles?.[index],
      `${draftId}:cpu:${index + 1}`
    );

    return {
      teamId: `t${teamNumber}`,
      teamNumber,
      userId: null,
      managerType: "computer" as const,
      managerProfileId,
      name: `CPU ${index + 1}`,
      budget: settings?.teamBudgets?.[teamNumber - 1] ?? settings?.startingBudget ?? 200,
      spent: 0,
      roster: [],
    };
  });

  const nextTeams = [...humanTeams, ...botTeams];
  const existingTeams = snapshot.teams ?? [];
  const teamsChanged =
    existingTeams.length !== nextTeams.length ||
    existingTeams.some((team, index) => {
      const nextTeam = nextTeams[index];
      return (
        !nextTeam ||
        team.teamId !== nextTeam.teamId ||
        team.name !== nextTeam.name ||
        team.budget !== nextTeam.budget ||
        team.managerType !== nextTeam.managerType ||
        team.managerProfileId !== nextTeam.managerProfileId ||
        team.userId !== nextTeam.userId
      );
    });

  if (!teamsChanged) return snapshot;

  return {
    ...snapshot,
    teams: nextTeams,
  };
}

export function startHostEngine(draftId: string, hostUserId: string): HostEngineHandle {
  let currentSnapshot: DraftSnapshotState | null = null;
  let playerPool: ReturnType<typeof loadPlayerPool> = [];
  let playerPoolSettingsKey = "";
  const queue: DraftActionRow[] = [];
  const processed = new Set<string>();
  let busy = false;
  let tickTimer: number | null = null;
  let cleanup: null | (() => void) = null;
  let stopRequested = false;
  let lastAuctionStateSyncKey: string | null = null;

  async function loadSnapshot() {
    const data = await getFirebaseDraftById(draftId);
    if (!data) throw new Error("Draft not found");

    const auctionState = await getFirebaseAuctionState(draftId);
    const hydratedSnapshot = hydrateDraftSnapshot(
      data?.snapshot,
      data?.settings,
      data?.draft_type,
      data?.team_count
    );

    currentSnapshot = ensureEngineFields(
      applyAuctionStateToSnapshot(hydratedSnapshot, auctionState),
      hostUserId
    );
    const valueOptions = auctionValueOptionsFromSettings(currentSnapshot.settings);
    const nextPlayerPoolSettingsKey = auctionValueOptionsKey(valueOptions);
    if (nextPlayerPoolSettingsKey !== playerPoolSettingsKey) {
      playerPool = loadPlayerPool(valueOptions);
      playerPoolSettingsKey = nextPlayerPoolSettingsKey;
    }
  }

  async function refreshSnapshotFromStore() {
    await loadSnapshot();
  }

  async function updateSnapshot(nextSnapshot: DraftSnapshotState) {
    const normalizedSnapshot = ensureEngineFields(nextSnapshot, hostUserId);
    currentSnapshot = normalizedSnapshot;

    await updateFirebaseDraftSnapshot(
      draftId,
      normalizedSnapshot,
      mapSnapshotPhaseToDraftStatus(normalizedSnapshot.phase)
    );

    const auctionSyncKey = auctionStateSyncKey(normalizedSnapshot);
    if (auctionSyncKey !== lastAuctionStateSyncKey) {
      await syncFirebaseAuctionState(draftId, normalizedSnapshot);
      lastAuctionStateSyncKey = auctionSyncKey;
    }
  }

  function reducer(snapshotIn: DraftSnapshotState | null, action: DraftActionRow) {
    const snapshot = ensureEngineFields(snapshotIn, hostUserId);
    if (processed.has(action.action_id)) return snapshot;

    processed.add(action.action_id);

    const base: DraftSnapshotState = {
      ...snapshot,
      engine: {
        ...snapshot.engine,
        last_action_created_at: action.created_at,
        last_action_id: action.action_id,
      },
    };

    switch (action.type) {
      case "start_draft": {
        if (base.phase !== "lobby") return base;

        const teams = base.teams ?? [];
        if (teams.length < (base.settings?.teamCount ?? 2)) return base;

        if (base.settings?.draftType === "snake") {
          const firstTeam = teams[0];
          return pushUndo(
            base,
            beginSnakePickWindow(base, 0, 1, 1, 1, {
              id: action.action_id,
              ts: nowIso(),
              type: "system",
              text: `Draft started. ${firstTeam?.name ?? "Team 1"} is on the clock.`,
            })
          );
        }

        const firstIndex = initialNominatorIndex(base, teams);
        const firstTeam = teams[firstIndex];
        return pushUndo(
          base,
          beginNominationWindow(base, firstIndex, {
            id: action.action_id,
            ts: nowIso(),
            type: "system",
            text: `Draft started. ${firstTeam?.name ?? "A manager"} nominates first.`,
          })
        );
      }

      case "nominate": {
        if (base.phase !== "nominating" || base.settings?.draftType !== "auction") return base;
        const player = action.payload?.player as DraftAuctionPlayer | undefined;
        if (!player?.playerId || !player.name) return base;

        const requestedTeamId =
          typeof action.payload?.teamId === "string" ? action.payload.teamId : null;
        const currentNominatorTeamId = base.order?.currentNominatorTeamId ?? null;

        if (requestedTeamId && currentNominatorTeamId && requestedTeamId !== currentNominatorTeamId) {
          return base;
        }

        const openingBid = getOpeningBid(
          base,
          player,
          requestedTeamId,
          action.payload?.startingBid
        );
        if (!openingBid) return base;

        return startBidding(
          base,
          player,
          action.action_id,
          `Nomination: ${player.name}${openingBidLogSuffix(openingBid)}`,
          openingBid
        );
      }

      case "pick": {
        if (base.phase !== "picking" || base.settings?.draftType !== "snake") return base;
        const player = action.payload?.player as DraftAuctionPlayer | undefined;
        const teamId = typeof action.payload?.teamId === "string" ? action.payload.teamId : null;
        if (!teamId || !player?.playerId || !player.name) return base;

        return applySnakePick(
          base,
          teamId,
          player,
          action.action_id,
          `${getTeam(base, teamId)?.name ?? "Team"} drafted ${player.name}.`
        );
      }

      case "bid": {
        if (base.phase !== "bidding" || !base.auction?.player) return base;
        const submittedAtMs = getBidSubmittedAtMs(
          action.payload?.submittedAt,
          Date.parse(action.created_at) || nowMs()
        );
        const submittedBeforeDeadline = wasBidSubmittedBeforeDeadline(base, submittedAtMs);
        if (
          (base.auction.call === "sold" || getTimerRemainingSeconds(base) <= 0) &&
          !submittedBeforeDeadline
        ) {
          return clearBotAction(base);
        }

        const teamId = typeof action.payload?.teamId === "string" ? action.payload.teamId : null;
        const amount =
          typeof action.payload?.amount === "number" ? action.payload.amount : null;

        if (!teamId || amount === null) return base;

        const validationSnapshot =
          base.auction.call === "sold"
            ? {
                ...base,
                auction: {
                  ...base.auction,
                  call: "none" as AuctionCall,
                },
              }
            : base;

        return applyBid(validationSnapshot, teamId, amount);
      }

      case "pause_draft": {
        if (base.phase === "paused") return base;

        return pushUndo(
          base,
          withLog(
            clearTimer(
              clearBotAction({
                ...base,
                phase: "paused",
                engine: {
                  ...base.engine,
                  paused_from: base.phase ?? "lobby",
                },
              })
            ),
            {
              id: action.action_id,
              ts: nowIso(),
              type: "system",
              text: "Draft paused.",
            }
          )
        );
      }

      case "resume_draft": {
        if (base.phase !== "paused") return base;

        const resumePhase =
          base.engine?.paused_from ??
          (base.settings?.draftType === "snake"
            ? "picking"
            : base.auction?.player
              ? "bidding"
              : "nominating");

        const resumedSnapshot: DraftSnapshotState = {
          ...base,
          phase: resumePhase,
          engine: {
            ...base.engine,
            paused_from: null,
          },
          auction: {
            ...base.auction,
            call:
              resumePhase === "bidding"
                ? ((base.auction?.call ?? "none") as AuctionCall)
                : ("none" as AuctionCall),
            secondsLeft:
              base.auction?.secondsLeft ??
              (resumePhase === "bidding" || resumePhase === "picking"
                ? base.settings?.bidSeconds ?? 10
                : base.settings?.nominationSeconds ?? 30),
          },
        };

        return pushUndo(
          base,
          restoreTimer(
            withLog(clearBotAction(resumedSnapshot), {
              id: action.action_id,
              ts: nowIso(),
              type: "system",
              text: "Draft resumed.",
            })
          )
        );
      }

      case "undo_last":
        return popUndo(base);

      case "force_nominate": {
        if (base.settings?.draftType !== "auction") return base;

        const player = action.payload?.player as DraftAuctionPlayer | undefined;
        if (!player?.playerId || !player.name) return base;

        const requestedTeamId =
          typeof action.payload?.teamId === "string" ? action.payload.teamId : null;
        const openingBid = getOpeningBid(
          base,
          player,
          requestedTeamId,
          action.payload?.startingBid
        );
        if (!openingBid) return base;

        return startBidding(
          base,
          player,
          action.action_id,
          `Host forced nomination: ${player.name}${openingBidLogSuffix(openingBid)}`,
          openingBid
        );
      }

      case "set_style_pack": {
        const style = action.payload?.style;
        if (typeof style !== "string" || !style) return base;

        return withLog(
          {
            ...base,
            auctioneer: {
              ...(base.auctioneer ?? {}),
              style_pack: style,
            },
          },
          {
            id: action.action_id,
            ts: nowIso(),
            type: "system",
            text: `Auctioneer style changed to ${style}.`,
          }
        );
      }

      default:
        return base;
    }
  }

  function enqueue(action: DraftActionRow) {
    if (!action.action_id || processed.has(action.action_id)) return;

    queue.push(action);
    queue.sort((left, right) => {
      if (left.created_at < right.created_at) return -1;
      if (left.created_at > right.created_at) return 1;
      return left.action_id.localeCompare(right.action_id);
    });

    void drain();
  }

  async function drain() {
    if (busy) return;
    busy = true;

    try {
      await refreshSnapshotFromStore();

      while (queue.length > 0) {
        const nextAction = queue.shift();
        if (!nextAction) continue;

        const nextSnapshot = reducer(currentSnapshot, nextAction);
        if (nextSnapshot !== currentSnapshot) {
          await updateSnapshot(nextSnapshot);
        }
      }
    } catch (error) {
      reportEngineError("action drain", error);
    } finally {
      busy = false;
    }
  }

  async function maintainSnapshot() {
    if (busy || !currentSnapshot) return;
    busy = true;

    try {
      await refreshSnapshotFromStore();
      if (!currentSnapshot) return;

      let nextSnapshot = syncClock(currentSnapshot, playerPool);
      nextSnapshot = applyAutomation(nextSnapshot, playerPool);

      const lastHeartbeat = Date.parse(nextSnapshot.engine?.heartbeat_at ?? "");
      if (!Number.isFinite(lastHeartbeat) || nowMs() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        nextSnapshot = {
          ...nextSnapshot,
          engine: {
            ...nextSnapshot.engine,
            host_user_id: hostUserId,
            heartbeat_at: nowIso(),
          },
        };
      }

      if (nextSnapshot !== currentSnapshot) {
        await updateSnapshot(nextSnapshot);
      }
    } catch (error) {
      reportEngineError("snapshot maintenance", error);
    } finally {
      busy = false;

      if (queue.length > 0) {
        void drain();
      }
    }
  }

  async function replayCatchup() {
    const cursorTs = currentSnapshot?.engine?.last_action_created_at ?? null;
    const data = await replayFirebaseActions(draftId, cursorTs);
    data.forEach(enqueue);
  }

  async function start() {
    await loadSnapshot();

    if (!currentSnapshot) {
      currentSnapshot = ensureEngineFields(null, hostUserId);
    }

    currentSnapshot = await buildLobbyTeams(currentSnapshot, draftId);
    await updateSnapshot(currentSnapshot);

    let resolveSubscribed: (() => void) | null = null;
    const subscribed = new Promise<void>((resolve) => {
      resolveSubscribed = resolve;
    });

    const channel = subscribeHostToActions(
      draftId,
      (row: Record<string, unknown>) => {
        const action: DraftActionRow = {
          action_id: String(row.action_id ?? ""),
          draft_id: String(row.draft_id ?? ""),
          user_id: String(row.user_id ?? ""),
          type: String(row.type ?? ""),
          payload: (row.payload as Record<string, unknown> | null) ?? null,
          created_at: String(row.created_at ?? ""),
        };

        enqueue(action);
      },
      (status) => {
        if (
          status === "SUBSCRIBED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          resolveSubscribed?.();
          resolveSubscribed = null;
        }
      }
    );

    await subscribed;
    await replayCatchup();

    tickTimer = window.setInterval(() => {
      void maintainSnapshot();
    }, TICK_INTERVAL_MS);

    await maintainSnapshot();

    const stop = () => {
      channel.unsubscribe();
      if (tickTimer) {
        window.clearInterval(tickTimer);
        tickTimer = null;
      }
    };

    cleanup = stop;

    if (stopRequested) {
      stop();
    }
  }

  const ready = start().catch((error: unknown) => {
    console.error("[hostEngine] failed to start", error);
    throw error;
  });

  return {
    stop() {
      stopRequested = true;
      cleanup?.();
      cleanup = null;
    },
    ready,
    getQueueDepth() {
      return queue.length;
    },
  };
}
