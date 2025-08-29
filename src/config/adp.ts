// ADP configuration settings
type ScoringFormat = 'ppr' | 'standard' | 'half-ppr';

export interface AdpConfig {
  scoring: ScoringFormat;
  teams: number;
  year: number;
  includeTeInFlex: boolean;
}

// Default configuration values
const defaultConfig: AdpConfig = {
  scoring: 'ppr',
  teams: 12,
  year: new Date().getFullYear(),
  includeTeInFlex: true,
};

// Get configuration from environment variables with fallbacks
const getEnvConfig = (): Partial<AdpConfig> => ({
  scoring: (import.meta.env.VITE_ADP_SCORING as ScoringFormat) || undefined,
  teams: import.meta.env.VITE_ADP_TEAMS ? parseInt(import.meta.env.VITE_ADP_TEAMS, 10) : undefined,
  year: import.meta.env.VITE_ADP_YEAR ? parseInt(import.meta.env.VITE_ADP_YEAR, 10) : undefined,
  includeTeInFlex: import.meta.env.VITE_INCLUDE_TE_IN_FLEX !== 'false',
});

// Merge default config with environment config
export const adpConfig: AdpConfig = {
  ...defaultConfig,
  ...getEnvConfig(),
};

// Validate scoring format
if (!['ppr', 'half', 'standard'].includes(adpConfig.scoring)) {
  console.warn(`Invalid scoring format: ${adpConfig.scoring}. Defaulting to 'ppr'.`);
  adpConfig.scoring = 'ppr';
}

// Validate teams
if (isNaN(adpConfig.teams) || adpConfig.teams < 4 || adpConfig.teams > 20) {
  console.warn(`Invalid team count: ${adpConfig.teams}. Defaulting to 12.`);
  adpConfig.teams = 12;
}

// Validate year
const currentYear = new Date().getFullYear();
if (isNaN(adpConfig.year) || adpConfig.year < 2020 || adpConfig.year > currentYear + 1) {
  console.warn(`Invalid year: ${adpConfig.year}. Defaulting to ${currentYear}.`);
  adpConfig.year = currentYear;
}

console.log('ADP Configuration:', adpConfig);
