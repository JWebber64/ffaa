import { useEffect, useRef } from "react";

export function useAuctionAudio(snapshot: any, isHost: boolean) {
  const lastCallRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isHost) return;
    if (!snapshot?.auction) return;

    const call = snapshot.auction.call;
    if (!call || call === lastCallRef.current) return;

    lastCallRef.current = call;

    if (call === "once") playTone("once");
    if (call === "twice") playTone("twice");
    if (call === "sold") playTone("sold");
  }, [snapshot, isHost]);
}

function playTone(type: string) {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}
