/** Competition ranks (1, 2, 2, 4) over the full eligible population. */
export function buildStatRanks<Row extends { id: string }>(
  rows: Row[],
  valueFor: (row: Row) => number | string | null,
): Map<string, number> {
  const values = rows.flatMap((row) => {
    const value = valueFor(row);
    return typeof value === "number" && Number.isFinite(value) ? [{ id: row.id, value }] : [];
  }).sort((left, right) => right.value - left.value);
  const ranks = new Map<string, number>();
  let rank = 0;
  values.forEach(({ id, value }, index) => {
    if (index === 0 || value !== values[index - 1]?.value) rank = index + 1;
    ranks.set(id, rank);
  });
  return ranks;
}
