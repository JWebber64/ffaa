import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { generateRoomCode } from "@/lib/multiplayer";
import { ensureFirebaseUserId } from "@/lib/authSession";
import {
  buildInitialDraftSnapshot,
  hydrateDraftSnapshot,
  normalizeRuntimeSettings,
} from "@/multiplayer/draftSnapshot";
import { getBidValidation } from "@/multiplayer/bidRules";
import { getBidSubmittedAtMs, wasBidSubmittedBeforeDeadline } from "@/multiplayer/auctionClock";
import {
  applyAuctionStateToSnapshot,
  auctionStateFromSnapshot,
  normalizeAuctionState,
  type FirebaseAuctionState,
} from "@/multiplayer/auctionState";
import { normalizeDraftConfigV2, type DraftConfigV2 } from "@/types/draftConfig";

const ROOM_CODE_ATTEMPTS = 8;

export type FirebaseDraftRow = {
  id: string;
  code: string;
  host_user_id: string;
  settings: Record<string, unknown>;
  draft_type: string;
  team_count: number;
  status: string;
  snapshot: unknown;
  created_at: string;
  updated_at: string;
};

export type FirebaseParticipantRow = {
  id: string;
  draft_id: string;
  user_id: string;
  display_name: string;
  team_number: number;
  team_id?: string;
  is_ready: boolean;
  joined_at: string;
};

export type FirebaseActionRow = {
  id: string;
  action_id: string;
  draft_id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function toFirestoreValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const nextValue = toFirestoreValue(entry);
      return nextValue === undefined ? null : nextValue;
    });
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const nextValue = toFirestoreValue(entry);
    if (nextValue !== undefined) {
      output[key] = nextValue;
    }
  }
  return output;
}

function toFirestoreRecord(value: Record<string, unknown>) {
  return toFirestoreValue(value) as Record<string, unknown>;
}

function draftsCollection() {
  return collection(firestore, "drafts");
}

function draftRef(draftId: string) {
  return doc(firestore, "drafts", draftId);
}

function participantsCollection(draftId: string) {
  return collection(firestore, "drafts", draftId, "participants");
}

function participantRef(draftId: string, userId: string) {
  return doc(firestore, "drafts", draftId, "participants", userId);
}

function actionsCollection(draftId: string) {
  return collection(firestore, "drafts", draftId, "actions");
}

function auctionStateRef(draftId: string) {
  return doc(firestore, "drafts", draftId, "auctionState", "current");
}

function draftFromDoc(snapshot: QueryDocumentSnapshot<DocumentData> | DocumentData): FirebaseDraftRow {
  const id = "id" in snapshot ? snapshot.id : String(snapshot.id ?? "");
  const data = "data" in snapshot ? snapshot.data() : snapshot;
  return {
    id,
    code: String(data.code ?? ""),
    host_user_id: String(data.host_user_id ?? ""),
    settings: (data.settings as Record<string, unknown>) ?? {},
    draft_type: String(data.draft_type ?? data.settings?.draftType ?? "auction"),
    team_count: Number(data.team_count ?? data.settings?.teamCount ?? 12),
    status: String(data.status ?? "lobby"),
    snapshot: data.snapshot ?? null,
    created_at: String(data.created_at ?? nowIso()),
    updated_at: String(data.updated_at ?? nowIso()),
  };
}

function participantFromDoc(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentData,
  fallbackDraftId = ""
): FirebaseParticipantRow {
  const id = "id" in snapshot ? snapshot.id : String(snapshot.id ?? "");
  const data = "data" in snapshot ? snapshot.data() : snapshot;
  return {
    id,
    draft_id: String(data.draft_id ?? fallbackDraftId),
    user_id: String(data.user_id ?? id),
    display_name: String(data.display_name ?? "Manager"),
    team_number: Number(data.team_number ?? 0),
    team_id: typeof data.team_id === "string" ? data.team_id : undefined,
    is_ready: Boolean(data.is_ready),
    joined_at: String(data.joined_at ?? nowIso()),
  };
}

function getParticipantTeamId(data: Record<string, unknown> | undefined) {
  if (typeof data?.team_id === "string" && data.team_id.trim()) {
    return data.team_id.trim();
  }

  const teamNumber = Number(data?.team_number ?? 0);
  if (!Number.isFinite(teamNumber) || teamNumber <= 0) return null;
  return `t${Math.round(teamNumber)}`;
}

function hasLogEntry(snapshot: { log?: unknown }, actionId: string) {
  return Array.isArray(snapshot.log)
    && snapshot.log.some(
      (entry) =>
        typeof entry === "object"
        && entry !== null
        && (entry as { id?: unknown }).id === actionId
    );
}

function terminalDraftSnapshot(
  draft: FirebaseDraftRow,
  phase: "complete" | "cancelled",
  text: string
) {
  const snapshot = hydrateDraftSnapshot(
    draft.snapshot,
    draft.settings,
    draft.draft_type,
    draft.team_count
  );

  return {
    ...snapshot,
    phase,
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
    engine: {
      ...snapshot.engine,
      timer_expires_at: null,
      bot_action_due_at: null,
      bot_action_key: null,
    },
    log: [
      ...(Array.isArray(snapshot.log) ? snapshot.log : []),
      {
        id: crypto.randomUUID(),
        ts: nowIso(),
        type: "system",
        text,
      },
    ],
  };
}

function actionFromDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>,
  fallbackDraftId: string
): FirebaseActionRow {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    action_id: String(data.action_id ?? snapshot.id),
    draft_id: String(data.draft_id ?? fallbackDraftId),
    user_id: String(data.user_id ?? ""),
    type: String(data.type ?? ""),
    payload: (data.payload as Record<string, unknown> | null) ?? null,
    created_at: String(data.created_at ?? nowIso()),
  };
}

export async function createFirebaseDraftRoom(displayName: string, draftConfig: DraftConfigV2) {
  const userId = await ensureFirebaseUserId();
  const normalizedConfig = normalizeDraftConfigV2(draftConfig);
  const settings = {
    ...normalizedConfig,
    version: 1,
    locked: true,
    lockedAt: nowIso(),
  };
  const initialSnapshot = buildInitialDraftSnapshot(
    settings,
    normalizedConfig.draftType,
    normalizedConfig.teamCount
  );

  for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const codeQuery = query(draftsCollection(), where("code", "==", code), limit(1));
    const existing = await getDocs(codeQuery);
    if (!existing.empty) continue;

    const createdAt = nowIso();
    const draftDoc = doc(draftsCollection());
    const draftRow: FirebaseDraftRow = {
      id: draftDoc.id,
      code,
      host_user_id: userId,
      settings,
      draft_type: normalizedConfig.draftType,
      team_count: normalizedConfig.teamCount,
      status: "lobby",
      snapshot: initialSnapshot,
      created_at: createdAt,
      updated_at: createdAt,
    };

    await runTransaction(firestore, async (transaction) => {
      transaction.set(draftDoc, toFirestoreRecord(draftRow as unknown as Record<string, unknown>));
      transaction.set(participantRef(draftDoc.id, userId), toFirestoreRecord({
        id: userId,
        draft_id: draftDoc.id,
        user_id: userId,
        display_name: displayName,
        team_number: 1,
        team_id: "t1",
        is_ready: true,
        joined_at: createdAt,
      }));
    });

    return draftRow;
  }

  throw new Error("Could not allocate a unique draft code.");
}

export async function updateFirebaseDraftConfig(draftId: string, draftConfig: DraftConfigV2) {
  const userId = await ensureFirebaseUserId();
  const draft = await getFirebaseDraftById(draftId);
  if (!draft) throw new Error("Draft room not found.");
  if (draft.host_user_id !== userId) {
    throw new Error("Only the host can update this draft.");
  }

  const snapshot = hydrateDraftSnapshot(
    draft.snapshot,
    draft.settings,
    draft.draft_type,
    draft.team_count
  );
  if (snapshot.phase !== "lobby") {
    throw new Error("Cannot update CPU profiles after the draft starts.");
  }

  const normalizedConfig = normalizeDraftConfigV2(draftConfig);
  const existingSettings = draft.settings as unknown as DraftConfigV2 & {
    version?: number;
    locked?: boolean;
    lockedAt?: string;
  };
  const settings = {
    ...normalizedConfig,
    version: existingSettings.version ?? 1,
    locked: existingSettings.locked ?? true,
    lockedAt: existingSettings.lockedAt ?? nowIso(),
  };
  const nextSettings = normalizeRuntimeSettings(settings, {
    draftType: normalizedConfig.draftType,
    teamCount: normalizedConfig.teamCount,
  });

  await updateDoc(draftRef(draftId), toFirestoreRecord({
    settings,
    draft_type: normalizedConfig.draftType,
    team_count: normalizedConfig.teamCount,
    snapshot: {
      ...snapshot,
      settings: nextSettings,
      draft_type: normalizedConfig.draftType,
      team_count: normalizedConfig.teamCount,
    },
    updated_at: nowIso(),
  }));

  return settings as DraftConfigV2;
}

export async function joinFirebaseDraftRoom(code: string, displayName: string) {
  const userId = await ensureFirebaseUserId();
  const normalizedCode = code.trim().toUpperCase();
  const draftRoom = await getFirebaseDraftByCode(normalizedCode);
  const runtimeSettings = normalizeRuntimeSettings(draftRoom.settings, {
    draftType: draftRoom.draft_type as DraftConfigV2["draftType"],
    teamCount: draftRoom.team_count,
  });
  const snapshotPhase =
    typeof (draftRoom.snapshot as { phase?: unknown } | null)?.phase === "string"
      ? (draftRoom.snapshot as { phase: string }).phase
      : "lobby";

  if (draftRoom.status !== "lobby" || snapshotPhase !== "lobby") {
    throw new Error("Draft room has already started.");
  }

  const joinedAt = nowIso();

  await runTransaction(firestore, async (transaction) => {
    const participantsQuery = query(
      participantsCollection(draftRoom.id),
      orderBy("joined_at", "asc")
    );
    const participantDocs = await getDocs(participantsQuery);
    const existing = participantDocs.docs.find((entry) => entry.id === userId);
    if (existing) {
      transaction.update(participantRef(draftRoom.id, userId), toFirestoreRecord({
        display_name: displayName,
        updated_at: joinedAt,
      }));
      return;
    }

    const humanSeatCount = Math.max(
      1,
      runtimeSettings.teamCount - runtimeSettings.computerManagers
    );
    if (participantDocs.size >= humanSeatCount) {
      throw new Error("Draft room is full.");
    }

    const usedTeamNumbers = new Set(
      participantDocs.docs
        .map((entry) => Number(entry.data().team_number ?? 0))
        .filter((entry) => entry > 0)
    );
    let teamNumber = 1;
    while (usedTeamNumbers.has(teamNumber)) {
      teamNumber += 1;
    }

    transaction.set(participantRef(draftRoom.id, userId), toFirestoreRecord({
      id: userId,
      draft_id: draftRoom.id,
      user_id: userId,
      display_name: displayName,
      team_number: teamNumber,
      team_id: `t${teamNumber}`,
      is_ready: false,
      joined_at: joinedAt,
    }));
  });

  return draftRoom;
}

export async function appendFirebaseDraftAction(
  draftId: string,
  type: string,
  payload: Record<string, unknown> | null,
  actionId?: string
) {
  const userId = await ensureFirebaseUserId();
  const finalActionId = actionId ?? crypto.randomUUID();
  const createdAt = nowIso();
  await setDoc(doc(actionsCollection(draftId), finalActionId), toFirestoreRecord({
    id: finalActionId,
    action_id: finalActionId,
    draft_id: draftId,
    user_id: userId,
    type,
    payload: payload ?? {},
    created_at: createdAt,
  }));
  return finalActionId;
}

export async function placeFirebaseBid(
  draftId: string,
  teamId: string,
  amount: number,
  actionId?: string,
  submittedAt?: number
) {
  const userId = await ensureFirebaseUserId();
  const finalActionId = actionId ?? crypto.randomUUID();
  const submittedAtMs = getBidSubmittedAtMs(submittedAt);

  await runTransaction(firestore, async (transaction) => {
    const draftDocument = draftRef(draftId);
    const participantDocument = participantRef(draftId, userId);
    const auctionStateDocument = auctionStateRef(draftId);
    const [draftSnapshot, participantSnapshot, auctionStateSnapshot] = await Promise.all([
      transaction.get(draftDocument),
      transaction.get(participantDocument),
      transaction.get(auctionStateDocument),
    ]);

    if (!draftSnapshot.exists()) {
      throw new Error("Draft room not found.");
    }

    const participant = participantSnapshot.exists()
      ? participantSnapshot.data()
      : undefined;
    if (getParticipantTeamId(participant) !== teamId) {
      throw new Error("You can only bid for your assigned team.");
    }

    const draft = draftSnapshot.data();
    const baseSnapshot = hydrateDraftSnapshot(
      draft.snapshot,
      draft.settings,
      draft.draft_type,
      draft.team_count
    );
    const currentAuctionState = auctionStateSnapshot.exists()
      ? normalizeAuctionState(auctionStateSnapshot.data())
      : null;
    if (currentAuctionState?.actionId === finalActionId || hasLogEntry(baseSnapshot, finalActionId)) {
      return;
    }
    const snapshot = applyAuctionStateToSnapshot(baseSnapshot, currentAuctionState);

    const submittedBeforeDeadline = wasBidSubmittedBeforeDeadline(snapshot, submittedAtMs);
    if (!submittedBeforeDeadline) {
      throw new Error("Auction is already sold.");
    }

    const validationSnapshot =
      snapshot.auction?.call === "sold"
        ? {
            ...snapshot,
            auction: {
              ...snapshot.auction,
              call: "none" as const,
            },
          }
        : snapshot;
    const validation = getBidValidation(validationSnapshot, teamId, amount);
    if (!validation.canBid || validation.amount === null || !validation.team) {
      throw new Error(validation.reason ?? "Bid is not allowed.");
    }

    const bidSeconds = Math.max(1, Number(snapshot.settings?.bidSeconds ?? 10) || 10);
    const acceptedAt = nowIso();
    const timerExpiresAt = new Date(Date.now() + bidSeconds * 1000).toISOString();
    transaction.set(auctionStateDocument, toFirestoreRecord({
      playerId: validation.player?.playerId ?? snapshot.auction?.player?.playerId ?? null,
      currentBid: validation.amount,
      highBidderTeamId: teamId,
      timerExpiresAt,
      bidWindowExpiresAt: timerExpiresAt,
      call: "none",
      actionId: finalActionId,
      updatedAt: acceptedAt,
      version: (currentAuctionState?.version ?? 0) + 1,
    }));
  });

  return finalActionId;
}

export async function getFirebaseDraftByCode(code: string) {
  const codeQuery = query(
    draftsCollection(),
    where("code", "==", code.trim().toUpperCase()),
    limit(1)
  );
  const snapshot = await getDocs(codeQuery);
  const row = snapshot.docs[0];
  if (!row) throw new Error("Draft room not found.");
  return draftFromDoc(row);
}

export async function getFirebaseDraftById(draftId: string) {
  const snapshot = await getDoc(draftRef(draftId));
  if (!snapshot.exists()) return null;
  return draftFromDoc({ id: snapshot.id, ...snapshot.data() });
}

export async function getFirebaseAuctionState(draftId: string) {
  const snapshot = await getDoc(auctionStateRef(draftId));
  if (!snapshot.exists()) return null;
  return normalizeAuctionState(snapshot.data());
}

export async function getFirebaseDraftConfig(draftId: string): Promise<DraftConfigV2> {
  const draft = await getFirebaseDraftById(draftId);
  if (!draft?.settings) throw new Error("Draft config not found");
  return draft.settings as unknown as DraftConfigV2;
}

export async function listFirebaseParticipants(draftId: string) {
  const snapshot = await getDocs(query(participantsCollection(draftId), orderBy("joined_at", "asc")));
  return snapshot.docs.map((entry) => participantFromDoc(entry, draftId));
}

export async function setFirebaseReady(draftId: string, isReady: boolean) {
  const userId = await ensureFirebaseUserId();
  await updateDoc(participantRef(draftId, userId), toFirestoreRecord({
    is_ready: isReady,
    updated_at: nowIso(),
  }));
}

export async function leaveFirebaseDraftRoom(draftId: string) {
  const userId = await ensureFirebaseUserId();
  const currentParticipants = await getDocs(participantsCollection(draftId));
  const remainingParticipants = currentParticipants.docs.filter((entry) => entry.id !== userId);

  await runTransaction(firestore, async (transaction) => {
    const draftDocument = draftRef(draftId);
    const participantDocument = participantRef(draftId, userId);
    const [draftSnapshot, participantSnapshot] = await Promise.all([
      transaction.get(draftDocument),
      transaction.get(participantDocument),
    ]);

    if (participantSnapshot.exists()) {
      transaction.delete(participantDocument);
    }

    if (!draftSnapshot.exists() || remainingParticipants.length > 0) {
      return;
    }

    const draft = draftFromDoc({ id: draftSnapshot.id, ...draftSnapshot.data() });
    const existingPhase = hydrateDraftSnapshot(
      draft.snapshot,
      draft.settings,
      draft.draft_type,
      draft.team_count
    ).phase;
    if (draft.host_user_id !== userId || existingPhase === "complete" || existingPhase === "cancelled") {
      return;
    }

    transaction.update(draftDocument, toFirestoreRecord({
      status: "complete",
      snapshot: terminalDraftSnapshot(draft, "complete", "All managers left. Draft finalized."),
      updated_at: nowIso(),
    }));
  });
}

export async function cancelFirebaseDraftRoom(draftId: string) {
  const userId = await ensureFirebaseUserId();
  const draft = await getFirebaseDraftById(draftId);
  if (!draft) return;
  if (draft.host_user_id !== userId) {
    throw new Error("Only the host can cancel this draft.");
  }

  const phase = (draft.snapshot as { phase?: unknown } | null)?.phase;
  if (draft.status === "complete" || phase === "complete") {
    throw new Error("Cannot cancel a completed draft.");
  }

  await updateDoc(draftRef(draftId), toFirestoreRecord({
    status: "cancelled",
    snapshot: terminalDraftSnapshot(draft, "cancelled", "Draft cancelled by host."),
    updated_at: nowIso(),
  }));
}

export async function getFirebaseParticipant(draftId: string, userId: string) {
  const snapshot = await getDoc(participantRef(draftId, userId));
  if (!snapshot.exists()) return null;
  return participantFromDoc({ id: snapshot.id, ...snapshot.data() }, draftId);
}

export async function findFirebaseParticipantByUserId(userId: string) {
  const drafts = await getDocs(draftsCollection());
  for (const draft of drafts.docs) {
    const participant = await getFirebaseParticipant(draft.id, userId);
    if (participant) return participant;
  }
  return null;
}

export async function updateFirebaseTeamNumber(userId: string, teamNumber: number) {
  const participant = await findFirebaseParticipantByUserId(userId);
  if (!participant) throw new Error("Participant not found");

  const draft = await getFirebaseDraftById(participant.draft_id);
  const phase = (draft?.snapshot as { phase?: unknown } | null)?.phase;
  if (phase !== "lobby") {
    throw new Error("Cannot change teams after draft starts.");
  }

  await updateDoc(participantRef(participant.draft_id, userId), toFirestoreRecord({
    team_number: teamNumber,
    team_id: `t${teamNumber}`,
    updated_at: nowIso(),
  }));
}

export async function updateFirebaseDraftSnapshot(draftId: string, snapshot: unknown, status: string) {
  await updateDoc(draftRef(draftId), toFirestoreRecord({
    snapshot,
    status,
    updated_at: nowIso(),
  }));
}

export async function syncFirebaseAuctionState(
  draftId: string,
  snapshot: unknown
) {
  const nextState = auctionStateFromSnapshot(hydrateDraftSnapshot(snapshot));
  await setDoc(auctionStateRef(draftId), toFirestoreRecord(nextState));
}

export async function replayFirebaseActions(draftId: string, cursorTs: string | null) {
  const baseQuery = cursorTs
    ? query(
        actionsCollection(draftId),
        where("created_at", ">", cursorTs),
        orderBy("created_at", "asc"),
        orderBy("action_id", "asc")
      )
    : query(actionsCollection(draftId), orderBy("created_at", "asc"), orderBy("action_id", "asc"));
  const snapshot = await getDocs(baseQuery);
  return snapshot.docs.map((entry) => actionFromDoc(entry, draftId));
}

export function subscribeToFirebaseDraftSnapshot(
  draftId: string,
  onDraftRow: (draftRow: FirebaseDraftRow | null) => void
): Unsubscribe {
  return onSnapshot(draftRef(draftId), (snapshot) => {
    onDraftRow(snapshot.exists() ? draftFromDoc({ id: snapshot.id, ...snapshot.data() }) : null);
  });
}

export function subscribeToFirebaseAuctionState(
  draftId: string,
  onAuctionState: (auctionState: FirebaseAuctionState | null) => void
): Unsubscribe {
  return onSnapshot(auctionStateRef(draftId), (snapshot) => {
    onAuctionState(snapshot.exists() ? normalizeAuctionState(snapshot.data()) : null);
  });
}

export function subscribeHostToFirebaseActions(
  draftId: string,
  onAction: (actionRow: FirebaseActionRow) => void,
  onStatus?: (status: string) => void
): Unsubscribe {
  const actionsQuery = query(
    actionsCollection(draftId),
    orderBy("created_at", "asc"),
    orderBy("action_id", "asc")
  );
  onStatus?.("SUBSCRIBED");
  return onSnapshot(actionsQuery, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added") {
        onAction(actionFromDoc(change.doc, draftId));
      }
    }
  });
}

export function subscribeToFirebaseParticipants(
  draftId: string,
  onChange: () => void
): Unsubscribe {
  return onSnapshot(participantsCollection(draftId), () => onChange());
}

export async function addFirebaseDraftActionForLegacyHost(draftId: string, snapshot: unknown) {
  await addDoc(actionsCollection(draftId), toFirestoreRecord({
    action_id: crypto.randomUUID(),
    draft_id: draftId,
    user_id: "legacy-host",
    type: "legacy_snapshot",
    payload: { snapshot },
    created_at: nowIso(),
  }));
}
