import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { subscribeToDraftSnapshot } from "../multiplayer/realtime";

export function useDraftSnapshot(draftId: string | undefined) {
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInitial() {
    if (!draftId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("drafts")
      .select("snapshot, draft_type, team_count, settings")
      .eq("id", draftId)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setSnapshot({
      ...data.snapshot,
      draft_type: data.settings?.draftType || data.draft_type,
      team_count: data.settings?.teamCount || data.team_count,
    });
    setLoading(false);
  }

  useEffect(() => {
    if (!draftId) return;

    loadInitial();

    const channel = subscribeToDraftSnapshot(draftId, (row) => {
      setSnapshot(row.snapshot ?? null);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [draftId]);

  return { snapshot, setSnapshot, loading, error };
}
