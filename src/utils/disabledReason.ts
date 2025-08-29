import type { DraftState } from '../store/draftStore';
import type { Player } from '../store/draftStore';

export function bidDisabledReason(s: DraftState, teamId: number): string | null {
  if (!s.bidState.isLive || !s.bidState.playerId) return 'No live auction.';
  const player = s.players.find((p: Player) => p.id === s.bidState.playerId);
  const playerPos = player?.pos;
  const max = s.computeMaxBid(teamId, playerPos);
  if (max <= s.bidState.highBid) return 'Your max bid is not high enough.';
  if (!s.hasSlotFor(teamId, playerPos || 'BENCH')) return 'No valid roster slot for this player.';
  return null;
}
