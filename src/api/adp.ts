import FfcAdp, { type FfcScoring } from '../services/FfcAdp';
import type { Player } from '../types/draft';

const ffcAdp = new FfcAdp();

export interface AdpOptions {
  year?: number;
  teams?: number;
  scoring?: 'standard' | 'ppr' | 'half-ppr';
  useCache?: boolean;
  signal?: AbortSignal;
}

const SCORING_MAP: Record<Required<AdpOptions>['scoring'], FfcScoring> = {
  'standard': 'standard',
  'ppr': 'ppr',
  'half-ppr': 'half'
};

export async function loadAdp(
  options: AdpOptions = {}
): Promise<Player[]> {
  // Default options
  const {
    year = new Date().getFullYear(),
    teams = 12,
    scoring = 'ppr',
    useCache = true,
    signal,
  } = options;

  try {
    const ffcOptions = {
      year,
      teams,
      scoring: SCORING_MAP[scoring],
      useCache,
      ...(signal && { signal })
    };

    const players = await ffcAdp.load(ffcOptions);

    // Map FFC player data to our Player type
    return players.map(player => ({
      id: player.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: player.name,
      pos: player.position as Player['pos'],
      nflTeam: player.team || '',
      rank: player.rank,
      posRank: player.posRank,
      adp: player.adp,
      adpSource: 'ffc'
    } as Player));
  } catch (error) {
    console.error('Failed to load ADP data:', error);
    throw error;
  }
}

// Export as default for backward compatibility
export default loadAdp;
