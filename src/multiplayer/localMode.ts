import { generateRoomCode, MULTIPLAYER_ENABLED } from "../lib/multiplayer";
import { loadPlayerPool } from "../data/loadPlayerPool";
import {
  auctionValueOptionsFromSettings,
  auctionValueOptionsKey,
} from "../data/auctionValueSettings";
import {
  chooseComputerBid,
  chooseComputerNomination,
  chooseComputerSnakePick,
  getComputerManagerNominationDelayMultiplier,
  getComputerManagerThinkDelayMultiplier,
} from "../engine/autoManager";
import {
  buildInitialDraftSnapshot,
  type DraftAuctionPlayer,
  hydrateDraftSnapshot,
  mapSnapshotPhaseToDraftStatus,
  normalizeRuntimeSettings,
  type DraftSnapshotState,
  type DraftTeam,
} from "./draftSnapshot";
import { getBidSubmittedAtMs, wasBidSubmittedBeforeDeadline } from "./auctionClock";
import { getBidValidation, getTeamMaxBidForSnapshot, getTotalRosterSlots } from "./bidRules";
import {
  normalizeDraftConfigV2,
  orderByOfficialDraftOrder,
  type DraftConfigV2,
} from "../types/draftConfig";
import { resolveCpuManagerProfileSelection } from "../types/cpuManager";

const LOCAL_DRAFTS_KEY = "ffaa.localMultiplayer.drafts.v1";
const LOCAL_USER_KEY = "ffaa.localMultiplayer.user.v1";
const LOCAL_EVENT_NAME = "ffaa:local-multiplayer-change";
const ONCE_THRESHOLD_SECONDS = 5;
const TWICE_THRESHOLD_SECONDS = 2;
const SOLD_BANNER_SECONDS = 1;
const BOT_THINK_MIN_MS = 800;
const BOT_THINK_MAX_MS = 1800;

type LocalUser = {
  userId: string;
  displayName: string | null;
};

export type LocalParticipantRow = {
  id: string;
  draft_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_ready: boolean;
  team_number: number | null;
  created_at: string;
};

export type LocalDraftRecord = {
  id: string;
  code: string;
  host_user_id: string;
  settings: DraftConfigV2 & {
    version?: number;
    locked?: boolean;
    lockedAt?: string;
  };
  draft_type: DraftConfigV2["draftType"];
  team_count: number;
  status: string;
  snapshot: DraftSnapshotState;
  participants: LocalParticipantRow[];
  created_at: string;
  updated_at: string;
};

type SnapshotPlayer = NonNullable<DraftSnapshotState["auction"]>["player"];

type OpeningBid = {
  amount: number;
  teamId: string | null;
};

let cachedLocalPlayerPool: {
  key: string;
  players: ReturnType<typeof loadPlayerPool>;
} | null = null;

function nowIso() {
  return new Date().toISOString();
}

function getLocalPlayerPool(settings?: DraftSnapshotState["settings"]) {
  const options = auctionValueOptionsFromSettings(settings);
  const key = auctionValueOptionsKey(options);
  if (!cachedLocalPlayerPool || cachedLocalPlayerPool.key !== key) {
    cachedLocalPlayerPool = { key, players: loadPlayerPool(options) };
  }

  return cachedLocalPlayerPool.players;
}

function randomBotDelayMs(multiplier = 1) {
  const delay = BOT_THINK_MIN_MS + Math.floor(Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS + 1));
  return Math.max(250, Math.round(delay * multiplier));
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortParticipants(participants: LocalParticipantRow[]) {
  return [...participants].sort((left, right) => {
    const leftTeam = left.team_number ?? Number.MAX_SAFE_INTEGER;
    const rightTeam = right.team_number ?? Number.MAX_SAFE_INTEGER;
    if (leftTeam !== rightTeam) return leftTeam - rightTeam;
    return left.created_at.localeCompare(right.created_at);
  });
}

function readDrafts(): LocalDraftRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as LocalDraftRecord[]) : [];
  } catch {
    return [];
  }
}

function emitChange(draftId?: string) {
  window.dispatchEvent(
    new CustomEvent(LOCAL_EVENT_NAME, {
      detail: { draftId: draftId ?? null },
    })
  );
}

function writeDrafts(drafts: LocalDraftRecord[], draftId?: string) {
  window.localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
  emitChange(draftId);
}

function readUser(): LocalUser | null {
  try {
    const raw = window.sessionStorage.getItem(LOCAL_USER_KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch {
    return null;
  }
}

function writeUser(user: LocalUser) {
  window.sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
}

function getAuctionCall(secondsLeft: number) {
  if (secondsLeft <= 0) return "sold" as const;
  if (secondsLeft <= TWICE_THRESHOLD_SECONDS) return "twice" as const;
  if (secondsLeft <= ONCE_THRESHOLD_SECONDS) return "once" as const;
  return "none" as const;
}

function isDraftComplete(snapshot: DraftSnapshotState) {
  const rosterSlots = getTotalRosterSlots(snapshot);
  if (!rosterSlots) return false;
  return (snapshot.teams ?? []).every((team) => (team.roster?.length ?? 0) >= rosterSlots);
}

function setTimer(snapshot: DraftSnapshotState, seconds: number): DraftSnapshotState {
  const timerExpiresAt = new Date(Date.now() + seconds * 1000).toISOString();

  return {
    ...snapshot,
    auction: {
      ...snapshot.auction,
      secondsLeft: seconds,
    },
    engine: {
      ...snapshot.engine,
      heartbeat_at: nowIso(),
      timer_expires_at: timerExpiresAt,
      bid_window_expires_at: snapshot.phase === "bidding" ? timerExpiresAt : null,
    },
  };
}

function clearTimer(snapshot: DraftSnapshotState): DraftSnapshotState {
  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      heartbeat_at: nowIso(),
      timer_expires_at: null,
      bid_window_expires_at: null,
    },
  };
}

function clearBotAction(snapshot: DraftSnapshotState): DraftSnapshotState {
  if (!snapshot.engine?.bot_action_due_at && !snapshot.engine?.bot_action_key) {
    return snapshot;
  }

  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      heartbeat_at: nowIso(),
      bot_action_due_at: null,
      bot_action_key: null,
    },
  };
}

function maybeScheduleBotAction(snapshot: DraftSnapshotState, key: string, delayMultiplier = 1) {
  if (snapshot.engine?.bot_action_key === key && snapshot.engine?.bot_action_due_at) {
    return snapshot;
  }

  return {
    ...snapshot,
    engine: {
      ...snapshot.engine,
      heartbeat_at: nowIso(),
      bot_action_key: key,
      bot_action_due_at: new Date(Date.now() + randomBotDelayMs(delayMultiplier)).toISOString(),
    },
  };
}

function isBotActionDue(snapshot: DraftSnapshotState, key: string) {
  if ((snapshot.engine?.bot_action_key ?? null) !== key) return false;
  const dueAt = Date.parse(snapshot.engine?.bot_action_due_at ?? "");
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function withLog(snapshot: DraftSnapshotState, type: string, text: string) {
  return {
    ...snapshot,
    log: [
      ...(Array.isArray(snapshot.log) ? snapshot.log : []),
      {
        id: crypto.randomUUID(),
        ts: nowIso(),
        type,
        text,
      },
    ],
  };
}

function syncDraftRecord(record: LocalDraftRecord): LocalDraftRecord {
  const settings = normalizeRuntimeSettings(record.settings, {
    draftType: record.draft_type,
    teamCount: record.team_count,
  });
  const snapshot = hydrateDraftSnapshot(record.snapshot, record.settings, record.draft_type, record.team_count);
  const previousTeams = new Map((snapshot.teams ?? []).map((team) => [team.teamId, team]));
  const participants = orderByOfficialDraftOrder(
    sortParticipants(record.participants),
    settings.draftOrder,
    (participant) => participant.user_id,
  );
  const humanSeatCount = Math.max(1, settings.teamCount - settings.computerManagers);

  const teams: DraftTeam[] = Array.from({ length: settings.teamCount }, (_, index) => {
    const teamNumber = index + 1;
    const teamId = `t${teamNumber}`;
    const participant =
      participants.find((row) => row.team_number === teamNumber) ??
      (teamNumber <= humanSeatCount ? participants[index] : null);
    const previous = previousTeams.get(teamId);
    const managerType = teamNumber <= humanSeatCount ? "human" : "computer";
    const cpuIndex = teamNumber - humanSeatCount - 1;
    const managerProfileId =
      managerType === "computer"
        ? resolveCpuManagerProfileSelection(
            settings.computerManagerProfiles?.[cpuIndex],
            `${record.id}:cpu:${cpuIndex + 1}`
          )
        : undefined;

    return {
      teamId,
      teamNumber,
      name:
        participant?.display_name ??
        (managerType === "computer" ? `CPU ${teamNumber - humanSeatCount}` : `Team ${teamNumber}`),
      budget: Number(settings.teamBudgets[index] ?? settings.startingBudget),
      spent: previous?.spent ?? 0,
      managerType,
      ...(managerProfileId ? { managerProfileId } : {}),
      userId: participant?.user_id ?? null,
      roster: previous?.roster ?? [],
    };
  });
  const orderedTeams = orderByOfficialDraftOrder(
    teams,
    settings.draftOrder,
    (team) => team.userId,
  );

  return {
    ...record,
    team_count: settings.teamCount,
    draft_type: settings.draftType,
    status: mapSnapshotPhaseToDraftStatus(snapshot.phase),
    snapshot: {
      ...snapshot,
      settings,
      draft_type: settings.draftType,
      team_count: settings.teamCount,
      teams: orderedTeams,
      engine: {
        ...snapshot.engine,
        host_user_id: record.host_user_id,
        heartbeat_at: snapshot.engine?.heartbeat_at ?? nowIso(),
      },
    },
  };
}

function readDraftByIdRaw(draftId: string) {
  return readDrafts().find((draft) => draft.id === draftId) ?? null;
}

function readDraftByCodeRaw(code: string) {
  return readDrafts().find((draft) => draft.code === code.toUpperCase()) ?? null;
}

function writeDraftRecord(record: LocalDraftRecord) {
  const drafts = readDrafts();
  const index = drafts.findIndex((draft) => draft.id === record.id);
  const next = syncDraftRecord({
    ...record,
    updated_at: nowIso(),
  });

  if (index >= 0) {
    drafts[index] = next;
  } else {
    drafts.push(next);
  }

  writeDrafts(drafts, next.id);
  return next;
}

function updateDraftRecord(draftId: string, updater: (draft: LocalDraftRecord) => LocalDraftRecord) {
  const drafts = readDrafts();
  const index = drafts.findIndex((draft) => draft.id === draftId);
  if (index < 0) {
    throw new Error("Local draft not found");
  }

  const currentDraft = drafts[index];
  if (!currentDraft) {
    throw new Error("Local draft not found");
  }

  const current = syncDraftRecord(clonePlain(currentDraft));
  const updated = syncDraftRecord({
    ...updater(current),
    updated_at: nowIso(),
  });
  drafts[index] = updated;
  writeDrafts(drafts, draftId);
  return updated;
}

function getRemainingSeconds(snapshot: DraftSnapshotState) {
  const expiresAt = Date.parse(snapshot.engine?.timer_expires_at ?? "");
  if (!Number.isFinite(expiresAt)) {
    return snapshot.auction?.secondsLeft ?? 0;
  }

  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function getCurrentTeam(snapshot: DraftSnapshotState) {
  const currentId = snapshot.order?.currentNominatorTeamId ?? null;
  return (snapshot.teams ?? []).find((team) => team.teamId === currentId) ?? null;
}

function getTeamById(snapshot: DraftSnapshotState, teamId: string | null | undefined) {
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
  const team = getTeamById(snapshot, teamId);
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

function completeDraft(snapshot: DraftSnapshotState, text: string) {
  return clearTimer(
    withLog(
      {
        ...snapshot,
        phase: "complete",
      },
      "system",
      text
    )
  );
}

function cancelDraft(snapshot: DraftSnapshotState, text: string) {
  return clearBotAction(
    clearTimer(
      withLog(
        {
          ...snapshot,
          phase: "cancelled",
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
        "system",
        text
      )
    )
  );
}

function beginAuctionNomination(snapshot: DraftSnapshotState, nextIndex: number, text: string) {
  const nextTeam = (snapshot.teams ?? [])[nextIndex] ?? null;
  const nominationSeconds = snapshot.settings?.nominationSeconds ?? 30;
  return setTimer(
    withLog(
      {
        ...snapshot,
        phase: "nominating",
        order: {
          ...snapshot.order,
          nominatingIndex: nextIndex,
          currentNominatorTeamId: nextTeam?.teamId ?? null,
        },
        auction: {
          ...snapshot.auction,
          player: null,
          currentBid: 0,
          highBidderTeamId: null,
          secondsLeft: nominationSeconds,
          call: "none",
        },
      },
      "system",
      text
    ),
    nominationSeconds
  );
}

function resolveAuctionSale(snapshot: DraftSnapshotState) {
  const player = snapshot.auction?.player;
  const winnerTeamId = snapshot.auction?.highBidderTeamId ?? null;
  const teams = snapshot.teams ?? [];
  const currentIndex = snapshot.order?.nominatingIndex ?? 0;
  const nextIndex = teams.length ? (currentIndex + 1) % teams.length : 0;

  if (!player || !winnerTeamId) {
    return beginAuctionNomination(snapshot, nextIndex, "Nomination expired. Moving to the next team.");
  }

  const price = Math.max(1, snapshot.auction?.currentBid ?? 1);
  const winner = teams.find((team) => team.teamId === winnerTeamId) ?? null;
  const updatedTeams = teams.map((team) =>
    team.teamId === winnerTeamId
      ? {
          ...team,
          spent: (team.spent ?? 0) + price,
          roster: [
            ...(team.roster ?? []),
            copyValueFields(player, {
              playerId: player.playerId,
              name: player.name,
              price,
              ...(player.pos ? { pos: player.pos } : {}),
              ...(player.team ? { team: player.team } : {}),
              ...(typeof player.byeWeek === "number" ? { byeWeek: player.byeWeek } : {}),
            }),
          ],
        }
      : team
  );

  const soldSnapshot = withLog(
    {
      ...snapshot,
      teams: updatedTeams,
    },
    "sold",
    `SOLD: ${player.name} to ${winner?.name ?? winnerTeamId} for $${price}.`
  );

  if (isDraftComplete(soldSnapshot)) {
    return completeDraft(soldSnapshot, "Draft complete.");
  }

  return beginAuctionNomination(soldSnapshot, nextIndex, `${(updatedTeams[nextIndex] ?? winner)?.name ?? "Next team"} is nominating.`);
}

function advanceSnakeTurn(snapshot: DraftSnapshotState, pickedTeamId: string, player: SnapshotPlayer) {
  if (!player) return snapshot;

  const teams = snapshot.teams ?? [];
  const currentIndex = teams.findIndex((team) => team.teamId === pickedTeamId);
  if (currentIndex < 0) return snapshot;

  const updatedTeams = teams.map((team) =>
    team.teamId === pickedTeamId
      ? {
          ...team,
          roster: [
            ...(team.roster ?? []),
            copyValueFields(player, {
              playerId: player.playerId,
              name: player.name,
              price: 0,
              ...(player.pos ? { pos: player.pos } : {}),
              ...(player.team ? { team: player.team } : {}),
              ...(typeof player.byeWeek === "number" ? { byeWeek: player.byeWeek } : {}),
            }),
          ],
        }
      : team
  );

  const pickedSnapshot = withLog(
    {
      ...snapshot,
      teams: updatedTeams,
    },
    "pick",
    `${teams[currentIndex]?.name ?? "Team"} drafted ${player.name}.`
  );

  if (isDraftComplete(pickedSnapshot)) {
    return completeDraft(pickedSnapshot, "Draft complete.");
  }

  const currentDirection = snapshot.order?.snakeDirection ?? 1;
  const currentRound = snapshot.order?.snakeRound ?? 1;
  let nextIndex = currentIndex + currentDirection;
  let nextDirection = currentDirection;
  let nextRound = currentRound;

  if (nextIndex >= teams.length) {
    nextDirection = -1;
    nextRound += 1;
    nextIndex = teams.length - 1;
  } else if (nextIndex < 0) {
    nextDirection = 1;
    nextRound += 1;
    nextIndex = 0;
  }

  const pickSeconds = snapshot.settings?.bidSeconds ?? 60;
  return setTimer(
    {
      ...pickedSnapshot,
      phase: "picking",
      order: {
        ...pickedSnapshot.order,
        currentNominatorTeamId: updatedTeams[nextIndex]?.teamId ?? null,
        snakeRound: nextRound,
        snakeDirection: nextDirection,
        overallPick: (snapshot.order?.overallPick ?? 1) + 1,
      },
      auction: {
        ...pickedSnapshot.auction,
        player: null,
        currentBid: 0,
        highBidderTeamId: null,
        secondsLeft: pickSeconds,
        call: "none",
      },
    },
    pickSeconds
  );
}

function reduceDraftAction(draft: LocalDraftRecord, type: string, payload: Record<string, unknown>) {
  const snapshot = syncDraftRecord(draft).snapshot;
  const currentSnapshot = clonePlain(snapshot);

  switch (type) {
    case "start_draft": {
      if (currentSnapshot.phase !== "lobby") return draft;
      const teams = currentSnapshot.teams ?? [];
      if (!teams.length) return draft;

      if (currentSnapshot.settings?.draftType === "snake") {
        const pickSeconds = currentSnapshot.settings?.bidSeconds ?? 60;
        return {
          ...draft,
          snapshot: setTimer(
            withLog(
              {
                ...currentSnapshot,
                phase: "picking",
                order: {
                  ...currentSnapshot.order,
                  currentNominatorTeamId: teams[0]?.teamId ?? null,
                  snakeRound: 1,
                  snakeDirection: 1,
                  overallPick: 1,
                },
                auction: {
                  ...currentSnapshot.auction,
                  player: null,
                  currentBid: 0,
                  highBidderTeamId: null,
                  secondsLeft: pickSeconds,
                  call: "none",
                },
              },
              "system",
              `Draft started. ${teams[0]?.name ?? "Team 1"} is on the clock.`
            ),
            pickSeconds
          ),
        };
      }

      return {
        ...draft,
        snapshot: beginAuctionNomination(
          currentSnapshot,
          0,
          `Draft started. ${teams[0]?.name ?? "Team 1"} nominates first.`
        ),
      };
    }

    case "nominate":
    case "force_nominate": {
      if (currentSnapshot.settings?.draftType !== "auction") return draft;
      const player = payload.player as SnapshotPlayer;
      if (!player?.playerId || !player.name) return draft;
      const requestedTeamId = typeof payload.teamId === "string" ? payload.teamId : null;
      const currentNominatorTeamId = currentSnapshot.order?.currentNominatorTeamId ?? null;
      if (type === "nominate" && requestedTeamId && currentNominatorTeamId && requestedTeamId !== currentNominatorTeamId) {
        return draft;
      }
      const openingBid = getOpeningBid(
        currentSnapshot,
        player,
        requestedTeamId,
        payload.startingBid
      );
      if (!openingBid) return draft;
      const bidSeconds = currentSnapshot.settings?.bidSeconds ?? 10;
      return {
        ...draft,
        snapshot: setTimer(
          withLog(
            {
              ...currentSnapshot,
              phase: "bidding",
              auction: {
                ...currentSnapshot.auction,
                player,
                currentBid: openingBid.amount,
                highBidderTeamId: openingBid.teamId,
                secondsLeft: bidSeconds,
                call: "none",
              },
            },
            type === "force_nominate" ? "system" : "nominate",
            `${type === "force_nominate" ? "Host forced nomination" : "Nomination"}: ${player.name}${openingBidLogSuffix(openingBid)}.`
          ),
          bidSeconds
        ),
      };
    }

    case "bid": {
      if (currentSnapshot.phase !== "bidding") return draft;
      const submittedAtMs = getBidSubmittedAtMs(payload.submittedAt);
      const submittedBeforeDeadline = wasBidSubmittedBeforeDeadline(currentSnapshot, submittedAtMs);
      if (
        (currentSnapshot.auction?.call === "sold" || getRemainingSeconds(currentSnapshot) <= 0) &&
        !submittedBeforeDeadline
      ) {
        return {
          ...draft,
          snapshot: clearBotAction(currentSnapshot),
        };
      }

      const teamId = typeof payload.teamId === "string" ? payload.teamId : null;
      const amount = typeof payload.amount === "number" ? payload.amount : null;
      if (!teamId || amount === null) return draft;

      const bidSeconds = currentSnapshot.settings?.bidSeconds ?? 10;
      const validationSnapshot =
        currentSnapshot.auction?.call === "sold"
          ? {
              ...currentSnapshot,
              auction: {
                ...currentSnapshot.auction,
                call: "none" as const,
              },
            }
          : currentSnapshot;
      const validation = getBidValidation(validationSnapshot, teamId, amount);
      if (!validation.canBid || validation.amount === null || !validation.team) return draft;

      return {
        ...draft,
        snapshot: setTimer(
          withLog(
            {
              ...validationSnapshot,
              auction: {
                ...validationSnapshot.auction,
                currentBid: validation.amount,
                highBidderTeamId: teamId,
                secondsLeft: bidSeconds,
                call: "none",
              },
            },
            "bid",
            `${validation.team.name} bid $${validation.amount}.`
          ),
          bidSeconds
        ),
      };
    }

    case "pick": {
      if (currentSnapshot.phase !== "picking") return draft;
      const teamId = typeof payload.teamId === "string" ? payload.teamId : null;
      const player = payload.player as SnapshotPlayer;
      if (!teamId || !player?.playerId || !player.name) return draft;
      return {
        ...draft,
        snapshot: advanceSnakeTurn(currentSnapshot, teamId, player),
      };
    }

    case "pause_draft":
      return {
        ...draft,
        snapshot: clearTimer(
          withLog(
            {
              ...currentSnapshot,
              phase: "paused",
              engine: {
                ...currentSnapshot.engine,
                paused_from: currentSnapshot.phase ?? "lobby",
              },
            },
            "system",
            "Draft paused."
          )
        ),
      };

    case "resume_draft": {
      const resumePhase =
        currentSnapshot.engine?.paused_from ??
        (currentSnapshot.settings?.draftType === "snake"
          ? "picking"
          : currentSnapshot.auction?.player
            ? "bidding"
            : "nominating");
      const seconds =
        currentSnapshot.auction?.secondsLeft ??
        (resumePhase === "nominating"
          ? currentSnapshot.settings?.nominationSeconds ?? 30
          : currentSnapshot.settings?.bidSeconds ?? 10);

      return {
        ...draft,
        snapshot: setTimer(
          withLog(
            {
              ...currentSnapshot,
              phase: resumePhase,
              engine: {
                ...currentSnapshot.engine,
                paused_from: null,
              },
            },
            "system",
            "Draft resumed."
          ),
          seconds
        ),
      };
    }

    case "set_style_pack":
      return {
        ...draft,
        snapshot: {
          ...currentSnapshot,
          auctioneer: {
            ...(currentSnapshot.auctioneer ?? {}),
            style_pack: typeof payload.style === "string" ? payload.style : "classic",
          },
        },
      };

    case "cancel_draft":
      if (currentSnapshot.phase === "cancelled") return draft;
      return {
        ...draft,
        snapshot: cancelDraft(currentSnapshot, "Draft cancelled by host."),
      };

    default:
      return draft;
  }
}

export function isLocalMultiplayerMode() {
  return !MULTIPLAYER_ENABLED;
}

export function ensureLocalUser(displayName?: string) {
  const existing = readUser();
  const normalizedName = displayName?.trim() || existing?.displayName || null;
  const user: LocalUser = {
    userId: existing?.userId ?? crypto.randomUUID(),
    displayName: normalizedName,
  };
  writeUser(user);
  return user;
}

export function getLocalUserId() {
  return ensureLocalUser().userId;
}

export function getLocalSessionInfo() {
  const user = ensureLocalUser();
  return {
    hasSession: true,
    userId: user.userId,
    email: null,
    provider: "local",
  };
}

export function subscribeToLocalDraft(draftId: string, listener: () => void) {
  const onCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ draftId?: string | null }>).detail;
    if (!detail?.draftId || detail.draftId === draftId) {
      listener();
    }
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_DRAFTS_KEY) {
      listener();
    }
  };

  window.addEventListener(LOCAL_EVENT_NAME, onCustomEvent as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, onCustomEvent as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

export function createLocalDraftRoom(displayName: string, draftConfig: DraftConfigV2) {
  const user = ensureLocalUser(displayName);
  const now = nowIso();
  const normalizedDisplayName = displayName.trim();
  const normalizedConfig = normalizeDraftConfigV2(draftConfig);
  let code = generateRoomCode(6);

  while (readDraftByCodeRaw(code)) {
    code = generateRoomCode(6);
  }

  const settings = {
    ...normalizedConfig,
    version: 1,
    locked: true,
    lockedAt: now,
  };
  const draftId = crypto.randomUUID();
  const participant: LocalParticipantRow = {
    id: crypto.randomUUID(),
    draft_id: draftId,
    user_id: user.userId,
    display_name: normalizedDisplayName,
    is_host: true,
    is_ready: true,
    team_number: 1,
    created_at: now,
  };

  const draft = writeDraftRecord({
    id: draftId,
    code,
    host_user_id: user.userId,
    settings,
    draft_type: normalizedConfig.draftType,
    team_count: normalizedConfig.teamCount,
    status: "lobby",
    snapshot: buildInitialDraftSnapshot(settings, normalizedConfig.draftType, normalizedConfig.teamCount),
    participants: [participant],
    created_at: now,
    updated_at: now,
  });

  return {
    ...draft,
    snapshot: draft.snapshot,
  };
}

export function updateLocalDraftConfig(draftId: string, draftConfig: DraftConfigV2) {
  const userId = getLocalUserId();
  const normalizedConfig = normalizeDraftConfigV2(draftConfig);
  const updated = updateDraftRecord(draftId, (draft) => {
    if (draft.host_user_id !== userId) {
      throw new Error("Only the host can update this draft.");
    }

    const snapshot = hydrateDraftSnapshot(draft.snapshot, draft.settings, draft.draft_type, draft.team_count);
    if (snapshot.phase !== "lobby") {
      throw new Error("Cannot update CPU profiles after the draft starts.");
    }

    const settings = {
      ...normalizedConfig,
      version: draft.settings.version ?? 1,
      locked: draft.settings.locked ?? true,
      lockedAt: draft.settings.lockedAt ?? nowIso(),
    };
    const nextSettings = normalizeRuntimeSettings(settings, {
      draftType: normalizedConfig.draftType,
      teamCount: normalizedConfig.teamCount,
    });

    return {
      ...draft,
      settings,
      draft_type: normalizedConfig.draftType,
      team_count: normalizedConfig.teamCount,
      snapshot: {
        ...snapshot,
        settings: nextSettings,
        draft_type: normalizedConfig.draftType,
        team_count: normalizedConfig.teamCount,
      },
    };
  });

  return updated.settings as DraftConfigV2;
}

export function getLocalDraftById(draftId: string) {
  const draft = readDraftByIdRaw(draftId);
  return draft ? syncDraftRecord(draft) : null;
}

export function getLocalDraftByCode(code: string) {
  const draft = readDraftByCodeRaw(code);
  return draft ? syncDraftRecord(draft) : null;
}

export function getLocalDraftConfig(draftId: string) {
  const draft = getLocalDraftById(draftId);
  if (!draft) throw new Error("Draft config not found");
  return draft.settings as DraftConfigV2;
}

export function getLocalParticipant(draftId: string) {
  const userId = getLocalUserId();
  const draft = getLocalDraftById(draftId);
  return draft?.participants.find((row) => row.user_id === userId) ?? null;
}

export function joinLocalDraftRoom(code: string, displayName: string) {
  const draft = getLocalDraftByCode(code.toUpperCase());
  if (!draft) throw new Error("Draft room not found.");
  if (draft.status !== "lobby" || draft.snapshot.phase !== "lobby") {
    throw new Error("Draft room has already started.");
  }

  const user = ensureLocalUser(displayName);
  const normalizedDisplayName = displayName.trim();
  const settings = normalizeRuntimeSettings(draft.settings, {
    draftType: draft.draft_type,
    teamCount: draft.team_count,
  });
  const humanSeatCount = Math.max(1, settings.teamCount - settings.computerManagers);
  const sortedParticipants = sortParticipants(draft.participants);
  const existing = sortedParticipants.find((row) => row.user_id === user.userId) ?? null;

  if (!existing && sortedParticipants.length >= humanSeatCount) {
    throw new Error("Draft room is full.");
  }

  const takenSeats = new Set(sortedParticipants.map((row) => row.team_number).filter((value): value is number => typeof value === "number"));
  let nextSeat = 1;
  while (takenSeats.has(nextSeat) && nextSeat <= humanSeatCount) {
    nextSeat += 1;
  }

  const updated = updateDraftRecord(draft.id, (current) => ({
    ...current,
    participants: existing
      ? current.participants.map((row) =>
          row.user_id === user.userId
            ? {
                ...row,
                display_name: normalizedDisplayName,
              }
            : row
        )
      : [
          ...current.participants,
          {
            id: crypto.randomUUID(),
            draft_id: current.id,
            user_id: user.userId,
            display_name: normalizedDisplayName,
            is_host: false,
            is_ready: false,
            team_number: nextSeat <= humanSeatCount ? nextSeat : null,
            created_at: nowIso(),
          },
        ],
  }));

  return updated;
}

export function listLocalParticipants(draftId: string) {
  const draft = getLocalDraftById(draftId);
  return sortParticipants(draft?.participants ?? []);
}

export function setLocalReady(draftId: string, isReady: boolean) {
  const userId = getLocalUserId();
  updateDraftRecord(draftId, (draft) => ({
    ...draft,
    participants: draft.participants.map((row) =>
      row.user_id === userId
        ? {
            ...row,
            is_ready: isReady,
          }
        : row
    ),
  }));
}

export function leaveLocalDraftRoom(draftId: string) {
  const userId = getLocalUserId();
  updateDraftRecord(draftId, (draft) => {
    const participants = draft.participants.filter((row) => row.user_id !== userId);
    const snapshot =
      participants.length === 0 &&
      draft.snapshot.phase !== "complete" &&
      draft.snapshot.phase !== "cancelled"
        ? completeDraft(draft.snapshot, "All managers left. Draft finalized.")
        : draft.snapshot;

    return {
      ...draft,
      participants,
      snapshot,
    };
  });
}

export function cancelLocalDraftRoom(draftId: string) {
  const userId = getLocalUserId();
  updateDraftRecord(draftId, (draft) => {
    if (draft.host_user_id !== userId) {
      throw new Error("Only the host can cancel this draft.");
    }

    if (draft.snapshot.phase === "cancelled") return draft;

    return {
      ...draft,
      snapshot: cancelDraft(draft.snapshot, "Draft cancelled by host."),
    };
  });
}

export function updateLocalTeamNumber(userId: string, teamNumber: number) {
  const drafts = readDrafts();
  const nextDrafts = drafts.map((draft) => {
    const hasUser = draft.participants.some((row) => row.user_id === userId);
    if (!hasUser) return draft;
    return syncDraftRecord({
      ...draft,
      participants: draft.participants.map((row) =>
        row.user_id === userId
          ? {
              ...row,
              team_number: teamNumber,
            }
          : row
      ),
      updated_at: nowIso(),
    });
  });

  writeDrafts(nextDrafts);
}

export function appendLocalDraftAction(
  draftId: string,
  type: string,
  payload: Record<string, unknown>,
  actionId?: string
) {
  const finalActionId = actionId ?? crypto.randomUUID();
  updateDraftRecord(draftId, (draft) => reduceDraftAction(draft, type, payload));
  return finalActionId;
}

export function tickLocalDraft(draftId: string) {
  const existing = readDraftByIdRaw(draftId);
  if (!existing) return;

  const snapshot = syncDraftRecord(existing).snapshot;
  if (
    snapshot.phase === "lobby" ||
    snapshot.phase === "paused" ||
    snapshot.phase === "complete" ||
    snapshot.phase === "cancelled"
  ) {
    return;
  }

  const playerPool = getLocalPlayerPool(snapshot.settings);
  const remaining = getRemainingSeconds(snapshot);
  updateDraftRecord(draftId, (draft) => {
    const current = draft.snapshot;
    const currentTeam = getCurrentTeam(current);

    if (current.phase === "nominating") {
      if (remaining <= 0) {
        const expiredSnapshot = clearBotAction(current);
        const forcedPlayer = currentTeam
          ? chooseComputerNomination(expiredSnapshot, currentTeam, playerPool)
          : null;

        if (forcedPlayer) {
          const bidSeconds = current.settings?.bidSeconds ?? 10;
          return {
            ...draft,
            snapshot: setTimer(
              withLog(
                {
                  ...expiredSnapshot,
                  phase: "bidding",
                  auction: {
                    ...expiredSnapshot.auction,
                    player: forcedPlayer,
                    currentBid: 0,
                    highBidderTeamId: null,
                    secondsLeft: bidSeconds,
                    call: "none",
                  },
                },
                "nominate",
                `${currentTeam?.name ?? "Current nominator"} ran out of nomination time. Timer nominated ${forcedPlayer.name}.`
              ),
              bidSeconds
            ),
          };
        }

        const nextIndex = ((current.order?.nominatingIndex ?? 0) + 1) % Math.max(1, (current.teams ?? []).length);
        return {
          ...draft,
          snapshot: beginAuctionNomination(
            expiredSnapshot,
            nextIndex,
            `${currentTeam?.name ?? "Current nominator"} ran out of nomination time. No legal nomination was available, so the clock rotated to the next team.`
          ),
        };
      }

      if (currentTeam?.managerType === "computer") {
        const actionKey = `nominate:${currentTeam.teamId}:${current.order?.nominatingIndex ?? -1}`;
        const scheduledSnapshot = maybeScheduleBotAction(
          current,
          actionKey,
          getComputerManagerNominationDelayMultiplier(currentTeam)
        );

        if (isBotActionDue(scheduledSnapshot, actionKey)) {
          const player = chooseComputerNomination(scheduledSnapshot, currentTeam, playerPool);
          if (!player) {
            const nextIndex =
              ((scheduledSnapshot.order?.nominatingIndex ?? 0) + 1) %
              Math.max(1, (scheduledSnapshot.teams ?? []).length);
            return {
              ...draft,
              snapshot: beginAuctionNomination(
                clearBotAction(scheduledSnapshot),
                nextIndex,
                `${currentTeam.name} let the nomination clock expire.`
              ),
            };
          }

          return reduceDraftAction(
            {
              ...draft,
              snapshot: clearBotAction(scheduledSnapshot),
            },
            "nominate",
            {
              teamId: currentTeam.teamId,
              player,
            }
          );
        }

        if (scheduledSnapshot !== current) {
          return {
            ...draft,
            snapshot: scheduledSnapshot,
          };
        }
      }

      const baseSnapshot =
        currentTeam?.managerType === "computer" ? current : clearBotAction(current);
      if (remaining === baseSnapshot.auction?.secondsLeft) {
        return baseSnapshot === current
          ? draft
          : {
              ...draft,
              snapshot: baseSnapshot,
            };
      }

      return {
        ...draft,
        snapshot: {
          ...baseSnapshot,
          auction: {
            ...baseSnapshot.auction,
            secondsLeft: remaining,
            call: "none",
          },
          engine: {
            ...baseSnapshot.engine,
            heartbeat_at: nowIso(),
          },
        },
      };
    }

    if (current.phase === "bidding") {
      if (remaining <= 0) {
        if (current.auction?.call === "sold") {
          return {
            ...draft,
            snapshot: resolveAuctionSale(clearBotAction(current)),
          };
        }

        return {
          ...draft,
          snapshot: {
            ...clearBotAction(current),
            auction: {
              ...current.auction,
              secondsLeft: 0,
              call: "sold",
            },
            engine: {
              ...clearBotAction(current).engine,
              heartbeat_at: nowIso(),
              timer_expires_at: new Date(Date.now() + SOLD_BANNER_SECONDS * 1000).toISOString(),
              bid_window_expires_at:
                current.engine?.bid_window_expires_at ?? current.engine?.timer_expires_at ?? null,
            },
          },
        };
      }

      if (current.auction?.call === "sold") {
        return {
          ...draft,
          snapshot: clearBotAction(current),
        };
      }

      const bidDecision = chooseComputerBid(current, playerPool);
      if (bidDecision) {
        const actionKey = `bid:${current.auction?.player?.playerId ?? "none"}:${current.auction?.currentBid ?? 0}:${current.auction?.highBidderTeamId ?? "none"}`;
        const biddingTeam = (current.teams ?? []).find((team) => team.teamId === bidDecision.teamId) ?? null;
        const scheduledSnapshot = maybeScheduleBotAction(
          current,
          actionKey,
          getComputerManagerThinkDelayMultiplier(biddingTeam)
        );

        if (isBotActionDue(scheduledSnapshot, actionKey)) {
          return reduceDraftAction(
            {
              ...draft,
              snapshot: clearBotAction(scheduledSnapshot),
            },
            "bid",
            bidDecision
          );
        }

        if (scheduledSnapshot !== current) {
          return {
            ...draft,
            snapshot: scheduledSnapshot,
          };
        }
      }

      const baseSnapshot = bidDecision ? current : clearBotAction(current);
      const nextCall = getAuctionCall(remaining);
      if (remaining === baseSnapshot.auction?.secondsLeft && nextCall === (baseSnapshot.auction?.call ?? "none")) {
        return baseSnapshot === current
          ? draft
          : {
              ...draft,
              snapshot: baseSnapshot,
            };
      }

      return {
        ...draft,
        snapshot: {
          ...baseSnapshot,
          auction: {
            ...baseSnapshot.auction,
            secondsLeft: remaining,
            call: nextCall,
          },
          engine: {
            ...baseSnapshot.engine,
            heartbeat_at: nowIso(),
          },
        },
      };
    }

    if (current.phase === "picking") {
      const timedOut = remaining <= 0;
      const shouldAct =
        !!currentTeam &&
        (currentTeam.managerType === "computer" || (timedOut && (current.settings?.snakeAutopick ?? true)));

      if (currentTeam && shouldAct) {
        const actionKey = `pick:${currentTeam.teamId}:${current.order?.overallPick ?? 1}`;
        const scheduledSnapshot =
          currentTeam.managerType === "computer" && !timedOut
            ? maybeScheduleBotAction(
                current,
                actionKey,
                getComputerManagerThinkDelayMultiplier(currentTeam)
              )
            : clearBotAction(current);

        if (currentTeam.managerType === "computer" && !timedOut && !isBotActionDue(scheduledSnapshot, actionKey)) {
          return scheduledSnapshot === current
            ? draft
            : {
                ...draft,
                snapshot: scheduledSnapshot,
              };
        }

        const player = chooseComputerSnakePick(scheduledSnapshot, currentTeam, playerPool);
        if (!player) {
          return {
            ...draft,
            snapshot: clearBotAction(
              completeDraft(scheduledSnapshot, "No players available. Draft complete.")
            ),
          };
        }

        return reduceDraftAction(
          {
            ...draft,
            snapshot: clearBotAction(scheduledSnapshot),
          },
          "pick",
          {
            teamId: currentTeam.teamId,
            player,
          }
        );
      }

      const baseSnapshot = clearBotAction(current);
      if (remaining <= 0) {
        const pickSeconds = current.settings?.bidSeconds ?? 60;
        return {
          ...draft,
          snapshot: setTimer(
            withLog(
              {
                ...baseSnapshot,
                auction: {
                  ...baseSnapshot.auction,
                  secondsLeft: pickSeconds,
                  call: "none",
                },
              },
              "system",
              `${currentTeam?.name ?? "Current team"} ran out of pick time.`
            ),
            pickSeconds
          ),
        };
      }

      if (remaining === baseSnapshot.auction?.secondsLeft) {
        return baseSnapshot === current
          ? draft
          : {
              ...draft,
              snapshot: baseSnapshot,
            };
      }

      return {
        ...draft,
        snapshot: {
          ...baseSnapshot,
          auction: {
            ...baseSnapshot.auction,
            secondsLeft: remaining,
            call: "none",
          },
          engine: {
            ...baseSnapshot.engine,
            heartbeat_at: nowIso(),
          },
        },
      };
    }

    return draft;
  });
}
