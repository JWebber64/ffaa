import { useEffect, useState, useCallback } from 'react';
import type { Player, BasePosition } from '../store/draftStore';
import { FALLBACK_PLAYERS } from '../data/players';

type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  fantasy_positions?: string[];
  active?: boolean;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const LS_KEY = 'sleeper_players_v2';

const POSITION_LIMITS: Record<BasePosition, number> = {
  QB: 50,
  RB: 125,
  WR: 150,
  TE: 50,
  K: 32,
  DEF: 32,
};

function normalizePosition(posRaw?: string): BasePosition | null {
  const p = (posRaw || '').toUpperCase();
  if (p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE') return p as BasePosition;
  if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DEF';
  if (p === 'PK' || p === 'K') return 'K';
  return null;
}

function toPlayer(sp: SleeperPlayer & { search_rank?: number; search_rank_ppr?: number }): (Player & { search_rank?: number; search_rank_ppr?: number }) | null {
  const name = sp.full_name || [sp.first_name, sp.last_name].filter(Boolean).join(' ').trim();
  const pos = normalizePosition(sp.position) || normalizePosition(sp.fantasy_positions?.[0]);
  if (!name || !sp.player_id || !pos) return null;

  return {
    id: sp.player_id,
    name,
    pos,
    nflTeam: sp.team || undefined,
    search_rank: sp.search_rank,
    search_rank_ppr: sp.search_rank_ppr,
  };
}

function rankKey(p: Player & { search_rank?: number; search_rank_ppr?: number }) {
  // Position priority: QB, RB, WR, TE, K, DEF
  const positionOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
  const positionIndex = positionOrder.indexOf(p.pos as (typeof positionOrder)[number]);
  
  // Use search_rank_ppr if available (lower is better), then search_rank, then fallback
  const rank = p.search_rank_ppr ?? p.search_rank ?? 9999;
  
  // Format: positionPriority-rank-playerName
  // This ensures players are sorted by position first, then by rank
  return [
    positionIndex.toString().padStart(2, '0'),
    rank.toString().padStart(5, '0'),
    p.name
  ].join('-');
}

function uniqueById(players: Player[]) {
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const p of players) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function capByPosition(players: Player[]): Player[] {
  const counts: Partial<Record<BasePosition, number>> = {};
  const out: Player[] = [];
  for (const p of players) {
    const pos = p.pos as BasePosition;
    const limit = POSITION_LIMITS[pos] ?? 0;
    const used = counts[pos] ?? 0;
    if (limit === 0 || used < limit) {
      out.push(p);
      counts[pos] = used + 1;
    }
  }
  return out;
}

export function useSleeperPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cachedRaw = localStorage.getItem(LS_KEY);
      if (cachedRaw) {
        const { data, ts } = JSON.parse(cachedRaw) as { data: Player[]; ts: number };
        if (Date.now() - ts < TTL_MS && Array.isArray(data) && data.length > 0) {
          setPlayers(data);
          setLoading(false);
          return;
        }
      }

      const resp = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!resp.ok) throw new Error(`Sleeper ${resp.status}`);
      const raw = (await resp.json()) as Record<string, SleeperPlayer>;

      const mapped: Player[] = Object.values(raw)
        .map(toPlayer)
        .filter((p): p is Player => !!p);

      const ordered = mapped.sort((a, b) => rankKey(a).localeCompare(rankKey(b)));
      const unique = uniqueById(ordered);
      console.log('[useSleeperPlayers] Unique players:', {
        total: unique.length,
        byPosition: unique.reduce((acc, p) => {
          acc[p.pos] = (acc[p.pos] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      const capped = capByPosition(unique);
      console.log('[useSleeperPlayers] Capped players:', {
        total: capped.length,
        byPosition: capped.reduce((acc, p) => {
          acc[p.pos] = (acc[p.pos] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      setPlayers(capped);
      localStorage.setItem(LS_KEY, JSON.stringify({ data: capped, ts: Date.now() }));
    } catch (e) {
      console.warn('[useSleeperPlayers] Falling back to local players.ts', e);
      setPlayers(FALLBACK_PLAYERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { players, loading };
}

export default useSleeperPlayers;
