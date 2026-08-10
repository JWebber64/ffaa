import { appUrl } from "../lib/appBasePath";

export type AuctionSound =
  | "nomination"
  | "bid"
  | "winner"
  | "timer"
  | "once"
  | "twice"
  | "sold"
  | "draftComplete";

type PlayAuctionSoundOptions = {
  volume?: number | undefined;
  quiet?: boolean | undefined;
};

const AUCTION_AUDIO_MUTED_STORAGE_KEY = "ffaa.auctionAudioMuted";

export const AUCTION_SOUND_FILES: Record<AuctionSound, string> = {
  nomination: appUrl("sounds/auction-nomination.wav"),
  bid: appUrl("sounds/bid-placed.wav"),
  winner: appUrl("sounds/auction-winner.wav"),
  timer: appUrl("sounds/timer-warning.wav"),
  once: appUrl("sounds/once.wav"),
  twice: appUrl("sounds/twice.wav"),
  sold: appUrl("sounds/sold.mp3"),
  draftComplete: appUrl("sounds/draft-complete.wav"),
};

const DEFAULT_VOLUMES: Record<AuctionSound, number> = {
  nomination: 0.45,
  bid: 0.35,
  winner: 0.5,
  timer: 0.18,
  once: 0.42,
  twice: 0.48,
  sold: 0.58,
  draftComplete: 0.52,
};

const audioCache: Partial<Record<AuctionSound, HTMLAudioElement>> = {};
const audioMutedListeners = new Set<(muted: boolean) => void>();

function readInitialAudioMuted() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(AUCTION_AUDIO_MUTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let auctionAudioMuted = readInitialAudioMuted();

function canUseAudio() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return 0.5;
  return Math.min(1, Math.max(0, volume));
}

function getAudio(type: AuctionSound) {
  if (!canUseAudio()) return null;

  let audio = audioCache[type];
  if (!audio) {
    audio = new Audio(AUCTION_SOUND_FILES[type]);
    audio.preload = "auto";
    audioCache[type] = audio;
  }

  return audio;
}

function stopCachedAuctionSounds() {
  Object.values(audioCache).forEach((audio) => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  });
}

function persistAudioMuted(muted: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AUCTION_AUDIO_MUTED_STORAGE_KEY, String(muted));
  } catch {
    // Audio muting still works for the current session if storage is unavailable.
  }
}

export function isAuctionAudioMuted() {
  return auctionAudioMuted;
}

export function setAuctionAudioMuted(muted: boolean) {
  if (auctionAudioMuted === muted) return;

  auctionAudioMuted = muted;
  persistAudioMuted(muted);

  if (muted) {
    stopCachedAuctionSounds();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  audioMutedListeners.forEach((listener) => listener(auctionAudioMuted));
}

export function subscribeAuctionAudioMuted(listener: (muted: boolean) => void) {
  audioMutedListeners.add(listener);
  return () => {
    audioMutedListeners.delete(listener);
  };
}

export function preloadAuctionSounds() {
  (Object.keys(AUCTION_SOUND_FILES) as AuctionSound[]).forEach((type) => {
    const audio = getAudio(type);
    if (!audio) return;
    audio.load();
  });
}

export function playAuctionSound(type: AuctionSound, options: PlayAuctionSoundOptions = {}) {
  if (auctionAudioMuted) return;

  const audio = getAudio(type);
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  audio.volume = clampVolume(options.volume ?? DEFAULT_VOLUMES[type]);

  void audio.play().catch((error: unknown) => {
    if (!options.quiet) {
      console.warn(`Unable to play ${type} sound`, error);
    }
  });
}
