import { createContext, useContext } from "react";

export type RoleContextValue = {
  isAdmin: boolean;
  enableAdminMode: () => void;
  disableAdminMode: () => void;
};

export const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within a RoleProvider");
  return context;
}
