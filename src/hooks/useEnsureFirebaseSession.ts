import { useEffect, useState } from "react";
import { ensureFirebaseSession } from "../lib/authSession";
import { ensureLocalUser, isLocalMultiplayerMode } from "../multiplayer/localMode";

type EnsureSessionState = {
  isReady: boolean;
  userId: string | null;
  error: string | null;
};

export function useEnsureFirebaseSession(): EnsureSessionState {
  const [state, setState] = useState<EnsureSessionState>({
    isReady: false,
    userId: null,
    error: null,
  });

  useEffect(() => {
    if (isLocalMultiplayerMode()) {
      const user = ensureLocalUser();
      setState({
        isReady: true,
        userId: user.userId,
        error: null,
      });
      return;
    }

    let mounted = true;

    async function run() {
      try {
        const session = await ensureFirebaseSession();
        const id = session?.user?.uid ?? null;
        if (!mounted) return;
        setState({ isReady: true, userId: id, error: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to establish session";
        console.error("[ensureSession] failed", msg);
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
