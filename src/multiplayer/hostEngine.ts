import { supabase } from "@/lib/supabase";
import { subscribeHostToActions } from "@/multiplayer/realtime";
import { useDraftStore } from "@/store/draftStore";

export function startHostEngine(draftId: string) {
  const channel = subscribeHostToActions(draftId, async (actionRow) => {
    const store = useDraftStore.getState();

    // Apply to in-memory store
    store.applyIncomingAction(actionRow);

    // Publish snapshot
    const snapshot = store.exportDraftState();

    const { error } = await supabase
      .from("drafts")
      .update({ snapshot })
      .eq("id", draftId);

    if (error) {
      // log only; do not crash the host loop
      console.error("[hostEngine] snapshot update failed", error);
    }
  });

  return channel;
}
