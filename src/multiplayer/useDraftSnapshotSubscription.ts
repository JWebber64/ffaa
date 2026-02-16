import { useEffect } from "react";
import { subscribeToDraftSnapshot } from "@/multiplayer/realtime";
import { supabase } from "@/lib/supabase";
import { useDraftStore } from "@/store/draftStore";

export function useDraftSnapshotSubscription(draftId: string) {
  useEffect(() => {
    if (!draftId) return;
    const ch = subscribeToDraftSnapshot(draftId, (snapshot) => {
      useDraftStore.getState().importDraftState(snapshot);
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [draftId]);
}
