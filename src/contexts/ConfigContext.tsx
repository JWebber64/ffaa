import React, { useState, type ReactNode, useCallback, useEffect } from 'react';
import { type AdpConfig, adpConfig as defaultConfig, saveAdpConfig } from '../config/adp';
import { ConfigContext } from './configContextState';

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

  // Persist config changes to localStorage
  useEffect(() => {
    saveAdpConfig(config);
  }, [config]);

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
