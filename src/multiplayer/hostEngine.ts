import { subscribeHostToActions } from "@/multiplayer/realtime";
import { updateFirebaseDraftSnapshot } from "@/multiplayer/firebaseBackend";
import { useDraftStore } from "@/store/draftStore";

export function startHostEngine(draftId: string) {
  const channel = subscribeHostToActions(draftId, async (actionRow) => {
    const store = useDraftStore.getState();

    // Apply to in-memory store
    store.applyIncomingAction(actionRow);

    // Publish snapshot
    const snapshot = store.exportDraftState();

    await updateFirebaseDraftSnapshot(draftId, snapshot, "live").catch((error: unknown) => {
      console.error("[hostEngine] snapshot update failed", error);
    });
  });

  return channel;
}
