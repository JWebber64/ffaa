import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SessionInfo = {
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  provider: string | null;
};

export function useSupabaseSessionInfo(): SessionInfo {
  const [info, setInfo] = useState<SessionInfo>({
    hasSession: false,
    userId: null,
    email: null,
    provider: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      setInfo({
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        provider: (session?.user?.app_metadata as any)?.provider ?? null,
      });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return info;
}
