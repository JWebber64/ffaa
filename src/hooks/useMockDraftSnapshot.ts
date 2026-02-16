import { useEffect, useMemo, useState } from "react";
import { DraftSnapshot, MOCK_SNAPSHOT } from "../mock/mockDraftSnapshot";

export function useMockDraftSnapshot(draftId: string | undefined) {
  const [snap, setSnap] = useState<DraftSnapshot>(() => ({
    ...MOCK_SNAPSHOT,
    draftId: draftId ?? "mock",
  }));

  // Tiny "alive" timer tick to make the room feel realtime.
  useEffect(() => {
    const t = window.setInterval(() => {
      setSnap((prev) => {
        if (prev.phase !== "bidding" && prev.phase !== "nominating") return prev;
        const next = { ...prev, auction: { ...prev.auction } };
        next.auction.secondsLeft = Math.max(0, next.auction.secondsLeft - 1);

        // Mock call progression
        if (next.auction.secondsLeft === 10) next.auction.call = "once";
        if (next.auction.secondsLeft === 5) next.auction.call = "twice";
        if (next.auction.secondsLeft === 0) next.auction.call = "sold";

        return next;
      });
    }, 1000);

    return () => window.clearInterval(t);
  }, []);

  const me = useMemo(() => {
    // MOCK: pretend you are Team 7 to see bid enabled
    return { teamId: "t7", teamName: "Team 7", isHost: false };
  }, []);

  return { snap, setSnap, me };
}
