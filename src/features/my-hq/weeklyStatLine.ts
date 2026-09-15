import type { ToolPlayer } from "../../data/toolPlayerData";

export type WeeklyScoreStatus = "live" | "final";

function easternDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/**
 * Sleeper's matchup payload exposes current player points but not game state.
 * The weekly stats feed gives us the NFL game date, so prior dates are final;
 * same-day returned scores are the only scores presented as live.
 */
export function weeklyScoreStatus(
  player: Pick<ToolPlayer, "weeklyActualPoints" | "weeklyStatLine"> | null,
  now: Date = new Date(),
): WeeklyScoreStatus | null {
  if (player?.weeklyActualPoints === null || player?.weeklyActualPoints === undefined) return null;
  const gameDate = player.weeklyStatLine?.gameDate?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(gameDate)) return "final";
  return gameDate < easternDateKey(now) ? "final" : "live";
}

function statValue(stats: Record<string, number>, key: string) {
  return Object.prototype.hasOwnProperty.call(stats, key) ? (stats[key] ?? null) : null;
}

function count(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function add(chunks: string[], stats: Record<string, number>, key: string, label: string) {
  const value = statValue(stats, key);
  if (value !== null) chunks.push(`${count(value)} ${label}`);
}

export function weeklyStatLineText(player: { position: string; weeklyStatLine?: ToolPlayer["weeklyStatLine"] } | null) {
  const line = player?.weeklyStatLine;
  if (!line || !Object.keys(line.stats).length) return "Stat line unavailable";
  const stats = line.stats;
  const chunks: string[] = [];
  if (player.position === "QB") {
    const cmp = statValue(stats, "pass_cmp");
    const att = statValue(stats, "pass_att");
    if (cmp !== null && att !== null) chunks.push(`${count(cmp)}/${count(att)} pass`);
    add(chunks, stats, "pass_yd", "pass yds");
    add(chunks, stats, "pass_td", "pass TD");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
  } else if (player.position === "RB") {
    add(chunks, stats, "rush_att", "carries");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
    add(chunks, stats, "rec", "rec");
    add(chunks, stats, "rec_tgt", "targets");
    add(chunks, stats, "rec_yd", "rec yds");
    add(chunks, stats, "rec_td", "rec TD");
  } else if (player.position === "WR" || player.position === "TE") {
    add(chunks, stats, "rec", "rec");
    add(chunks, stats, "rec_tgt", "targets");
    add(chunks, stats, "rec_yd", "rec yds");
    add(chunks, stats, "rec_td", "rec TD");
    add(chunks, stats, "rush_yd", "rush yds");
    add(chunks, stats, "rush_td", "rush TD");
  } else if (player.position === "K") {
    const made = statValue(stats, "fgm");
    const attempts = statValue(stats, "fga");
    if (made !== null && attempts !== null) chunks.push(`${count(made)}/${count(attempts)} FG`);
    add(chunks, stats, "xpm", "XP");
  } else {
    add(chunks, stats, "tkl", "tkl");
    add(chunks, stats, "sack", "sacks");
    add(chunks, stats, "int", "INT");
    add(chunks, stats, "fum_rec", "FR");
    add(chunks, stats, "def_td", "TD");
  }
  return chunks.length ? chunks.join(" · ") : "Stat line unavailable";
}
