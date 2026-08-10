import { createContext, useContext } from "react";
import type { AdpConfig } from "../config/adp";

export interface ConfigContextType {
  config: AdpConfig;
  updateConfig: (updates: Partial<AdpConfig>) => void;
  resetConfig: () => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
