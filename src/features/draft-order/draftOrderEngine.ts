import {
  DRAFT_ORDER_ALGORITHM_VERSION,
  MODE_LABELS,
  type DraftOrderAnimationPlan,
  type DraftOrderDrawInput,
  type DraftOrderDrawRecord,
  type DraftOrderMode,
  type DraftOrderParticipant,
  type DraftOrderParticipantSnapshot,
  type DraftOrderVerification,
} from "./types";

const encoder = new TextEncoder();

function getCrypto() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for a verifiable draft-order draw.");
  }
  return globalThis.crypto;
}
function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await getCrypto().subtle.digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(digest);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function canonicalSerialize(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function concatBytes(...chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function createSecureSeed(byteLength = 16) {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Draft-order seeds must contain at least 128 bits of randomness.");
  }
  return bytesToBase64Url(getCrypto().getRandomValues(new Uint8Array(byteLength)));
}

export async function deriveSeed(masterSeed: string, streamName: string) {
  if (!masterSeed || !streamName) throw new Error("A master seed and stream name are required.");
  const derived = await sha256Bytes(
    concatBytes(base64UrlToBytes(masterSeed), new Uint8Array([0]), encoder.encode(streamName)),
  );
  return bytesToBase64Url(derived);
}

class DeterministicByteStream {
  private block = new Uint8Array(0);
  private offset = 0;
  private counter = 0;

  constructor(private readonly seed: Uint8Array) {}

  private async refill() {
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, this.counter, false);
    this.counter += 1;
    this.block = await sha256Bytes(concatBytes(this.seed, counter));
    this.offset = 0;
  }

  private async nextByte() {
    if (this.offset >= this.block.length) await this.refill();
    return this.block[this.offset++]!;
  }

  async nextUint32() {
    // Consume the stream serially. Parallel reads can all observe an empty
    // block and race independent refills, making a seeded draw non-repeatable.
    const bytes: number[] = [];
    for (let index = 0; index < 4; index += 1) bytes.push(await this.nextByte());
    return new DataView(Uint8Array.from(bytes).buffer).getUint32(0, false);
  }

  async nextInt(maxExclusive: number) {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0xffffffff) {
      throw new Error("Deterministic random indexes require a positive 32-bit upper bound.");
    }
    if (maxExclusive === 1) return 0;
    const range = 0x1_0000_0000;
    const rejectionLimit = Math.floor(range / maxExclusive) * maxExclusive;
    let value = await this.nextUint32();
    while (value >= rejectionLimit) value = await this.nextUint32();
    return value % maxExclusive;
  }
}

function snapshotParticipant(participant: DraftOrderParticipant): DraftOrderParticipantSnapshot {
  return {
    id: participant.id,
    managerName: participant.managerName.trim(),
    teamName: participant.teamName.trim(),
    ...(participant.avatarUrl ? { avatarUrl: participant.avatarUrl } : {}),
    color: participant.color,
    source: participant.source,
    ...(participant.sourceId ? { sourceId: participant.sourceId } : {}),
  };
}

function validateParticipantSnapshot(participants: DraftOrderParticipantSnapshot[]) {
  if (participants.length < 2) throw new Error("Add at least two managers before locking the draw.");
  const ids = new Set<string>();
  for (const participant of participants) {
    if (!participant.id.trim()) throw new Error("Every participant needs a stable internal ID.");
    if (ids.has(participant.id)) throw new Error("Participant IDs must be unique.");
    if (!participant.managerName.trim() && !participant.teamName.trim()) {
      throw new Error("Every participant needs a manager or team name.");
    }
    ids.add(participant.id);
  }
}

export async function shuffleParticipants<T extends { id: string }>(masterSeed: string, participants: T[]) {
  const outcomeSeed = base64UrlToBytes(await deriveSeed(masterSeed, "outcome"));
  const stream = new DeterministicByteStream(outcomeSeed);
  const shuffled = [...participants];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = await stream.nextInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

function verificationPayload(draw: Omit<DraftOrderDrawRecord, "verificationHash"> | DraftOrderDrawRecord) {
  // Presentation mode is intentionally excluded: switching animations must
  // keep the commitment for the already-locked outcome byte-for-byte stable.
  return {
    id: draw.id,
    algorithmVersion: draw.algorithmVersion,
    masterSeed: draw.masterSeed,
    participants: draw.participants,
    finalParticipantIds: draw.finalParticipantIds,
    createdAt: draw.createdAt,
    rerollIndex: draw.rerollIndex,
    ...(draw.leagueId ? { leagueId: draw.leagueId } : {}),
    ...(draw.draftId ? { draftId: draw.draftId } : {}),
  };
}

export async function createVerificationHash(
  draw: Omit<DraftOrderDrawRecord, "verificationHash"> | DraftOrderDrawRecord,
) {
  return bytesToBase64Url(await sha256Bytes(encoder.encode(canonicalSerialize(verificationPayload(draw)))));
}

export async function createDraftOrderDraw(input: DraftOrderDrawInput): Promise<DraftOrderDrawRecord> {
  const participants = input.participants.map(snapshotParticipant);
  validateParticipantSnapshot(participants);
  const masterSeed = input.masterSeed ?? createSecureSeed();
  const ordered = await shuffleParticipants(masterSeed, participants);
  const record: Omit<DraftOrderDrawRecord, "verificationHash"> = {
    id: input.drawId ?? getCrypto().randomUUID(),
    algorithmVersion: DRAFT_ORDER_ALGORITHM_VERSION,
    masterSeed,
    participants,
    finalParticipantIds: ordered.map((participant) => participant.id),
    mode: input.mode,
    createdAt: input.createdAt ?? new Date().toISOString(),
    rerollIndex: Math.max(0, Math.trunc(input.rerollIndex ?? 0)),
    ...(input.leagueId ? { leagueId: input.leagueId } : {}),
    ...(input.draftId ? { draftId: input.draftId } : {}),
  };
  return { ...record, verificationHash: await createVerificationHash(record) };
}

export async function changeDraftOrderRevealMode(draw: DraftOrderDrawRecord, mode: DraftOrderMode) {
  const changed = { ...draw, mode, verificationHash: "" };
  return { ...changed, verificationHash: await createVerificationHash(changed) };
}

export async function verifyDraftOrderDraw(draw: DraftOrderDrawRecord): Promise<DraftOrderVerification> {
  if (draw.algorithmVersion !== DRAFT_ORDER_ALGORITHM_VERSION) {
    return {
      valid: false,
      orderValid: false,
      hashValid: false,
      participantSetValid: false,
      message: `Unsupported algorithm version: ${draw.algorithmVersion}`,
    };
  }

  try {
    validateParticipantSnapshot(draw.participants);
    const participantIds = draw.participants.map((participant) => participant.id);
    const resultIds = draw.finalParticipantIds;
    const participantSetValid =
      resultIds.length === participantIds.length
      && new Set(resultIds).size === resultIds.length
      && resultIds.every((id) => participantIds.includes(id));
    const recomputed = await shuffleParticipants(draw.masterSeed, draw.participants);
    const orderValid = recomputed.map((participant) => participant.id).join("\u0000") === resultIds.join("\u0000");
    const hashValid = (await createVerificationHash(draw)) === draw.verificationHash;
    const valid = participantSetValid && orderValid && hashValid;
    return {
      valid,
      participantSetValid,
      orderValid,
      hashValid,
      message: valid
        ? "Verified: the seed, participant snapshot, result order, and commitment hash all match."
        : "Verification failed: this draw record has been changed or is incomplete.",
    };
  } catch (error) {
    return {
      valid: false,
      participantSetValid: false,
      orderValid: false,
      hashValid: false,
      message: error instanceof Error ? error.message : "The draw could not be verified.",
    };
  }
}

function modeTiming(mode: DraftOrderMode, rank: number, total: number, jitter: number) {
  switch (mode) {
    case "draft-dash":
      return { delayMs: 0, durationMs: 6_900 + rank * 220 + jitter, totalDurationMs: 10_800 };
    case "football-plinko":
      return { delayMs: 600 + rank * 430, durationMs: 2_100 + jitter, totalDurationMs: 10_200 };
    case "punt-bounce":
      return { delayMs: rank * 130, durationMs: 4_400 + jitter, totalDurationMs: 7_400 };
    case "fumble-pile":
      return { delayMs: (total - rank - 1) * 420 + 1_700, durationMs: 360, totalDurationMs: 9_400 };
    case "helmet-shuffle":
      return { delayMs: 0, durationMs: 2_800, totalDurationMs: 0 };
  }
}

export async function createDraftOrderAnimationPlan(
  draw: DraftOrderDrawRecord,
  mode: DraftOrderMode = draw.mode,
): Promise<DraftOrderAnimationPlan> {
  const animationSeed = base64UrlToBytes(await deriveSeed(draw.masterSeed, `animation:${mode}`));
  const stream = new DeterministicByteStream(animationSeed);
  const ranks = new Map(draw.finalParticipantIds.map((id, index) => [id, index]));
  const cues = [];

  for (const participant of draw.participants) {
    const rank = ranks.get(participant.id);
    if (rank === undefined) throw new Error("Animation plan could not map the locked result.");
    const jitter = await stream.nextInt(121);
    const drift = (await stream.nextInt(19)) - 9;
    const bounce = 2 + (await stream.nextInt(7));
    const pathVariant = await stream.nextInt(5);
    const timing = modeTiming(mode, rank, draw.participants.length, jitter);
    cues.push({
      participantId: participant.id,
      rank,
      delayMs: timing.delayMs,
      durationMs: timing.durationMs,
      drift,
      bounce,
      pathVariant,
      finalPercent: mode === "punt-bounce"
        ? 92 - rank * (62 / Math.max(1, draw.participants.length - 1)) + (await stream.nextInt(70)) / 100
        : ((rank + 1) / draw.participants.length) * 100,
    });
  }

  return {
    mode,
    cues,
    totalDurationMs: modeTiming(mode, 0, draw.participants.length, 0).totalDurationMs,
  };
}

export function formatDraftOrderText(draw: DraftOrderDrawRecord) {
  const participants = new Map(draw.participants.map((participant) => [participant.id, participant]));
  const lines = draw.finalParticipantIds.map((id, index) => {
    const participant = participants.get(id);
    return `${index + 1}. ${participant?.teamName || participant?.managerName || "Manager"}`;
  });
  return [
    "GameHQ Draft Order",
    "",
    ...lines,
    "",
    `Mode: ${MODE_LABELS[draw.mode]}`,
    `Draw: ${draw.rerollIndex + 1}`,
    `Seed: ${draw.masterSeed}`,
    `Verification: ${draw.verificationHash}`,
  ].join("\n");
}
