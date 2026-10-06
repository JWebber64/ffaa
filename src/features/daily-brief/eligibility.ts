export function fills(positions: string[], slot: string, configured?: Record<string, string[]>) {
  if (["BN", "BENCH", "IR", "IR+", "RESERVE", "TAXI"].includes(slot)) return false;
  if (configured?.[slot]) return positions.some(position => configured[slot]!.includes(position));
  if (positions.includes(slot)) return true;
  if (slot === "UTIL") return positions.some(p => ["C", "LW", "RW", "D"].includes(p));
  if (slot === "F") return positions.some(p => ["C", "LW", "RW"].includes(p));
  if (slot === "FLEX") return positions.some(p => ["RB", "WR", "TE"].includes(p));
  return slot === "SUPER_FLEX" && positions.some(p => ["QB", "RB", "WR", "TE"].includes(p));
}
