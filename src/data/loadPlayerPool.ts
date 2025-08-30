import type { Player, Position } from "@/types/draft";
import pool from "./player-pool-2025.json" assert { type: 'json' };

type Raw = {
  id: string;
  season: number;
  source: string;
  rank?: number;
  name: string;
  pos: Position;
  nflTeam?: string;
};

type PlayerWithOptionalTeam = Omit<Player, 'nflTeam' | 'draftedBy' | 'price'> & {
  nflTeam?: string;
  draftedBy?: undefined;
  price?: undefined;
  meta: {
    rank: number | undefined;
    season: number;
    source: string;
  };
};

export function loadPlayerPool(): PlayerWithOptionalTeam[] {
  return (pool as unknown as Raw[]).map(r => ({
    id: r.id,
    name: r.name,
    pos: r.pos,
    ...(r.nflTeam && { nflTeam: r.nflTeam }),
    meta: { 
      rank: r.rank, 
      season: r.season, 
      source: r.source 
    }
  }));
}
