import type { DraftConfigV2 } from "@/types/draftConfig";
import {
  appendFirebaseDraftAction,
  cancelFirebaseDraftRoom,
  createFirebaseDraftRoom,
  getFirebaseDraftByCode,
  getFirebaseDraftConfig,
  joinFirebaseDraftRoom,
  leaveFirebaseDraftRoom,
  listFirebaseParticipants,
  placeFirebaseBid,
  setFirebaseReady,
  updateFirebaseDraftConfig,
  updateFirebaseTeamNumber,
} from "@/multiplayer/firebaseBackend";
import {
  appendLocalDraftAction,
  cancelLocalDraftRoom,
  createLocalDraftRoom,
  getLocalDraftByCode,
  getLocalDraftConfig,
  isLocalMultiplayerMode,
  joinLocalDraftRoom,
  leaveLocalDraftRoom,
  listLocalParticipants,
  setLocalReady,
  updateLocalDraftConfig,
  updateLocalTeamNumber,
} from "@/multiplayer/localMode";
import {
  isAuctionGatewayEnabled,
  submitCloudflareBid,
} from "@/multiplayer/cloudflareGateway";

type DraftActionOptions = {
  actionId?: string;
  submittedAt?: number;
};

function isDirectBidFallback(error: unknown) {
  const code = typeof error === "object" && error !== null
    ? String((error as { code?: unknown }).code ?? "")
    : "";

  return code === "permission-denied" || code === "unavailable" || code === "failed-precondition";
}

export async function createDraftRoom(displayName: string, draftConfig: DraftConfigV2) {
  if (isLocalMultiplayerMode()) {
    return createLocalDraftRoom(displayName, draftConfig);
  }

  return createFirebaseDraftRoom(displayName, draftConfig);
}

export async function joinDraftRoom(code: string, displayName: string) {
  if (isLocalMultiplayerMode()) {
    return joinLocalDraftRoom(code, displayName);
  }

  return joinFirebaseDraftRoom(code, displayName);
}

export async function sendDraftAction(
  draftId: string,
  type: string,
  payload: unknown,
  options: DraftActionOptions = {}
) {
  if (isLocalMultiplayerMode()) {
    return appendLocalDraftAction(
      draftId,
      type,
      (payload as Record<string, unknown> | null) ?? {},
      options.actionId
    );
  }

  return appendFirebaseDraftAction(
    draftId,
    type,
    (payload as Record<string, unknown> | null) ?? {},
    options.actionId
  );
}

export async function getDraftByCode(code: string) {
  if (isLocalMultiplayerMode()) {
    const draft = getLocalDraftByCode(code.toUpperCase());
    if (!draft) throw new Error("Draft room not found.");
    return draft;
  }

  return getFirebaseDraftByCode(code);
}

export async function getDraftConfig(draftId: string): Promise<DraftConfigV2> {
  if (isLocalMultiplayerMode()) {
    return getLocalDraftConfig(draftId);
  }

  return getFirebaseDraftConfig(draftId);
}

export async function updateDraftConfig(draftId: string, draftConfig: DraftConfigV2): Promise<DraftConfigV2> {
  if (isLocalMultiplayerMode()) {
    return updateLocalDraftConfig(draftId, draftConfig);
  }

  return updateFirebaseDraftConfig(draftId, draftConfig);
}

export async function listParticipants(draftId: string) {
  if (isLocalMultiplayerMode()) {
    return listLocalParticipants(draftId);
  }

  return listFirebaseParticipants(draftId);
}

export async function listParticipantsSafe(draftId: string) {
  if (isLocalMultiplayerMode()) {
    return listLocalParticipants(draftId);
  }

  try {
    return await listFirebaseParticipants(draftId);
  } catch (error) {
    console.error("listParticipants failed", error);
    return [];
  }
}

export async function setMyReady(draftId: string, isReady: boolean) {
  if (isLocalMultiplayerMode()) {
    setLocalReady(draftId, isReady);
    return;
  }

  await setFirebaseReady(draftId, isReady);
}

export async function leaveDraftRoom(draftId: string) {
  if (isLocalMultiplayerMode()) {
    leaveLocalDraftRoom(draftId);
    return;
  }

  await leaveFirebaseDraftRoom(draftId);
}

export async function cancelDraftRoom(draftId: string) {
  if (isLocalMultiplayerMode()) {
    cancelLocalDraftRoom(draftId);
    return;
  }

  await cancelFirebaseDraftRoom(draftId);
}

export async function updateTeamNumber(userId: string, teamNumber: number) {
  if (isLocalMultiplayerMode()) {
    updateLocalTeamNumber(userId, teamNumber);
    return;
  }

  await updateFirebaseTeamNumber(userId, teamNumber);
}

export async function appendDraftAction(
  draftId: string,
  type: string,
  payload: Record<string, any>,
  options: DraftActionOptions = {}
) {
  if (isLocalMultiplayerMode()) {
    return appendLocalDraftAction(draftId, type, payload, options.actionId);
  }

  return appendFirebaseDraftAction(draftId, type, payload, options.actionId);
}

export async function submitDraftBid(
  draftId: string,
  teamId: string,
  amount: number,
  options: DraftActionOptions = {}
) {
  const actionId: string = options.actionId ?? crypto.randomUUID();
  const submittedAt = options.submittedAt ?? Date.now();
  const payload = { teamId, amount, submittedAt };

  if (isLocalMultiplayerMode()) {
    return appendLocalDraftAction(draftId, "bid", payload, actionId);
  }

  if (isAuctionGatewayEnabled()) {
    return submitCloudflareBid(draftId, teamId, amount, actionId);
  }

  try {
    return await placeFirebaseBid(draftId, teamId, amount, actionId, submittedAt);
  } catch (error) {
    if (isDirectBidFallback(error)) {
      console.warn("[multiplayer] direct bid transaction unavailable; falling back to host action queue.", error);
      return appendFirebaseDraftAction(draftId, "bid", payload, actionId);
    }

    throw error;
  }
}
