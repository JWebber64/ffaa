import type { DraftState, Player, Position } from '../types/draft';

type BidDisabledReasonParams = {
  state: DraftState;
  computeMaxBid: (teamId: number, playerPos?: Position) => number;
  hasSlotFor: (teamId: number, pos: Position, includeTeInFlex?: boolean) => boolean;
  teamId: number;
};

export function bidDisabledReason({ state, computeMaxBid, hasSlotFor, teamId }: BidDisabledReasonParams): string | null {
  if (!state.bidState.isLive || !state.bidState.playerId) return 'No live auction.';
  const player = state.players.find((p: Player) => p.id === state.bidState.playerId);
  const playerPos = player?.pos;
  const max = computeMaxBid(teamId, playerPos);
  if (max <= state.bidState.highBid) return 'Your max bid is not high enough.';
  if (!hasSlotFor(teamId, playerPos || 'BENCH')) return 'No valid roster slot for this player.';
  return null;
}
