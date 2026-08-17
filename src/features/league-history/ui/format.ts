export function formatRecord(wins: number, losses: number, ties = 0) {
  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
}

export function formatNumber(value: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function ordinal(value: number | null) {
  if (value == null) return "—";
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}
