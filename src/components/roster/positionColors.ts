export const positionColorVar: Record<string, string> = {
  QB: "var(--pos-qb)",
  RB: "var(--pos-rb)",
  WR: "var(--pos-wr)",
  TE: "var(--pos-te)",
  FLEX: "var(--pos-flex)",
  K: "var(--pos-k)",
  DST: "var(--pos-dst)",
  BENCH: "var(--pos-bench)",
  IR: "var(--pos-bench)",
  DL: "var(--pos-dst)",
  LB: "var(--pos-rb)",
  DB: "var(--pos-wr)",
  IDP_FLEX: "var(--pos-flex)",
};

export const positionColorRgb: Record<string, string> = {
  QB: "30, 64, 175",     // deep sapphire
  RB: "16, 120, 76",     // emerald
  WR: "91, 33, 182",     // amethyst
  TE: "217, 119, 6",     // amber/gold
  FLEX: "6, 148, 162",   // teal/cyan (muted)
  K: "185, 28, 28",      // ruby
  DST: "71, 85, 105",    // steel/ice
  BENCH: "100, 116, 139", // slate
  IR: "100, 116, 139",   // slate
  DL: "71, 85, 105",     // steel/ice
  LB: "16, 120, 76",     // emerald
  DB: "91, 33, 182",     // amethyst
  IDP_FLEX: "6, 148, 162", // teal/cyan (muted)
};

export const positionColorHex: Record<string, string> = {
  QB: "#1E40AF",   // deep sapphire
  RB: "#10784C",   // emerald
  WR: "#5B21B6",   // amethyst
  TE: "#D97706",   // amber/gold
  FLEX: "#0694A2", // teal/cyan (muted)
  K: "#B91C1C",    // ruby
  DST: "#475569",  // steel/ice
  BENCH: "#64748B",// slate
  IR: "#64748B",   // slate
  DL: "#475569",   // steel/ice
  LB: "#10784C",   // emerald
  DB: "#5B21B6",   // amethyst
  IDP_FLEX: "#0694A2", // teal/cyan (muted)
};

export const getPositionColor = (position: string): string => {
  const color = positionColorVar[position];
  return color || positionColorVar.BENCH || "var(--pos-bench)";
};

export const getPositionRgb = (position: string): string => {
  const rgb = positionColorRgb[position];
  return rgb || positionColorRgb.BENCH || "100, 116, 139";
};

export const getPositionGlow = (position: string, alpha: number = 0.18): string => {
  const hex = positionColorHex[position] || positionColorHex.BENCH;
  if (!hex) return `rgba(148, 163, 184, ${alpha})`; // fallback slate color
  // Convert hex to rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
