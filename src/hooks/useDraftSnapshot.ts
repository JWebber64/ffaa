import { useCallback, useEffect, useMemo, useState } from "react";
import { applyAuctionStateToSnapshot, type FirebaseAuctionState } from "../multiplayer/auctionState";
import { hydrateDraftSnapshot } from "../multiplayer/draftSnapshot";
import { subscribeToAuctionState, subscribeToDraftSnapshot } from "../multiplayer/realtime";
import { getFirebaseAuctionState, getFirebaseDraftById } from "../multiplayer/firebaseBackend";
import {
  getLocalDraftById,
  isLocalMultiplayerMode,
  subscribeToLocalDraft,
  tickLocalDraft,
} from "../multiplayer/localMode";

export function useDraftSnapshot(draftId: string | undefined) {
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [auctionState, setAuctionState] = useState<FirebaseAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    setError(null);

    if (isLocalMultiplayerMode()) {
      const draft = getLocalDraftById(draftId);
      setSnapshot(draft?.snapshot ?? null);
      setAuctionState(null);
      setLoading(false);
      return;
    }

    const [data, initialAuctionState] = await Promise.all([
      getFirebaseDraftById(draftId),
      getFirebaseAuctionState(draftId).catch(() => null),
    ]).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Failed to load draft");
      setLoading(false);
      return [null, null] as const;
    });

    if (!data) {
      setSnapshot(null);
      setAuctionState(null);
      setLoading(false);
      return;
    }

    setSnapshot(
      hydrateDraftSnapshot(
        data.snapshot,
        data.settings,
        data.settings?.draftType || data.draft_type,
        data.settings?.teamCount || data.team_count
      )
    );
    setAuctionState(initialAuctionState);
    setLoading(false);
  }, [draftId]);

  useEffect(() => {
    if (!draftId) return;

    loadInitial();

    if (isLocalMultiplayerMode()) {
      const unsubscribe = subscribeToLocalDraft(draftId, () => {
        const draft = getLocalDraftById(draftId);
        setSnapshot(draft?.snapshot ?? null);
      });
      const tick = window.setInterval(() => {
        tickLocalDraft(draftId);
      }, 1000);

      return () => {
        unsubscribe();
        window.clearInterval(tick);
      };
    }

    const channel = subscribeToDraftSnapshot(draftId, (draftRow) => {
      setSnapshot(
        hydrateDraftSnapshot(
          draftRow?.snapshot,
          draftRow?.settings,
          draftRow?.settings?.draftType || draftRow?.draft_type,
          draftRow?.settings?.teamCount || draftRow?.team_count
        )
      );
    });
    const auctionChannel = subscribeToAuctionState(draftId, (nextAuctionState) => {
      setAuctionState(nextAuctionState);
    });

    return () => {
      channel.unsubscribe();
      auctionChannel.unsubscribe();
    };
  }, [draftId, loadInitial]);

  const mergedSnapshot = useMemo(
    () => (snapshot ? applyAuctionStateToSnapshot(snapshot, auctionState) : snapshot),
    [auctionState, snapshot]
  );

  return { snapshot: mergedSnapshot, setSnapshot, loading, error };
}
