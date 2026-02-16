import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMyParticipant(draftId: string | undefined) {
  const [participant, setParticipant] = useState<any | null>(null);

  useEffect(() => {
    if (!draftId) return;

    async function load() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      const { data } = await supabase
        .from("draft_participants")
        .select("*")
        .eq("draft_id", draftId)
        .eq("user_id", user.user.id)
        .single();

      setParticipant(data ?? null);
    }

    load();
  }, [draftId]);

  return participant;
}
