import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AdpConfig, adpConfig as defaultConfig } from '../config/adp';

interface ConfigContextType {
  config: AdpConfig;
  updateConfig: (updates: Partial<AdpConfig>) => void;
  resetConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AdpConfig>(defaultConfig);

  const updateConfig = useCallback((updates: Partial<AdpConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
