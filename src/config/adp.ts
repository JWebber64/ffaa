export type ScoringFormat = 'ppr' | 'standard' | 'half-ppr';

export interface AdpConfig {
  scoring: ScoringFormat;
  teams: number;
  year: number;
  includeTeInFlex: boolean;
}

// Defaults
const defaults: AdpConfig = {
  scoring: 'ppr',
  teams: 12,
  year: new Date().getFullYear(),
  includeTeInFlex: true,
};

// Try to hydrate from localStorage (optional)
function loadFromStorage(): Partial<AdpConfig> | null {
  try {
    const raw = localStorage.getItem('adpConfig');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitize(cfg: Partial<AdpConfig>): AdpConfig {
  const out: AdpConfig = { ...defaults, ...cfg };

  // scoring
  if (!['ppr', 'standard', 'half-ppr'].includes(out.scoring)) out.scoring = 'ppr';

  // teams
  if (Number.isNaN(out.teams) || out.teams < 4 || out.teams > 20) out.teams = 12;

  // year
  const cur = new Date().getFullYear();
  if (Number.isNaN(out.year) || out.year < 2020 || out.year > cur + 1) out.year = cur;

  // includeTeInFlex stays boolean
  out.includeTeInFlex = !!out.includeTeInFlex;

  return out;
}

export const adpConfig: AdpConfig = sanitize(loadFromStorage() ?? {});

// save helper (optional; your context may handle this instead)
export function saveAdpConfig(cfg: AdpConfig) {
  try {
    localStorage.setItem('adpConfig', JSON.stringify(cfg));
  } catch {}
}
