import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RoleContext } from "./roleContextState";

const STORAGE_KEY = "ffaa_admin_mode"; // local preference only (NOT security)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setIsAdmin(raw === "true");
    } catch {
      // ignore
    }
  }, []);

  const enableAdminMode = useCallback(() => {
    setIsAdmin(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  const disableAdminMode = useCallback(() => {
    setIsAdmin(false);
    try {
      localStorage.setItem(STORAGE_KEY, "false");
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ isAdmin, enableAdminMode, disableAdminMode }),
    [isAdmin, enableAdminMode, disableAdminMode]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
