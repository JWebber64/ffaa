const FLEX_ELIGIBLE_POSITIONS = new Set(["RB", "WR", "TE"]);

export function matchesPositionFilter(playerPosition: unknown, filter: string) {
  const normalizedPosition = String(playerPosition ?? "").trim().toUpperCase();
  const normalizedFilter = filter.trim().toUpperCase();

  if (normalizedFilter === "ALL") return true;
  if (normalizedFilter === "FLEX") return FLEX_ELIGIBLE_POSITIONS.has(normalizedPosition);
  if (normalizedFilter === "DEF") return normalizedPosition === "DEF" || normalizedPosition === "DST";

  return normalizedPosition === normalizedFilter;
}
