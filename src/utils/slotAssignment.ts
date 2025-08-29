import type { Position, Player, Team, DraftState } from '../types/draft';

export function getOpenSlotsForTeamAndPlayer(
  state: DraftState,
  teamId: number,
  playerId: string
): Position[] {
  const team = state.teams.find(t => t.id === teamId);
  const player = state.players.find(p => p.id === playerId);
  
  if (!team || !player) return [];
  
  const openSlots: Position[] = [];
  const pos = player.pos;
  
  // Check primary position slot
  if (team.roster[pos] > 0) {
    openSlots.push(pos);
  }
  
  // Check FLEX if player is RB, WR, or TE
  if ((pos === 'RB' || pos === 'WR' || pos === 'TE') && team.roster.FLEX > 0) {
    openSlots.push('FLEX');
  }
  
  // Check BENCH if no other slots are available
  if (openSlots.length === 0 && team.roster.BENCH > 0) {
    openSlots.push('BENCH');
  }
  
  return openSlots;
}

export function assignPlayerToSlot(
  state: DraftState,
  playerId: string,
  teamId: number,
  price: number,
  slot?: Position
): void {
  const player = state.players.find(p => p.id === playerId);
  const team = state.teams.find(t => t.id === teamId);
  
  if (!player || !team) return;
  
  // If slot is not provided, find the first available slot
  if (!slot) {
    const slots = getOpenSlotsForTeamAndPlayer(state, teamId, playerId);
    if (slots.length === 0) return; // No available slots
    slot = slots[0];
  }
  
  // Update player
  player.draftedBy = teamId;
  player.price = price;
  player.slot = slot;
  
  // Update team roster
  if (team.roster[slot] > 0) {
    team.roster[slot]--;
  }
  
  // Update team players if not already included
  if (!team.players.includes(playerId)) {
    team.players.push(playerId);
  }
}

export function handlePlayerAssignment(
  state: DraftState,
  playerId: string,
  teamId: number,
  price: number
): void {
  const slots = getOpenSlotsForTeamAndPlayer(state, teamId, playerId);
  
  if (slots.length === 0) return; // No valid slots
  
  if (slots.length === 1) {
    // Auto-assign if only one slot is available
    assignPlayerToSlot(state, playerId, teamId, price, slots[0]);
    
    // Update team budget
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
      team.budget = Math.max(0, team.budget - price);
    }
  } else {
    // Set pending assignment for manual slot selection
    state.pendingAssignment = { teamId, playerId, validSlots: slots };
  }
}
