export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

/**
 * Converts any position string to the internal position format.
 * @param position - The position string to convert (case insensitive)
 * @returns The canonical position string
 */
export const toInternalPos = (position: string): Position => {
  const normalized = position.toUpperCase().replace('D/ST', 'DEF').replace('DST', 'DEF');
  
  // Validate the position is one of our allowed values
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized)) {
    return normalized as Position;
  }
  
  throw new Error(`Invalid position: ${position}`);
};

/**
 * Converts an internal position to a display-friendly format
 * @param position - The internal position
 * @returns The display-friendly position string
 */
export const toDisplayPos = (position: Position): string => {
  return position === 'DEF' ? 'D/ST' : position;
};
