export const DRAFT_ORDER_ALGORITHM_VERSION = "gamehq-draft-order-v1" as const;

export const DRAFT_ORDER_MODES = [
  "draft-dash",
  "football-plinko",
  "punt-bounce",
  "fumble-pile",
  "helmet-shuffle",
] as const;

export type DraftOrderMode = (typeof DRAFT_ORDER_MODES)[number];

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
  "fumble-pile": "Fumble-Pile Reveal",
  "helmet-shuffle": "Helmet Shuffle",
};

export const MODE_DESCRIPTIONS: Record<DraftOrderMode, string> = {
  "draft-dash": "Every manager races the full field, with each finish revealing the locked order.",
  "football-plinko": "Team footballs ricochet through stadium pegs into their predetermined slots.",
  "punt-bounce": "Farthest punt gets the first pick, with every final distance fixed before kickoff.",
  "fumble-pile": "The pile gives up the order from the final pick to a dramatic first-pick reveal.",
  "helmet-shuffle": "Shuffle the helmets, then reveal each already-assigned draft position.",
};

export const MODE_REVEAL_STYLES: Record<DraftOrderMode, string> = {
  "draft-dash": "Live finish",
  "football-plinko": "Slot by slot",
  "punt-bounce": "Distance ranking",
  "fumble-pile": "Last to first",
  "helmet-shuffle": "Tap to reveal",
};
