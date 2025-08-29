import type { Player } from '../store/draftStore.new';

type FfcScoring = 'standard' | 'ppr' | 'half-ppr';

interface FfcAdpPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  rank: number;
  position_rank: number;
}

interface FfcAdpOptions {
  year: number;
  teams: number;
  scoring: FfcScoring;
}

// Team code normalization map
const TEAM_ALIASES: Record<string, string> = {
  'JAC': 'JAX',
  'JAX': 'JAC',
  'LAR': 'LA',
  'LA': 'LAR',
  'WAS': 'WAS',
  'TB': 'TB',
  'GB': 'GB',
  'KC': 'KC',
  'BUF': 'BUF',
  'MIA': 'MIA',
  'NE': 'NE',
  'NYJ': 'NYJ',
  'BAL': 'BAL',
  'CIN': 'CIN',
  'CLE': 'CLE',
  'PIT': 'PIT',
  'HOU': 'HOU',
  'IND': 'IND',
  'TEN': 'TEN',
  'DEN': 'DEN',
  'LV': 'LV',
  'LAC': 'LAC',
  'DAL': 'DAL',
  'NYG': 'NYG',
  'PHI': 'PHI',
  'CHI': 'CHI',
  'DET': 'DET',
  'MIN': 'MIN',
  'ATL': 'ATL',
  'CAR': 'CAR',
  'NO': 'NO',
  'ARI': 'ARI',
  'SF': 'SF',
  'SEA': 'SEA',
};

// Position normalization map
const POSITION_ALIASES: Record<string, string> = {
  'DST': 'DEF',
  'D/ST': 'DEF',
  'DEF': 'DEF',
  'PK': 'K',
  'K': 'K',
  'QB': 'QB',
  'RB': 'RB',
  'WR': 'WR',
  'TE': 'TE',
};

/**
 * Normalize player names for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '') // Remove periods
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Normalize team codes
 */
function normalizeTeam(team: string): string {
  return TEAM_ALIASES[team.toUpperCase()] || team.toUpperCase();
}

/**
 * Normalize position codes
 */
function normalizePosition(pos: string): string {
  return POSITION_ALIASES[pos.toUpperCase()] || pos.toUpperCase();
}

/**
 * Map FFC ADP data to player updates
 */
function mapAdpToPlayers(
  players: Player[],
  adpRows: FfcAdpPlayer[],
  sourceLabel: string
): Array<{ id: string } & Partial<Player>> {
  // Create a map of normalized player info to player ID for lookup
  const playerMap = new Map<string, string>();
  
  // First pass: build the lookup map
  for (const player of players) {
    const key = [
      normalizeName(player.name),
      player.nflTeam ? normalizeTeam(player.nflTeam) : '',
      normalizePosition(player.pos)
    ].join('|');
    
    playerMap.set(key, player.id);
  }

  // Second pass: find matches and create updates
  const updates: Array<{ id: string } & Partial<Player>> = [];
  
  for (const adpPlayer of adpRows) {
    const key = [
      normalizeName(adpPlayer.name),
      adpPlayer.team ? normalizeTeam(adpPlayer.team) : '',
      normalizePosition(adpPlayer.position)
    ].join('|');
    
    const playerId = playerMap.get(key);
    if (playerId) {
      updates.push({
        id: playerId,
        rank: adpPlayer.rank,
        posRank: adpPlayer.position_rank,
        adp: adpPlayer.adp,
        adpSource: sourceLabel,
      });
    }
  }
  
  return updates;
}

export class FfcAdp {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://fantasyfootballcalculator.com/api/v1/adp') {
    this.baseUrl = baseUrl.endsWith('/adp') ? baseUrl : `${baseUrl}/adp`;
  }

  /**
   * Load ADP data from FFC API
   */
  async load(options: FfcAdpOptions): Promise<Array<{ id: string } & Partial<Player>>> {
    const { year, teams, scoring } = options;
    // Remove the /adp from the base URL if it's already included
    const basePath = this.baseUrl.endsWith('/adp') 
      ? this.baseUrl.slice(0, -4) 
      : this.baseUrl;
    const url = `${basePath}/${scoring}?year=${year}&teams=${teams}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`FFC API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data.players)) {
        throw new Error('Invalid response format from FFC API');
      }
      
      // Players will be passed from the store
      const players: Player[] = [];
      
      // Map the ADP data to player updates
      return mapAdpToPlayers(
        players,
        data.players,
        `FFC-${scoring}-${year}-${teams}teams`
      );
    } catch (error) {
      console.error('Failed to load FFC ADP data:', error);
      throw error;
    }
  }
}

export default FfcAdp;
