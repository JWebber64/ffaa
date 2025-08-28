import type { Player } from '../store/draftStore';

export const FALLBACK_PLAYERS: Player[] = [
  { id: 'QB-001', name: 'Josh Allen', pos: 'QB', nflTeam: 'BUF' },
  { id: 'QB-002', name: 'Patrick Mahomes', pos: 'QB', nflTeam: 'KC' },
  { id: 'RB-001', name: 'Christian McCaffrey', pos: 'RB', nflTeam: 'SF' },
  { id: 'WR-001', name: 'Justin Jefferson', pos: 'WR', nflTeam: 'MIN' },
  { id: 'WR-002', name: 'Ja\'Marr Chase', pos: 'WR', nflTeam: 'CIN' },
  { id: 'TE-001', name: 'Travis Kelce', pos: 'TE', nflTeam: 'KC' },
  { id: 'K-001',  name: 'Justin Tucker', pos: 'K',  nflTeam: 'BAL' },
  { id: 'DEF-001', name: '49ers D/ST', pos: 'DEF', nflTeam: 'SF' },
];
