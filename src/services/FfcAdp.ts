type FfcScoring = 'ppr' | 'half' | 'standard';

interface FfcAdpOptions {
  year: number;
  teams: number;
  scoring: FfcScoring;
  useCache?: boolean;
  ttlMs?: number; // default 12h
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

function normTeam(t?: string) { return (t ?? '').toUpperCase(); }

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
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`FFC ADP fetch failed: ${res.status} ${res.statusText}`);
    const json = await res.json();
    const rows = (json.players ?? json) as any[];

    const data: FfcPlayer[] = rows.map(p => ({
      name: String(p.name ?? ''),
      position: normPos(String(p.position ?? '')),
      team: normTeam(p.team),
      adp: Number(p.adp ?? Number.POSITIVE_INFINITY),
      rank: Number(p.rank ?? p.overall_rank ?? Number.POSITIVE_INFINITY),
      posRank: p.pos_rank != null ? Number(p.pos_rank) : undefined,
    }));

    if (useCache) localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
    return data;
  }
}

// Export all types and the class
export type { FfcScoring, FfcAdpOptions, FfcPlayer };
export default FfcAdp;
