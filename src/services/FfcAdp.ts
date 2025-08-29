import { normalizeTeamName, logTeamNameMiss } from '../config/teamAliases';

export interface FfcAdpOptions {
  year: number;
  teams: number;
  scoring: 'standard' | 'ppr' | 'half';
  useCache?: boolean;
}

interface FfcPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  minPick: number;
  maxPick: number;
  averagePick: number;
  percentDrafted: number;
}

const CACHE_KEY_PREFIX = 'ffc_adp_cache_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

class FfcAdp {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use proxy in development, direct URL in production
    this.baseUrl = baseUrl || (import.meta.env.DEV 
      ? '/ffc-api/adp' 
      : 'https://fantasyfootballcalculator.com/api/v1/adp');
  }

  private getCacheKey(options: FfcAdpOptions): string {
    return `${CACHE_KEY_PREFIX}${options.year}_${options.teams}_${options.scoring}`;
  }

  private loadFromCache(key: string): FfcPlayer[] | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { timestamp, data } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < CACHE_DURATION_MS) {
        return data;
      }
      
      // Clear expired cache
      localStorage.removeItem(key);
      return null;
    } catch (error) {
      console.warn('Failed to load from cache:', error);
      return null;
    }
  }

  private saveToCache(key: string, data: FfcPlayer[]): void {
    try {
      const cacheItem = {
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }

  async load(options: FfcAdpOptions): Promise<Array<{ id: string } & Partial<FfcPlayer>>> {
    const { year, teams, scoring, useCache = true } = options;
    const cacheKey = this.getCacheKey(options);
    
    // Try to load from cache if enabled
    if (useCache) {
      const cachedData = this.loadFromCache(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    const url = `${this.baseUrl}/${scoring}?year=${year}&teams=${teams}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ADP data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('Invalid ADP data format');
      }
      
      const players = data.players.map((player: any) => {
        // Normalize team names for D/ST players
        let team = player.team;
        if (player.position === 'DST') {
          const normalizedTeam = normalizeTeamName(team);
          if (normalizedTeam !== team) {
            logTeamNameMiss(team, normalizedTeam);
          }
          team = normalizedTeam;
        }

        return {
          id: player.id,
          name: player.name,
          position: player.position,
          team,
          adp: player.adp,
          minPick: player.minPick,
          maxPick: player.maxPick,
          averagePick: player.averagePick,
          percentDrafted: player.percentDrafted,
        };
      });

      // Save to cache if enabled
      if (useCache) {
        this.saveToCache(cacheKey, players);
      }

      return players;
    } catch (error) {
      console.error('Error loading ADP data:', error);
      
      // If network error but we have cached data, return that
      if (useCache) {
        const cachedData = this.loadFromCache(cacheKey);
        if (cachedData) {
          console.warn('Using cached ADP data due to network error');
          return cachedData;
        }
      }
      
      throw error;
    }
  }

  // Clear all cached ADP data
  clearCache(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}

export type { FfcPlayer };

export default FfcAdp;
