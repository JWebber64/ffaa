import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type EnsureSessionState = {
  isReady: boolean;
  userId: string | null;
  error: string | null;
};

export function useEnsureSupabaseSession(): EnsureSessionState {
  const [state, setState] = useState<EnsureSessionState>({
    isReady: false,
    userId: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session?.user?.id) {
          if (!mounted) return;
          setState({ isReady: true, userId: sess.session.user.id, error: null });
          return;
        }

        // If no session, sign in anonymously (fast device onboarding)
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;

        const id = data.user?.id ?? null;
        if (!mounted) return;
        setState({ isReady: true, userId: id, error: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to establish session";
        if (!mounted) return;
        setState({ isReady: true, userId: null, error: msg });
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
