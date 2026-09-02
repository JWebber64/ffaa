export const POSITION_COLOR_KEYS = [
  "qb",
  "rb",
  "wr",
  "te",
  "flex",
  "k",
  "dst",
  "bench",
  "ir",
  "dl",
  "lb",
  "db",
  "idpflex",
] as const;

export type PositionColorKey = (typeof POSITION_COLOR_KEYS)[number];

const POSITION_COLOR_ALIASES: Record<string, PositionColorKey> = {
  QB: "qb",
  RB: "rb",
  WR: "wr",
  TE: "te",
  FLEX: "flex",
  WRT: "flex",
  QWRT: "flex",
  RBWRTE: "flex",
  RECFLEX: "flex",
  WRRBFLEX: "flex",
  SUPERFLEX: "flex",
  SFLEX: "flex",
  OP: "flex",
  K: "k",
  PK: "k",
  DEF: "dst",
  DST: "dst",
  BN: "bench",
  BENCH: "bench",
  TAXI: "bench",
  IR: "ir",
  RESERVE: "ir",
  DL: "dl",
  DE: "dl",
  DT: "dl",
  LB: "lb",
  DB: "db",
  CB: "db",
  S: "db",
  IDP: "idpflex",
  IDPFLEX: "idpflex",
};

function normalizedPositionName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\d+$/, "")
    .replace(/[^A-Z]/g, "");
}

export function positionColorKey(value: string | null | undefined): PositionColorKey | undefined {
  return POSITION_COLOR_ALIASES[normalizedPositionName(value)];
}

export function positionColorVar(
  value: string | null | undefined,
  fallback = "var(--pos-bench)",
) {
  const key = positionColorKey(value);
  return key ? `var(--pos-${key})` : fallback;
}

export function positionClassName(value: string | null | undefined) {
  return `pos-${positionColorKey(value) ?? "bench"}`;
}
