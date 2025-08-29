// Map of team name variations to standard team abbreviations
export const TEAM_ALIASES: Record<string, string> = {
  // Standard team abbreviations
  'ARI': 'ARI', 'ARZ': 'ARI', 'Arizona': 'ARI', 'Cardinals': 'ARI',
  'ATL': 'ATL', 'Atlanta': 'ATL', 'Falcons': 'ATL',
  'BAL': 'BAL', 'Baltimore': 'BAL', 'Ravens': 'BAL',
  'BUF': 'BUF', 'Buffalo': 'BUF', 'Bills': 'BUF',
  'CAR': 'CAR', 'Carolina': 'CAR', 'Panthers': 'CAR',
  'CHI': 'CHI', 'Chicago': 'CHI', 'Bears': 'CHI',
  'CIN': 'CIN', 'Cincinnati': 'CIN', 'Bengals': 'CIN',
  'CLE': 'CLE', 'Cleveland': 'CLE', 'Browns': 'CLE',
  'DAL': 'DAL', 'Dallas': 'DAL', 'Cowboys': 'DAL',
  'DEN': 'DEN', 'Denver': 'DEN', 'Broncos': 'DEN',
  'DET': 'DET', 'Detroit': 'DET', 'Lions': 'DET',
  'GB': 'GB', 'GNB': 'GB', 'Green Bay': 'GB', 'Packers': 'GB',
  'HOU': 'HOU', 'Houston': 'HOU', 'Texans': 'HOU',
  'IND': 'IND', 'Indianapolis': 'IND', 'Colts': 'IND',
  'JAX': 'JAX', 'JAC': 'JAX', 'Jacksonville': 'JAX', 'Jaguars': 'JAX',
  'KC': 'KC', 'KAN': 'KC', 'Kansas City': 'KC', 'Chiefs': 'KC',
  'LAC': 'LAC', 'L.A. Chargers': 'LAC', 'LA Chargers': 'LAC', 'Los Angeles Chargers': 'LAC', 'Chargers': 'LAC',
  'LAR': 'LAR', 'LA': 'LAR', 'L.A. Rams': 'LAR', 'LA Rams': 'LAR', 'Los Angeles Rams': 'LAR', 'Rams': 'LAR',
  'LV': 'LV', 'LVR': 'LV', 'OAK': 'LV', 'Las Vegas': 'LV', 'Oakland': 'LV', 'Raiders': 'LV',
  'MIA': 'MIA', 'Miami': 'MIA', 'Dolphins': 'MIA',
  'MIN': 'MIN', 'Minnesota': 'MIN', 'Vikings': 'MIN',
  'NE': 'NE', 'NWE': 'NE', 'New England': 'NE', 'Patriots': 'NE',
  'NO': 'NO', 'NOR': 'NO', 'New Orleans': 'NO', 'Saints': 'NO',
  'NYG': 'NYG', 'New York Giants': 'NYG', 'Giants': 'NYG',
  'NYJ': 'NYJ', 'New York Jets': 'NYJ', 'Jets': 'NYJ',
  'PHI': 'PHI', 'Philadelphia': 'PHI', 'Eagles': 'PHI',
  'PIT': 'PIT', 'Pittsburgh': 'PIT', 'Steelers': 'PIT',
  'SF': 'SF', 'SFO': 'SF', 'San Francisco': 'SF', '49ers': 'SF',
  'SEA': 'SEA', 'Seattle': 'SEA', 'Seahawks': 'SEA',
  'TB': 'TB', 'TAM': 'TB', 'Tampa Bay': 'TB', 'Buccaneers': 'TB',
  'TEN': 'TEN', 'Tennessee': 'TEN', 'Titans': 'TEN',
  'WAS': 'WAS', 'WSH': 'WAS', 'Washington': 'WAS', 'Commanders': 'WAS', 'Football Team': 'WAS',

  // Common DEF name variations
  'Cardinals DEF': 'ARI', 'Arizona DEF': 'ARI', 'ARI DEF': 'ARI',
  'Falcons DEF': 'ATL', 'Atlanta DEF': 'ATL', 'ATL DEF': 'ATL',
  // ... add more DEF variations as needed
};

/**
 * Normalize a team name to its standard abbreviation
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return '';
  
  // Try exact match first
  const exactMatch = TEAM_ALIASES[teamName];
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match
  const upperTeam = teamName.toUpperCase();
  for (const [key, value] of Object.entries(TEAM_ALIASES)) {
    if (key.toUpperCase() === upperTeam) {
      return value;
    }
  }
  
  // Try partial match for DEF
  if (teamName.includes('DEF')) {
    const teamPart = teamName.split('DEF')[0].trim();
    return TEAM_ALIASES[teamPart] || teamName;
  }
  
  return teamName;
}

/**
 * Log when a team name is normalized to help identify missing aliases
 * @param original The original team name that needed normalization
 * @param normalized The normalized team name
 */
export function logTeamNameMiss(original: string, normalized: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Team name normalization: "${original}" -> "${normalized}"`);
  }
  // In production, you might want to send this to an analytics service
  // analytics.track('team_name_normalization', { original, normalized });
}
