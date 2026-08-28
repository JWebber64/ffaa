export const DRAFT_ORDER_ALGORITHM_VERSION = "gamehq-draft-order-v1" as const;

export const DRAFT_ORDER_MODES = [
  "draft-dash",
  "football-plinko",
  "punt-bounce",
] as const;

export type DraftOrderMode = (typeof DRAFT_ORDER_MODES)[number];

export const DEFAULT_DRAFT_ORDER_MODE: DraftOrderMode = "draft-dash";

const DRAFT_ORDER_MODE_SET = new Set<string>(DRAFT_ORDER_MODES);

export function isDraftOrderMode(value: unknown): value is DraftOrderMode {
  return typeof value === "string" && DRAFT_ORDER_MODE_SET.has(value);
}

export function normalizeDraftOrderMode(value: unknown): DraftOrderMode {
  return isDraftOrderMode(value) ? value : DEFAULT_DRAFT_ORDER_MODE;
}

export type DraftOrderParticipantSource = "manual" | "sleeper" | "draft-room";

export interface DraftOrderParticipant {
  id: string;
  managerName: string;
  teamName: string;
  avatarUrl?: string;
  color: string;
  source: DraftOrderParticipantSource;
  sourceId?: string;
}

export interface DraftOrderParticipantSnapshot {
  id: string;
  managerName: string;
  teamName: string;
  avatarUrl?: string;
  color: string;
  source: DraftOrderParticipantSource;
  sourceId?: string;
}

export interface DraftOrderDrawRecord {
  id: string;
  algorithmVersion: typeof DRAFT_ORDER_ALGORITHM_VERSION;
  masterSeed: string;
  participants: DraftOrderParticipantSnapshot[];
  finalParticipantIds: string[];
  mode: DraftOrderMode;
  createdAt: string;
  rerollIndex: number;
  verificationHash: string;
  leagueId?: string;
  draftId?: string;
}

export interface DraftOrderDrawInput {
  participants: DraftOrderParticipant[];
  mode: DraftOrderMode;
  rerollIndex?: number;
  leagueId?: string;
  draftId?: string;
  masterSeed?: string;
  drawId?: string;
  createdAt?: string;
}

export interface DraftOrderVerification {
  valid: boolean;
  orderValid: boolean;
  hashValid: boolean;
  participantSetValid: boolean;
  message: string;
}

export interface DraftOrderAnimationCue {
  participantId: string;
  rank: number;
  delayMs: number;
  durationMs: number;
  drift: number;
  bounce: number;
  pathVariant: number;
  finalPercent: number;
  dashProgressPoints?: [number, number, number, number];
}

export interface DraftOrderAnimationPlan {
  mode: DraftOrderMode;
  cues: DraftOrderAnimationCue[];
  totalDurationMs: number;
}

export type DraftOrderPhase =
  | "setup"
  | "choose-game"
  | "locked"
  | "countdown"
  | "running"
  | "results";

export interface DraftRoomOrderContext {
  draftId: string;
  code: string;
  draftType: "auction" | "snake";
  teamCount: number;
  humanSeatCount: number;
  isHost: boolean;
  isLobby: boolean;
  participants: DraftOrderParticipant[];
}

export const MODE_LABELS: Record<DraftOrderMode, string> = {
  "draft-dash": "100-Yard Draft Dash",
  "football-plinko": "Football Plinko",
  "punt-bounce": "Punt Bounce",
};

export const MODE_DESCRIPTIONS: Record<DraftOrderMode, string> = {
  "draft-dash": "Every manager races the full field. First across the line gets the first pick.",
  "football-plinko": "Team footballs ricochet through stadium pegs, with every landing claiming a draft slot.",
  "punt-bounce": "The farthest punt wins the first pick while every bounce builds the suspense.",
};

export const MODE_REVEAL_STYLES: Record<DraftOrderMode, string> = {
  "draft-dash": "Live finish",
  "football-plinko": "Slot by slot",
  "punt-bounce": "Distance ranking",
};
