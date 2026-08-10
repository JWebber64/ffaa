import { useEffect } from "react";
import { subscribeToDraftSnapshot } from "@/multiplayer/realtime";
import { useDraftStore } from "@/store/draftStore";

export function useDraftSnapshotSubscription(draftId: string) {
  useEffect(() => {
    if (!draftId) return;
    const ch = subscribeToDraftSnapshot(draftId, (draftRow) => {
      useDraftStore.getState().importDraftState(draftRow?.snapshot);
    });
    return () => {
      ch.unsubscribe();
    };
  }, [draftId]);
}
