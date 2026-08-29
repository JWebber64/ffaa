import type { DraftOrderDrawRecord, DraftRoomOrderContext } from "./types";

export const OFFLINE_DRAFT_HANDOFF_KEY = "ffaa.offlineDraft.handoff.v1";

export type OfflineDraftType = "auction" | "snake";

export type OfflineDraftHandoffParticipant = {
  managerName: string;
  teamName: string;
};

export type OfflineDraftHandoff = {
  version: 1;
  drawId: string;
  verificationHash: string;
  algorithmVersion: string;
  mode: string;
  drawNumber: number;
  draftType: OfflineDraftType;
  createdAt: string;
  queuedAt: string;
  participants: OfflineDraftHandoffParticipant[];
};

function normalizeDraftType(value: unknown): OfflineDraftType {
  return value === "auction" ? "auction" : "snake";
}

function normalizeParticipant(value: unknown): OfflineDraftHandoffParticipant | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const managerName = typeof record.managerName === "string" ? record.managerName.trim() : "";
  const teamName = typeof record.teamName === "string" ? record.teamName.trim() : "";
  if (!managerName && !teamName) return null;
  return {
    managerName: managerName || teamName,
    teamName: teamName || managerName,
  };
}

export function createOfflineDraftHandoff(
  draw: DraftOrderDrawRecord,
  roomContext: DraftRoomOrderContext | null,
): OfflineDraftHandoff {
  const participantsById = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const participants = draw.finalParticipantIds.map((participantId) => {
    const participant = participantsById.get(participantId);
    if (!participant) throw new Error("The verified draft order is missing a participant.");
    return {
      managerName: participant.managerName.trim() || participant.teamName.trim(),
      teamName: participant.teamName.trim() || participant.managerName.trim(),
    };
  });

  return {
    version: 1,
    drawId: draw.id,
    verificationHash: draw.verificationHash,
    algorithmVersion: draw.algorithmVersion,
    mode: draw.mode,
    drawNumber: draw.rerollIndex + 1,
    draftType: roomContext?.draftType ?? "snake",
    createdAt: draw.createdAt,
    queuedAt: new Date().toISOString(),
    participants,
  };
}

export function saveOfflineDraftHandoff(handoff: OfflineDraftHandoff) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFLINE_DRAFT_HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    throw new Error("This browser could not save the offline draft handoff.");
  }
}

export function loadOfflineDraftHandoff(): OfflineDraftHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_DRAFT_HANDOFF_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.participants)) return null;
    const participants = record.participants
      .map(normalizeParticipant)
      .filter((participant): participant is OfflineDraftHandoffParticipant => Boolean(participant));
    const drawId = typeof record.drawId === "string" ? record.drawId.trim() : "";
    const verificationHash = typeof record.verificationHash === "string" ? record.verificationHash.trim() : "";
    if (!drawId || !verificationHash || participants.length < 2 || participants.length > 32) return null;

    return {
      version: 1,
      drawId,
      verificationHash,
      algorithmVersion: typeof record.algorithmVersion === "string" ? record.algorithmVersion : "",
      mode: typeof record.mode === "string" ? record.mode : "",
      drawNumber: Math.max(1, Math.round(Number(record.drawNumber) || 1)),
      draftType: normalizeDraftType(record.draftType),
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      queuedAt: typeof record.queuedAt === "string" ? record.queuedAt : "",
      participants,
    };
  } catch {
    return null;
  }
}

export function clearOfflineDraftHandoff() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OFFLINE_DRAFT_HANDOFF_KEY);
  } catch {
    // A blocked storage cleanup should not prevent the active offline draft from opening.
  }
}
