import { DEFAULT_DRAFT_ORDER_MODE, normalizeDraftOrderMode } from "./types";
import type {
  DraftOrderAnimationPlan,
  DraftOrderDrawRecord,
  DraftOrderMode,
  DraftOrderParticipant,
  DraftOrderPhase,
  DraftRoomOrderContext,
} from "./types";

export interface DraftOrderShowdownState {
  phase: DraftOrderPhase;
  participants: DraftOrderParticipant[];
  selectedMode: DraftOrderMode;
  draw: DraftOrderDrawRecord | null;
  animationPlan: DraftOrderAnimationPlan | null;
  countdown: number;
  roomContext: DraftRoomOrderContext | null;
  leagueId: string;
  readOnly: boolean;
  accepted: boolean;
}

export const INITIAL_SHOWDOWN_STATE: DraftOrderShowdownState = {
  phase: "setup",
  participants: [],
  selectedMode: DEFAULT_DRAFT_ORDER_MODE,
  draw: null,
  animationPlan: null,
  countdown: 3,
  roomContext: null,
  leagueId: "",
  readOnly: false,
  accepted: false,
};

export type DraftOrderShowdownAction =
  | { type: "set-participants"; participants: DraftOrderParticipant[] }
  | { type: "set-room-context"; context: DraftRoomOrderContext }
  | { type: "set-league"; leagueId: string }
  | { type: "choose-game" }
  | { type: "back-to-setup" }
  | { type: "select-mode"; mode: DraftOrderMode }
  | { type: "lock"; draw: DraftOrderDrawRecord; animationPlan: DraftOrderAnimationPlan }
  | { type: "begin-countdown" }
  | { type: "countdown-tick"; value: number }
  | { type: "run" }
  | { type: "finish" }
  | { type: "replay" }
  | { type: "reveal-with"; draw: DraftOrderDrawRecord; animationPlan: DraftOrderAnimationPlan }
  | { type: "accept" }
  | { type: "reset" }
  | { type: "load-shared"; draw: DraftOrderDrawRecord; animationPlan: DraftOrderAnimationPlan }
  | { type: "restore"; state: DraftOrderShowdownState };

function editingLocked(state: DraftOrderShowdownState) {
  return state.phase !== "setup" && state.phase !== "choose-game";
}

export function draftOrderShowdownReducer(
  state: DraftOrderShowdownState,
  action: DraftOrderShowdownAction,
): DraftOrderShowdownState {
  switch (action.type) {
    case "set-participants":
      return editingLocked(state) || state.readOnly ? state : { ...state, participants: action.participants };
    case "set-room-context":
      return editingLocked(state) || state.readOnly
        ? state
        : { ...state, roomContext: action.context, participants: action.context.participants };
    case "set-league":
      return editingLocked(state) || state.readOnly ? state : { ...state, leagueId: action.leagueId };
    case "choose-game":
      return state.phase === "setup" && state.participants.length >= 2
        ? { ...state, phase: "choose-game" }
        : state;
    case "back-to-setup":
      return state.phase === "choose-game" ? { ...state, phase: "setup" } : state;
    case "select-mode":
      return editingLocked(state) || state.readOnly ? state : { ...state, selectedMode: action.mode };
    case "lock":
      return state.phase === "choose-game" || state.phase === "results"
        ? {
            ...state,
            phase: "countdown",
            draw: action.draw,
            selectedMode: action.draw.mode,
            animationPlan: action.animationPlan,
            countdown: 3,
            accepted: action.draw.id === state.draw?.id ? state.accepted : false,
          }
        : state;
    case "begin-countdown":
      return state.phase === "locked" && state.draw
        ? { ...state, phase: "countdown", countdown: 3 }
        : state;
    case "countdown-tick":
      return state.phase === "countdown" ? { ...state, countdown: Math.max(0, action.value) } : state;
    case "run":
      return state.phase === "countdown" ? { ...state, phase: "running", countdown: 0 } : state;
    case "finish":
      return state.phase === "running" ? { ...state, phase: "results" } : state;
    case "replay":
      return state.phase === "results" && state.draw && state.animationPlan
        ? { ...state, phase: "countdown", countdown: 3 }
        : state;
    case "reveal-with":
      return state.phase === "results" && state.draw
        ? {
            ...state,
            phase: "countdown",
            countdown: 3,
            draw: action.draw,
            selectedMode: action.draw.mode,
            animationPlan: action.animationPlan,
          }
        : state;
    case "accept":
      return { ...state, accepted: true };
    case "reset":
      return { ...INITIAL_SHOWDOWN_STATE };
    case "load-shared":
      return {
        ...INITIAL_SHOWDOWN_STATE,
        phase: "results",
        participants: action.draw.participants,
        selectedMode: action.draw.mode,
        draw: action.draw,
        animationPlan: action.animationPlan,
        readOnly: true,
      };
    case "restore": {
      const restored = action.state;
      const safePhase = restored.phase === "running" || restored.phase === "countdown" || restored.phase === "locked"
        ? "countdown"
        : restored.phase;
      return { ...restored, phase: safePhase, countdown: 3 };
    }
  }
}

const ACTIVE_DRAW_KEY = "ffaa.draftOrder.active.v1";

export function loadActiveShowdownState(): DraftOrderShowdownState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_DRAW_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as DraftOrderShowdownState;
    if (!state.draw || !Array.isArray(state.participants) || !state.animationPlan) return null;
    const mode = normalizeDraftOrderMode(state.draw.mode);
    return {
      ...state,
      phase: state.phase === "running" || state.phase === "countdown" || state.phase === "locked"
        ? "countdown"
        : state.phase,
      countdown: 3,
      selectedMode: mode,
      draw: { ...state.draw, mode },
      animationPlan: { ...state.animationPlan, mode },
    };
  } catch {
    return null;
  }
}

export function persistActiveShowdownState(state: DraftOrderShowdownState) {
  if (typeof window === "undefined" || !state.draw) return;
  window.localStorage.setItem(ACTIVE_DRAW_KEY, JSON.stringify(state));
}

export function clearActiveShowdownState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_DRAW_KEY);
}
