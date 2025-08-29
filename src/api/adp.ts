import type { Player } from '../types/draft';

export interface AdpOptions {
  year?: number;
  teams?: number;
  scoring?: 'standard' | 'ppr' | 'half-ppr';
  useCache?: boolean;
  signal?: AbortSignal;
}

export async function loadAdp(
  options: AdpOptions = {}
): Promise<Array<{ id: string } & Partial<Player>>> {
  // Default options
  const {
    year = new Date().getFullYear(),
    teams = 12,
    scoring = 'ppr',
    useCache = true,
    signal,
  } = options;

  try {
    // In a real implementation, this would fetch from your API
    // For now, we'll return an empty array
    return [];
  } catch (error) {
    console.error('Failed to load ADP data:', error);
    throw error;
  }
}

// Export as default for backward compatibility
export default loadAdp;
