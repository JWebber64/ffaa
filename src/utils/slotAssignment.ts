// Define Position type to match the one in draftStore.ts
type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'BENCH';

// Define interfaces for the parts of DraftState we need
interface Player {
  id: string;
  pos: Position;
  draftedBy?: number;
  price?: number;
  slot?: string;
}

interface Team {
  id: number;
  roster: Record<Position, number>;
  players: string[];
  budget: number;
}

interface DraftState {
  players: Player[];
  teams: Team[];
  pendingAssignment: {
    teamId: number;
    playerId: string;
    validSlots: string[];
  } | null;
}


export function getOpenSlotsForTeamAndPlayer(state: DraftState, teamId: number, playerId: string): string[] {
  const team = state.teams.find(t => t.id === teamId);
  const player = state.players.find(p => p.id === playerId);
  
  if (!team || !player) return [];
  
  const openSlots: string[] = [];
  const pos = player.pos;
  
  // Check primary position slot
  if (team.roster[pos as keyof typeof team.roster] > 0) {
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
  slot?: string
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
  if (team.roster[slot as keyof typeof team.roster] > 0) {
    team.roster[slot as keyof typeof team.roster]--;
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
