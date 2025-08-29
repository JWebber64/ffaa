import { Position } from '../store/draftStore';

/**
 * Converts internal position format to display format
 * @param pos The position to format
 * @returns Formatted position for display
 */
export function formatPositionForDisplay(pos: Position): string {
  return pos === 'DEF' ? 'D/ST' : pos;
}

/**
 * Gets the display name for a position
 * @param pos The position to get the display name for
 * @returns The display name of the position
 */
export function getPositionDisplayName(pos: Position): string {
  const displayNames: Record<Position, string> = {
    QB: 'Quarterback',
    RB: 'Running Back',
    WR: 'Wide Receiver',
    TE: 'Tight End',
    K: 'Kicker',
    DEF: 'Defense',
    FLEX: 'Flex',
    BENCH: 'Bench'
  };
  
  return displayNames[pos] || pos;
}
