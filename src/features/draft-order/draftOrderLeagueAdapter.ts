import { ensureFirebaseUserId } from "../../lib/authSession";
import {
  getDraftByCode,
  getDraftConfig,
  updateDraftConfig,
} from "../../multiplayer/api";
import {
  getFirebaseDraftById,
  listFirebaseParticipants,
} from "../../multiplayer/firebaseBackend";
import {
  getLocalDraftById,
  getLocalUserId,
  isLocalMultiplayerMode,
  listLocalParticipants,
} from "../../multiplayer/localMode";
import { loadSleeperLeagueHQ } from "../league-hq/sleeperLeague";
import { verifyDraftOrderDraw } from "./draftOrderEngine";
import type {
  DraftOrderDrawRecord,
  DraftOrderParticipant,
  DraftRoomOrderContext,
} from "./types";

const PARTICIPANT_COLORS = [
  "var(--green-200)",
  "var(--green-300)",
  "var(--green-400)",
  "var(--green-500)",
  "var(--green-600)",
  "var(--gray-200)",
  "var(--gray-300)",
  "var(--gray-400)",
];

function colorFor(index: number) {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]!;
}

export async function loadSleeperDraftOrderParticipants(leagueId: string) {
  const imported = await loadSleeperLeagueHQ(leagueId);
  const activeManagers = imported.data.managers.filter((manager) => typeof manager.currentRosterId === "number");
  const managers = activeManagers.length ? activeManagers : imported.data.managers;
  return {
    leagueName: imported.leagueName,
    participants: managers.map<DraftOrderParticipant>((manager, index) => {
      const sourceId = manager.sleeperUserId ?? manager.id;
      return {
        id: `sleeper:${sourceId}`,
        source: "sleeper",
        sourceId,
        managerName: manager.managerName,
        teamName: manager.teamName || manager.managerName,
        ...(manager.avatarUrl ? { avatarUrl: manager.avatarUrl } : {}),
        color: colorFor(index),
      };
    }),
  };
}

function roomParticipant(
  row: { user_id: string; display_name: string },
  index: number,
): DraftOrderParticipant {
  return {
    id: `draft-room:${row.user_id}`,
    source: "draft-room",
    sourceId: row.user_id,
    managerName: row.display_name,
    teamName: row.display_name,
    color: colorFor(index),
  };
}

export async function loadDraftRoomOrderContext(draftId: string): Promise<DraftRoomOrderContext> {
  if (isLocalMultiplayerMode()) {
    const draft = getLocalDraftById(draftId);
    if (!draft) throw new Error("Draft room not found.");
    const config = await getDraftConfig(draftId);
    const userId = getLocalUserId();
    const participants = listLocalParticipants(draftId);
    return {
      draftId,
      code: draft.code,
      draftType: config.draftType,
      teamCount: config.teamCount,
      humanSeatCount: Math.max(1, config.teamCount - (config.computerManagers ?? 0)),
      isHost: draft.host_user_id === userId,
      isLobby: draft.status === "lobby" && draft.snapshot.phase === "lobby",
      participants: participants.map(roomParticipant),
    };
  }

  const [draft, participants, userId] = await Promise.all([
    getFirebaseDraftById(draftId),
    listFirebaseParticipants(draftId),
    ensureFirebaseUserId(),
  ]);
  if (!draft) throw new Error("Draft room not found.");
  const config = await getDraftConfig(draftId);
  const snapshotPhase = typeof draft.snapshot === "object" && draft.snapshot !== null
    ? String((draft.snapshot as { phase?: unknown }).phase ?? "lobby")
    : "lobby";
  return {
    draftId,
    code: draft.code,
    draftType: config.draftType,
    teamCount: config.teamCount,
    humanSeatCount: Math.max(1, config.teamCount - (config.computerManagers ?? 0)),
    isHost: draft.host_user_id === userId,
    isLobby: draft.status === "lobby" && snapshotPhase === "lobby",
    participants: participants.map(roomParticipant),
  };
}

export async function loadDraftRoomOrderContextByCode(code: string) {
  const draft = await getDraftByCode(code);
  return loadDraftRoomOrderContext(draft.id);
}

export async function applyDraftOrderToRoom(
  context: DraftRoomOrderContext,
  draw: DraftOrderDrawRecord,
) {
  const verification = await verifyDraftOrderDraw(draw);
  if (!verification.valid) throw new Error("The draw must verify before it can be applied.");
  if (!context.isHost) throw new Error("Only the GameHQ draft host can apply an official order.");
  if (!context.isLobby) throw new Error("An official order can only be applied before the draft starts.");
  if (context.participants.length !== context.humanSeatCount) {
    throw new Error(`The room needs all ${context.humanSeatCount} human managers before applying an order.`);
  }

  const roomUserIds = new Set(context.participants.map((participant) => participant.sourceId));
  const orderedUserIds = draw.finalParticipantIds.map((participantId) => {
    const participant = draw.participants.find((entry) => entry.id === participantId);
    return participant?.source === "draft-room" ? participant.sourceId ?? "" : "";
  });
  if (
    orderedUserIds.some((id) => !id || !roomUserIds.has(id))
    || new Set(orderedUserIds).size !== roomUserIds.size
  ) {
    throw new Error("Import this GameHQ room before drawing so every official manager ID matches.");
  }

  const config = await getDraftConfig(context.draftId);
  await updateDraftConfig(context.draftId, {
    ...config,
    ...(config.draftType === "auction" && config.auctionSettings
      ? {
          auctionSettings: {
            ...config.auctionSettings,
            nominationOrderMode: "fixed" as const,
          },
        }
      : {}),
    draftOrder: {
      participantUserIds: orderedUserIds,
      drawId: draw.id,
      verificationHash: draw.verificationHash,
      algorithmVersion: draw.algorithmVersion,
      mode: draw.mode,
      appliedAt: new Date().toISOString(),
    },
  });
  return { applied: true, orderedUserIds };
}
