export const positionColorVar: Record<string, string> = {
  QB: "var(--pos-qb)",
  RB: "var(--pos-rb)",
  WR: "var(--pos-wr)",
  TE: "var(--pos-te)",
  FLEX: "var(--pos-flex)",
  K: "var(--pos-k)",
  DST: "var(--pos-dst)",
  BENCH: "var(--pos-bench)",
};

export const positionColorHex: Record<string, string> = {
  QB: "#60A5FA",   /* sky */
  RB: "#34D399",   /* emerald */
  WR: "#A78BFA",   /* violet */
  TE: "#FBBF24",   /* amber */
  FLEX: "#22D3EE", /* cyan */
  K: "#FB7185",    /* rose */
  DST: "#F97316",  /* orange */
  BENCH: "#94A3B8",/* slate */
};

export const getPositionColor = (position: string): string => {
  const color = positionColorVar[position];
  return color ?? positionColorVar.BENCH;
};

export const getPositionGlow = (position: string, alpha: number = 0.18): string => {
  const hex = positionColorHex[position] ?? positionColorHex.BENCH;
  if (!hex) return `rgba(148, 163, 184, ${alpha})`; // fallback slate color
  // Convert hex to rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
