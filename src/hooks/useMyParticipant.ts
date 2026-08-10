import { useEffect, useState } from "react";
import { ensureFirebaseSession } from "../lib/authSession";
import { getFirebaseParticipant } from "../multiplayer/firebaseBackend";
import { getLocalParticipant, isLocalMultiplayerMode, subscribeToLocalDraft } from "../multiplayer/localMode";

export function useMyParticipant(draftId: string | undefined) {
  const [participant, setParticipant] = useState<any | null>(null);

  useEffect(() => {
    if (!draftId) {
      setParticipant(null);
      return;
    }

    let cancelled = false;
    const activeDraftId = draftId;

    if (isLocalMultiplayerMode()) {
      const sync = () => {
        if (cancelled) return;
        setParticipant(getLocalParticipant(draftId));
      };

      sync();
      const unsubscribe = subscribeToLocalDraft(draftId, sync);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    async function load() {
      const session = await ensureFirebaseSession();
      const userId = session?.user?.uid;
      if (!userId || cancelled) return;

      const data = await getFirebaseParticipant(activeDraftId, userId);
      if (cancelled) return;
      setParticipant(data ?? null);
    }

    void load().catch((error) => {
      if (cancelled) return;
      console.error("[useMyParticipant] failed", error);
      setParticipant(null);
    });

    return () => {
      cancelled = true;
    };
  }, [draftId]);

  return participant;
}
