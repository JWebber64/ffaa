type FfcScoring = 'ppr' | 'half' | 'standard';

interface FfcAdpOptions {
  year: number;
  teams: number;
  scoring: FfcScoring;
  useCache?: boolean;
  ttlMs?: number; // default 12h
  signal?: AbortSignal;
}

interface FfcPlayer {
  name: string;
  position: string; // QB/RB/WR/TE/DST/K
  team?: string;    // e.g., SF
  adp: number;      // Average draft position
  rank: number;     // Overall rank (1-based)
  posRank?: number; // Within-position rank
}

const CACHE_PREFIX = 'ffc_adp:';

function normPos(p: string) {
  const u = p.toUpperCase();
  return (u === 'DST' || u === 'D/ST') ? 'DEF' : u; // internal canonical
}

const TEAM_ALIASES: Record<string, string> = { JAX: 'JAC', LA: 'LAR', WSH: 'WAS', SFO: 'SF', KAN: 'KC' };

function normTeam(t?: string) {
  const team = (t ?? '').toUpperCase();
  return TEAM_ALIASES[team] ?? team;
}

class FfcAdp {
  constructor(private base = 'https://fantasyfootballcalculator.com/api/v1') {}

  private key(o: FfcAdpOptions) { return `${CACHE_PREFIX}${o.scoring}:${o.teams}:${o.year}`; }

  clearCache() {
    Object.keys(localStorage).forEach(k => { if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k); });
  }

  async load(opts: FfcAdpOptions): Promise<FfcPlayer[]> {
    const { year, teams, scoring, useCache = true, ttlMs = 12 * 60 * 60 * 1000 } = opts;
    const key = this.key(opts);

    if (useCache) {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const { t, data } = JSON.parse(cached);
          if (Date.now() - t < ttlMs) return data;
        } catch {}
      }
    }

    const url = `${this.base}/adp/${scoring}?year=${year}&teams=${teams}`;
    const fetchOptions: RequestInit = {
      headers: { accept: 'application/json' }
    };
    
    if (opts.signal) {
      fetchOptions.signal = opts.signal;
    }
    
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error(`FFC ADP fetch failed: ${res.status} ${res.statusText}`);
    const json = await res.json();
    interface FfcApiPlayer {
      name?: string;
      position?: string;
      team?: string;
      adp?: number | string;
      rank?: number | string;
      overall_rank?: number | string;
      pos_rank?: number | string;
    }
    
    const response = json as FfcApiPlayer[] | { players: FfcApiPlayer[] };
    const rows = 'players' in response ? response.players : response;

    const data: FfcPlayer[] = rows.map(p => {
      const posRank = p.pos_rank != null ? Number(p.pos_rank) : 0;
      
      return {
        name: String(p.name ?? ''),
        position: normPos(String(p.position ?? '')),
        team: normTeam(p.team) || '',
        adp: Number(p.adp ?? Number.POSITIVE_INFINITY),
        rank: Number(p.rank ?? p.overall_rank ?? Number.POSITIVE_INFINITY),
        posRank: posRank,
      };
    });

    if (useCache) localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
    return data;
  }
}

// Export all types and the class
export type { FfcScoring, FfcAdpOptions, FfcPlayer };
export default FfcAdp;
