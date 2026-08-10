import { useEffect, useState } from "react";
import {
  getCachedFirebaseSession,
  readFirebaseSession,
  subscribeToFirebaseSession,
} from "../lib/authSession";
import { getLocalSessionInfo, isLocalMultiplayerMode } from "../multiplayer/localMode";

type SessionInfo = {
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  provider: string | null;
};

export function useFirebaseSessionInfo(): SessionInfo {
  const localMode = isLocalMultiplayerMode();
  const [info, setInfo] = useState<SessionInfo>(() => {
    if (localMode) return getLocalSessionInfo();
    const cachedSession = getCachedFirebaseSession();
    return {
      hasSession: !!cachedSession,
      userId: cachedSession?.user?.uid ?? null,
      email: cachedSession?.user?.email ?? null,
      provider: cachedSession?.provider ?? null,
    };
  });

  useEffect(() => {
    if (localMode) {
      setInfo(getLocalSessionInfo());
      return undefined;
    }

    let mounted = true;
    function sync(session: ReturnType<typeof getCachedFirebaseSession>) {
      if (!mounted) return;
      setInfo({
        hasSession: !!session,
        userId: session?.user?.uid ?? null,
        email: session?.user?.email ?? null,
        provider: session?.provider ?? null,
      });
    }

    void readFirebaseSession()
      .then((session) => {
        sync(session);
      })
      .catch((error) => {
        console.warn("[sessionInfo] failed", error);
      });

    const unsubscribe = subscribeToFirebaseSession((session) => {
      sync(session);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [localMode]);

  return info;
}
