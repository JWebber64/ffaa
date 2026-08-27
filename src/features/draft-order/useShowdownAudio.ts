import { useCallback, useState } from "react";

const SHOWDOWN_MUTED_KEY = "ffaa.draftOrder.soundMuted";
const AUCTION_MUTED_KEY = "ffaa.auctionAudioMuted";

type ShowdownSound = "countdown" | "reveal" | "finish";

function initialMuted() {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem(SHOWDOWN_MUTED_KEY);
  if (saved !== null) return saved !== "false";
  const auctionPreference = window.localStorage.getItem(AUCTION_MUTED_KEY);
  return auctionPreference === null ? true : auctionPreference === "true";
}

export function useShowdownAudio() {
  const [muted, setMutedState] = useState(initialMuted);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    window.localStorage.setItem(SHOWDOWN_MUTED_KEY, String(value));
  }, []);

  const play = useCallback((sound: ShowdownSound) => {
    if (muted || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const now = context.currentTime;
    const frequency = sound === "countdown" ? 430 : sound === "reveal" ? 660 : 820;
    oscillator.type = sound === "finish" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (sound === "finish") oscillator.frequency.exponentialRampToValueAtTime(1_080, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sound === "countdown" ? 0.055 : 0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (sound === "finish" ? 0.34 : 0.16));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (sound === "finish" ? 0.36 : 0.18));
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  }, [muted]);

  return { muted, setMuted, play };
}

