import { useEffect, useRef } from "react";
import {
  isAuctionAudioMuted,
  playAuctionSound,
  preloadAuctionSounds,
  subscribeAuctionAudioMuted,
} from "./soundEffects";
import { STYLE_PACKS, type StylePackId } from "../auctioneer/stylePacks";
import { appUrl } from "../lib/appBasePath";

type AuctionCall = "none" | "once" | "twice" | "sold";
type AuctionSpeechStyle = {
  rate: number;
  pitch: number;
};
type SpokenAuctionCall = Exclude<AuctionCall, "none">;
type VoiceManifest = {
  clips?: Partial<Record<StylePackId, Partial<Record<SpokenAuctionCall, string>>>>;
};

const SPEECH_STYLE: Record<StylePackId, AuctionSpeechStyle> = {
  classic: { rate: 1.18, pitch: 0.95 },
  rodeo: { rate: 1.24, pitch: 1 },
  posh: { rate: 0.95, pitch: 0.92 },
  comedian: { rate: 1.18, pitch: 1.05 },
};

function isAuctionCall(value: unknown): value is AuctionCall {
  return value === "none" || value === "once" || value === "twice" || value === "sold";
}

let voiceManifestPromise: Promise<VoiceManifest | null> | null = null;

function loadVoiceManifest() {
  if (voiceManifestPromise) return voiceManifestPromise;

  voiceManifestPromise = fetch(appUrl("sounds/voice/manifest.json"))
    .then((response) => (response.ok ? response.json() as Promise<VoiceManifest> : null))
    .catch(() => null);

  return voiceManifestPromise;
}

function getStyleId(value: unknown): StylePackId {
  return value === "rodeo" || value === "posh" || value === "comedian" ? value : "classic";
}

function getTeamName(snapshot: any, teamId: unknown) {
  if (typeof teamId !== "string") return "the winning team";
  const team = Array.isArray(snapshot?.teams)
    ? snapshot.teams.find((candidate: any) => candidate?.teamId === teamId)
    : null;
  return typeof team?.name === "string" && team.name.trim() ? team.name : teamId;
}

function getAuctionPhrase(snapshot: any, call: SpokenAuctionCall) {
  const styleId = getStyleId(snapshot?.auctioneer?.style_pack);
  const pack = STYLE_PACKS[styleId];
  const currentBid =
    typeof snapshot?.auction?.currentBid === "number" && Number.isFinite(snapshot.auction.currentBid)
      ? snapshot.auction.currentBid
      : 0;

  if (call === "once") return { phrase: pack.once(), styleId };
  if (call === "twice") return { phrase: pack.twice(), styleId };

  return {
    phrase: pack.sold(getTeamName(snapshot, snapshot?.auction?.highBidderTeamId), currentBid),
    styleId,
  };
}

function pickVoice(voices: SpeechSynthesisVoice[], styleId: StylePackId) {
  if (styleId === "posh") {
    return voices.find((voice) => /en-GB/i.test(voice.lang)) ?? null;
  }

  if (styleId === "rodeo" || styleId === "classic") {
    return voices.find((voice) => /en-US/i.test(voice.lang) && /male|david|mark|guy/i.test(voice.name)) ?? null;
  }

  return null;
}

function speakAuctionPhrase(phrase: string, styleId: StylePackId, onFinished?: () => void) {
  if (isAuctionAudioMuted()) return;

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onFinished?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(phrase);
  const speechStyle = SPEECH_STYLE[styleId];
  utterance.rate = speechStyle.rate;
  utterance.pitch = speechStyle.pitch;
  utterance.volume = 1;

  const voice = pickVoice(window.speechSynthesis.getVoices(), styleId);
  if (voice) utterance.voice = voice;

  utterance.onend = () => onFinished?.();
  utterance.onerror = () => onFinished?.();

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playVoiceClip(src: string, onFinished?: () => void) {
  return new Promise<boolean>((resolve) => {
    if (isAuctionAudioMuted()) {
      resolve(true);
      return;
    }

    const audio = new Audio(src);
    let settled = false;
    let unsubscribeMuted = () => {};

    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeMuted();
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      resolve(played);
    };

    const handleEnded = () => {
      onFinished?.();
      finish(true);
    };
    const handleError = () => finish(false);
    unsubscribeMuted = subscribeAuctionAudioMuted((muted) => {
      if (!muted) return;
      audio.pause();
      audio.currentTime = 0;
      finish(true);
    });

    audio.volume = 1;
    audio.preload = "auto";
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    void audio.play().catch(() => finish(false));
  });
}

function playSoldGavel() {
  playAuctionSound("sold", { quiet: true, volume: 1 });
}

export function useAuctionAudio(snapshot: any, isHost: boolean) {
  const lastCallRef = useRef<string | null>(null);

  useEffect(() => {
    preloadAuctionSounds();
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!isHost) return;
    if (!snapshot?.auction) return;

    const call = snapshot.auction.call;
    if (!isAuctionCall(call) || call === lastCallRef.current) return;

    lastCallRef.current = call;
    if (call === "none") return;
    if (isAuctionAudioMuted()) return;

    const { phrase, styleId } = getAuctionPhrase(snapshot, call);
    const onFinished = call === "sold" ? playSoldGavel : undefined;
    let cancelled = false;

    void loadVoiceManifest().then(async (manifest) => {
      if (cancelled) return;
      if (isAuctionAudioMuted()) return;

      const manifestClipSrc = manifest?.clips?.[styleId]?.[call];
      const clipSrc = manifestClipSrc ? appUrl(manifestClipSrc) : null;
      if (clipSrc) {
        const played = await playVoiceClip(clipSrc, onFinished);
        if (played || cancelled) return;
      }

      if (isAuctionAudioMuted()) return;
      speakAuctionPhrase(phrase, styleId, onFinished);
    });

    return () => {
      cancelled = true;
    };
  }, [snapshot, isHost]);
}
