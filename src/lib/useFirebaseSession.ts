import { useEffect, useState } from "react";

import {
  getCachedFirebaseSession,
  readFirebaseSession,
  subscribeToFirebaseSession,
  type AppSession,
} from "./authSession";

export function useFirebaseSession() {
  const [session, setSession] = useState<AppSession | null>(() => getCachedFirebaseSession());

  useEffect(() => {
    let disposed = false;
    const unsubscribe = subscribeToFirebaseSession((nextSession) => {
      if (!disposed) setSession(nextSession);
    });
    void readFirebaseSession().then((nextSession) => {
      if (!disposed) setSession(nextSession);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return session;
}
