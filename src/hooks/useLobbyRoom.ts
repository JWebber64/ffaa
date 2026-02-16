import { useEffect, useState } from "react";
import { listParticipants } from "../multiplayer/api";
import { subscribeToParticipants } from "../multiplayer/realtime";

export type ParticipantRow = {
  id: string;
  draft_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_ready: boolean;
  team_number: number | null;
  created_at: string;
};

export function useLobbyRoom(draftId: string | null) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!draftId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = (await listParticipants(draftId)) as ParticipantRow[];
      setParticipants(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!draftId) return;
    refresh();

    const ch = subscribeToParticipants(draftId, () => {
      refresh();
    });

    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  return { participants, loading, error, refresh };
}
