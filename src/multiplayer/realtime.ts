import { supabase } from "@/lib/supabase";

export function subscribeToDraftSnapshot(draftId: string, onSnapshot: (snapshot: any) => void) {
  return supabase
    .channel(`draft-snapshot:${draftId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draftId}` },
      (payload) => {
        const snap = (payload.new as any).snapshot;
        onSnapshot(snap);
      }
    )
    .subscribe();
}

export function subscribeHostToActions(
  draftId: string,
  onAction: (actionRow: any) => void
) {
  return supabase
    .channel(`draft-actions:${draftId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "draft_actions", filter: `draft_id=eq.${draftId}` },
      (payload) => {
        // Ensure the callback receives the full row with action_id and created_at
        const actionRow = payload.new;
        if (!actionRow.action_id || !actionRow.created_at) {
          console.error("Action row missing required fields:", actionRow);
          return;
        }
        onAction(actionRow);
      }
    )
    .subscribe();
}

export function subscribeToParticipants(
  draftId: string,
  onChange: () => void
) {
  return supabase
    .channel(`draft-participants:${draftId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "draft_participants", filter: `draft_id=eq.${draftId}` },
      () => onChange()
    )
    .subscribe();
}
